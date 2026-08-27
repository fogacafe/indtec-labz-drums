import type { DrumInstrument } from '../midi/midi';

export type ExpectedHit = {
  id: string;
  beat: number;
  measure: number;
  midiNote: number | null;
  instrument: DrumInstrument;
};

export type Measure = {
  number: number;
  startBeat: number;
  durationBeats: number;
};

export type Chart = {
  title: string;
  bpm: number;
  beatsPerMeasure: number;
  beatType: number;
  measures: Measure[];
  expectedHits: ExpectedHit[];
  totalBeats: number;
};

export type PracticeLoop = {
  startMeasure: number;
  endMeasure: number;
};
