import React, {useEffect, useState} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {KeplerVideoSurfaceView} from '@amazon-devices/react-native-w3cmedia';
import {SERVER_URL} from '../config';
import {getSocket, pingOnce} from '../net/socket';
import {usePlayer, type PlayerReport} from '../player/use-player';
import type {ContentView} from '../shared/protocol';

type Check = {ok: boolean | null; text: string};
const pending: Check = {ok: null, text: 'checking...'};
const PING_EVERY_MS = 5000;

function errorText(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${SERVER_URL}${path}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as T;
}

export function DiagnosticsScreen() {
  const [health, setHealth] = useState<Check>(pending);
  const [socket, setSocket] = useState<Check>(pending);
  const [films, setFilms] = useState<Check>(pending);
  const [video, setVideo] = useState<Check>({
    ok: null,
    text: 'waiting for the film list',
  });
  const [report, setReport] = useState<PlayerReport | null>(null);
  const player = usePlayer(setReport, (message) =>
    setVideo({ok: false, text: message}),
  );
  const {load, play} = player;

  useEffect(() => {
    getJson<{ok: boolean; version: string}>('/health')
      .then((body) =>
        setHealth({ok: body.ok, text: `ok, server ${body.version}`}),
      )
      .catch((err) => setHealth({ok: false, text: errorText(err)}));
  }, []);

  useEffect(() => {
    let cancelled = false;
    getJson<ContentView[]>('/api/films')
      .then(async (list) => {
        const first = list[0];
        if (!first) throw new Error('no films');
        setFilms({ok: true, text: first.title});
        await load(first.url);
        if (cancelled) return;
        play();
        setVideo({ok: null, text: `loading ${first.url}`});
      })
      .catch((err) => {
        setFilms({ok: false, text: errorText(err)});
        setVideo({ok: false, text: 'no film to play'});
      });
    return () => {
      cancelled = true;
    };
  }, [load, play]);

  useEffect(() => {
    const s = getSocket();
    let timer: ReturnType<typeof setInterval> | undefined;
    const stop = () => {
      if (timer !== undefined) clearInterval(timer);
      timer = undefined;
    };
    const ping = async () => {
      const ms = await pingOnce(s);
      setSocket(
        ms === null
          ? {ok: false, text: 'connected, ping timed out'}
          : {ok: ms < 300, text: `connected, round trip ${ms} ms`},
      );
    };
    const onConnect = () => {
      ping();
      stop();
      timer = setInterval(ping, PING_EVERY_MS);
    };
    const onDisconnect = (reason: string) => {
      stop();
      setSocket({ok: false, text: `disconnected: ${reason}`});
    };
    const onError = (err: Error) =>
      setSocket({ok: false, text: `connect error: ${err.message}`});
    s.on('connect', onConnect);
    s.on('disconnect', onDisconnect);
    s.on('connect_error', onError);
    if (s.connected) onConnect();
    return () => {
      stop();
      s.off('connect', onConnect);
      s.off('disconnect', onDisconnect);
      s.off('connect_error', onError);
    };
  }, []);

  useEffect(() => {
    if (!report) return;
    const state = report.ended ? 'ended' : report.paused ? 'paused' : 'playing';
    setVideo({
      ok: report.positionSec > 0 || !report.paused,
      text: `${state} ${report.positionSec.toFixed(
        1,
      )} / ${report.durationSec.toFixed(0)} s`,
    });
  }, [report]);

  return (
    <View style={styles.root}>
      <KeplerVideoSurfaceView
        style={styles.video}
        scalingmode="fit"
        onSurfaceViewCreated={player.onSurfaceViewCreated}
        onSurfaceViewDestroyed={player.onSurfaceViewDestroyed}
      />
      <View style={styles.panel}>
        <Text style={styles.title}>Pip diagnostics</Text>
        <Line label="SERVER_URL" check={{ok: true, text: SERVER_URL}} />
        <Line label="GET /health" check={health} />
        <Line label="Socket.IO" check={socket} />
        <Line label="GET /api/films" check={films} />
        <Line label="Film" check={video} />
      </View>
    </View>
  );
}

function Line({label, check}: {label: string; check: Check}) {
  // Mirror each line into the device log so it can be read without seeing the screen.
  useEffect(() => {
    const state = check.ok === null ? 'WAIT' : check.ok ? 'OK' : 'FAIL';
    console.log(`[pip-diag] ${state} ${label}: ${check.text}`);
  }, [label, check.ok, check.text]);
  const color =
    check.ok === null ? '#F5C542' : check.ok ? '#4ADE80' : '#F87171';
  return (
    <View style={styles.line}>
      <View style={[styles.dot, {backgroundColor: color}]} />
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value} numberOfLines={1}>
        {check.text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: '#000000'},
  video: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 0,
  },
  panel: {
    position: 'absolute',
    top: 54,
    left: 96,
    width: 1100,
    padding: 24,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    zIndex: 1,
  },
  title: {color: '#FFFFFF', fontSize: 32, fontWeight: '600', marginBottom: 12},
  line: {flexDirection: 'row', alignItems: 'center', marginVertical: 6},
  dot: {width: 18, height: 18, borderRadius: 9, marginRight: 16},
  label: {color: '#FFFFFF', fontSize: 24, width: 220},
  value: {color: '#E5E7EB', fontSize: 24, flex: 1},
});
