// The pad's state: a reducer with no side effects, so it is easy to test (PROJECT.md section 3.3).
import type { JoinResult, PipSay, Playback, SessionView } from '../shared/protocol';

export type Connection = 'connecting' | 'online' | 'offline';
export type JoinFailure = Extract<JoinResult, { ok: false }>['reason'];
export type ChipKind = 'starter' | 'next' | 'clarify';

export const STARTER_CHIPS = ['What just happened?', 'Who is that?', 'Why did they do that?'];

export interface PadState {
  connection: Connection;
  myId: string;
  view: SessionView | null; // null until joined; the join screen shows
  viewAt: number; // when the latest view arrived (ms), for the quiz countdown
  playbackAt: number; // when the TV's latest playback report arrived (ms), for the progress line
  say: PipSay | null; // Pip's latest answer to me
  chips: { kind: ChipKind; items: string[] };
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
  | { type: 'say'; say: PipSay }
  | { type: 'chips-expired' }
  | { type: 'leave' };

export function initialState(myId: string): PadState {
  return {
    connection: 'connecting',
    myId,
    view: null,
    viewAt: 0,
    playbackAt: 0,
    say: null,
    chips: { kind: 'starter', items: STARTER_CHIPS },
    joinError: null,
    lookingForTv: false,
  };
}

const starter = (): PadState['chips'] => ({ kind: 'starter', items: STARTER_CHIPS });

export function reducer(state: PadState, action: PadAction): PadState {
  switch (action.type) {
    case 'connected':
      return { ...state, connection: 'online' };
    case 'disconnected':
      return { ...state, connection: 'offline' };
    case 'joined':
      return {
        ...state,
        view: action.view,
        viewAt: action.at,
        playbackAt: action.at,
        joinError: null,
        lookingForTv: false,
      };
    case 'view':
      // A view for another session (after leaving it) is ignored; before joining there is none.
      if (!state.view || state.view.code !== action.view.code) return state;
      return {
        ...state,
        view: action.view,
        viewAt: action.at,
        // Other changes (a player joining) resend the same report; keep its original arrival time.
        playbackAt: isSamePlayback(state.view.playback, action.view.playback)
          ? state.playbackAt
          : action.at,
      };
    case 'join-failed':
      return { ...state, joinError: action.reason };
    case 'looking-for-tv':
      return { ...state, lookingForTv: action.isLooking };
    case 'say': {
      if (action.say.askedBy !== state.myId) return state;
      const { next, clarify } = action.say;
      const chips =
        clarify.length > 0
          ? { kind: 'clarify' as const, items: clarify }
          : next.length > 0
            ? { kind: 'next' as const, items: next }
            : starter();
      return { ...state, say: action.say, chips };
    }
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

function isSamePlayback(a: Playback | null, b: Playback | null): boolean {
  if (a === null || b === null) return a === b;
  return (
    a.contentId === b.contentId &&
    a.positionSec === b.positionSec &&
    a.paused === b.paused &&
    a.ended === b.ended
  );
}
