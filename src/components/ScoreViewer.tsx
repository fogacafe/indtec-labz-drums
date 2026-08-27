import { useEffect, useRef, useState } from 'react';
import { OpenSheetMusicDisplay } from 'opensheetmusicdisplay';

type Props = {
  xml: string | null;
  currentBeat: number;
  totalBeats: number;
  beatsPerMeasure: number;
  playing: boolean;
  onSeek?: (beat: number) => void;
};

type MeasurePosition = {
  x: number;
  width: number;
};

const PIXELS_PER_BEAT = 92;
const PLAYHEAD_RATIO = 0.35;

export function ScoreViewer({ xml, currentBeat, totalBeats, beatsPerMeasure, playing, onSeek }: Props) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const userSeekingRef = useRef(false);
  const seekIdleTimerRef = useRef<number | null>(null);
  const [viewportWidth, setViewportWidth] = useState(0);
  const [measurePositions, setMeasurePositions] = useState<MeasurePosition[]>([]);

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
    setMeasurePositions([]);

    const osmd = new OpenSheetMusicDisplay(container, {
      autoResize: false,
      backend: 'svg',
      drawTitle: false,
      drawingParameters: 'compacttight',
    });

    let disposed = false;

    void osmd.load(xml).then(() => {
      if (disposed) return;

      osmd.EngravingRules.RenderSingleHorizontalStaffline = true;
      osmd.render();

      const positions = osmd.GraphicSheet.MeasureList.map((staffMeasures) => {
        const measure = staffMeasures.find((item) => item?.isVisible()) ?? staffMeasures[0];
        if (!measure) return null;

        return {
          x: measure.PositionAndShape.AbsolutePosition.x * 10 * osmd.Zoom,
          width: measure.PositionAndShape.Size.width * 10 * osmd.Zoom,
        };
      }).filter((position): position is MeasurePosition => position !== null);

      if (!disposed) setMeasurePositions(positions);
    });

    return () => {
      disposed = true;
      container.innerHTML = '';
    };
  }, [xml, scoreWidth, viewportWidth]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport || userSeekingRef.current || !xml || totalBeats <= 0 || viewportWidth <= 0 || measurePositions.length === 0) return;

    const safeBeat = Math.min(Math.max(currentBeat, 0), totalBeats);
    const measureIndex = Math.min(Math.floor(safeBeat / beatsPerMeasure), measurePositions.length - 1);
    const measure = measurePositions[measureIndex];
    const beatInsideMeasure = safeBeat - measureIndex * beatsPerMeasure;
    const measureProgress = measureIndex === measurePositions.length - 1 && safeBeat >= totalBeats
      ? 1
      : Math.min(Math.max(beatInsideMeasure / beatsPerMeasure, 0), 1);

    viewport.scrollTo({
      left: measure.x + measure.width * measureProgress,
      behavior: playing ? 'auto' : 'smooth',
    });
  }, [currentBeat, totalBeats, beatsPerMeasure, playing, xml, viewportWidth, measurePositions]);

  function markUserSeeking() {
    userSeekingRef.current = true;
    if (seekIdleTimerRef.current !== null) window.clearTimeout(seekIdleTimerRef.current);
  }

  function finishUserSeekingSoon() {
    if (seekIdleTimerRef.current !== null) window.clearTimeout(seekIdleTimerRef.current);
    seekIdleTimerRef.current = window.setTimeout(() => {
      userSeekingRef.current = false;
    }, 180);
  }

  function seekFromScroll() {
    const viewport = viewportRef.current;
    if (!userSeekingRef.current || !viewport || !onSeek || measurePositions.length === 0) return;

    const x = Math.max(viewport.scrollLeft, 0);
    let measureIndex = measurePositions.findIndex((measure) => x < measure.x + measure.width);
    if (measureIndex < 0) measureIndex = measurePositions.length - 1;

    const measure = measurePositions[measureIndex];
    const progress = Math.min(Math.max((x - measure.x) / Math.max(measure.width, 1), 0), 1);
    const beat = Math.min(measureIndex * beatsPerMeasure + progress * beatsPerMeasure, totalBeats);
    onSeek(beat);
    finishUserSeekingSoon();
  }

  useEffect(() => () => {
    if (seekIdleTimerRef.current !== null) window.clearTimeout(seekIdleTimerRef.current);
  }, []);

  if (!xml) {
    return <div className="empty-score">Import a MusicXML file to render the score.</div>;
  }

  return (
    <div className="score-practice">
      <div className="score-now" aria-hidden="true"><span>NOW</span></div>
      <div
        className="score-viewport"
        ref={viewportRef}
        onPointerDown={markUserSeeking}
        onPointerUp={finishUserSeekingSoon}
        onTouchStart={markUserSeeking}
        onWheel={markUserSeeking}
        onScroll={seekFromScroll}
      >
        <div className="score-track">
          <div className="score-spacer" style={{ width: playheadOffset }} />
          <div className="score" ref={containerRef} />
          <div className="score-spacer" style={{ width: Math.max(viewportWidth - playheadOffset, 0) }} />
        </div>
      </div>
    </div>
  );
}
