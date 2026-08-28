import type { DrumInstrument } from '../midi/midi';
import './DrumKitFeedback.css';

type Props = {
  played: DrumInstrument | null;
  expected: DrumInstrument | null;
  wrong: boolean;
};

const pieces: Array<{ instrument: DrumInstrument; label: string; className: string }> = [
  { instrument: 'Crash', label: 'CR', className: 'crash' },
  { instrument: 'Ride', label: 'RD', className: 'ride' },
  { instrument: 'Closed Hi-Hat', label: 'HH', className: 'hihat' },
  { instrument: 'High Tom', label: 'T1', className: 'tom-high' },
  { instrument: 'Mid Tom', label: 'T2', className: 'tom-mid' },
  { instrument: 'Snare', label: 'SN', className: 'snare' },
  { instrument: 'Low Tom', label: 'FT', className: 'tom-low' },
  { instrument: 'Kick', label: 'K', className: 'kick' },
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
          const isPlayed = played === piece.instrument;
          const isExpected = expected === piece.instrument;
          return (
            <div
              key={piece.instrument}
              className={`kit-piece ${piece.className} ${isPlayed ? (wrong ? 'played-wrong' : 'played') : ''} ${isExpected ? 'expected' : ''}`}
              title={piece.instrument}
            >
              <span>{piece.label}</span>
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
