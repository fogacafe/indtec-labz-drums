import { useEffect, useMemo, useRef, useState } from 'react';
import { MidiMonitor } from './components/MidiMonitor';
import { PracticeTimeline } from './components/PracticeTimeline';
import { ScoreViewer } from './components/ScoreViewer';
import type { Chart, PracticeLoop } from './domain/chart';
import { parseMusicXml } from './musicxml/parseMusicXml';

const SPEED_OPTIONS = [50, 60, 75, 90, 100];
type AudioStatus = 'idle' | AudioContextState | 'unsupported' | 'error';
type SafariAudioNavigator = Navigator & { audioSession?: { type: string } };
type SafariAudioWindow = Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext };

export function App() {
  const [xml, setXml] = useState<string | null>(null);
  const [chart, setChart] = useState<Chart | null>(null);
  const [loop, setLoop] = useState<PracticeLoop | null>(null);
  const [currentBeat, setCurrentBeat] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingDemo, setLoadingDemo] = useState(false);
  const [speedPercent, setSpeedPercent] = useState(100);
  const [metronomeEnabled, setMetronomeEnabled] = useState(false);
  const [audioStatus, setAudioStatus] = useState<AudioStatus>('idle');
  const startedAtRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  const effectiveBpm = useMemo(() => (chart ? chart.bpm * (speedPercent / 100) : 120), [chart, speedPercent]);
  const beatDurationMs = useMemo(() => 60_000 / effectiveBpm, [effectiveBpm]);
  const beatInMeasure = chart ? Math.floor(currentBeat) % chart.beatsPerMeasure : 0;

  function loadXml(content: string) {
    const nextChart = parseMusicXml(content);
    setXml(content); setChart(nextChart); setCurrentBeat(0); setLoop(null); setPlaying(false); setError(null);
  }

  async function importXml(file: File) {
    try { loadXml(await file.text()); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not import MusicXML.'); }
  }

  async function loadDemo() {
    setLoadingDemo(true);
    try {
      const response = await fetch(`${import.meta.env.BASE_URL}demo-groove.musicxml`);
      if (!response.ok) throw new Error('Could not load the demo groove.');
      loadXml(await response.text());
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not load demo.'); }
    finally { setLoadingDemo(false); }
  }

  async function ensureAudioContext() {
    try {
      const safariNavigator = navigator as SafariAudioNavigator;
      if (safariNavigator.audioSession) safariNavigator.audioSession.type = 'playback';
      if (!audioContextRef.current) {
        const safariWindow = window as SafariAudioWindow;
        const AudioContextClass = window.AudioContext ?? safariWindow.webkitAudioContext;
        if (!AudioContextClass) { setAudioStatus('unsupported'); throw new Error('Web Audio is not supported in this browser.'); }
        const context = new AudioContextClass();
        context.onstatechange = () => setAudioStatus(context.state);
        audioContextRef.current = context;
      }
      const context = audioContextRef.current;
      if (context.state !== 'running') await context.resume();
      setAudioStatus(context.state);
      return context;
    } catch (reason) { setAudioStatus('error'); throw reason; }
  }

  function scheduleMetronomeClick(context: AudioContext, time: number, accent: boolean) {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'square';
    oscillator.frequency.setValueAtTime(accent ? 1700 : 1050, time);
    gain.gain.setValueAtTime(accent ? 0.5 : 0.3, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.075);
    oscillator.connect(gain); gain.connect(context.destination); oscillator.start(time); oscillator.stop(time + 0.08);
  }

  async function togglePlaying() {
    if (!chart) return;
    if (!playing) {
      if (!loop && currentBeat >= chart.totalBeats - 0.001) { setCurrentBeat(0); startedAtRef.current = null; }
      if (metronomeEnabled) {
        try { await ensureAudioContext(); }
        catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not start audio.'); }
      }
    }
    setPlaying((value) => !value);
  }

  async function toggleMetronome() {
    if (!metronomeEnabled) {
      try {
        const context = await ensureAudioContext();
        scheduleMetronomeClick(context, context.currentTime, true);
        setMetronomeEnabled(true);
      } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not start audio.'); }
      return;
    }
    setMetronomeEnabled(false);
  }

  function selectMeasure(measure: number) {
    setLoop((current) => {
      if (!current || current.startMeasure !== current.endMeasure) return { startMeasure: measure, endMeasure: measure };
      return { startMeasure: Math.min(current.startMeasure, measure), endMeasure: Math.max(current.startMeasure, measure) };
    });
  }

  useEffect(() => {
    if (!playing || !chart) return;
    let frame = 0;
    startedAtRef.current = performance.now() - currentBeat * beatDurationMs;
    const tick = (now: number) => {
      const startedAt = startedAtRef.current ?? now;
      let beat = (now - startedAt) / beatDurationMs;
      if (loop) {
        const startBeat = (loop.startMeasure - 1) * chart.beatsPerMeasure;
        const endBeat = loop.endMeasure * chart.beatsPerMeasure;
        const loopLength = endBeat - startBeat;
        if (beat >= endBeat && loopLength > 0) {
          beat = startBeat + ((beat - startBeat) % loopLength);
          startedAtRef.current = now - beat * beatDurationMs;
        }
      } else if (beat >= chart.totalBeats) { beat = chart.totalBeats; setPlaying(false); }
      setCurrentBeat(beat);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, chart, loop, beatDurationMs]);

  useEffect(() => {
    if (!playing || !metronomeEnabled || !chart) return;
    const context = audioContextRef.current;
    if (!context || context.state !== 'running') return;
    const beatDurationSeconds = 60 / effectiveBpm;
    const currentWholeBeat = Math.ceil(currentBeat - 0.0001);
    let nextBeat = currentWholeBeat;
    let nextClickAt = context.currentTime + Math.max(Math.max(currentWholeBeat - currentBeat, 0) * beatDurationSeconds, 0.03);
    const scheduler = window.setInterval(() => {
      if (context.state !== 'running') return;
      while (nextClickAt < context.currentTime + 0.12) {
        scheduleMetronomeClick(context, nextClickAt, nextBeat % chart.beatsPerMeasure === 0);
        nextBeat += 1; nextClickAt += beatDurationSeconds;
      }
    }, 25);
    return () => window.clearInterval(scheduler);
  }, [playing, metronomeEnabled, chart, effectiveBpm]);

  useEffect(() => {
    const resumeAudio = () => {
      const context = audioContextRef.current;
      if (metronomeEnabled && context && context.state !== 'running') void context.resume().then(() => setAudioStatus(context.state));
    };
    document.addEventListener('visibilitychange', resumeAudio); window.addEventListener('pageshow', resumeAudio);
    return () => { document.removeEventListener('visibilitychange', resumeAudio); window.removeEventListener('pageshow', resumeAudio); };
  }, [metronomeEnabled]);

  return (
    <main className="shell">
      <nav className="topbar">
        <div className="brand"><span className="brand-mark">D</span><div><strong>INDTEC DRUMS</strong><span>LABZ</span></div></div>
        <MidiMonitor />
      </nav>

      <header className="session-header">
        <div>
          <span className="eyebrow">PRACTICE SESSION</span>
          <h1>{chart?.title ?? 'Pick something to play'}</h1>
          <p>{chart ? `${chart.measures.length} measures · ${chart.beatsPerMeasure}/${chart.beatType} · original ${chart.bpm} BPM` : 'Load a score and turn notation into a playable practice lane.'}</p>
        </div>
        <div className="hero-actions">
          <button className="demo-button" type="button" disabled={loadingDemo} onClick={() => void loadDemo()}>{loadingDemo ? 'Loading…' : 'Load demo'}</button>
          <label className="import-button">Import score<input type="file" accept=".xml,.musicxml,application/vnd.recordare.musicxml+xml" onChange={(event) => { const file = event.target.files?.[0]; if (file) void importXml(file); }} /></label>
        </div>
      </header>

      {error && <div className="error">{error}</div>}

      <section className={`practice-stage ${playing ? 'is-playing' : ''}`} style={{ '--beat-duration': `${beatDurationMs}ms` } as React.CSSProperties}>
        <div className="stage-glow" key={`${Math.floor(currentBeat)}-${playing}`} />
        <div className="stage-topline">
          <div className="tempo-readout"><span>TEMPO</span><strong>{chart ? Math.round(effectiveBpm) : '—'}</strong><small>BPM</small></div>
          <div className="beat-dots" aria-label="Beat position">
            {Array.from({ length: chart?.beatsPerMeasure ?? 4 }, (_, index) => <i key={index} className={chart && index === beatInMeasure ? 'active' : ''} />)}
          </div>
          <div className="loop-readout"><span>LOOP</span><strong>{loop ? `${loop.startMeasure}—${loop.endMeasure}` : 'Full chart'}</strong></div>
        </div>

        <div className="score-stage">
          <ScoreViewer xml={xml} currentBeat={currentBeat} totalBeats={chart?.totalBeats ?? 0} beatsPerMeasure={chart?.beatsPerMeasure ?? 4} playing={playing} />
        </div>

        <div className="stage-status"><span className={playing ? 'live-dot active' : 'live-dot'} />{playing ? 'PLAYING' : chart ? 'READY' : 'LOAD A SCORE'}</div>
      </section>

      <section className="control-deck">
        <div className="transport-main">
          <button className="restart-button" type="button" disabled={!chart} onClick={() => { setPlaying(false); setCurrentBeat(0); }} aria-label="Restart">↺</button>
          <button className="play-button" type="button" disabled={!chart} onClick={() => void togglePlaying()}>{playing ? 'Ⅱ' : '▶'}<span>{playing ? 'Pause' : 'Play'}</span></button>
          <button className={`metro-button ${metronomeEnabled ? 'active' : ''}`} type="button" onClick={() => void toggleMetronome()}><span>♩</span><div><small>METRONOME</small><strong>{metronomeEnabled ? 'ON' : 'OFF'}</strong></div></button>
        </div>

        <div className="speed-strip">
          <span>PRACTICE SPEED</span>
          <div>{SPEED_OPTIONS.map((speed) => <button key={speed} type="button" className={speedPercent === speed ? 'active' : ''} onClick={() => setSpeedPercent(speed)}>{speed}%</button>)}</div>
        </div>

        <div className="audio-state">Audio {audioStatus}</div>
      </section>

      <section className="timeline-section">
        <div className="timeline-title"><span>ARRANGEMENT</span><button type="button" disabled={!loop} onClick={() => setLoop(null)}>Clear loop</button></div>
        <PracticeTimeline chart={chart} currentBeat={currentBeat} loop={loop} onSelectMeasure={selectMeasure} />
      </section>
    </main>
  );
}
