import type { Chart, Measure } from '../domain/chart';

const textOf = (parent: ParentNode, selector: string) =>
  parent.querySelector(selector)?.textContent?.trim();

export function parseMusicXml(xml: string): Chart {
  const document = new DOMParser().parseFromString(xml, 'application/xml');

  if (document.querySelector('parsererror')) {
    throw new Error('Invalid MusicXML file.');
  }

  const title =
    textOf(document, 'work > work-title') ??
    textOf(document, 'movement-title') ??
    'Untitled exercise';

  const firstMeasure = document.querySelector('part > measure');
  const beatsPerMeasure = Number(textOf(firstMeasure ?? document, 'attributes > time > beats') ?? 4);
  const beatType = Number(textOf(firstMeasure ?? document, 'attributes > time > beat-type') ?? 4);

  const soundTempo = document.querySelector('sound[tempo]')?.getAttribute('tempo');
  const metronomeTempo = textOf(document, 'direction metronome per-minute');
  const bpm = Number(soundTempo ?? metronomeTempo ?? 120);

  const measureNodes = [...document.querySelectorAll('part:first-of-type > measure')];
  const measures: Measure[] = measureNodes.map((measure, index) => ({
    number: Number(measure.getAttribute('number') ?? index + 1),
    startBeat: index * beatsPerMeasure,
    durationBeats: beatsPerMeasure,
  }));

  const normalizedMeasures = measures.length
    ? measures
    : [{ number: 1, startBeat: 0, durationBeats: beatsPerMeasure }];

  return {
    title,
    bpm,
    beatsPerMeasure,
    beatType,
    measures: normalizedMeasures,
    totalBeats: normalizedMeasures.length * beatsPerMeasure,
  };
}
