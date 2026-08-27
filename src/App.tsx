import { useEffect, useMemo, useRef, useState } from 'react';
import { MidiMonitor } from './components/MidiMonitor';
import { PracticeTimeline } from './components/PracticeTimeline';
import { ScoreViewer } from './components/ScoreViewer';
import type { Chart, PracticeLoop } from './domain/chart';
import { parseMusicXml } from './musicxml/parseMusicXml';

const SPEED_OPTIONS = [50, 60, 75, 90, 100];
type AudioStatus = 'idle' | AudioContextState | 'unsupported' | 'error';

type SafariAudioNavigator = Navigator & {
  audioSession?: { type: string };
};

type SafariAudioWindow = Window & typeof globalThis & {
  webkitAudioContext?: typeof AudioContext;
};

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
    try {
      const safariNavigator = navigator as SafariAudioNavigator;
      if (safariNavigator.audioSession) safariNavigator.audioSession.type = 'playback';

      if (!audioContextRef.current) {
        const safariWindow = window as SafariAudioWindow;
        const AudioContextClass = window.AudioContext ?? safariWindow.webkitAudioContext;
        if (!AudioContextClass) {
          setAudioStatus('unsupported');
          throw new Error('Web Audio is not supported in this browser.');
        }

        const context = new AudioContextClass();
        context.onstatechange = () => setAudioStatus(context.state);
        audioContextRef.current = context;
      }

      const context = audioContextRef.current;
      if (context.state !== 'running') await context.resume();
      setAudioStatus(context.state);
      return context;
    } catch (reason) {
      setAudioStatus('error');
      throw reason;
    }
  }

  function scheduleMetronomeClick(context: AudioContext, time: number, accent: boolean) {
    const oscillator = context.createOscillator();
    const gain = context.createGain();

    oscillator.type = 'square';
    oscillator.frequency.setValueAtTime(accent ? 1700 : 1050, time);
    gain.gain.setValueAtTime(accent ? 0.5 : 0.3, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.075);

    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(time);
    oscillator.stop(time + 0.08);
  }

  async function testMetronomeClick() {
    try {
      const context = await ensureAudioContext();
      scheduleMetronomeClick(context, context.currentTime, true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not start audio.');
    }
  }

  async function togglePlaying() {
    if (!chart) return;

    if (!playing && metronomeEnabled) {
      try {
        await ensureAudioContext();
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : 'Could not start audio.');
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
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : 'Could not start audio.');
      }
      return;
    }

    setMetronomeEnabled(false);
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
    if (!context || context.state !== 'running') return;

    const beatDurationSeconds = 60 / effectiveBpm;
    const lookAheadSeconds = 0.12;
    const schedulerIntervalMs = 25;
    const currentWholeBeat = Math.ceil(currentBeat - 0.0001);
    const fractionToNextBeat = Math.max(currentWholeBeat - currentBeat, 0);
    let nextBeat = currentWholeBeat;
    let nextClickAt = context.currentTime + Math.max(fractionToNextBeat * beatDurationSeconds, 0.03);

    const scheduler = window.setInterval(() => {
      if (context.state !== 'running') return;

      while (nextClickAt < context.currentTime + lookAheadSeconds) {
        const accent = nextBeat % chart.beatsPerMeasure === 0;
        scheduleMetronomeClick(context, nextClickAt, accent);
        nextBeat += 1;
        nextClickAt += beatDurationSeconds;
      }
    }, schedulerIntervalMs);

    return () => window.clearInterval(scheduler);
  }, [playing, metronomeEnabled, chart, effectiveBpm]);

  useEffect(() => {
    const resumeAudio = () => {
      const context = audioContextRef.current;
      if (metronomeEnabled && context && context.state !== 'running') {
        void context.resume().then(() => setAudioStatus(context.state));
      }
    };

    document.addEventListener('visibilitychange', resumeAudio);
    window.addEventListener('pageshow', resumeAudio);

    return () => {
      document.removeEventListener('visibilitychange', resumeAudio);
      window.removeEventListener('pageshow', resumeAudio);
    };
  }, [metronomeEnabled]);

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

        <div className="metronome-control">
          <button
            type="button"
            className={`metronome-toggle ${metronomeEnabled ? 'active' : ''}`}
            onClick={() => void toggleMetronome()}
          >
            <span>Metronome</span>
            <strong>{metronomeEnabled ? 'On' : 'Off'}</strong>
          </button>
          <button type="button" className="audio-test" onClick={() => void testMetronomeClick()}>
            Test click
          </button>
          <small>Audio: {audioStatus}</small>
        </div>
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
