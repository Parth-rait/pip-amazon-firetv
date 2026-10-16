// The Pip Pad: one socket, one reducer, and the screen for the session's stage.
import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { DebugOverlay } from './components/DebugOverlay';
import { LabPanel } from './components/LabPanel';
import { Pip } from './components/Pip';
import { StatusPill } from './components/StatusPill';
import { getPlayerId, getSavedCode, getSavedName } from './lib/player-id';
import { connectPad, createSocket, type PadConnection } from './net/socket';
import { JoinScreen } from './screens/JoinScreen';
import { LobbyScreen } from './screens/LobbyScreen';
import { QuizScreen } from './screens/QuizScreen';
import { ResultsScreen } from './screens/ResultsScreen';
import { WatchScreen } from './screens/WatchScreen';
import type { AskVia, HostCommand, InputEnvelope, InputResult } from './shared/protocol';
import { initialState, isHost, isPipThinkingForMe, reducer } from './state/store';

const NEXT_CHIPS_MS = 60_000;
const ACK_TIMEOUT_MS = 5000;
const REPLY_TIMEOUT_MS = 20_000; // the server always replies; this only covers a lost message

function flag(name: string): boolean {
  return new URLSearchParams(window.location.search).get(name) === '1';
}

export function App() {
  const playerId = useMemo(() => getPlayerId(), []);
  const [state, dispatch] = useReducer(reducer, playerId, initialState);
  const socket = useMemo(() => createSocket(), []);
  const connection = useRef<PadConnection | null>(null);
  const [isDebug] = useState(() => flag('debug'));
  const [isLab] = useState(() => flag('lab'));
  const [focusSignal, setFocusSignal] = useState(0);

  useEffect(() => {
    connection.current = connectPad(socket, playerId, dispatch);
    return () => connection.current?.stop();
  }, [socket, playerId]);

  useEffect(() => {
    if (state.chips.kind === 'starter') return;
    const timer = setTimeout(() => dispatch({ type: 'chips-expired' }), NEXT_CHIPS_MS);
    return () => clearTimeout(timer);
  }, [state.chips]);

  useEffect(() => {
    if (!state.isAsking) return;
    const timer = setTimeout(
      () => dispatch({ type: 'ask-refused', reason: 'no-answer' }),
      REPLY_TIMEOUT_MS,
    );
    return () => clearTimeout(timer);
  }, [state.isAsking]);

  const sendHost = (command: HostCommand) => socket.emit('pad:host', command);

  const ask = async (text: string, via: AskVia) => {
    dispatch({ type: 'ask-sent' });
    try {
      const result = await socket.timeout(ACK_TIMEOUT_MS).emitWithAck('pad:ask', { text, via });
      if (!result.ok) dispatch({ type: 'ask-refused', reason: result.reason });
    } catch {
      dispatch({ type: 'ask-refused', reason: 'no-answer' });
    }
  };

  /** Done on my reply: close it here, and hide it on the TV if it is still mine there. */
  const closeReply = () => {
    dispatch({ type: 'reply-closed' });
    if (state.view?.assist?.askedBy === state.myId) socket.emit('pad:assist', { type: 'dismiss' });
  };

  const sendInput = async (
    input: InputEnvelope['input'],
    source: InputEnvelope['source'],
    eventId: string,
  ): Promise<InputResult | null> => {
    try {
      const result = await socket
        .timeout(ACK_TIMEOUT_MS)
        .emitWithAck('pad:input', { v: 1, eventId, source, sentAt: Date.now(), input });
      if (result.ok && result.intent === 'invoke') setFocusSignal((n) => n + 1);
      return result;
    } catch {
      return null;
    }
  };

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
          state={state}
          isHost={isHost(state)}
          isThinking={isPipThinkingForMe(state)}
          focusSignal={focusSignal}
          onCommand={sendHost}
          onAsk={(text, via) => void ask(text, via)}
          onDone={closeReply}
          onHideTv={() => socket.emit('pad:assist', { type: 'dismiss' })}
        />
      )}
      {view?.stage === 'quiz' && <QuizScreen />}
      {view?.stage === 'results' && <ResultsScreen />}
      {view && isLab && <LabPanel onInput={sendInput} />}
      {isDebug && <DebugOverlay socket={socket} />}
    </div>
  );
}
