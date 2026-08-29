import { useEffect, useRef, useState } from 'react';
import type { DrumHit } from '../midi/midi';
import { downloadMusicXml, recordHit, recordedHitsToMusicXml, type RecordedHit } from '../recording/recording';

type Props = {
  bpm: number;
  onRecordingChange: (handler: ((hit: DrumHit) => void) | null) => void;
  onLivePreview: (xml: string) => void;
  onPreview: (xml: string) => void;
};

export function Recorder({ bpm, onRecordingChange, onLivePreview, onPreview }: Props) {
  const [recording, setRecording] = useState(false);
  const [hits, setHits] = useState<RecordedHit[]>([]);
  const [recordBpm, setRecordBpm] = useState(Math.round(bpm) || 120);
  const [title, setTitle] = useState('My Groove');
  const started = useRef(0);
  const hitsRef = useRef<RecordedHit[]>([]);
  const previewTimer = useRef<number | null>(null);
  const recordingChangeRef = useRef(onRecordingChange);
  const livePreviewRef = useRef(onLivePreview);
  recordingChangeRef.current = onRecordingChange;
  livePreviewRef.current = onLivePreview;

  const buildXml = () => recordedHitsToMusicXml(hitsRef.current, recordBpm, 4, title);

  const pushLivePreview = () => {
    if (previewTimer.current !== null) return;
    previewTimer.current = window.setTimeout(() => {
      previewTimer.current = null;
      if (hitsRef.current.length) livePreviewRef.current(buildXml());
    }, 120);
  };

  function start() {
    hitsRef.current = [];
    setHits([]);
    started.current = performance.now();
    setRecording(true);
    recordingChangeRef.current((hit) => {
      const next = recordHit(hit, performance.now() - started.current, recordBpm);
      hitsRef.current = [...hitsRef.current, next];
      setHits(hitsRef.current);
      pushLivePreview();
    });
  }

  function stop() {
    setRecording(false);
    recordingChangeRef.current(null);
    if (previewTimer.current !== null) {
      window.clearTimeout(previewTimer.current);
      previewTimer.current = null;
    }
    setHits(hitsRef.current);
    if (hitsRef.current.length) livePreviewRef.current(buildXml());
  }

  useEffect(() => () => {
    recordingChangeRef.current(null);
    if (previewTimer.current !== null) window.clearTimeout(previewTimer.current);
  }, []);

  return <section className={`recorder ${recording ? 'recording' : ''}`}>
    <div className="recorder-copy"><span>GROOVE RECORDER</span><strong>{recording ? `Recording · ${hits.length} hits · writing score` : hits.length ? `${hits.length} hits captured · ready to preview` : 'Play it. We write it.'}</strong></div>
    <label className="recorder-name">NAME<input type="text" maxLength={48} value={title} disabled={recording} onChange={(event) => setTitle(event.target.value)} /></label>
    <label>BPM<input type="number" min="30" max="300" value={recordBpm} disabled={recording} onChange={(event) => setRecordBpm(Number(event.target.value) || 120)} /></label>
    {!recording ? <button className="record-button" onClick={start}><i /> Record</button> : <button className="stop-button" onClick={stop}>■ Stop</button>}
    {!recording && hits.length > 0 && <><button className="preview-button" onClick={() => onPreview(buildXml())}>▶ Preview take</button><button onClick={() => downloadMusicXml(buildXml(), title)}>Export XML</button></>}
  </section>;
}
