// shared/protocol.ts
// The contract between the server, the Pip Pad (pad/) and the TV app (tv/).
// Edit only this file, then run `npm run sync:shared` to copy it into each package.
// Types and constants only: no imports, so it compiles in Node, browsers and React Native for Vega.

export const PROTOCOL_VERSION = 2;

/** Where the session is in the journey. The server owns it; the TV and pads follow it. */
export type Stage = 'lobby' | 'watch' | 'quiz' | 'results';
export type PipState = 'sleep' | 'idle' | 'thinking' | 'talking' | 'cheer';
export type Source = 'ai' | 'template';
/** How a question was asked: typed, spoken, or tapped from the starter, next or "Did you mean" chips. */
export type AskVia = 'typed' | 'voice' | 'starter' | 'next' | 'clarify';

/** A film as clients see it. Never includes the notes or the quiz. */
export interface ContentView {
  id: string;
  title: string;
  url: string; // full URL of the MP4
  credit: string;
  durationSec: number;
}

/** What the TV's video player is doing. The TV app is the only writer. */
export interface Playback {
  contentId: string;
  positionSec: number;
  durationSec: number;
  paused: boolean;
  ended: boolean;
}

export interface PlayerView {
  id: string;
  name: string;
  score: number;
  online: boolean;
}

export interface QuizView {
  index: number; // 0-based; screens show index + 1
  total: number;
  phase: 'question' | 'reveal';
  question: string;
  choices: string[]; // always 4, shown as A to D
  secondsLeft: number; // counts down in the question phase; 0 in the reveal
  answeredIds: string[]; // who has answered, never what they picked
  correct: number | null; // null until the reveal
  explanation: string | null; // null until the reveal
  picks: Record<string, number> | null; // playerId -> choice; null until the reveal
}

export interface ResultsView {
  ranking: { playerId: string; name: string; score: number; place: number }[]; // equal scores share a place
  questions: number; // questions in this quiz
  correct: number; // right answers from everyone together
  answers: number; // answers given by everyone together
}

/** The whole session in one snapshot. The server sends it to the TV and every pad after each change. */
export interface SessionView {
  code: string;
  stage: Stage;
  tvOnline: boolean;
  hostId: string | null;
  players: PlayerView[]; // in join order
  content: ContentView | null; // the film chosen for watch, quiz and results
  playback: Playback | null; // the TV's latest report for that film
  quizUnlocked: number; // quiz questions about scenes already watched
  pip: PipState;
  quiz: QuizView | null; // only in the quiz stage
  results: ResultsView | null; // only in the results stage
}

/** Commands only the host's pad may send. The server ignores them from anyone else. */
export type HostCommand =
  | { type: 'watch'; contentId: string } // from the lobby or results; the same film resumes
  | { type: 'play' }
  | { type: 'pause' }
  | { type: 'seek'; deltaSec: number }
  | { type: 'start-quiz' }
  | { type: 'next'; index: number; phase: 'question' | 'reveal' } // what the host saw, so a double tap cannot skip ahead
  | { type: 'lobby' };

/** What the server asks the TV's player to do. */
export type TvCommand = { type: 'play' } | { type: 'pause' } | { type: 'seek'; deltaSec: number };

export interface PipSay {
  askedBy: string; // playerId
  askedByName: string;
  question: string;
  text: string; // the answer, or "Did you mean one of these?"
  next: string[]; // up to 3 follow-up questions, for the asker's pad
  clarify: string[]; // up to 3 clearer versions of a vague question, for the asker's pad
  source: Source;
}

export type HelloResult =
  | { ok: true; code: string; tvKey: string; padUrl: string; qrUrl: string }
  | { ok: false; reason: 'invalid' };

export type JoinResult =
  | { ok: true; view: SessionView }
  | { ok: false; reason: 'invalid' | 'unknown-code' | 'rate-limited' | 'full' };

export type AskResult =
  | { ok: true }
  | { ok: false; reason: 'invalid' | 'not-watching' | 'busy' | 'too-soon' };

export type Ack<T> = (result: T) => void;

/** Events a client (TV or pad) sends to the server. */
export interface ClientToServerEvents {
  'sys:ping': (payload: { sentAt: number }, ack: Ack<{ sentAt: number; serverAt: number }>) => void;
  'tv:hello': (
    payload: { previousCode: string | null; tvKey: string | null; playback: Playback | null },
    ack: Ack<HelloResult>,
  ) => void;
  'tv:playback': (playback: Playback) => void;
  'tv:watch': (payload: { contentId: string }) => void; // the remote picked a film in the lobby
  'pad:join': (payload: { code: string; playerId: string; name: string }, ack: Ack<JoinResult>) => void;
  'pad:host': (command: HostCommand) => void;
  'pad:ask': (payload: { text: string; via: AskVia }, ack: Ack<AskResult>) => void;
  'pad:answer': (payload: { index: number; choice: number }) => void;
}

/** Events the server sends to the TV and pads of one session. */
export interface ServerToClientEvents {
  'session:view': (view: SessionView) => void; // to the TV and every pad, after each change
  'tv:command': (command: TvCommand) => void; // to the TV only
  'pip:say': (say: PipSay) => void; // to the TV and every pad; a pad shows it only to the asker
}

export const LIMITS = {
  codeLength: 4,
  nameMaxChars: 12,
  maxPlayers: 8,
  askMaxChars: 200,
  askMinIntervalMs: 2000, // per player
  seekMaxAbsSec: 60,
  failedJoinsPerMinute: 60, // per IP address; only joins with an unknown code count
  questionSeconds: 20,
  hostGraceMs: 10000,
  sessionIdleMs: 6 * 60 * 60 * 1000,
} as const;

/** Pairing code alphabet without 0, O, 1 or I, so codes are easy to read on a TV. */
export const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
