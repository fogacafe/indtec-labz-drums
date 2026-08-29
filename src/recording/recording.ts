import type { DrumHit, DrumInstrument } from '../midi/midi';

export type RecordedHit = { beat: number; note: number; velocity: number; instrument: DrumInstrument };

type Notation = { name: string; step: string; octave: number; notehead?: string; stem?: 'up' | 'down' };
const notation: Record<DrumInstrument, Notation> = {
  Kick: { name: 'Bass Drum', step: 'F', octave: 4, stem: 'down' },
  Snare: { name: 'Snare Drum', step: 'C', octave: 5, stem: 'up' },
  'Closed Hi-Hat': { name: 'Closed Hi-Hat', step: 'G', octave: 5, notehead: 'x', stem: 'up' },
  'Open Hi-Hat': { name: 'Open Hi-Hat', step: 'G', octave: 5, notehead: 'circle-x', stem: 'up' },
  'High Tom': { name: 'High Tom', step: 'E', octave: 5, stem: 'up' },
  'Mid Tom': { name: 'Mid Tom', step: 'D', octave: 5, stem: 'up' },
  'Low Tom': { name: 'Floor Tom', step: 'A', octave: 4, stem: 'up' },
  Crash: { name: 'Crash Cymbal', step: 'A', octave: 5, notehead: 'x', stem: 'up' },
  Ride: { name: 'Ride Cymbal', step: 'F', octave: 5, notehead: 'x', stem: 'up' },
  Unknown: { name: 'Percussion', step: 'C', octave: 5, stem: 'up' },
};

const xmlEscape = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
const safeFileName = (value: string) => value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'recorded-groove';

export function quantizeBeat(beat: number, divisions = 4) { return Math.max(0, Math.round(beat * divisions) / divisions); }
export function recordHit(hit: DrumHit, elapsedMs: number, bpm: number): RecordedHit {
  return { beat: quantizeBeat(elapsedMs / (60_000 / bpm)), note: hit.note, velocity: hit.velocity, instrument: hit.instrument };
}

export function recordedHitsToMusicXml(hits: RecordedHit[], bpm: number, beatsPerMeasure = 4, title = 'Recorded Groove') {
  const divisions = 4;
  const measureUnits = beatsPerMeasure * divisions;
  const maxBeat = hits.reduce((max, hit) => Math.max(max, hit.beat), 0);
  const measureCount = Math.max(1, Math.floor(maxBeat / beatsPerMeasure) + 1);
  const used = [...new Map(hits.map((hit) => [`${hit.note}-${hit.instrument}`, hit])).values()];
  const instrumentId = (hit: RecordedHit) => `P1-I${hit.note}-${hit.instrument.replace(/[^A-Za-z]/g, '')}`;
  const scoreInstruments = used.map((hit) => `<score-instrument id="${instrumentId(hit)}"><instrument-name>${xmlEscape(notation[hit.instrument].name)}</instrument-name></score-instrument>`).join('');
  const midiInstruments = used.map((hit) => `<midi-instrument id="${instrumentId(hit)}"><midi-channel>10</midi-channel><midi-unpitched>${hit.note + 1}</midi-unpitched></midi-instrument>`).join('');

  const measures = Array.from({ length: measureCount }, (_, measureIndex) => {
    const startBeat = measureIndex * beatsPerMeasure;
    const grouped = new Map<number, RecordedHit[]>();
    hits.filter((hit) => hit.beat >= startBeat && hit.beat < startBeat + beatsPerMeasure)
      .sort((a, b) => a.beat - b.beat || a.note - b.note)
      .forEach((hit) => {
        const position = Math.min(measureUnits - 1, Math.max(0, Math.round((hit.beat - startBeat) * divisions)));
        grouped.set(position, [...(grouped.get(position) ?? []), hit]);
      });

    let cursor = 0;
    const body = [...grouped.entries()].sort(([a], [b]) => a - b).map(([position, group]) => {
      const forward = position > cursor ? `<forward><duration>${position - cursor}</duration></forward>` : '';
      const notes = group.map((hit, index) => {
        const info = notation[hit.instrument];
        return `<note>${index > 0 ? '<chord/>' : ''}<unpitched><display-step>${info.step}</display-step><display-octave>${info.octave}</display-octave></unpitched><duration>1</duration><instrument id="${instrumentId(hit)}"/><voice>1</voice><type>16th</type><stem>${info.stem ?? 'up'}</stem>${info.notehead ? `<notehead>${info.notehead}</notehead>` : ''}</note>`;
      }).join('');
      cursor = position + 1;
      return `${forward}${notes}`;
    }).join('');

    const remaining = Math.max(0, measureUnits - cursor);
    const tail = remaining ? `<forward><duration>${remaining}</duration></forward>` : '';
    const attributes = measureIndex === 0 ? `<attributes><divisions>${divisions}</divisions><time><beats>${beatsPerMeasure}</beats><beat-type>4</beat-type></time><clef><sign>percussion</sign><line>2</line></clef></attributes><direction placement="above"><direction-type><metronome><beat-unit>quarter</beat-unit><per-minute>${bpm}</per-minute></metronome></direction-type><sound tempo="${bpm}"/></direction>` : '';
    return `<measure number="${measureIndex + 1}">${attributes}${body}${tail}</measure>`;
  }).join('');

  return `<?xml version="1.0" encoding="UTF-8" standalone="no"?><!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd"><score-partwise version="4.0"><work><work-title>${xmlEscape(title.trim() || 'Recorded Groove')}</work-title></work><part-list><score-part id="P1"><part-name>Drums</part-name>${scoreInstruments}${midiInstruments}</score-part></part-list><part id="P1">${measures}</part></score-partwise>`;
}

export function downloadMusicXml(xml: string, title = 'Recorded Groove') {
  const url = URL.createObjectURL(new Blob([xml], { type: 'application/vnd.recordare.musicxml+xml' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${safeFileName(title)}.musicxml`;
  anchor.click();
  URL.revokeObjectURL(url);
}
