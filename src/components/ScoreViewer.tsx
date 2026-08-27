import { useEffect, useRef, useState } from 'react';
import { OpenSheetMusicDisplay } from 'opensheetmusicdisplay';

type Props = {
  xml: string | null;
  currentBeat: number;
  totalBeats: number;
  playing: boolean;
};

const PIXELS_PER_BEAT = 92;
const PLAYHEAD_RATIO = 0.35;

export function ScoreViewer({ xml, currentBeat, totalBeats, playing }: Props) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [viewportWidth, setViewportWidth] = useState(0);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const updateWidth = () => setViewportWidth(viewport.clientWidth);
    updateWidth();

    const observer = new ResizeObserver(updateWidth);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [xml]);

  const playheadOffset = viewportWidth * PLAYHEAD_RATIO;
  const scoreWidth = Math.max(totalBeats * PIXELS_PER_BEAT, viewportWidth || 720);

  useEffect(() => {
    if (!xml || !containerRef.current || viewportWidth <= 0) return;

    const container = containerRef.current;
    container.innerHTML = '';
    container.style.width = `${scoreWidth}px`;

    const osmd = new OpenSheetMusicDisplay(container, {
      autoResize: false,
      backend: 'svg',
      drawTitle: false,
      drawingParameters: 'compacttight',
    });

    void osmd.load(xml).then(() => {
      osmd.EngravingRules.RenderSingleHorizontalStaffline = true;
      osmd.render();
    });

    return () => {
      container.innerHTML = '';
    };
  }, [xml, scoreWidth, viewportWidth]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport || !xml || totalBeats <= 0 || viewportWidth <= 0) return;

    const progress = Math.min(Math.max(currentBeat / totalBeats, 0), 1);
    const target = progress * scoreWidth;

    viewport.scrollTo({
      left: target,
      behavior: playing ? 'auto' : 'smooth',
    });
  }, [currentBeat, totalBeats, playing, xml, scoreWidth, viewportWidth]);

  if (!xml) {
    return <div className="empty-score">Import a MusicXML file to render the score.</div>;
  }

  return (
    <div className="score-practice">
      <div className="score-now" aria-hidden="true">
        <span>NOW</span>
      </div>
      <div className="score-viewport" ref={viewportRef}>
        <div className="score-track">
          <div className="score-spacer" style={{ width: playheadOffset }} />
          <div className="score" ref={containerRef} />
          <div className="score-spacer" style={{ width: Math.max(viewportWidth - playheadOffset, 0) }} />
        </div>
      </div>
    </div>
  );
}
