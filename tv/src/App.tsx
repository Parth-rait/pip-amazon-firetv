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
  // Only 'background' lets go: 'inactive' is a passing state, and on the VVD (SDK 0.24, RN 0.83)
  // 'change' can stop arriving after the first background and foreground, while 'focus' still
  // comes (community.amazondeveloper.com/t/29128). Anything but 'background', or a focus, comes
  // back, so one missed event cannot leave the TV off the server with every command refused.
  useEffect(() => {
    const comeBack = () => {
      setIsActive(true);
      const s = getSocket();
      if (!s.connected) s.connect();
    };
    const change = AppState.addEventListener('change', (next) => {
      if (next !== 'background') return comeBack();
      setIsActive(false);
      getSocket().disconnect();
    });
    const focus = AppState.addEventListener('focus', comeBack); // unverified on Vega: harmless if never sent
    return () => {
      change.remove();
      focus.remove();
    };
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
