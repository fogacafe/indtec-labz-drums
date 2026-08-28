import type { DrumHit, DrumInstrument } from '../midi/midi';

export type RecordedHit = { beat: number; note: number; velocity: number; instrument: DrumInstrument };

const instrumentName: Record<DrumInstrument, string> = {
  Kick: 'Bass Drum', Snare: 'Snare Drum', 'Closed Hi-Hat': 'Closed Hi-Hat', 'Open Hi-Hat': 'Open Hi-Hat',
  'High Tom': 'High Tom', 'Mid Tom': 'Mid Tom', 'Low Tom': 'Floor Tom', Crash: 'Crash Cymbal', Ride: 'Ride Cymbal', Unknown: 'Percussion',
};

export function quantizeBeat(beat: number, divisions = 4) { return Math.max(0, Math.round(beat * divisions) / divisions); }

export function recordHit(hit: DrumHit, elapsedMs: number, bpm: number): RecordedHit {
  return { beat: quantizeBeat(elapsedMs / (60_000 / bpm)), note: hit.note, velocity: hit.velocity, instrument: hit.instrument };
}

export function recordedHitsToMusicXml(hits: RecordedHit[], bpm: number, beatsPerMeasure = 4) {
  const divisions = 4;
  const maxBeat = hits.reduce((max, hit) => Math.max(max, hit.beat), 0);
  const measureCount = Math.max(1, Math.floor(maxBeat / beatsPerMeasure) + 1);
  const used = [...new Map(hits.map((hit) => [hit.note, hit])).values()];
  const scoreInstruments = used.map((hit) => `<score-instrument id="P1-I${hit.note}"><instrument-name>${instrumentName[hit.instrument]}</instrument-name></score-instrument>`).join('');
  const midiInstruments = used.map((hit) => `<midi-instrument id="P1-I${hit.note}"><midi-channel>10</midi-channel><midi-unpitched>${hit.note + 1}</midi-unpitched></midi-instrument>`).join('');

  const measures = Array.from({ length: measureCount }, (_, measureIndex) => {
    const start = measureIndex * beatsPerMeasure;
    const events = hits.filter((hit) => hit.beat >= start && hit.beat < start + beatsPerMeasure).sort((a, b) => a.beat - b.beat);
    let cursor = 0;
    const body = events.map((hit) => {
      const position = Math.round((hit.beat - start) * divisions);
      const forward = position > cursor ? `<forward><duration>${position - cursor}</duration></forward>` : '';
      cursor = position;
      return `${forward}<note><unpitched><display-step>C</display-step><display-octave>5</display-octave></unpitched><duration>1</duration><instrument id="P1-I${hit.note}"/><voice>1</voice><type>16th</type><stem>up</stem></note>`;
    }).join('');
    const attributes = measureIndex === 0 ? `<attributes><divisions>${divisions}</divisions><time><beats>${beatsPerMeasure}</beats><beat-type>4</beat-type></time><clef><sign>percussion</sign><line>2</line></clef></attributes><direction placement="above"><direction-type><metronome><beat-unit>quarter</beat-unit><per-minute>${bpm}</per-minute></metronome></direction-type><sound tempo="${bpm}"/></direction>` : '';
    return `<measure number="${measureIndex + 1}">${attributes}${body}</measure>`;
  }).join('');

  return `<?xml version="1.0" encoding="UTF-8" standalone="no"?><!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd"><score-partwise version="4.0"><work><work-title>Recorded Groove</work-title></work><part-list><score-part id="P1"><part-name>Drums</part-name>${scoreInstruments}${midiInstruments}</score-part></part-list><part id="P1">${measures}</part></score-partwise>`;
}

export function downloadMusicXml(xml: string) {
  const url = URL.createObjectURL(new Blob([xml], { type: 'application/vnd.recordare.musicxml+xml' }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = `indtec-groove-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.musicxml`; anchor.click(); URL.revokeObjectURL(url);
}
