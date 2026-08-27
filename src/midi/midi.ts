export type DrumInstrument =
  | 'Kick'
  | 'Snare'
  | 'Closed Hi-Hat'
  | 'Open Hi-Hat'
  | 'Low Tom'
  | 'Mid Tom'
  | 'High Tom'
  | 'Crash'
  | 'Ride'
  | 'Unknown';

export type DrumHit = {
  note: number;
  velocity: number;
  channel: number;
  instrument: DrumInstrument;
  timestamp: number;
};

export type MidiDevice = {
  id: string;
  name: string;
  manufacturer?: string;
};

type MidiMessageEventLike = {
  data: Uint8Array;
  timeStamp: number;
};

type MidiInputLike = {
  id: string;
  name?: string | null;
  manufacturer?: string | null;
  onmidimessage: ((event: MidiMessageEventLike) => void) | null;
};

type MidiAccessLike = {
  inputs: Map<string, MidiInputLike>;
};

type NavigatorWithMidi = Navigator & {
  requestMIDIAccess?: () => Promise<MidiAccessLike>;
};

const GM_DRUM_MAP: Record<number, DrumInstrument> = {
  36: 'Kick',
  38: 'Snare',
  42: 'Closed Hi-Hat',
  46: 'Open Hi-Hat',
  41: 'Low Tom',
  43: 'Low Tom',
  45: 'Mid Tom',
  47: 'Mid Tom',
  48: 'High Tom',
  50: 'High Tom',
  49: 'Crash',
  51: 'Ride',
};

export function isWebMidiSupported() {
  return typeof (navigator as NavigatorWithMidi).requestMIDIAccess === 'function';
}

export async function connectMidi(onHit: (hit: DrumHit) => void) {
  const requestMIDIAccess = (navigator as NavigatorWithMidi).requestMIDIAccess;
  if (!requestMIDIAccess) {
    throw new Error('Web MIDI is not supported by this browser. Try Chrome or Edge on desktop.');
  }

  const access = await requestMIDIAccess.call(navigator);
  const inputs = Array.from(access.inputs.values());

  for (const input of inputs) {
    input.onmidimessage = (event) => {
      const [status, note, velocity] = event.data;
      const command = status & 0xf0;
      const channel = (status & 0x0f) + 1;

      // Note On with velocity > 0. Some devices emit Note On velocity 0 as Note Off.
      if (command !== 0x90 || velocity === 0) return;

      onHit({
        note,
        velocity,
        channel,
        instrument: GM_DRUM_MAP[note] ?? 'Unknown',
        timestamp: event.timeStamp,
      });
    };
  }

  const devices: MidiDevice[] = inputs.map((input) => ({
    id: input.id,
    name: input.name || 'Unnamed MIDI input',
    manufacturer: input.manufacturer || undefined,
  }));

  return {
    devices,
    disconnect() {
      for (const input of inputs) input.onmidimessage = null;
    },
  };
}
