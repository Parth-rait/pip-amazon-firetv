// The Pip Pad's companion (PROJECT.md 2.4): "Catch me up" chapters, "Who's who" cards, "What
// happens next?" votes and the favourite moment. Everything is cut at the family's position, so
// nothing here can show a scene, a fact, a vote or an answer before its time.
import type { CompanionView, PredictionView } from '../shared/protocol.js';
import { sceneAt } from './ask-prompt.js';
import type { Content, Prediction } from './content.js';

/** A revealed prediction stays on screen this long after its reveal time. */
export const REVEAL_SHOW_SEC = 20;

/** predictionId -> playerId -> choice */
export type PredictionVotes = Record<string, Record<string, number>>;

const fullUrl = (path: string | undefined, publicUrl: string) =>
  path ? new URL(path, publicUrl).toString() : null;

/** The prediction to show now: an open one (the latest asked), or one revealed in the last 20 s. */
export function currentPrediction(
  film: Content,
  positionSec: number,
): { prediction: Prediction; status: 'open' | 'revealed' } | null {
  const asked = film.predictions.filter((p) => p.askAtSec <= positionSec);
  const open = asked.filter((p) => positionSec < p.revealAtSec);
  const latestOpen = open.at(-1);
  if (latestOpen) return { prediction: latestOpen, status: 'open' };
  const recent = asked.filter(
    (p) => positionSec >= p.revealAtSec && positionSec - p.revealAtSec <= REVEAL_SHOW_SEC,
  );
  const latestRevealed = recent.at(-1);
  return latestRevealed ? { prediction: latestRevealed, status: 'revealed' } : null;
}

function toPredictionView(
  prediction: Prediction,
  status: 'open' | 'revealed',
  votes: Record<string, number>,
): PredictionView {
  const isRevealed = status === 'revealed';
  return {
    id: prediction.id,
    question: prediction.question,
    choices: prediction.choices,
    status,
    votedIds: Object.keys(votes),
    answer: isRevealed ? prediction.answer : null,
    reveal: isRevealed ? prediction.reveal : null,
    picks: isRevealed ? { ...votes } : null,
  };
}

/** What the pads show beside the film at this position. */
export function buildCompanion(
  film: Content,
  positionSec: number,
  votes: PredictionVotes,
  publicUrl: string,
): CompanionView {
  const chapters = film.chapters
    .filter((chapter) => chapter.atSec <= positionSec)
    .map((chapter) => ({
      atSec: chapter.atSec,
      title: chapter.title,
      summary: chapter.summary,
      image: fullUrl(chapter.image, publicUrl),
    }));
  const characters = film.characters
    .map((character) => ({
      id: character.id,
      name: character.name,
      image: fullUrl(character.image, publicUrl),
      facts: character.facts.filter((f) => f.atSec <= positionSec).map((f) => f.text),
    }))
    .filter((character) => character.facts.length > 0);
  const current = currentPrediction(film, positionSec);
  return {
    chapters,
    characters,
    prediction: current
      ? toPredictionView(current.prediction, current.status, votes[current.prediction.id] ?? {})
      : null,
  };
}

/** Records a vote if that prediction is open at this position and the choice exists. */
export function recordVote(
  film: Content,
  positionSec: number,
  votes: PredictionVotes,
  playerId: string,
  vote: { id: string; choice: number },
): boolean {
  const current = currentPrediction(film, positionSec);
  if (!current || current.status !== 'open' || current.prediction.id !== vote.id) return false;
  if (vote.choice >= current.prediction.choices.length) return false;
  votes[vote.id] = { ...(votes[vote.id] ?? {}), [playerId]: vote.choice };
  return true;
}

/** Counts one reaction at the scene the family is in; returns that scene's atSec. */
export function recordReaction(
  film: Content,
  positionSec: number,
  reactions: Record<string, number>,
): number {
  const scene = sceneAt(film.notes, positionSec);
  reactions[scene] = (reactions[scene] ?? 0) + 1;
  return scene;
}

/** The scene with the most reactions (the earlier one on a tie), with its note, or null. */
export function favouriteMoment(
  film: Content,
  reactions: Record<string, number>,
): { atSec: number; text: string; reactions: number } | null {
  let best: { atSec: number; count: number } | null = null;
  for (const [key, count] of Object.entries(reactions)) {
    const atSec = Number(key);
    if (!best || count > best.count || (count === best.count && atSec < best.atSec)) {
      best = { atSec, count };
    }
  }
  if (!best) return null;
  const at = best.atSec;
  const note = film.notes.find((n) => n.atSec === at);
  return note ? { atSec: at, text: note.text, reactions: best.count } : null;
}
