import { useEffect, useMemo, useRef, useState } from 'react';
import { MidiMonitor } from './components/MidiMonitor';
import { PracticeTimeline } from './components/PracticeTimeline';
import { ScoreViewer } from './components/ScoreViewer';
import type { Chart, PracticeLoop } from './domain/chart';
import { parseMusicXml } from './musicxml/parseMusicXml';

export function App() {
  const [xml, setXml] = useState<string | null>(null);
  const [chart, setChart] = useState<Chart | null>(null);
  const [loop, setLoop] = useState<PracticeLoop | null>(null);
  const [currentBeat, setCurrentBeat] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingDemo, setLoadingDemo] = useState(false);
  const startedAtRef = useRef<number | null>(null);

  const beatDurationMs = useMemo(() => (chart ? 60_000 / chart.bpm : 500), [chart]);

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
        <div><span>Tempo</span><strong>{chart ? `${chart.bpm} BPM` : '—'}</strong></div>
        <div><span>Signature</span><strong>{chart ? `${chart.beatsPerMeasure}/${chart.beatType}` : '—'}</strong></div>
        <div><span>Measures</span><strong>{chart?.measures.length ?? '—'}</strong></div>
      </section>

      <section className="transport">
        <button type="button" disabled={!chart} onClick={() => setPlaying((value) => !value)}>
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
          playing={playing}
        />
      </section>
    </main>
  );
}
