import React, {useCallback, useEffect, useRef, useState} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {KeplerVideoSurfaceView} from '@amazon-devices/react-native-w3cmedia';
import {getSocket, setHelloPlayback} from '../net/socket';
import {usePlayer, type PlayerReport} from '../player/use-player';
import {
  PIP_COLORS,
  type ContentView,
  type Playback,
  type SessionView,
  type TvCommand,
} from '../shared/protocol';
import type {GreetEntry, SayEntry} from '../state/tv-store';
import {Fade} from '../components/Fade';
import {Pip} from '../components/Pip';
import {SpeechBubble} from '../components/SpeechBubble';
import {color, dp, radius, safe, space, type} from '../theme';

const CREDIT_MS = 4000;
const PAUSE_BAR_MS = 3000;
const ANSWER_MS = 8000;
const GREETING_MS = 4000;

/**
 * WATCH (PROJECT.md 3.3 and 4.5, Watch). Stays mounted through the quiz and the results so
 * "Keep watching" resumes at once; the quiz and results screens cover it.
 */
export function WatchScreen({
  view,
  content,
  say,
  greet,
}: {
  view: SessionView;
  content: ContentView;
  greet: GreetEntry | null;
  say: SayEntry | null;
}) {
  const active = view.stage === 'watch';
  const accent = PIP_COLORS[view.pipStyle.color];
  const activeRef = useRef(active);
  activeRef.current = active;
  const viewRef = useRef(view);
  viewRef.current = view;

  const [report, setReport] = useState<PlayerReport | null>(null);
  const [failed, setFailed] = useState(false);
  const [showCredit, setShowCredit] = useState(false);
  const [showPauseBar, setShowPauseBar] = useState(false);

  const onReport = useCallback(
    (r: PlayerReport) => {
      setReport(r);
      const playback: Playback = {contentId: content.id, ...r};
      setHelloPlayback(activeRef.current ? playback : null);
      getSocket().emit('tv:playback', playback);
    },
    [content.id],
  );
  const player = usePlayer(onReport, (message) => {
    console.warn(`[pip] ${message}`);
    setFailed(true);
  });
  const {load, play, pause, seekBy, playerRef} = player;
  const loadedRef = useRef(false);

  // Load the film at the resume point: the server's playback for this film, unless it ended.
  useEffect(() => {
    let cancelled = false;
    const last = viewRef.current.playback;
    const resume =
      last && last.contentId === content.id && !last.ended
        ? last.positionSec
        : 0;
    loadedRef.current = false;
    setFailed(false);
    load(content.url, resume)
      .then(() => {
        if (cancelled) return;
        loadedRef.current = true;
        if (activeRef.current) {
          play();
          setShowCredit(true);
        }
      })
      .catch((err: unknown) => {
        console.warn(`[pip] load failed: ${String(err)}`);
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [content.id, content.url, load, play]);

  // Pause when the stage leaves watch; play again when it comes back (from the start if it ended).
  useEffect(() => {
    if (!loadedRef.current) return;
    if (active) {
      const p = playerRef.current;
      if (p?.ended) p.currentTime = 0;
      play();
    } else {
      setHelloPlayback(null);
      pause();
    }
  }, [active, play, pause, playerRef]);

  useEffect(() => () => setHelloPlayback(null), []);

  // The host's commands, sent by the server to the TV only.
  useEffect(() => {
    const s = getSocket();
    const onCommand = (command: TvCommand) => {
      if (!activeRef.current) return;
      if (command.type === 'play') play();
      if (command.type === 'pause') pause();
      if (command.type === 'seek') seekBy(command.deltaSec);
    };
    s.on('tv:command', onCommand);
    return () => {
      s.off('tv:command', onCommand);
    };
  }, [play, pause, seekBy]);

  useEffect(() => {
    if (!showCredit) return;
    const t = setTimeout(() => setShowCredit(false), CREDIT_MS);
    return () => clearTimeout(t);
  }, [showCredit]);

  const paused = report?.paused ?? false;
  const ended = report?.ended ?? false;
  useEffect(() => {
    if (!paused || ended) {
      setShowPauseBar(false);
      return;
    }
    setShowPauseBar(true);
    const t = setTimeout(() => setShowPauseBar(false), PAUSE_BAR_MS);
    return () => clearTimeout(t);
  }, [paused, ended]);

  return (
    <View style={styles.root}>
      <KeplerVideoSurfaceView
        style={styles.video}
        scalingmode="fit"
        onSurfaceViewCreated={player.onSurfaceViewCreated}
        onSurfaceViewDestroyed={player.onSurfaceViewDestroyed}
      />
      {active && (
        <View style={styles.overlay} pointerEvents="none">
          <Fade visible={showCredit} style={styles.credit}>
            <Text style={styles.caption}>{content.credit}</Text>
          </Fade>

          <Fade visible={showPauseBar} style={styles.pauseBar}>
            <Text style={styles.body}>{content.title}</Text>
            <Text style={styles.caption}>
              {clock(report?.positionSec ?? 0)} /{' '}
              {clock(report?.durationSec || content.durationSec)}
            </Text>
          </Fade>

          {(ended || failed) && (
            <View style={styles.centre}>
              <Text style={styles.title}>
                {failed
                  ? "The film didn't load."
                  : 'The end. Ready for the quiz?'}
              </Text>
            </View>
          )}

          <View style={styles.corner}>
            {say ? (
              <SpeechBubble
                key={`say-${say.id}`}
                above={`${say.say.askedByName} asked: ${say.say.question}`}
                text={say.say.text}
                showMs={ANSWER_MS}
                tint={accent}
              />
            ) : greet ? (
              <SpeechBubble
                key={`greet-${greet.id}`}
                text={greet.hello.text}
                showMs={GREETING_MS}
                tint={accent}
              />
            ) : null}
            <Pip state={view.pip} size={dp(96)} color={accent} />
          </View>
        </View>
      )}
    </View>
  );
}

function clock(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: '#000000'},
  video: {position: 'absolute', top: 0, left: 0, right: 0, bottom: 0},
  overlay: {
    ...StyleSheet.absoluteFillObject,
    paddingHorizontal: safe.horizontal,
    paddingVertical: safe.vertical,
  },
  credit: {
    position: 'absolute',
    left: safe.horizontal,
    bottom: safe.vertical,
    maxWidth: dp(1100),
    padding: space.l,
    borderRadius: radius,
    backgroundColor: 'rgba(11, 11, 15, 0.7)',
  },
  pauseBar: {
    position: 'absolute',
    left: safe.horizontal,
    right: safe.horizontal,
    top: safe.vertical,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: space.xxl,
    paddingVertical: space.l,
    borderRadius: radius,
    backgroundColor: 'rgba(11, 11, 15, 0.8)',
  },
  centre: {flex: 1, alignItems: 'center', justifyContent: 'center'},
  corner: {
    position: 'absolute',
    right: safe.horizontal,
    bottom: safe.vertical,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: space.xl,
  },
  title: {
    color: color.text,
    fontSize: type.title,
    fontWeight: '600',
    padding: space.xl,
    borderRadius: radius,
    backgroundColor: 'rgba(11, 11, 15, 0.8)',
  },
  body: {color: color.text, fontSize: type.body},
  caption: {color: color.textMuted, fontSize: type.caption},
});
