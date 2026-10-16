// shared/protocol.ts
// The contract between the server, the Pip Pad (pad/) and the TV app (tv/).
// Edit only this file, then run `npm run sync:shared` to copy it into each package.
// Types and constants only: no imports, so it compiles in Node, browsers and React Native for Vega.

// v3 (vNext): Pip is hidden on the TV until asked (assist), playback commands carry an id and an
// observed outcome (lastAction), devices send one semantic input envelope, quiz is opt-in.
export const PROTOCOL_VERSION = 3;

/** Where the session is in the journey. The server owns it; the TV and pads follow it. */
export type Stage = 'lobby' | 'watch' | 'quiz' | 'results';
export type PipState = 'sleep' | 'idle' | 'thinking' | 'talking' | 'cheer';
/** Where a reply's words came from: the model, the reviewed timeline, or a fixed line. */
export type Source = 'ai' | 'timeline' | 'template';
/** How a question was asked: typed, spoken, or tapped from the starter, next or "Did you mean" chips. */
export type AskVia = 'typed' | 'voice' | 'starter' | 'next' | 'clarify';
/**
 * What a reply is: an answer, "Did you mean" options, an honest "not sure" (the evidence did not
 * support an answer), a fallback after a failure, a playback action, or a refused request.
 */
export type ReplyKind = 'answer' | 'clarify' | 'unknown' | 'fallback' | 'action' | 'refused';

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

/** Pip on the shared screen. `null` in the view means Pip is hidden and the film stays full screen. */
export interface AssistView {
  phase: 'thinking' | 'reply';
  askedBy: string; // playerId
  askedByName: string;
  question: string;
  text: string | null; // null while thinking
  kind: ReplyKind | null; // null while thinking
}

/** "sent" is not success: a command is done only when the TV's playback report shows its effect. */
export type ActionStatus = 'sent' | 'done' | 'unconfirmed';

/** The latest playback command and what is known about its outcome. */
export interface ActionView {
  commandId: string;
  type: 'play' | 'pause' | 'seek';
  deltaSec: number | null; // seek only
  by: string; // playerId, or 'remote' for the TV's remote
  status: ActionStatus;
}

/** Optional activities this server allows. The default viewing path never shows them. */
export interface FeaturesView {
  quiz: boolean;
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
  assist: AssistView | null; // only in watch, and only while Pip was asked and has not been dismissed
  lastAction: ActionView | null; // only in watch
  features: FeaturesView;
  quiz: QuizView | null; // only in the quiz stage
  results: ResultsView | null; // only in the results stage
}

/**
 * Commands only the host's pad may send. The server ignores them from anyone else.
 * A playback command may carry a commandId (16 to 64 of A-Z a-z 0-9 _ -); a repeat is ignored,
 * so a double tap on +10 s seeks once.
 */
export type HostCommand =
  | { type: 'watch'; contentId: string } // from the lobby or results; the same film resumes
  | { type: 'play'; commandId?: string }
  | { type: 'pause'; commandId?: string }
  | { type: 'seek'; deltaSec: number; commandId?: string }
  | { type: 'start-quiz' } // ignored unless features.quiz
  | { type: 'next'; index: number; phase: 'question' | 'reveal' } // what the host saw, so a double tap cannot skip ahead
  | { type: 'lobby' };

/** What the server asks the TV's player to do. The TV reports playback after applying it. */
export type TvCommand =
  | { type: 'play'; commandId: string }
  | { type: 'pause'; commandId: string }
  | { type: 'seek'; deltaSec: number; commandId: string };

/** Where an input came from. Every source maps to the same semantic intents on the server. */
export type InputSource = 'pad-touch' | 'pad-button' | 'pad-wheel' | 'remote' | 'keyboard' | 'sim';

/** Keys a TV remote (or a keyboard standing in for one) can send. */
export type RemoteKey =
  | 'play-pause'
  | 'play'
  | 'pause'
  | 'rewind'
  | 'fast-forward'
  | 'left'
  | 'right'
  | 'back';

/** A raw device input. The server's adapters turn it into an intent; devices never decide. */
export type RawInput =
  | { kind: 'key'; key: RemoteKey }
  | { kind: 'button'; gesture: 'press' | 'double-press' | 'long-press' } // the pad's capacitive button
  | { kind: 'wheel'; detents: number }; // touchwheel: + is clockwise (forward), - is back

/** One input event. eventId is unique per device (16 to 64 of A-Z a-z 0-9 _ -); a repeat is ignored. */
export interface InputEnvelope {
  v: 1;
  eventId: string;
  source: InputSource;
  sentAt: number; // the device's clock (ms), for diagnostics only
  input: RawInput;
}

/** What an input became: the intent the server applied (or that the pad should apply, for invoke). */
export type InputResult =
  | { ok: true; intent: 'play' | 'pause' | 'seek' | 'invoke' | 'dismiss' | 'none'; commandId: string | null }
  | { ok: false; reason: 'invalid' | 'duplicate' | 'not-allowed' | 'not-watching' };

export interface PipSay {
  askedBy: string; // playerId
  askedByName: string;
  question: string;
  text: string; // the answer, or "Did you mean one of these?"
  next: string[]; // up to 3 follow-up questions, for the asker's pad
  clarify: string[]; // up to 3 clearer versions of a vague question, for the asker's pad
  source: Source;
  kind: ReplyKind;
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
  'pad:assist': (payload: { type: 'dismiss' }) => void; // hide Pip on the TV now
  'pad:input': (input: InputEnvelope, ack: Ack<InputResult>) => void; // pad button, wheel, simulator
  'tv:input': (input: InputEnvelope) => void; // remote keys the TV app forwards
}

/** Events the server sends to the TV and pads of one session. */
export interface ServerToClientEvents {
  'session:view': (view: SessionView) => void; // to the TV and every pad, after each change
  'tv:command': (command: TvCommand) => void; // to the TV only
  'pip:say': (say: PipSay) => void; // to the asker's pads only; the TV draws Pip from view.assist
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
  assistShowMs: 8000, // how long a reply stays on the TV unless dismissed
  actionConfirmMs: 4000, // a command with no matching playback report by then is "unconfirmed"
  remoteSeekSec: 10, // rewind, fast-forward, left and right
  wheelSecPerDetent: 5,
  eventIdMinChars: 16,
  eventIdMaxChars: 64,
} as const;

/** Pairing code alphabet without 0, O, 1 or I, so codes are easy to read on a TV. */
export const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
