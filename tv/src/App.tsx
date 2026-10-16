import React, {useEffect, useReducer, useState} from 'react';
import {AppState, StyleSheet, View} from 'react-native';
import {SHOW_DIAGNOSTICS} from './config';
import {getSocket, sendHello} from './net/socket';
import {initialTvState, tvReducer} from './state/tv-store';
import {StatusPill} from './components/StatusPill';
import {DiagnosticsScreen} from './screens/DiagnosticsScreen';
import {LobbyScreen} from './screens/LobbyScreen';
import {QuizScreen} from './screens/QuizScreen';
import {ResultsScreen} from './screens/ResultsScreen';
import {StageScreen} from './screens/StageScreen';
import {WatchScreen} from './screens/WatchScreen';
import {color} from './theme';

export const App = () => {
  if (SHOW_DIAGNOSTICS) return <DiagnosticsScreen />;
  return <PipTv />;
};

function PipTv() {
  const [state, dispatch] = useReducer(tvReducer, initialTvState);
  const [isActive, setIsActive] = useState(
    AppState.currentState !== 'background',
  );

  // In the background a Vega app must release its player; its network is cut too. So the TV
  // closes its socket and unmounts the watch screen, and on its way back reconnects with its
  // code: the server still has the film's position, so the film resumes (a warm start).
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      const active = next === 'active';
      setIsActive(active);
      const s = getSocket();
      if (active && !s.connected) s.connect();
      if (!active) s.disconnect();
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    const s = getSocket();
    const onConnect = () => {
      dispatch({type: 'connected'});
      sendHello(s, (r) =>
        dispatch({
          type: 'hello',
          code: r.code,
          padUrl: r.padUrl,
          qrUrl: r.qrUrl,
        }),
      );
    };
    const onDisconnect = () => dispatch({type: 'disconnected'});
    s.on('connect', onConnect);
    s.on('disconnect', onDisconnect);
    s.on('session:view', (view) => dispatch({type: 'view', view}));
    s.on('pip:say', (say) => dispatch({type: 'say', say}));
    s.on('pip:hello', (hello) => dispatch({type: 'greet', hello}));
    if (s.connected) onConnect();
    return () => {
      s.off('connect', onConnect);
      s.off('disconnect', onDisconnect);
      s.off('session:view');
      s.off('pip:say');
      s.off('pip:hello');
    };
  }, []);

  const {view} = state;
  if (!isActive) return <View style={styles.root} />;
  // The server owns the stage; the TV draws whatever session:view says (PROJECT.md 3.3).
  return (
    <View style={styles.root}>
      {!view ? (
        <StageScreen pip="sleep" line="Connecting" />
      ) : view.stage === 'lobby' || !view.content ? (
        <LobbyScreen
          view={view}
          qrUrl={state.hello?.qrUrl ?? null}
          greet={state.greet}
        />
      ) : (
        <>
          <WatchScreen
            key={view.content.id}
            view={view}
            content={view.content}
            say={state.say}
          />
          {view.stage === 'quiz' && view.quiz && (
            <QuizScreen view={view} quiz={view.quiz} />
          )}
          {view.stage === 'results' && view.results && (
            <ResultsScreen view={view} results={view.results} />
          )}
        </>
      )}
      {view && <StatusPill connected={state.connected} />}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: color.bg},
});
