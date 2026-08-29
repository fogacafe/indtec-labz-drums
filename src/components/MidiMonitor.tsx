import { useEffect, useRef, useState } from 'react';
import { connectMidi, isWebMidiSupported, type DrumHit, type MidiDevice } from '../midi/midi';

type Props = { onHit?: (hit: DrumHit) => void };

export function MidiMonitor({ onHit }: Props) {
  const [devices, setDevices] = useState<MidiDevice[]>([]);
  const [lastHit, setLastHit] = useState<DrumHit | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const disconnectRef = useRef<(() => void) | null>(null);
  const onHitRef = useRef(onHit);
  onHitRef.current = onHit;
  const supported = isWebMidiSupported();
  const connected = devices.length > 0;

  async function handleConnect() {
    try {
      setConnecting(true); setError(null); disconnectRef.current?.();
      const session = await connectMidi((hit) => { setLastHit(hit); onHitRef.current?.(hit); });
      disconnectRef.current = session.disconnect; setDevices(session.devices);
      if (session.devices.length === 0) setError('MIDI permission granted, but no input device was found.');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not connect to MIDI.'); }
    finally { setConnecting(false); }
  }

  useEffect(() => () => disconnectRef.current?.(), []);

  return <div className={`midi-dock ${!supported ? 'unsupported' : ''}`}>
    <button className={`midi-pill ${connected ? 'connected' : ''}`} type="button" onClick={() => connected ? setExpanded((value) => !value) : void handleConnect()} disabled={!supported || connecting} title={!supported ? 'Web MIDI requires a supported desktop browser.' : undefined}>
      <span className="midi-dot" /><span>{!supported ? 'MIDI unavailable' : connecting ? 'Connecting…' : connected ? devices[0]?.name ?? 'Drums connected' : 'Connect drums'}</span>
    </button>
    {connected && expanded && <div className="midi-popover">
      <div className="midi-popover-head"><div><span>LIVE MIDI</span><strong>{devices[0]?.name}</strong></div><button type="button" onClick={() => void handleConnect()}>Reconnect</button></div>
      <div className="midi-readout"><div><span>Instrument</span><strong>{lastHit?.instrument ?? 'Waiting for a hit'}</strong></div><div><span>Note</span><strong>{lastHit?.note ?? '—'}</strong></div><div><span>Velocity</span><strong>{lastHit?.velocity ?? '—'}</strong></div><div><span>Channel</span><strong>{lastHit?.channel ?? '—'}</strong></div></div>
      <div className="velocity-meter"><div style={{ width: `${((lastHit?.velocity ?? 0) / 127) * 100}%` }} /></div>
    </div>}
    {error && <div className="midi-inline-warning">{error}</div>}
  </div>;
}
