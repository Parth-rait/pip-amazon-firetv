// The pad's state: a reducer with no side effects, so it is easy to test (PROJECT.md section 3.3).
import type {
  ActionView,
  AskResult,
  JoinResult,
  PipSay,
  Playback,
  SessionView,
} from '../shared/protocol';

export type Connection = 'connecting' | 'online' | 'offline';
export type JoinFailure = Extract<JoinResult, { ok: false }>['reason'];
export type AskFailure = Extract<AskResult, { ok: false }>['reason'] | 'no-answer';
export type ChipKind = 'starter' | 'next' | 'clarify';

export const STARTER_CHIPS = ['What just happened?', 'Who is that?', 'Why did they do that?'];

export interface PadState {
  connection: Connection;
  myId: string;
  view: SessionView | null; // null until joined; the join screen shows
  playbackAt: number; // when the TV's latest playback report arrived (ms), for the progress line
  say: PipSay | null; // Pip's latest reply to me; stays until I tap Done or ask again
  chips: { kind: ChipKind; items: string[] };
  isAsking: boolean; // my question is sent and Pip has not replied yet
  askError: AskFailure | null;
  joinError: JoinFailure | null;
  lookingForTv: boolean; // a saved-code rejoin is retrying
}

export type PadAction =
  | { type: 'connected' }
  | { type: 'disconnected' }
  | { type: 'joined'; view: SessionView; at: number }
  | { type: 'view'; view: SessionView; at: number }
  | { type: 'join-failed'; reason: JoinFailure }
  | { type: 'looking-for-tv'; isLooking: boolean }
  | { type: 'ask-sent' }
  | { type: 'ask-refused'; reason: AskFailure }
  | { type: 'say'; say: PipSay }
  | { type: 'reply-closed' }
  | { type: 'chips-expired' }
  | { type: 'leave' };

export function initialState(myId: string): PadState {
  return {
    connection: 'connecting',
    myId,
    view: null,
    playbackAt: 0,
    say: null,
    chips: starter(),
    isAsking: false,
    askError: null,
    joinError: null,
    lookingForTv: false,
  };
}

function starter(): PadState['chips'] {
  return { kind: 'starter', items: STARTER_CHIPS };
}

/** After a reply: "Did you mean" options, else the next questions, else the starters. */
function chipsFor(say: PipSay): PadState['chips'] {
  if (say.clarify.length > 0) return { kind: 'clarify', items: say.clarify };
  if (say.next.length > 0) return { kind: 'next', items: say.next };
  return starter();
}

export function reducer(state: PadState, action: PadAction): PadState {
  switch (action.type) {
    case 'connected':
      return { ...state, connection: 'online' };
    case 'disconnected':
      // An answer that was on its way will not come to this socket.
      return { ...state, connection: 'offline', isAsking: false };
    case 'joined':
      return {
        ...state,
        view: action.view,
        playbackAt: action.at,
        joinError: null,
        lookingForTv: false,
      };
    case 'view': {
      // A view for another session (after leaving it) is ignored; before joining there is none.
      if (!state.view || state.view.code !== action.view.code) return state;
      const leftWatch = state.view.stage === 'watch' && action.view.stage !== 'watch';
      return {
        ...state,
        view: action.view,
        // Other changes (a player joining) resend the same report; keep its original arrival time.
        playbackAt: isSamePlayback(state.view.playback, action.view.playback)
          ? state.playbackAt
          : action.at,
        ...(leftWatch ? { say: null, chips: starter(), isAsking: false, askError: null } : {}),
      };
    }
    case 'join-failed':
      return { ...state, joinError: action.reason };
    case 'looking-for-tv':
      return { ...state, lookingForTv: action.isLooking };
    case 'ask-sent':
      return { ...state, isAsking: true, askError: null, say: null };
    case 'ask-refused':
      return { ...state, isAsking: false, askError: action.reason };
    case 'say':
      if (action.say.askedBy !== state.myId) return state;
      return { ...state, say: action.say, chips: chipsFor(action.say), isAsking: false };
    case 'reply-closed':
      return { ...state, say: null, chips: starter() };
    case 'chips-expired':
      return { ...state, chips: starter() };
    case 'leave':
      return { ...initialState(state.myId), connection: state.connection };
  }
}

/** True when this pad's player holds the host controls. */
export function isHost(state: PadState): boolean {
  return state.view !== null && state.view.hostId === state.myId;
}

export function hostName(view: SessionView): string | null {
  return view.players.find((p) => p.id === view.hostId)?.name ?? null;
}

/** True when Pip is busy with my question, by the server's view or my own pending ask. */
export function isPipThinkingForMe(state: PadState): boolean {
  const assist = state.view?.assist;
  return state.isAsking || (assist?.phase === 'thinking' && assist.askedBy === state.myId);
}

/**
 * One short line about the latest playback command, or null. "Pausing…" is only a request;
 * "Paused" appears once the TV's own report confirms it.
 */
export function actionLine(action: ActionView | null): string | null {
  if (!action) return null;
  if (action.status === 'unconfirmed') return "The TV didn't respond. Try again.";
  const sec = Math.abs(action.deltaSec ?? 0);
  const back = (action.deltaSec ?? 0) < 0;
  const words = {
    play: ['Playing…', 'Playing'],
    pause: ['Pausing…', 'Paused'],
    seek: back
      ? [`Going back ${sec} s…`, `Back ${sec} s`]
      : [`Skipping ${sec} s…`, `Ahead ${sec} s`],
  }[action.type];
  return action.status === 'done' ? (words[1] ?? null) : (words[0] ?? null);
}

function isSamePlayback(a: Playback | null, b: Playback | null): boolean {
  if (a === null || b === null) return a === b;
  return (
    a.contentId === b.contentId &&
    a.positionSec === b.positionSec &&
    a.paused === b.paused &&
    a.ended === b.ended
  );
}
