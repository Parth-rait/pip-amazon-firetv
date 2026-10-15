// ?debug=1: the sys:ping round trip every 5 s, to measure the tap-to-TV budget (section 4.9).
import { useEffect, useState } from 'react';
import type { PadSocket } from '../net/socket';

const PING_EVERY_MS = 5000;
const PING_TIMEOUT_MS = 4000;

export function DebugOverlay({ socket }: { socket: PadSocket }) {
  const [roundTripMs, setRoundTripMs] = useState<number | null>(null);

  useEffect(() => {
    const ping = async () => {
      if (!socket.connected) return setRoundTripMs(null);
      const sentAt = Date.now();
      try {
        await socket.timeout(PING_TIMEOUT_MS).emitWithAck('sys:ping', { sentAt });
        setRoundTripMs(Date.now() - sentAt);
      } catch {
        setRoundTripMs(null);
      }
    };
    void ping();
    const timer = setInterval(() => void ping(), PING_EVERY_MS);
    return () => clearInterval(timer);
  }, [socket]);

  return <div className="debug">ping {roundTripMs === null ? '-' : `${roundTripMs} ms`}</div>;
}
