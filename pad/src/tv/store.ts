// The browser TV's state: the Vega TV's reducer (tv/src/state/tv-store.ts) with the films list
// and the floating reactions added. No side effects, so it is easy to test.
import type {
  BranchView,
  ContentView,
  PipHello,
  PipSay,
  ReactionKind,
  SessionView,
} from '../shared/protocol';

/** A pip:say with a sequence number, so the same answer twice still shows twice. */
export interface SayEntry {
  id: number;
  say: PipSay;
}

/** A pip:hello with a sequence number, so each greeting shows once. */
export interface GreetEntry {
  id: number;
  hello: PipHello;
}

export interface ReactionEntry {
  id: number;
  kind: ReactionKind;
  lane: number; // 0 to 4, so reactions in a burst do not stack
}

export interface TvState {
  connected: boolean;
  hello: { code: string; padUrl: string; qrUrl: string } | null;
  view: SessionView | null;
  films: ContentView[] | null;
  filmsFailed: boolean;
  say: SayEntry | null;
  greet: GreetEntry | null;
  reactions: ReactionEntry[];
  branch: BranchView | null; // Parallel Stories: the room's latest open branch
}

export type TvAction =
  | { type: 'connected' }
  | { type: 'disconnected' }
  | { type: 'hello'; code: string; padUrl: string; qrUrl: string }
  | { type: 'view'; view: SessionView }
  | { type: 'films'; films: ContentView[] }
  | { type: 'films-failed' }
  | { type: 'say'; say: PipSay }
  | { type: 'greet'; hello: PipHello }
  | { type: 'react'; kind: ReactionKind }
  | { type: 'reaction-done'; id: number }
  | { type: 'branch'; ownerId: string; branch: BranchView | null };

const MAX_REACTIONS = 12;

export const initialTvState: TvState = {
  connected: false,
  hello: null,
  view: null,
  films: null,
  filmsFailed: false,
  say: null,
  greet: null,
  reactions: [],
  branch: null,
};

export function tvReducer(state: TvState, action: TvAction): TvState {
  switch (action.type) {
    case 'connected':
      return { ...state, connected: true };
    case 'disconnected':
      // Keep the last view, so the film keeps playing while the socket reconnects.
      return { ...state, connected: false };
    case 'hello':
      return {
        ...state,
        hello: { code: action.code, padUrl: action.padUrl, qrUrl: action.qrUrl },
      };
    case 'view': {
      // An answer belongs to the watch stage of one film; drop it when either changes.
      const keepSay =
        action.view.stage === 'watch' && action.view.content?.id === state.view?.content?.id;
      return { ...state, view: action.view, say: keepSay ? state.say : null };
    }
    case 'films':
      return { ...state, films: action.films, filmsFailed: false };
    case 'films-failed':
      return { ...state, filmsFailed: true };
    case 'branch':
      // A closed branch disappears only if it is the one showing.
      if (action.branch) return { ...state, branch: action.branch };
      return state.branch?.ownerId === action.ownerId ? { ...state, branch: null } : state;
    case 'say':
      return { ...state, say: { id: (state.say?.id ?? 0) + 1, say: action.say } };
    case 'greet':
      return { ...state, greet: { id: (state.greet?.id ?? 0) + 1, hello: action.hello } };
    case 'react': {
      const id = (state.reactions.at(-1)?.id ?? 0) + 1;
      const entry = { id, kind: action.kind, lane: id % 5 };
      return { ...state, reactions: [...state.reactions, entry].slice(-MAX_REACTIONS) };
    }
    case 'reaction-done':
      return { ...state, reactions: state.reactions.filter((r) => r.id !== action.id) };
  }
}

/** Where the family left a film, if they are part way through it: for "Continue watching". */
export function resumeAt(view: SessionView | null, filmId: string): number | null {
  const p = view?.playback;
  if (!p || p.contentId !== filmId || p.ended) return null;
  return p.positionSec >= 5 && p.positionSec < p.durationSec - 5 ? p.positionSec : null;
}

/** "9:56", or "1:02:03" past an hour. */
export function clock(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}
