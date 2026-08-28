import { useEffect, useMemo, useRef, useState } from 'react';
import { DrumKitFeedback } from './components/DrumKitFeedback';
import { MidiMonitor } from './components/MidiMonitor';
import { PracticeTimeline } from './components/PracticeTimeline';
import { ScoreViewer } from './components/ScoreViewer';
import type { Chart, PracticeLoop } from './domain/chart';
import type { DrumHit, DrumInstrument } from './midi/midi';
import { parseMusicXml } from './musicxml/parseMusicXml';
import { readMusicXmlFile } from './musicxml/readMusicXmlFile';

const SPEED_OPTIONS = [50, 60, 75, 90, 100];
type AudioStatus = 'idle' | AudioContextState | 'unsupported' | 'error';
type FeedbackKind = 'perfect' | 'good' | 'early' | 'late' | 'wrong';
type Feedback = { kind: FeedbackKind; label: string; detail: string; id: number };
type KitSignal = { played: DrumInstrument; expected: DrumInstrument | null; wrong: boolean; id: number };
type SafariAudioNavigator = Navigator & { audioSession?: { type: string } };
type SafariAudioWindow = Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext };

export function App() {
  const [xml, setXml] = useState<string | null>(null); const [chart, setChart] = useState<Chart | null>(null); const [loop, setLoop] = useState<PracticeLoop | null>(null);
  const [currentBeat, setCurrentBeat] = useState(0); const [playing, setPlaying] = useState(false); const [error, setError] = useState<string | null>(null); const [loadingDemo, setLoadingDemo] = useState(false);
  const [speedPercent, setSpeedPercent] = useState(100); const [metronomeEnabled, setMetronomeEnabled] = useState(false); const [replayEnabled, setReplayEnabled] = useState(false); const [audioStatus, setAudioStatus] = useState<AudioStatus>('idle');
  const [feedback, setFeedback] = useState<Feedback | null>(null); const [kitSignal, setKitSignal] = useState<KitSignal | null>(null); const [hits, setHits] = useState({ perfect: 0, good: 0, earlyLate: 0, wrong: 0 });
  const startedAtRef = useRef<number | null>(null); const audioContextRef = useRef<AudioContext | null>(null); const matchedHitsRef = useRef(new Set<string>()); const feedbackIdRef = useRef(0);
  const effectiveBpm = useMemo(() => (chart ? chart.bpm * (speedPercent / 100) : 120), [chart, speedPercent]); const beatDurationMs = useMemo(() => 60_000 / effectiveBpm, [effectiveBpm]); const beatInMeasure = chart ? Math.floor(currentBeat) % chart.beatsPerMeasure : 0;

  function resetPerformance() { matchedHitsRef.current.clear(); setHits({ perfect: 0, good: 0, earlyLate: 0, wrong: 0 }); setFeedback(null); setKitSignal(null); }
  function loadXml(content: string) { const nextChart = parseMusicXml(content); setXml(content); setChart(nextChart); setCurrentBeat(0); setLoop(null); setPlaying(false); setError(null); resetPerformance(); }
  async function importScore(file: File) { try { loadXml(await readMusicXmlFile(file)); } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not import MusicXML.'); } }
  async function loadDemo() { setLoadingDemo(true); try { const response = await fetch(`${import.meta.env.BASE_URL}demo-groove.musicxml`); if (!response.ok) throw new Error('Could not load the demo groove.'); loadXml(await response.text()); } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not load demo.'); } finally { setLoadingDemo(false); } }

  async function ensureAudioContext() { try { const safariNavigator = navigator as SafariAudioNavigator; if (safariNavigator.audioSession) safariNavigator.audioSession.type = 'playback'; if (!audioContextRef.current) { const safariWindow = window as SafariAudioWindow; const AudioContextClass = window.AudioContext ?? safariWindow.webkitAudioContext; if (!AudioContextClass) { setAudioStatus('unsupported'); throw new Error('Web Audio is not supported in this browser.'); } const context = new AudioContextClass(); context.onstatechange = () => setAudioStatus(context.state); audioContextRef.current = context; } const context = audioContextRef.current; if (context.state !== 'running') await context.resume(); setAudioStatus(context.state); return context; } catch (reason) { setAudioStatus('error'); throw reason; } }
  function scheduleMetronomeClick(context: AudioContext, time: number, accent: boolean) { const oscillator = context.createOscillator(); const gain = context.createGain(); oscillator.type = 'square'; oscillator.frequency.setValueAtTime(accent ? 1700 : 1050, time); gain.gain.setValueAtTime(accent ? 0.5 : 0.3, time); gain.gain.exponentialRampToValueAtTime(0.001, time + 0.075); oscillator.connect(gain); gain.connect(context.destination); oscillator.start(time); oscillator.stop(time + 0.08); }

  function handleDrumHit(hit: DrumHit) {
    feedbackIdRef.current += 1;
    const signalId = feedbackIdRef.current;

    if (!playing || !chart || startedAtRef.current === null) {
      setKitSignal({ played: hit.instrument, expected: null, wrong: false, id: signalId });
      return;
    }

    const actualBeat = (performance.now() - startedAtRef.current) / beatDurationMs;
    const candidates = chart.expectedHits
      .filter((expected) => !matchedHitsRef.current.has(expected.id) && Math.abs(expected.beat - actualBeat) <= 0.45)
      .sort((a, b) => Math.abs(a.beat - actualBeat) - Math.abs(b.beat - actualBeat));

    const nearest = candidates[0];
    const sameInstrument = candidates.filter((expected) => expected.instrument !== 'Unknown' && expected.instrument === hit.instrument);
    const sameNote = candidates.filter((expected) => expected.midiNote !== null && expected.midiNote === hit.note);
    const target = (sameInstrument.length ? sameInstrument : sameNote)[0];
    const expectedInstrument = nearest?.instrument !== 'Unknown' ? nearest?.instrument ?? null : null;

    if (!target) {
      setKitSignal({ played: hit.instrument, expected: expectedInstrument, wrong: true, id: signalId });
      setFeedback({ kind: 'wrong', label: 'WRONG', detail: expectedInstrument ? `${hit.instrument} → ${expectedInstrument}` : `${hit.instrument} · note ${hit.note}`, id: signalId });
      setHits((value) => ({ ...value, wrong: value.wrong + 1 }));
      return;
    }

    matchedHitsRef.current.add(target.id);
    const deltaMs = (actualBeat - target.beat) * beatDurationMs; const abs = Math.abs(deltaMs);
    setKitSignal({ played: hit.instrument, expected: target.instrument !== 'Unknown' ? target.instrument : hit.instrument, wrong: false, id: signalId });
    let kind: FeedbackKind; let label: string;
    if (abs <= 55) { kind = 'perfect'; label = 'PERFECT'; setHits((value) => ({ ...value, perfect: value.perfect + 1 })); }
    else if (abs <= 110) { kind = 'good'; label = 'GOOD'; setHits((value) => ({ ...value, good: value.good + 1 })); }
    else { kind = deltaMs < 0 ? 'early' : 'late'; label = deltaMs < 0 ? 'EARLY' : 'LATE'; setHits((value) => ({ ...value, earlyLate: value.earlyLate + 1 })); }
    setFeedback({ kind, label, detail: `${target.instrument} · ${Math.round(Math.abs(deltaMs))}ms`, id: signalId });
  }

  function seekToBeat(beat: number) {
    if (!chart) return;
    const nextBeat = Math.min(Math.max(beat, 0), chart.totalBeats);
    setCurrentBeat(nextBeat); startedAtRef.current = performance.now() - nextBeat * beatDurationMs; matchedHitsRef.current.clear(); setFeedback(null); setKitSignal(null);
  }

  async function togglePlaying() { if (!chart) return; if (!playing) { if (!loop && currentBeat >= chart.totalBeats - 0.001) { setCurrentBeat(0); startedAtRef.current = null; resetPerformance(); } if (metronomeEnabled) { try { await ensureAudioContext(); } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not start audio.'); } } } setPlaying((value) => !value); }
  async function toggleMetronome() { if (!metronomeEnabled) { try { const context = await ensureAudioContext(); scheduleMetronomeClick(context, context.currentTime, true); setMetronomeEnabled(true); } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not start audio.'); } return; } setMetronomeEnabled(false); }
  function selectMeasure(measure: number) { setLoop((current) => { if (!current || current.startMeasure !== current.endMeasure) return { startMeasure: measure, endMeasure: measure }; return { startMeasure: Math.min(current.startMeasure, measure), endMeasure: Math.max(current.startMeasure, measure) }; }); }

  useEffect(() => { if (!playing || !chart) return; let frame = 0; startedAtRef.current = performance.now() - currentBeat * beatDurationMs; const tick = (now: number) => { const startedAt = startedAtRef.current ?? now; let beat = (now - startedAt) / beatDurationMs; if (loop) { const startBeat = (loop.startMeasure - 1) * chart.beatsPerMeasure; const endBeat = loop.endMeasure * chart.beatsPerMeasure; const loopLength = endBeat - startBeat; if (beat >= endBeat && loopLength > 0) { beat = startBeat + ((beat - startBeat) % loopLength); startedAtRef.current = now - beat * beatDurationMs; matchedHitsRef.current.clear(); } } else if (beat >= chart.totalBeats) { if (replayEnabled && chart.totalBeats > 0) { beat %= chart.totalBeats; startedAtRef.current = now - beat * beatDurationMs; matchedHitsRef.current.clear(); } else { beat = chart.totalBeats; setPlaying(false); } } setCurrentBeat(beat); frame = requestAnimationFrame(tick); }; frame = requestAnimationFrame(tick); return () => cancelAnimationFrame(frame); }, [playing, chart, loop, replayEnabled, beatDurationMs]);
  useEffect(() => { if (!playing || !metronomeEnabled || !chart) return; const context = audioContextRef.current; if (!context || context.state !== 'running') return; const beatDurationSeconds = 60 / effectiveBpm; const currentWholeBeat = Math.ceil(currentBeat - 0.0001); let nextBeat = currentWholeBeat; let nextClickAt = context.currentTime + Math.max(Math.max(currentWholeBeat - currentBeat, 0) * beatDurationSeconds, 0.03); const scheduler = window.setInterval(() => { if (context.state !== 'running') return; while (nextClickAt < context.currentTime + 0.12) { scheduleMetronomeClick(context, nextClickAt, nextBeat % chart.beatsPerMeasure === 0); nextBeat += 1; nextClickAt += beatDurationSeconds; } }, 25); return () => window.clearInterval(scheduler); }, [playing, metronomeEnabled, chart, effectiveBpm]);
  useEffect(() => { const resumeAudio = () => { const context = audioContextRef.current; if (metronomeEnabled && context && context.state !== 'running') void context.resume().then(() => setAudioStatus(context.state)); }; document.addEventListener('visibilitychange', resumeAudio); window.addEventListener('pageshow', resumeAudio); return () => { document.removeEventListener('visibilitychange', resumeAudio); window.removeEventListener('pageshow', resumeAudio); }; }, [metronomeEnabled]);
  useEffect(() => { if (!feedback) return; const timeout = window.setTimeout(() => setFeedback(null), 650); return () => window.clearTimeout(timeout); }, [feedback]);
  useEffect(() => { if (!kitSignal) return; const id = kitSignal.id; const timeout = window.setTimeout(() => setKitSignal((value) => value?.id === id ? null : value), 650); return () => window.clearTimeout(timeout); }, [kitSignal]);

  const judgedHits = hits.perfect + hits.good + hits.earlyLate + hits.wrong; const accuracy = judgedHits ? Math.round(((hits.perfect + hits.good) / judgedHits) * 100) : 0;
  return <main className="shell">
    <nav className="topbar"><div className="brand"><span className="brand-mark">D</span><div><strong>INDTEC DRUMS</strong><span>LABZ</span></div></div><MidiMonitor onHit={handleDrumHit} /></nav>
    <header className="session-header"><div><span className="eyebrow">PRACTICE SESSION</span><h1>{chart?.title ?? 'Pick something to play'}</h1><p>{chart ? `${chart.measures.length} measures · ${chart.beatsPerMeasure}/${chart.beatType} · original ${chart.bpm} BPM · ${chart.expectedHits.length} hits` : 'Load a score and turn notation into a playable practice lane.'}</p></div><div className="hero-actions"><button className="demo-button" type="button" disabled={loadingDemo} onClick={() => void loadDemo()}>{loadingDemo ? 'Loading…' : 'Load demo'}</button><label className="import-button">Import score<input type="file" accept=".xml,.musicxml,.mxl,application/vnd.recordare.musicxml+xml,application/vnd.recordare.musicxml" onChange={(event) => { const file = event.target.files?.[0]; if (file) void importScore(file); }} /></label></div></header>
    {error && <div className="error">{error}</div>}
    <section className={`practice-stage ${playing ? 'is-playing' : ''} ${feedback ? `feedback-${feedback.kind}` : ''}`} style={{ '--beat-duration': `${beatDurationMs}ms` } as React.CSSProperties}>
      <div className="stage-glow" key={`${Math.floor(currentBeat)}-${playing}`} /><div className="stage-topline"><div className="tempo-readout"><span>TEMPO</span><strong>{chart ? Math.round(effectiveBpm) : '—'}</strong><small>BPM</small></div><div className="beat-dots">{Array.from({ length: chart?.beatsPerMeasure ?? 4 }, (_, index) => <i key={index} className={chart && index === beatInMeasure ? 'active' : ''} />)}</div><div className="loop-readout"><span>LOOP</span><strong>{loop ? `${loop.startMeasure}—${loop.endMeasure}` : replayEnabled ? 'Replay chart' : 'Full chart'}</strong></div></div>
      <div className="score-stage"><ScoreViewer xml={xml} currentBeat={currentBeat} totalBeats={chart?.totalBeats ?? 0} beatsPerMeasure={chart?.beatsPerMeasure ?? 4} playing={playing} onSeek={seekToBeat} />{feedback && <div key={feedback.id} className={`hit-feedback ${feedback.kind}`}><strong>{feedback.label}</strong><span>{feedback.detail}</span></div>}</div>
      <DrumKitFeedback played={kitSignal?.played ?? null} expected={kitSignal?.expected ?? null} wrong={kitSignal?.wrong ?? false} />
      <div className="stage-status"><span className={playing ? 'live-dot active' : 'live-dot'} />{playing ? 'LISTENING TO YOUR KIT' : chart ? 'READY' : 'LOAD A SCORE'}</div>
    </section>
    <section className="control-deck"><div className="transport-main"><button className="restart-button" type="button" disabled={!chart} onClick={() => { setPlaying(false); setCurrentBeat(0); resetPerformance(); }}>↺</button><button className="play-button" type="button" disabled={!chart} onClick={() => void togglePlaying()}>{playing ? 'Ⅱ' : '▶'}<span>{playing ? 'Pause' : 'Play'}</span></button><button className={`metro-button ${metronomeEnabled ? 'active' : ''}`} type="button" onClick={() => void toggleMetronome()}><span>♩</span><div><small>METRONOME</small><strong>{metronomeEnabled ? 'ON' : 'OFF'}</strong></div></button><button className={`replay-button ${replayEnabled ? 'active' : ''}`} type="button" onClick={() => setReplayEnabled((value) => !value)}><span>↻</span><div><small>REPLAY</small><strong>{replayEnabled ? 'ON' : 'OFF'}</strong></div></button></div><div className="speed-strip"><span>PRACTICE SPEED</span><div>{SPEED_OPTIONS.map((speed) => <button key={speed} type="button" className={speedPercent === speed ? 'active' : ''} onClick={() => setSpeedPercent(speed)}>{speed}%</button>)}</div></div><div className="audio-state">Audio {audioStatus}</div></section>
    {judgedHits > 0 && <section className="performance-strip"><div><span>ACCURACY</span><strong>{accuracy}%</strong></div><div><span>PERFECT</span><strong>{hits.perfect}</strong></div><div><span>GOOD</span><strong>{hits.good}</strong></div><div><span>EARLY / LATE</span><strong>{hits.earlyLate}</strong></div><div><span>WRONG</span><strong>{hits.wrong}</strong></div></section>}
    <section className="timeline-section"><div className="timeline-title"><span>ARRANGEMENT</span><button type="button" disabled={!loop} onClick={() => setLoop(null)}>Clear loop</button></div><PracticeTimeline chart={chart} currentBeat={currentBeat} loop={loop} onSelectMeasure={selectMeasure} /></section>
  </main>;
}
