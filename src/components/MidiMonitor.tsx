import { useEffect, useRef, useState } from 'react';
import { connectMidi, isWebMidiSupported, type DrumHit, type MidiDevice } from '../midi/midi';

export function MidiMonitor() {
  const [devices, setDevices] = useState<MidiDevice[]>([]);
  const [lastHit, setLastHit] = useState<DrumHit | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const disconnectRef = useRef<(() => void) | null>(null);
  const supported = isWebMidiSupported();

  async function handleConnect() {
    try {
      setConnecting(true);
      setError(null);
      disconnectRef.current?.();

      const session = await connectMidi(setLastHit);
      disconnectRef.current = session.disconnect;
      setDevices(session.devices);

      if (session.devices.length === 0) {
        setError('MIDI permission granted, but no input device was found.');
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not connect to MIDI.');
    } finally {
      setConnecting(false);
    }
  }

  useEffect(() => () => disconnectRef.current?.(), []);

  return (
    <section className="midi-card">
      <div className="midi-header">
        <div>
          <span className="section-label">LIVE INPUT</span>
          <h2>Electronic drums</h2>
          <p>Connect a USB MIDI kit and inspect each hit before we plug it into the practice engine.</p>
        </div>

        <button type="button" onClick={() => void handleConnect()} disabled={!supported || connecting}>
          {connecting ? 'Connecting…' : devices.length > 0 ? 'Reconnect drums' : 'Connect drums'}
        </button>
      </div>

      {!supported && (
        <div className="midi-warning">Web MIDI is unavailable in this browser. Use Chrome or Edge on desktop.</div>
      )}

      {error && <div className="midi-warning">{error}</div>}

      <div className="midi-grid">
        <div>
          <span>Status</span>
          <strong className={devices.length > 0 ? 'connected' : ''}>
            {devices.length > 0 ? 'Connected' : 'Waiting'}
          </strong>
        </div>
        <div>
          <span>Device</span>
          <strong>{devices[0]?.name ?? '—'}</strong>
        </div>
        <div>
          <span>Instrument</span>
          <strong>{lastHit?.instrument ?? '—'}</strong>
        </div>
        <div>
          <span>Note</span>
          <strong>{lastHit?.note ?? '—'}</strong>
        </div>
        <div>
          <span>Velocity</span>
          <strong>{lastHit?.velocity ?? '—'}</strong>
        </div>
        <div>
          <span>Channel</span>
          <strong>{lastHit?.channel ?? '—'}</strong>
        </div>
      </div>

      <div className="velocity-meter" aria-label="MIDI velocity">
        <div style={{ width: `${((lastHit?.velocity ?? 0) / 127) * 100}%` }} />
      </div>
    </section>
  );
}
