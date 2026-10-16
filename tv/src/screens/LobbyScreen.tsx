import React, {useEffect, useRef, useState} from 'react';
import {
  findNodeHandle,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {FocusManager} from '@amazon-devices/react-native-kepler';
import {SERVER_URL} from '../config';
import {getSocket} from '../net/socket';
import {type ContentView, type SessionView} from '../shared/protocol';
import type {GreetEntry} from '../state/tv-store';
import {Pip} from '../components/Pip';
import {PlayerChips} from '../components/PlayerChips';
import {SpeechBubble} from '../components/SpeechBubble';
import {color, dp, radius, safe, space, type} from '../theme';

const QR_SIZE = dp(320);
const POSTER_WIDTH = dp(520);
const GREETING_MS = 4000;

/** LOBBY (PROJECT.md 3.3 and 2.4): Pip, the QR code, the code, the films and the players. */
export function LobbyScreen({
  view,
  qrUrl,
  greet,
}: {
  view: SessionView;
  qrUrl: string | null;
  greet: GreetEntry | null;
}) {
  const [films, setFilms] = useState<ContentView[] | null>(null);
  const [filmsFailed, setFilmsFailed] = useState(false);
  const accent = color.accent;
  const firstCard = useRef<View>(null);

  // hasTVPreferredFocus alone landed on the last card; focus the first one once the films are in.
  useEffect(() => {
    if (films && films.length > 0 && firstCard.current) {
      FocusManager.focus(findNodeHandle(firstCard.current));
    }
  }, [films]);

  useEffect(() => {
    fetch(`${SERVER_URL}/api/films`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<ContentView[]>;
      })
      .then(setFilms)
      .catch(() => setFilmsFailed(true));
  }, []);

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Pip state={view.pip} size={dp(96)} />
        {greet ? (
          <SpeechBubble
            key={greet.id}
            text={greet.hello.text}
            showMs={GREETING_MS}
            tint={accent}
          />
        ) : (
          <Text style={styles.brand}>Pip</Text>
        )}
      </View>

      <View style={styles.main}>
        <View style={styles.join}>
          <View style={styles.qrCard}>
            {qrUrl ? (
              <Image source={{uri: qrUrl}} style={styles.qr} />
            ) : (
              <View style={styles.qr} />
            )}
          </View>
          <View style={styles.joinText}>
            <Text style={styles.scan}>Scan to join</Text>
            <Text style={styles.or}>or enter</Text>
            <Text style={styles.code}>{view.code.split('').join(' ')}</Text>
          </View>
        </View>

        <View style={styles.films}>
          {filmsFailed && (
            <Text style={styles.muted}>
              Films didn't load. Check the server, then restart the app.
            </Text>
          )}
          {films?.map((film, i) => (
            <FilmCard
              key={film.id}
              ref={i === 0 ? firstCard : undefined}
              film={film}
              preferred={i === 0}
              accent={accent}
            />
          ))}
        </View>
      </View>

      <View style={styles.players}>
        {view.players.length > 0 ? (
          <PlayerChips
            players={view.players}
            hostId={view.hostId}
            accent={accent}
          />
        ) : (
          <Text style={styles.muted}>
            Point a phone camera at the code to join.
          </Text>
        )}
      </View>
    </View>
  );
}

function FilmCard({
  ref,
  film,
  preferred,
  accent,
}: {
  ref?: React.Ref<View>;
  film: ContentView;
  preferred: boolean;
  accent: string;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      ref={ref}
      hasTVPreferredFocus={preferred}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onPress={() => getSocket().emit('tv:watch', {contentId: film.id})}
      style={[
        styles.card,
        focused && [styles.cardFocused, {borderColor: accent}],
      ]}>
      {film.poster ? (
        <Image source={{uri: film.poster}} style={styles.poster} />
      ) : (
        <View style={styles.poster} />
      )}
      <View style={styles.cardText}>
        <Text style={styles.cardTitle}>{film.title}</Text>
        <Text style={styles.cardMinutes}>
          {Math.round(film.durationSec / 60)} min
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: color.bg,
    paddingHorizontal: safe.horizontal,
    paddingVertical: safe.vertical,
    gap: space.xl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xl,
    minHeight: dp(96),
  },
  brand: {color: color.text, fontSize: type.title, fontWeight: '600'},
  main: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.xxxl,
  },
  join: {flexDirection: 'row', alignItems: 'center', gap: space.xxxl},
  qrCard: {
    padding: space.xl,
    borderRadius: radius,
    backgroundColor: '#FFFFFF',
  },
  qr: {width: QR_SIZE, height: QR_SIZE},
  joinText: {gap: space.m},
  scan: {color: color.text, fontSize: type.title, fontWeight: '600'},
  or: {color: color.textMuted, fontSize: type.body},
  code: {
    color: color.text,
    fontSize: type.display,
    fontWeight: '700',
    letterSpacing: space.l,
  },
  films: {gap: space.xl},
  card: {
    width: POSTER_WIDTH,
    borderRadius: radius,
    borderWidth: dp(4),
    borderColor: 'transparent',
    overflow: 'hidden',
    backgroundColor: color.surface,
  },
  // Focus needs a physical change, not only a color (Vega focus guide).
  cardFocused: {transform: [{scale: 1.05}]},
  poster: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: color.surface2,
  },
  cardText: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingHorizontal: space.xl,
    paddingVertical: space.l,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
  },
  cardTitle: {color: color.text, fontSize: type.title, fontWeight: '700'},
  cardMinutes: {color: 'rgba(255, 255, 255, 0.8)', fontSize: type.caption},
  muted: {color: color.textMuted, fontSize: type.caption},
  players: {minHeight: dp(120), justifyContent: 'center'},
});
