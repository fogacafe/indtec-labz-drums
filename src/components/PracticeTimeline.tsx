import type { Chart, PracticeLoop } from '../domain/chart';

type Props = {
  chart: Chart | null;
  currentBeat: number;
  loop: PracticeLoop | null;
  onSelectMeasure: (measure: number) => void;
};

export function PracticeTimeline({ chart, currentBeat, loop, onSelectMeasure }: Props) {
  if (!chart) {
    return <div className="timeline timeline-empty">Timeline waiting for a chart.</div>;
  }

  const progress = chart.totalBeats === 0 ? 0 : Math.min(100, (currentBeat / chart.totalBeats) * 100);

  return (
    <section className="timeline">
      <div className="timeline-header">
        <span>Practice timeline</span>
        <strong>{Math.floor(currentBeat / chart.beatsPerMeasure) + 1}:{Math.floor(currentBeat % chart.beatsPerMeasure) + 1}</strong>
      </div>

      <div className="measure-track">
        <div className="playhead" style={{ left: `${progress}%` }} />
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

      <div className="timeline-hint">Click one measure to start a loop; click another to extend the range.</div>
    </section>
  );
}
