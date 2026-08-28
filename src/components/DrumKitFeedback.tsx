import type { DrumInstrument } from '../midi/midi';
import './DrumKitFeedback.css';

type Props = { played: DrumInstrument | null; expected: DrumInstrument | null; wrong: boolean };
type Piece = { instruments: DrumInstrument[]; label: string; className: string; kind: 'drum' | 'cymbal' | 'kick' };
const pieces: Piece[] = [
  { instruments:['Crash'],label:'CRASH',className:'crash',kind:'cymbal' },{ instruments:['Ride'],label:'RIDE',className:'ride',kind:'cymbal' },
  { instruments:['Closed Hi-Hat','Open Hi-Hat'],label:'HI-HAT',className:'hihat',kind:'cymbal' },{ instruments:['High Tom'],label:'T1',className:'tom-high',kind:'drum' },
  { instruments:['Mid Tom'],label:'T2',className:'tom-mid',kind:'drum' },{ instruments:['Snare'],label:'SNARE',className:'snare',kind:'drum' },
  { instruments:['Low Tom'],label:'FLOOR',className:'tom-low',kind:'drum' },{ instruments:['Kick'],label:'KICK',className:'kick',kind:'kick' },
];
export function DrumKitFeedback({ played, expected, wrong }: Props) {
 return <section className="drum-kit-feedback" aria-label="Live drum feedback"><div className="kit-copy"><span>LIVE KIT</span><strong>{wrong&&expected?`Expected ${expected}`:played?`You hit ${played}`:'Waiting for a hit'}</strong></div><div className="mini-kit garage-kit"><div className="kit-rack"/><div className="kit-stand stand-left"/><div className="kit-stand stand-right"/>{pieces.map(piece=>{const isPlayed=played?piece.instruments.includes(played):false;const isExpected=expected?piece.instruments.includes(expected):false;const open=piece.className==='hihat'&&(played==='Open Hi-Hat'||expected==='Open Hi-Hat');return <div key={piece.className} className={`kit-piece ${piece.kind} ${piece.className} ${open?'open-hihat':''} ${isPlayed?(wrong?'played-wrong':'played'):''} ${isExpected?'expected':''}`} title={piece.instruments.join(' / ')}><span>{open?'OPEN':piece.label}</span></div>})}<div className="kick-pedal"/></div><div className="kit-legend"><span><i className="legend-played"/> you</span><span><i className="legend-expected"/> expected</span></div></section>;
}
