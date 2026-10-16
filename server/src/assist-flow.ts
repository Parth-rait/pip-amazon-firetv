// Asking Pip: route the text, then act (deterministically) or answer (grounded), show the reply on
// the TV for a few seconds, and let anyone in the room dismiss it.
import { answerQuestion, recheckAtPosition, type AnswerResult } from './answer.js';
import { emptyTimeline } from './core/context/timeline.js';
import { shouldOfferCommandChoices } from './core/intent/judge.js';
import { routeText, type PlaybackIntent } from './core/intent/route-text.js';
import { restingPip, setPip } from './core/pip.js';
import { assistTimerKey, coreOf, positionOf, type FlowDeps } from './flow.js';
import { LINES } from './lines.js';
import { sendPlayback } from './playback-flow.js';
import type { Session } from './sessions.js';
import { LIMITS, type AskVia, type PipSay, type ReplyKind } from './shared/protocol.js';

const MAX_HISTORY = 3;
const JUDGE_THRESHOLD = 0.8;
// Each choice routes deterministically when tapped (routeText), so the judge never acts itself.
const COMMAND_CHOICES = ['Pause the film', 'Play the film', 'Go back 10 seconds'];

/** Sends a reply to the asker's own pads; the TV shows replies from view.assist instead. */
function sayTo(
  session: Session,
  playerId: string,
  question: string,
  say: Partial<PipSay> & { text: string; kind: ReplyKind },
  deps: FlowDeps,
): void {
  const player = session.players.get(playerId);
  if (!player) return;
  const full: PipSay = {
    askedBy: playerId,
    askedByName: player.name,
    question,
    next: [],
    clarify: [],
    source: 'template',
    ...say,
  };
  for (const socketId of player.socketIds) deps.io.to(socketId).emit('pip:say', full);
}

/** Hides Pip on the TV now, and lets Pip rest. Safe to call when nothing is showing. */
export function dismissAssist(session: Session, deps: FlowDeps): void {
  deps.timers.clear(assistTimerKey(session.code));
  const wasShowing = session.assist !== null && session.assist.phase === 'reply';
  if (!wasShowing) return;
  session.assist = null;
  setPip(session, restingPip(session), coreOf(session, deps));
}

function actionLine(intent: PlaybackIntent): string {
  if (intent.type === 'play') return LINES.play;
  if (intent.type === 'pause') return LINES.pause;
  return intent.deltaSec < 0
    ? LINES.seekBack(-intent.deltaSec)
    : LINES.seekForward(intent.deltaSec);
}

/**
 * Handles one accepted ask (realtime.ts has already checked stage, lock and rate). Commands never
 * reach a model; questions go through answerQuestion and the answer gate.
 */
export async function askPip(
  session: Session,
  playerId: string,
  text: string,
  via: AskVia,
  deps: FlowDeps,
): Promise<void> {
  const player = session.players.get(playerId);
  if (!player) return;
  player.lastAskAt = deps.now();
  const route = routeText(text);
  session.journal.append({
    at: deps.now(),
    type: 'ask.route',
    source: 'pad',
    actor: playerId,
    data: { via, route: route.kind },
  });
  if (route.kind === 'action') {
    if (session.hostId !== playerId) {
      const host = session.hostId ? session.players.get(session.hostId)?.name : undefined;
      sayTo(
        session,
        playerId,
        text,
        { text: LINES.onlyHost(host ?? 'The host'), kind: 'refused' },
        deps,
      );
      return;
    }
    const sent = sendPlayback(session, route.intent, playerId, null, deps);
    sayTo(
      session,
      playerId,
      text,
      { text: sent.ok ? actionLine(route.intent) : LINES.modelFailed, kind: 'action' },
      deps,
    );
    return;
  }
  if (route.kind === 'dismiss') {
    dismissAssist(session, deps);
    sayTo(session, playerId, text, { text: LINES.dismissed, kind: 'action' }, deps);
    return;
  }
  if (route.kind === 'ambiguous-command') {
    sayTo(
      session,
      playerId,
      text,
      { text: LINES.whatToStop, kind: 'clarify', clarify: route.options },
      deps,
    );
    return;
  }
  // Text the rules could not place may still be a command ("hold it a sec"). A typed judgement
  // can only offer explicit choices; a pick of "Did you mean" never asks the judge again.
  if (route.topic === 'other' && via !== 'clarify') {
    const judgement = await deps.judge.judge(text);
    if (shouldOfferCommandChoices(judgement, JUDGE_THRESHOLD)) {
      session.journal.append({
        at: deps.now(),
        type: 'ask.judged',
        source: 'server',
        actor: playerId,
        data: { judge: deps.judge.name, label: judgement?.label ?? null },
      });
      sayTo(
        session,
        playerId,
        text,
        { text: LINES.wantACommand, kind: 'clarify', clarify: COMMAND_CHOICES },
        deps,
      );
      return;
    }
  }
  await answerAndShow(session, playerId, text, via, route.topic, deps);
}

async function answerAndShow(
  session: Session,
  playerId: string,
  question: string,
  via: AskVia,
  topic: Parameters<typeof answerQuestion>[0]['topic'],
  deps: FlowDeps,
): Promise<void> {
  const player = session.players.get(playerId);
  const film = deps.films.find((f) => f.id === session.contentId);
  if (!player || !film) return;
  const timeline = deps.timelines.get(film.id) ?? emptyTimeline(film.id, film.durationSec);
  const contentAtStart = film.id;
  deps.timers.clear(assistTimerKey(session.code));
  session.asking = true;
  session.assist = {
    phase: 'thinking',
    askedBy: playerId,
    askedByName: player.name,
    question,
    text: null,
    kind: null,
  };
  setPip(session, 'thinking', coreOf(session, deps));
  let result: AnswerResult;
  try {
    result = await answerQuestion(
      {
        film,
        timeline,
        positionSec: positionOf(session, deps.now()),
        history: session.history,
        question,
        via,
        topic,
      },
      deps.answer,
    );
  } finally {
    session.asking = false;
  }
  if (session.stage !== 'watch' || session.contentId !== contentAtStart) {
    deps.log.info('ask.dropped', { code: session.code, playerId, why: 'stage-or-film-changed' });
    session.assist = null;
    setPip(session, restingPip(session), coreOf(session, deps));
    return;
  }
  // The film may have been rewound while the model was thinking: check again against now.
  result = recheckAtPosition(result, timeline, positionOf(session, deps.now()), deps.answer.policy);
  logReply(session, playerId, via, result, deps);
  if (result.kind === 'answer') {
    session.history = [
      ...session.history,
      { atSec: result.boundarySec, question, answer: result.text },
    ].slice(-MAX_HISTORY);
  }
  session.assist = {
    phase: 'reply',
    askedBy: playerId,
    askedByName: player.name,
    question,
    text: result.text,
    kind: result.kind,
  };
  sayTo(
    session,
    playerId,
    question,
    {
      text: result.text,
      kind: result.kind,
      next: result.next,
      clarify: result.clarify,
      source: result.source,
    },
    deps,
  );
  setPip(session, 'talking', coreOf(session, deps));
  deps.timers.set(assistTimerKey(session.code), LIMITS.assistShowMs, () =>
    dismissAssist(session, deps),
  );
}

function logReply(
  session: Session,
  playerId: string,
  via: AskVia,
  result: AnswerResult,
  deps: FlowDeps,
): void {
  const fields = {
    code: session.code,
    playerId,
    via,
    kind: result.kind,
    source: result.source,
    path: result.path,
    evidence: result.sources.length,
    boundarySec: Math.round(result.boundarySec),
    modelMs: result.modelMs,
    withheld: result.withheld,
    error: result.error,
  };
  deps.log.info('ask.done', fields);
  session.journal.append({
    at: deps.now(),
    type: 'ask.reply',
    source: 'server',
    actor: playerId,
    data: {
      kind: result.kind,
      path: result.path,
      sources: result.sources,
      withheld: result.withheld,
    },
  });
}
