import type { DrumInstrument } from '../midi/midi';

const GM_DRUM_MAP: Record<number, DrumInstrument> = {
  35: 'Kick',
  36: 'Kick',
  37: 'Snare',
  38: 'Snare',
  40: 'Snare',
  41: 'Low Tom',
  42: 'Closed Hi-Hat',
  43: 'Low Tom',
  44: 'Closed Hi-Hat',
  45: 'Mid Tom',
  46: 'Open Hi-Hat',
  47: 'Mid Tom',
  48: 'High Tom',
  49: 'Crash',
  50: 'High Tom',
  51: 'Ride',
  52: 'Crash',
  53: 'Ride',
  55: 'Crash',
  57: 'Crash',
  59: 'Ride',
};

export function musicXmlUnpitchedToMidi(value: number | null) {
  if (value === null || !Number.isFinite(value)) return null;
  // MusicXML stores MIDI values as 1..128; Web MIDI uses 0..127.
  return Math.min(Math.max(value - 1, 0), 127);
}

export function instrumentFromMidiNote(note: number | null): DrumInstrument {
  return note === null ? 'Unknown' : GM_DRUM_MAP[note] ?? 'Unknown';
}
