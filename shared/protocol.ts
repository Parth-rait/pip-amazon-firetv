// shared/protocol.ts
// The contract between the server, the Pip Pad (pad/) and the TV app (tv/).
// Edit only this file, then run `npm run sync:shared` to copy it into each package.
// Types and constants only: no imports, so it compiles in Node, browsers and React Native for Vega.

export const PROTOCOL_VERSION = 7;

/** Where the session is in the journey. The server owns it; the TV and pads follow it. */
export type Stage = 'lobby' | 'watch' | 'quiz' | 'results';
export type PipState = 'sleep' | 'idle' | 'thinking' | 'talking' | 'cheer';
// Where a reply's text came from: the model, a fixed line, or straight from reviewed timeline facts.
export type Source = 'ai' | 'template' | 'timeline';
/** A player's color, given when joining, so names are easy to tell apart. */
export const AVATAR_COLORS = [
  '#7CE7C4',
  '#FF8E7F',
  '#B8A6FF',
  '#FFD166',
  '#6EC1FF',
  '#FF9BD2',
  '#A8E06C',
  '#F4A65D',
] as const;

/** A tap on the reaction bar; it floats up on the TV. */
export type ReactionKind = 'laugh' | 'wow' | 'love' | 'scared';

/** One chapter of the story so far, for "Catch me up". Only chapters already watched are sent. */
export interface ChapterView {
  atSec: number; // everything in the summary has happened by this time
  title: string;
  summary: string;
  image: string | null; // full URL of a still
}

/** A character card for "Who's who": only characters already seen, with only the facts seen so far. */
export interface CharacterView {
  id: string;
  name: string;
  image: string | null;
  facts: string[]; // oldest first
}

/** Pip's "What happens next?" vote. The answer and everyone's votes come only with the reveal. */
export interface PredictionView {
  id: string;
  question: string;
  choices: string[]; // 2 or 3
  status: 'open' | 'revealed';
  votedIds: string[]; // who has voted, never what, until the reveal
  answer: number | null; // null until the reveal
  reveal: string | null; // one line, null until the reveal
  picks: Record<string, number> | null; // playerId -> choice; null until the reveal
}

/** What the pads show beside the film: only what the family has already seen. */
export interface CompanionView {
  chapters: ChapterView[];
  characters: CharacterView[];
  prediction: PredictionView | null; // open, or revealed in the last 20 s
}

/** How a question was asked: typed, spoken, or tapped from the starter, next or "Did you mean" chips. */
export type AskVia = 'typed' | 'voice' | 'starter' | 'next' | 'clarify';

/** A film as clients see it. Never includes the notes or the quiz. */
export interface ContentView {
  id: string;
  title: string;
  url: string; // full URL of the MP4
  credit: string;
  durationSec: number;
  poster: string | null; // full URL of a still from the film, for the film cards
  synopsis: string; // the film's premise: what it is about, spoiler-free (the TV's home screen)
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
  avatar: number; // index into AVATAR_COLORS
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
  moment: { atSec: number; text: string; reactions: number } | null; // the most reacted-to scene
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
  assistant: AssistantView; // Pip shows on the TV only when invoked, paused or answering
  device: DeviceView; // what the TV was last asked to do, and whether it confirmed
  kidsMode: boolean; // the host's opt-in: quiz, guesses and reactions (docs/vnext/PLAN.md 3.1)
  companion: CompanionView | null; // only in the watch stage
  quiz: QuizView | null; // only in the quiz stage
  results: ResultsView | null; // only in the results stage
}

export interface AssistantView {
  open: boolean;
  byId: string | null; // who opened Pip
}

/** Ambient light scenes. Real lights need a connected bridge; without one this is simulated. */
export type AmbientScene = 'off' | 'movie' | 'bright';

export interface DeviceView {
  volume: number; // the film's volume on the TV, 0 to 1 (Vega keeps system volume for system apps)
  brightness: number; // the picture's brightness in the TV app, 0.3 to 1
  ambient: AmbientScene;
  lights: 'simulated' | 'connected';
  lastAction: { id: string; action: string; ok: boolean | null } | null; // null: not confirmed yet
}

/** Commands only the host's pad may send. The server ignores them from anyone else. */
export type HostCommand =
  | { type: 'watch'; contentId: string } // from the lobby or results; the same film resumes
  | { type: 'start-quiz' } // kids mode only
  | { type: 'next'; index: number; phase: 'question' | 'reveal' } // what the host saw, so a double tap cannot skip ahead
  | { type: 'lobby' }
  | { type: 'kids-mode'; on: boolean };

/**
 * Where an input came from: the adapter, never the user (docs/vnext/PLAN.md 4.2). Every adapter
 * sends the same semantic events, so the brain does not care which surface was touched.
 */
export type InputSource =
  | 'pad_touch'
  | 'pad_voice'
  | 'tv_remote'
  | 'touchwheel_proto'
  | 'capacitive_button_proto'
  | 'hand_gesture_cam' // webcam hand tracking (gesture/, vendored gesture-tv-remote)
  | 'simulator';

/** One semantic input. Media and device inputs never call a model. */
export type PipInputEvent =
  | { type: 'pip.invoke' }
  | { type: 'pip.dismiss' }
  | { type: 'media.playPause' }
  | { type: 'media.play' }
  | { type: 'media.pause' }
  | { type: 'media.seekRelative'; seconds: number }
  | { type: 'media.volumeDelta'; delta: number } // -1 to 1, in steps of 0.1 on the pad
  | { type: 'media.brightnessDelta'; delta: number }
  | { type: 'ambient.set'; scene: AmbientScene }
  | { type: 'navigation.move'; direction: 'next' | 'previous' }
  | { type: 'navigation.confirm' }
  | { type: 'navigation.back' };

export interface PipInput {
  id: string; // made by the adapter, so a resent input is not applied twice
  source: InputSource;
  at: number; // when the adapter saw it (ms since epoch); stale inputs are refused
  event: PipInputEvent;
}

export type InputResult =
  | { ok: true; action: string }
  | {
      ok: false;
      reason: 'invalid' | 'not-allowed' | 'not-watching' | 'duplicate' | 'stale' | 'unsupported' | 'no-tv';
    };

/** What the server asks the TV's player to do. The TV confirms each one with tv:applied. */
export type TvCommand = { id: string } & (
  | { type: 'play' }
  | { type: 'pause' }
  | { type: 'seek'; deltaSec: number }
  | { type: 'volume'; level: number }
  | { type: 'brightness'; level: number }
);

export interface PipSay {
  askedBy: string; // playerId
  askedByName: string;
  question: string;
  text: string; // the answer, or "Did you mean one of these?"
  next: string[]; // up to 3 follow-up questions, for the asker's pad
  clarify: string[]; // up to 3 clearer versions of a vague question, for the asker's pad
  source: Source;
}

/**
 * "While you were away": what one viewer missed of the film, sent only to their pad when they come
 * back (pad hidden or offline, then back) or join late. Facts revealed after fromSec and by toSec,
 * never later; the TV and everyone else are not interrupted.
 */
export interface PipMissed {
  contentId: string;
  fromSec: number; // where the film was when they left (0 for a late join)
  toSec: number; // where it is now
  lateJoin: boolean;
  items: { atSec: number; text: string }[]; // at most 4, in story order
}

/** Pip says hello on the TV (lobby only) when a new player joins. */
export interface PipHello {
  playerId: string;
  name: string;
  text: string;
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
  'tv:home': () => void; // the remote's Back during the film: back to the films (watch stage only)
  'pad:join': (
    payload: { code: string; playerId: string; name: string; avatar?: number },
    ack: Ack<JoinResult>,
  ) => void;
  'pad:host': (command: HostCommand) => void;
  'pad:input': (input: PipInput, ack: Ack<InputResult>) => void;
  'tv:applied': (result: { id: string; ok: boolean; detail?: string }) => void; // outcome of a tv:command
  'pad:ask': (payload: { text: string; via: AskVia }, ack: Ack<AskResult>) => void;
  'pad:answer': (payload: { index: number; choice: number }) => void;
  'pad:react': (payload: { kind: ReactionKind }) => void; // kids mode, watch stage only
  'pad:predict': (payload: { id: string; choice: number }) => void; // kids mode, while that prediction is open
  'pad:away': (payload: { away: boolean }) => void; // the pad was hidden (phone locked) or shown again
}

/** Events the server sends to the TV and pads of one session. */
export interface ServerToClientEvents {
  'session:view': (view: SessionView) => void; // to the TV and every pad, after each change
  'tv:command': (command: TvCommand) => void; // to the TV only
  'pip:say': (say: PipSay) => void; // to the TV and every pad; a pad shows it only to the asker
  'pip:hello': (hello: PipHello) => void; // to the TV and every pad, when a new player joins
  'pip:react': (reaction: { playerId: string; kind: ReactionKind }) => void; // to the room
  'pip:missed': (missed: PipMissed) => void; // to one returning pad only
}

export const LIMITS = {
  codeLength: 4,
  nameMaxChars: 12,
  maxPlayers: 8,
  askMaxChars: 200,
  askMinIntervalMs: 2000, // per player
  reactMinIntervalMs: 400, // per player
  inputMaxAgeMs: 10_000, // an input older than this is stale and refused
  seekStepMaxSec: 60,
  seekMaxAbsSec: 60,
  failedJoinsPerMinute: 60, // per IP address; only joins with an unknown code count
  questionSeconds: 20,
  hostGraceMs: 10000,
  sessionIdleMs: 6 * 60 * 60 * 1000,
} as const;

/** Pairing code alphabet without 0, O, 1 or I, so codes are easy to read on a TV. */
export const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
