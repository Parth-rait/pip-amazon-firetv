// The Pip Pad: one socket, one reducer, and the screen for the session's stage.
import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { DebugOverlay } from './components/DebugOverlay';
import { Pip } from './components/Pip';
import { StatusPill } from './components/StatusPill';
import { getPlayerId, getSavedCode, getSavedName } from './lib/player-id';
import { connectPad, createSocket, sendAsk, type PadConnection } from './net/socket';
import { JoinScreen } from './screens/JoinScreen';
import { LobbyScreen } from './screens/LobbyScreen';
import { QuizScreen } from './screens/QuizScreen';
import { ResultsScreen } from './screens/ResultsScreen';
import { WatchScreen } from './screens/WatchScreen';
import type { AskVia, HostCommand } from './shared/protocol';
import { initialState, isHost, reducer } from './state/store';

const NEXT_CHIPS_MS = 60_000;

export function App() {
  const playerId = useMemo(() => getPlayerId(), []);
  const [state, dispatch] = useReducer(reducer, playerId, initialState);
  const socket = useMemo(() => createSocket(), []);
  const connection = useRef<PadConnection | null>(null);
  const [isDebug] = useState(
    () => new URLSearchParams(window.location.search).get('debug') === '1',
  );

  useEffect(() => {
    connection.current = connectPad(socket, playerId, dispatch);
    return () => connection.current?.stop();
  }, [socket, playerId]);

  useEffect(() => {
    if (state.chips.kind === 'starter') return;
    const timer = setTimeout(() => dispatch({ type: 'chips-expired' }), NEXT_CHIPS_MS);
    return () => clearTimeout(timer);
  }, [state.chips]);

  const sendHost = (command: HostCommand) => socket.emit('pad:host', command);
  const ask = (text: string, via: AskVia) => sendAsk(socket, text, via);
  const { view } = state;

  return (
    <div className="app">
      {view && (
        <header className="top-bar">
          <Pip state={view.pip} size={40} />
          <StatusPill
            connection={state.connection}
            tvOnline={view.tvOnline}
            isLookingForTv={state.lookingForTv}
            onJoinAnother={() => connection.current?.leave()}
          />
        </header>
      )}
      {!view && (
        <JoinScreen
          initialCode={getSavedCode() ?? ''}
          initialName={getSavedName() ?? ''}
          error={state.joinError}
          isOnline={state.connection === 'online'}
          onJoin={(code, name) => connection.current?.join(code, name) ?? Promise.resolve(null)}
        />
      )}
      {view?.stage === 'lobby' && (
        <LobbyScreen view={view} myId={state.myId} isHost={isHost(state)} onCommand={sendHost} />
      )}
      {view?.stage === 'watch' && (
        <WatchScreen
          view={view}
          playbackAt={state.playbackAt}
          isHost={isHost(state)}
          chips={state.chips}
          say={state.say}
          onCommand={sendHost}
          onAsk={ask}
          onSomethingElse={() => dispatch({ type: 'chips-expired' })}
        />
      )}
      {view?.stage === 'quiz' && <QuizScreen />}
      {view?.stage === 'results' && <ResultsScreen />}
      {isDebug && <DebugOverlay socket={socket} />}
    </div>
  );
}
