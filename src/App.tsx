import { useEffect, useMemo, useRef, useState } from 'react';
import { MidiMonitor } from './components/MidiMonitor';
import { PracticeTimeline } from './components/PracticeTimeline';
import { ScoreViewer } from './components/ScoreViewer';
import type { Chart, PracticeLoop } from './domain/chart';
import { parseMusicXml } from './musicxml/parseMusicXml';

const SPEED_OPTIONS = [50, 60, 75, 90, 100];

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
  const startedAtRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  const effectiveBpm = useMemo(
    () => (chart ? chart.bpm * (speedPercent / 100) : 120),
    [chart, speedPercent],
  );
  const beatDurationMs = useMemo(() => 60_000 / effectiveBpm, [effectiveBpm]);

  function loadXml(content: string) {
    const nextChart = parseMusicXml(content);
    setXml(content);
    setChart(nextChart);
    setCurrentBeat(0);
    setLoop(null);
    setPlaying(false);
    setError(null);
  }

  async function importXml(file: File) {
    try {
      loadXml(await file.text());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not import MusicXML.');
    }
  }

  async function loadDemo() {
    setLoadingDemo(true);
    try {
      const response = await fetch(`${import.meta.env.BASE_URL}demo-groove.musicxml`);
      if (!response.ok) throw new Error('Could not load the demo groove.');
      loadXml(await response.text());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not load demo.');
    } finally {
      setLoadingDemo(false);
    }
  }

  async function ensureAudioContext() {
    const AudioContextClass = window.AudioContext;
    if (!audioContextRef.current) audioContextRef.current = new AudioContextClass();
    if (audioContextRef.current.state === 'suspended') await audioContextRef.current.resume();
    return audioContextRef.current;
  }

  async function togglePlaying() {
    if (!chart) return;
    if (!playing && metronomeEnabled) await ensureAudioContext();
    setPlaying((value) => !value);
  }

  async function toggleMetronome() {
    if (!metronomeEnabled) await ensureAudioContext();
    setMetronomeEnabled((value) => !value);
  }

  function selectMeasure(measure: number) {
    setLoop((current) => {
      if (!current || current.startMeasure !== current.endMeasure) {
        return { startMeasure: measure, endMeasure: measure };
      }

      return {
        startMeasure: Math.min(current.startMeasure, measure),
        endMeasure: Math.max(current.startMeasure, measure),
      };
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
      } else if (beat >= chart.totalBeats) {
        beat = chart.totalBeats;
        setPlaying(false);
      }

      setCurrentBeat(beat);
      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, chart, loop, beatDurationMs]);

  useEffect(() => {
    if (!playing || !metronomeEnabled || !chart) return;

    const context = audioContextRef.current;
    if (!context) return;

    const beatDurationSeconds = 60 / effectiveBpm;
    const lookAheadSeconds = 0.1;
    const schedulerIntervalMs = 25;
    const currentWholeBeat = Math.ceil(currentBeat - 0.0001);
    const fractionToNextBeat = Math.max(currentWholeBeat - currentBeat, 0);
    let nextBeat = currentWholeBeat;
    let nextClickAt = context.currentTime + fractionToNextBeat * beatDurationSeconds;

    const scheduleClick = (time: number, beat: number) => {
      const accent = beat % chart.beatsPerMeasure === 0;
      const oscillator = context.createOscillator();
      const gain = context.createGain();

      oscillator.frequency.setValueAtTime(accent ? 1200 : 850, time);
      gain.gain.setValueAtTime(accent ? 0.16 : 0.09, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.045);

      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(time);
      oscillator.stop(time + 0.05);
    };

    const scheduler = window.setInterval(() => {
      while (nextClickAt < context.currentTime + lookAheadSeconds) {
        scheduleClick(nextClickAt, nextBeat);
        nextBeat += 1;
        nextClickAt += beatDurationSeconds;
      }
    }, schedulerIntervalMs);

    return () => window.clearInterval(scheduler);
  }, [playing, metronomeEnabled, chart, effectiveBpm]);

  return (
    <main className="shell">
      <header className="hero">
        <div>
          <span className="eyebrow">INDTEC LABZ / DRUMS</span>
          <h1>MusicXML practice playground</h1>
          <p>Import a drum score, connect an electronic kit over Web MIDI and rehearse selected measures directly in the browser.</p>
        </div>

        <div className="hero-actions">
          <button className="demo-button" type="button" disabled={loadingDemo} onClick={() => void loadDemo()}>
            {loadingDemo ? 'Loading…' : 'Load demo'}
          </button>
          <label className="import-button">
            Import MusicXML
            <input
              type="file"
              accept=".xml,.musicxml,application/vnd.recordare.musicxml+xml"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void importXml(file);
              }}
            />
          </label>
        </div>
      </header>

      {error && <div className="error">{error}</div>}

      <MidiMonitor />

      <section className="meta-card">
        <div><span>Exercise</span><strong>{chart?.title ?? 'No chart loaded'}</strong></div>
        <div><span>Tempo</span><strong>{chart ? `${Math.round(effectiveBpm)} BPM` : '—'}</strong></div>
        <div><span>Signature</span><strong>{chart ? `${chart.beatsPerMeasure}/${chart.beatType}` : '—'}</strong></div>
        <div><span>Measures</span><strong>{chart?.measures.length ?? '—'}</strong></div>
      </section>

      <section className="practice-controls">
        <div className="speed-control">
          <div className="control-copy">
            <span>Practice speed</span>
            <strong>{speedPercent}%{chart ? ` · ${Math.round(effectiveBpm)} BPM` : ''}</strong>
          </div>
          <div className="speed-options">
            {SPEED_OPTIONS.map((speed) => (
              <button
                key={speed}
                type="button"
                className={speedPercent === speed ? 'active' : ''}
                onClick={() => setSpeedPercent(speed)}
              >
                {speed}%
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          className={`metronome-toggle ${metronomeEnabled ? 'active' : ''}`}
          onClick={() => void toggleMetronome()}
        >
          <span>Metronome</span>
          <strong>{metronomeEnabled ? 'On' : 'Off'}</strong>
        </button>
      </section>

      <section className="transport">
        <button type="button" disabled={!chart} onClick={() => void togglePlaying()}>
          {playing ? 'Pause' : 'Play'}
        </button>
        <button type="button" disabled={!chart} onClick={() => { setPlaying(false); setCurrentBeat(0); }}>
          Restart
        </button>
        <button type="button" disabled={!loop} onClick={() => setLoop(null)}>
          Clear loop
        </button>
        <span>{loop ? `Loop: ${loop.startMeasure} → ${loop.endMeasure}` : 'Full chart'}</span>
      </section>

      <PracticeTimeline chart={chart} currentBeat={currentBeat} loop={loop} onSelectMeasure={selectMeasure} />

      <section className="score-card">
        <ScoreViewer
          xml={xml}
          currentBeat={currentBeat}
          totalBeats={chart?.totalBeats ?? 0}
          beatsPerMeasure={chart?.beatsPerMeasure ?? 4}
          playing={playing}
        />
      </section>
    </main>
  );
}
