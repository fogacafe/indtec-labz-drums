import { useEffect, useRef } from 'react';
import type { Chart, PracticeLoop } from '../domain/chart';

type Props = {
  chart: Chart | null;
  currentBeat: number;
  loop: PracticeLoop | null;
  onSelectMeasure: (measure: number) => void;
};

const MIN_MEASURE_WIDTH = 54;

export function PracticeTimeline({ chart, currentBeat, loop, onSelectMeasure }: Props) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const playheadRef = useRef<HTMLDivElement>(null);

  const progress = !chart || chart.totalBeats === 0
    ? 0
    : Math.min(1, Math.max(0, currentBeat / chart.totalBeats));

  useEffect(() => {
    const viewport = viewportRef.current;
    const playhead = playheadRef.current;
    if (!viewport || !playhead || !chart) return;

    const playheadX = playhead.offsetLeft;
    const leftSafeZone = viewport.scrollLeft + viewport.clientWidth * 0.2;
    const rightSafeZone = viewport.scrollLeft + viewport.clientWidth * 0.8;

    if (playheadX < leftSafeZone || playheadX > rightSafeZone) {
      viewport.scrollTo({
        left: Math.max(playheadX - viewport.clientWidth * 0.35, 0),
        behavior: 'auto',
      });
    }
  }, [currentBeat, chart]);

  if (!chart) {
    return <div className="timeline timeline-empty">Timeline waiting for a chart.</div>;
  }

  const trackWidth = Math.max(chart.measures.length * MIN_MEASURE_WIDTH, 100);

  return (
    <section className="timeline">
      <div className="timeline-header">
        <span>Practice timeline</span>
        <strong>{Math.min(Math.floor(currentBeat / chart.beatsPerMeasure) + 1, chart.measures.length)}:{Math.floor(currentBeat % chart.beatsPerMeasure) + 1}</strong>
      </div>

      <div className="measure-viewport" ref={viewportRef}>
        <div className="measure-track" style={{ minWidth: `${trackWidth}px` }}>
          <div ref={playheadRef} className="playhead" style={{ left: `${progress * 100}%` }} />
          {chart.measures.map((measure) => {
            const selected = loop && measure.number >= loop.startMeasure && measure.number <= loop.endMeasure;
            return (
              <button
                key={measure.number}
                className={selected ? 'measure selected' : 'measure'}
                onClick={() => onSelectMeasure(measure.number)}
                type="button"
                title={`Measure ${measure.number}`}
              >
                {measure.number}
              </button>
            );
          })}
        </div>
      </div>

      <div className="timeline-hint">Click one measure to start a loop; click another to extend the range.</div>
    </section>
  );
}
