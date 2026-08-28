import { useRef, useState } from 'react';
import type { DrumHit } from '../midi/midi';
import { downloadMusicXml, recordHit, recordedHitsToMusicXml, type RecordedHit } from '../recording/recording';

type Props={ bpm:number; onRecordingChange:(handler:((hit:DrumHit)=>void)|null)=>void; onPreview:(xml:string)=>void };
export function Recorder({bpm,onRecordingChange,onPreview}:Props){
 const [recording,setRecording]=useState(false);const [hits,setHits]=useState<RecordedHit[]>([]);const [recordBpm,setRecordBpm]=useState(Math.round(bpm)||120);const started=useRef(0);const hitsRef=useRef<RecordedHit[]>([]);
 function start(){hitsRef.current=[];setHits([]);started.current=performance.now();setRecording(true);onRecordingChange((hit)=>{const next=recordHit(hit,performance.now()-started.current,recordBpm);hitsRef.current=[...hitsRef.current,next];setHits(hitsRef.current)});}
 function stop(){setRecording(false);onRecordingChange(null);setHits(hitsRef.current)}
 const xml=()=>recordedHitsToMusicXml(hitsRef.current,recordBpm);
 return <section className={`recorder ${recording?'recording':''}`}><div className="recorder-copy"><span>GROOVE RECORDER</span><strong>{recording?`Recording · ${hits.length} hits`:hits.length?`${hits.length} hits captured`:'Play it. We write it.'}</strong></div><label>BPM<input type="number" min="30" max="300" value={recordBpm} disabled={recording} onChange={e=>setRecordBpm(Number(e.target.value)||120)}/></label>{!recording?<button className="record-button" onClick={start}><i/> Record</button>:<button className="stop-button" onClick={stop}>■ Stop</button>}{!recording&&hits.length>0&&<><button onClick={()=>onPreview(xml())}>Preview</button><button onClick={()=>downloadMusicXml(xml())}>Export XML</button></>}</section>;
}
