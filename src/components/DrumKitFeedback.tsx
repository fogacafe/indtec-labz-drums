import type { DrumInstrument } from '../midi/midi';
import './DrumKitFeedback.css';

type Props = {
  played: DrumInstrument | null;
  expected: DrumInstrument | null;
  wrong: boolean;
};

type Piece = {
  instruments: DrumInstrument[];
  label: string;
  className: string;
};

const pieces: Piece[] = [
  { instruments: ['Crash'], label: 'CR', className: 'crash' },
  { instruments: ['Ride'], label: 'RD', className: 'ride' },
  { instruments: ['Closed Hi-Hat', 'Open Hi-Hat'], label: 'HH', className: 'hihat' },
  { instruments: ['High Tom'], label: 'T1', className: 'tom-high' },
  { instruments: ['Mid Tom'], label: 'T2', className: 'tom-mid' },
  { instruments: ['Snare'], label: 'SN', className: 'snare' },
  { instruments: ['Low Tom'], label: 'FT', className: 'tom-low' },
  { instruments: ['Kick'], label: 'K', className: 'kick' },
];

export function DrumKitFeedback({ played, expected, wrong }: Props) {
  return (
    <section className="drum-kit-feedback" aria-label="Live drum feedback">
      <div className="kit-copy">
        <span>LIVE KIT</span>
        <strong>{wrong && expected ? `Expected ${expected}` : played ? `You hit ${played}` : 'Waiting for a hit'}</strong>
      </div>
      <div className="mini-kit">
        {pieces.map((piece) => {
          const isPlayed = played ? piece.instruments.includes(played) : false;
          const isExpected = expected ? piece.instruments.includes(expected) : false;
          const openHiHat = piece.className === 'hihat' && (played === 'Open Hi-Hat' || expected === 'Open Hi-Hat');
          return (
            <div
              key={piece.className}
              className={`kit-piece ${piece.className} ${openHiHat ? 'open-hihat' : ''} ${isPlayed ? (wrong ? 'played-wrong' : 'played') : ''} ${isExpected ? 'expected' : ''}`}
              title={piece.instruments.join(' / ')}
            >
              <span>{openHiHat ? 'HH◌' : piece.label}</span>
            </div>
          );
        })}
      </div>
      <div className="kit-legend">
        <span><i className="legend-played" /> you</span>
        <span><i className="legend-expected" /> expected</span>
      </div>
    </section>
  );
}
