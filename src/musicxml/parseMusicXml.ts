import type { Chart, ExpectedHit, Measure } from '../domain/chart';
import type { DrumInstrument } from '../midi/midi';

const textOf = (parent: ParentNode, selector: string) => parent.querySelector(selector)?.textContent?.trim();

const instrumentFromName = (name?: string): DrumInstrument => {
  const value = name?.toLowerCase() ?? '';
  if (value.includes('kick') || value.includes('bass drum')) return 'Kick';
  if (value.includes('snare')) return 'Snare';
  if (value.includes('closed') && value.includes('hat')) return 'Closed Hi-Hat';
  if (value.includes('open') && value.includes('hat')) return 'Open Hi-Hat';
  if (value.includes('high') && value.includes('tom')) return 'High Tom';
  if ((value.includes('mid') || value.includes('medium')) && value.includes('tom')) return 'Mid Tom';
  if ((value.includes('low') || value.includes('floor')) && value.includes('tom')) return 'Low Tom';
  if (value.includes('crash')) return 'Crash';
  if (value.includes('ride')) return 'Ride';
  return 'Unknown';
};

export function parseMusicXml(xml: string): Chart {
  const document = new DOMParser().parseFromString(xml, 'application/xml');
  if (document.querySelector('parsererror')) throw new Error('Invalid MusicXML file.');

  const title = textOf(document, 'work > work-title') ?? textOf(document, 'movement-title') ?? 'Untitled exercise';
  const firstMeasure = document.querySelector('part > measure');
  const beatsPerMeasure = Number(textOf(firstMeasure ?? document, 'attributes > time > beats') ?? 4);
  const beatType = Number(textOf(firstMeasure ?? document, 'attributes > time > beat-type') ?? 4);
  const soundTempo = document.querySelector('sound[tempo]')?.getAttribute('tempo');
  const metronomeTempo = textOf(document, 'direction metronome per-minute');
  const bpm = Number(soundTempo ?? metronomeTempo ?? 120);

  const instrumentInfo = new Map<string, { midiNote: number | null; instrument: DrumInstrument }>();
  document.querySelectorAll('score-part score-instrument').forEach((node) => {
    const id = node.getAttribute('id');
    if (!id) return;
    const name = textOf(node, 'instrument-name');
    const midiNode = document.querySelector(`midi-instrument[id="${id}"] midi-unpitched`);
    instrumentInfo.set(id, { midiNote: midiNode ? Number(midiNode.textContent) : null, instrument: instrumentFromName(name) });
  });

  const measureNodes = [...document.querySelectorAll('part:first-of-type > measure')];
  let divisions = Number(textOf(firstMeasure ?? document, 'attributes > divisions') ?? 1);
  const expectedHits: ExpectedHit[] = [];

  const measures: Measure[] = measureNodes.map((measure, index) => {
    const nextDivisions = Number(textOf(measure, 'attributes > divisions') ?? divisions);
    if (Number.isFinite(nextDivisions) && nextDivisions > 0) divisions = nextDivisions;
    const measureNumber = Number(measure.getAttribute('number') ?? index + 1);
    let cursorDivisions = 0;
    let lastNoteStart = 0;

    Array.from(measure.children).forEach((node, eventIndex) => {
      const duration = Number(textOf(node, 'duration') ?? 0);
      if (node.tagName === 'backup') { cursorDivisions -= duration; return; }
      if (node.tagName === 'forward') { cursorDivisions += duration; return; }
      if (node.tagName !== 'note') return;

      const chord = node.querySelector(':scope > chord') !== null;
      const rest = node.querySelector(':scope > rest') !== null;
      const noteStart = chord ? lastNoteStart : cursorDivisions;
      if (!rest) {
        const instrumentId = node.querySelector(':scope > instrument')?.getAttribute('id') ?? '';
        const info = instrumentInfo.get(instrumentId) ?? { midiNote: null, instrument: 'Unknown' as DrumInstrument };
        expectedHits.push({
          id: `${measureNumber}-${eventIndex}-${instrumentId}`,
          beat: index * beatsPerMeasure + noteStart / divisions,
          measure: measureNumber,
          midiNote: info.midiNote,
          instrument: info.instrument,
        });
      }
      lastNoteStart = noteStart;
      if (!chord) cursorDivisions += duration;
    });

    return { number: measureNumber, startBeat: index * beatsPerMeasure, durationBeats: beatsPerMeasure };
  });

  const normalizedMeasures = measures.length ? measures : [{ number: 1, startBeat: 0, durationBeats: beatsPerMeasure }];
  return { title, bpm, beatsPerMeasure, beatType, measures: normalizedMeasures, expectedHits, totalBeats: normalizedMeasures.length * beatsPerMeasure };
}
