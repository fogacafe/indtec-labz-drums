import { useEffect, useRef } from 'react';
import { OpenSheetMusicDisplay } from 'opensheetmusicdisplay';

type Props = {
  xml: string | null;
  currentBeat: number;
  totalBeats: number;
  playing: boolean;
};

export function ScoreViewer({ xml, currentBeat, totalBeats, playing }: Props) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!xml || !containerRef.current) return;

    const container = containerRef.current;
    container.innerHTML = '';

    const osmd = new OpenSheetMusicDisplay(container, {
      autoResize: true,
      backend: 'svg',
      drawTitle: false,
      drawingParameters: 'compacttight',
    });

    void osmd.load(xml).then(() => osmd.render());

    return () => {
      container.innerHTML = '';
    };
  }, [xml]);

  useEffect(() => {
    const viewport = viewportRef.current;
    const score = containerRef.current;
    if (!viewport || !score || !xml || totalBeats <= 0) return;

    const progress = Math.min(Math.max(currentBeat / totalBeats, 0), 1);
    const readableX = viewport.clientWidth * 0.35;
    const scoreTravel = Math.max(score.scrollWidth - viewport.clientWidth, 0);
    const target = Math.max(0, progress * scoreTravel - readableX * 0.15);

    viewport.scrollTo({
      left: target,
      behavior: playing ? 'auto' : 'smooth',
    });
  }, [currentBeat, totalBeats, playing, xml]);

  if (!xml) {
    return <div className="empty-score">Import a MusicXML file to render the score.</div>;
  }

  return (
    <div className="score-practice">
      <div className="score-now" aria-hidden="true">
        <span>NOW</span>
      </div>
      <div className="score-viewport" ref={viewportRef}>
        <div className="score" ref={containerRef} />
      </div>
    </div>
  );
}
