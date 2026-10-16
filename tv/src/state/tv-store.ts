import type {PipHello, PipSay, SessionView} from '../shared/protocol';

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

export interface TvState {
  connected: boolean;
  hello: {code: string; padUrl: string; qrUrl: string} | null;
  view: SessionView | null;
  say: SayEntry | null;
  greet: GreetEntry | null;
}

export type TvAction =
  | {type: 'connected'}
  | {type: 'disconnected'}
  | {type: 'hello'; code: string; padUrl: string; qrUrl: string}
  | {type: 'view'; view: SessionView}
  | {type: 'say'; say: PipSay}
  | {type: 'greet'; hello: PipHello};

export const initialTvState: TvState = {
  connected: false,
  hello: null,
  view: null,
  say: null,
  greet: null,
};

export function tvReducer(state: TvState, action: TvAction): TvState {
  switch (action.type) {
    case 'connected':
      return {...state, connected: true};
    case 'disconnected':
      // Keep the last view, so the film keeps playing while the socket reconnects.
      return {...state, connected: false};
    case 'hello':
      return {
        ...state,
        hello: {code: action.code, padUrl: action.padUrl, qrUrl: action.qrUrl},
      };
    case 'view': {
      // An answer belongs to the watch stage of one film; drop it when either changes.
      const keepSay =
        action.view.stage === 'watch' &&
        action.view.content?.id === state.view?.content?.id;
      return {...state, view: action.view, say: keepSay ? state.say : null};
    }
    case 'say':
      return {
        ...state,
        say: {id: (state.say?.id ?? 0) + 1, say: action.say},
      };
    case 'greet':
      return {
        ...state,
        greet: {id: (state.greet?.id ?? 0) + 1, hello: action.hello},
      };
  }
}
