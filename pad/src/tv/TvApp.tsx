// The TV simulator: says tv:hello on every connect (keeping its code and key in memory, like the
// real TV), draws the stage from session:view, and hands commands to the player.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import type {
  ClientToServerEvents,
  Playback,
  ServerToClientEvents,
  SessionView,
  TvCommand,
} from '../shared/protocol';
import { TvLobby } from './TvLobby';
import { TvWatch } from './TvWatch';

export type TvSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export interface Pairing {
  code: string;
  qrUrl: string;
  padUrl: string;
}

export function TvApp() {
  const socket = useMemo<TvSocket>(() => io({ autoConnect: false }), []);
  const [view, setView] = useState<SessionView | null>(null);
  const [pairing, setPairing] = useState<Pairing | null>(null);
  const [isOnline, setIsOnline] = useState(false);
  const memory = useRef<{ code: string | null; tvKey: string | null }>({ code: null, tvKey: null });
  const playback = useRef<Playback | null>(null); // the player's latest report, for tv:hello
  const commandHandler = useRef<((command: TvCommand) => void) | null>(null);
  const keepReport = useCallback((report: Playback) => void (playback.current = report), []);
  const setCommandHandler = useCallback(
    (handler: ((command: TvCommand) => void) | null) => void (commandHandler.current = handler),
    [],
  );

  useEffect(() => {
    socket.on('connect', async () => {
      setIsOnline(true);
      const result = await socket.emitWithAck('tv:hello', {
        previousCode: memory.current.code,
        tvKey: memory.current.tvKey,
        playback: playback.current,
      });
      if (!result.ok) return;
      memory.current = { code: result.code, tvKey: result.tvKey };
      setPairing({ code: result.code, qrUrl: result.qrUrl, padUrl: result.padUrl });
    });
    socket.on('disconnect', () => setIsOnline(false));
    socket.on('session:view', (next) => {
      setView(next);
      if (next.stage !== 'watch') playback.current = null;
    });
    socket.on('tv:command', (command) => commandHandler.current?.(command));
    socket.connect();
    return () => {
      socket.removeAllListeners();
      socket.disconnect();
    };
  }, [socket]);

  return (
    <div className="tv">
      {!isOnline && <div className="tv__status">Reconnecting</div>}
      {view?.stage === 'watch' && view.content ? (
        <TvWatch
          socket={socket}
          view={view}
          content={view.content}
          onReport={keepReport}
          setCommandHandler={setCommandHandler}
        />
      ) : (
        <TvLobby socket={socket} view={view} pairing={pairing} />
      )}
    </div>
  );
}
