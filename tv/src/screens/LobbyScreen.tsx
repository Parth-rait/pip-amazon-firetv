import React, {useEffect, useState} from 'react';
import {Image, Pressable, StyleSheet, Text, View} from 'react-native';
import {SERVER_URL} from '../config';
import {getSocket} from '../net/socket';
import type {ContentView, SessionView} from '../shared/protocol';
import {Pip} from '../components/Pip';
import {PlayerChips} from '../components/PlayerChips';
import {color, dp, radius, safe, space, type} from '../theme';

const QR_SIZE = dp(320);

/** LOBBY (PROJECT.md 3.3): Pip, the QR code, the code, the films and the players. */
export function LobbyScreen({
  view,
  qrUrl,
}: {
  view: SessionView;
  qrUrl: string | null;
}) {
  const [films, setFilms] = useState<ContentView[] | null>(null);
  const [filmsFailed, setFilmsFailed] = useState(false);

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
        <Text style={styles.brand}>Pip</Text>
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
            <FilmCard key={film.id} film={film} preferred={i === 0} />
          ))}
        </View>
      </View>

      <View style={styles.players}>
        {view.players.length > 0 ? (
          <PlayerChips players={view.players} hostId={view.hostId} />
        ) : (
          <Text style={styles.muted}>
            Point a phone camera at the code to join.
          </Text>
        )}
      </View>
    </View>
  );
}

function FilmCard({film, preferred}: {film: ContentView; preferred: boolean}) {
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      hasTVPreferredFocus={preferred}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onPress={() => getSocket().emit('tv:watch', {contentId: film.id})}
      style={[styles.card, focused && styles.cardFocused]}>
      <Text style={styles.cardTitle}>{film.title}</Text>
      <Text style={styles.muted}>{Math.round(film.durationSec / 60)} min</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: color.bg,
    paddingHorizontal: safe.horizontal,
    paddingVertical: safe.vertical,
  },
  header: {flexDirection: 'row', alignItems: 'center', gap: space.xl},
  brand: {color: color.text, fontSize: type.title, fontWeight: '600'},
  main: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xxxl * 2,
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
  films: {flex: 1, gap: space.xl},
  card: {
    padding: space.xxl,
    gap: space.s,
    borderRadius: radius,
    borderWidth: dp(4),
    borderColor: 'transparent',
    backgroundColor: color.surface,
  },
  // Focus needs a physical change, not only a color (Vega focus guide).
  cardFocused: {
    borderColor: color.accent,
    backgroundColor: color.surface2,
    transform: [{scale: 1.05}],
  },
  cardTitle: {color: color.text, fontSize: type.title, fontWeight: '600'},
  muted: {color: color.textMuted, fontSize: type.caption},
  players: {minHeight: dp(72), justifyContent: 'center'},
});
