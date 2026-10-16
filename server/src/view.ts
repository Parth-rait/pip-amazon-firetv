// buildView(): the one snapshot every screen draws from (PROJECT.md section 7.1).
import { isOnline } from './core/players.js';
import { toContentView, unlockedQuestions, type Content } from './film/content.js';
import { estimatePosition } from './film/playback.js';
import type { Session } from './sessions.js';
import type { ActionView, FeaturesView, SessionView } from './shared/protocol.js';

const NO_FEATURES: FeaturesView = { quiz: false };

/** The session as clients see it. Never holds notes, facts, answers or picks. */
export function buildView(
  session: Session,
  films: Content[],
  publicUrl: string,
  nowMs: number,
  features: FeaturesView = NO_FEATURES,
): SessionView {
  const isWatching = session.stage === 'watch';
  const action = session.lastAction;
  const lastAction: ActionView | null =
    isWatching && action
      ? {
          commandId: action.commandId,
          type: action.type,
          deltaSec: action.deltaSec,
          by: action.by,
          status: action.status,
        }
      : null;
  const film = films.find((f) => f.id === session.contentId) ?? null;
  const playback = session.playback;
  const quizUnlocked =
    features.quiz && isWatching && film && playback && playback.contentId === film.id
      ? unlockedQuestions(film, estimatePosition(playback, session.playbackAt, nowMs)).length
      : 0;
  return {
    code: session.code,
    stage: session.stage,
    tvOnline: session.tvSocketId !== null,
    hostId: session.hostId,
    players: [...session.players.values()].map((p) => ({
      id: p.id,
      name: p.name,
      score: p.score,
      online: isOnline(p),
    })),
    content: film ? toContentView(film, publicUrl) : null,
    playback,
    quizUnlocked,
    pip: session.pip,
    assist: isWatching ? session.assist : null,
    lastAction,
    features,
    quiz: null,
    results: null,
  };
}
