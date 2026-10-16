import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {PIP_COLORS, type QuizView, type SessionView} from '../shared/protocol';
import {ChoiceGrid} from '../components/ChoiceGrid';
import {CountdownBar} from '../components/CountdownBar';
import {Pip} from '../components/Pip';
import {PlayerChips} from '../components/PlayerChips';
import {SpeechBubble} from '../components/SpeechBubble';
import {color, dp, safe, space, type} from '../theme';

const REVEAL_MS = 60_000; // the explanation stays for the whole reveal

/**
 * QUIZ (PROJECT.md 3.3): the question number, the question, A to D in a 2 x 2 grid, the
 * countdown bar and the players, who light up when they have answered (never what they
 * picked). In the reveal: the right choice, everyone's picks and the explanation next to Pip.
 */
export function QuizScreen({view, quiz}: {view: SessionView; quiz: QuizView}) {
  const accent = PIP_COLORS[view.pipStyle.color];
  const isReveal = quiz.phase === 'reveal';
  return (
    <View style={styles.root}>
      <View style={styles.top}>
        <Text style={styles.count}>
          Question {quiz.index + 1} of {quiz.total}
        </Text>
        {isReveal ? (
          <Text style={styles.revealTag}>Answer</Text>
        ) : (
          <CountdownBar
            runKey={`${quiz.index}`}
            secondsLeft={quiz.secondsLeft}
            accent={accent}
          />
        )}
      </View>

      <Text style={styles.question} numberOfLines={2}>
        {quiz.question}
      </Text>

      <ChoiceGrid quiz={quiz} players={view.players} accent={accent} />

      <View style={styles.bottom}>
        <View style={styles.bottomLeft}>
          {isReveal ? null : (
            <PlayerChips
              players={view.players}
              hostId={null}
              highlightIds={quiz.answeredIds}
              accent={accent}
            />
          )}
        </View>
        <View style={styles.pipCorner}>
          {isReveal && quiz.explanation ? (
            <SpeechBubble
              key={`explain-${quiz.index}`}
              text={quiz.explanation}
              showMs={REVEAL_MS}
              tint={accent}
            />
          ) : null}
          <Pip
            state={view.pip}
            mood={view.pipStyle.mood}
            size={dp(96)}
            color={accent}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: color.bg,
    paddingHorizontal: safe.horizontal,
    paddingVertical: safe.vertical,
    gap: space.xl,
  },
  top: {flexDirection: 'row', alignItems: 'center', gap: space.xxxl},
  count: {color: color.textMuted, fontSize: type.title},
  revealTag: {color: color.textMuted, fontSize: type.title},
  question: {
    color: color.text,
    fontSize: dp(60),
    fontWeight: '700',
    lineHeight: dp(72),
  },
  bottom: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: space.xxl,
  },
  bottomLeft: {flex: 1},
  pipCorner: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: space.xl,
    flexShrink: 1,
  },
});
