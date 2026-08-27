import { useEffect, useRef } from 'react';
import { OpenSheetMusicDisplay } from 'opensheetmusicdisplay';

type Props = {
  xml: string | null;
};

export function ScoreViewer({ xml }: Props) {
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

  if (!xml) {
    return <div className="empty-score">Import a MusicXML file to render the score.</div>;
  }

  return <div className="score" ref={containerRef} />;
}
