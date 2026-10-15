// buildView(): the one snapshot every screen draws from (PROJECT.md section 7.1).
import { isOnline } from './core/players.js';
import { toContentView, unlockedQuestions, type Content } from './film/content.js';
import { estimatePosition } from './film/playback.js';
import type { Session } from './sessions.js';
import type { SessionView } from './shared/protocol.js';

/** The session as clients see it. Never holds notes, answers or picks (quiz comes in Step 9). */
export function buildView(
  session: Session,
  films: Content[],
  publicUrl: string,
  nowMs: number,
): SessionView {
  const film = films.find((f) => f.id === session.contentId) ?? null;
  const playback = session.playback;
  const quizUnlocked =
    session.stage === 'watch' && film && playback && playback.contentId === film.id
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
    quiz: null,
    results: null,
  };
}
