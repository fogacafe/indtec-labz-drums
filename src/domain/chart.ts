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
  totalBeats: number;
};

export type PracticeLoop = {
  startMeasure: number;
  endMeasure: number;
};
