// WATCH: the host's controls (or who has them), then Ask Pip. The TV stays a quiet, full-screen
// film; this pad is where people ask, read their answer and close it.
import { AskPanel } from '../components/AskPanel';
import { HostControls } from '../components/HostControls';
import type { AskVia, HostCommand, SessionView } from '../shared/protocol';
import { hostName, type PadState } from '../state/store';

interface Props {
  view: SessionView;
  state: PadState;
  isHost: boolean;
  isThinking: boolean;
  focusSignal: number;
  onCommand: (command: HostCommand) => void;
  onAsk: (text: string, via: AskVia) => void;
  onDone: () => void;
  onHideTv: () => void;
}

export function WatchScreen(props: Props) {
  const { view, state, isHost, isThinking } = props;
  const durationSec = view.content?.durationSec ?? 0;
  const assist = view.assist;
  const showingForOther = assist?.phase === 'reply' && assist.askedBy !== state.myId;

  return (
    <main className="screen">
      <h1 className="title">{view.content?.title ?? 'Film'}</h1>
      {isHost ? (
        <HostControls
          playback={view.playback}
          playbackAt={state.playbackAt}
          durationSec={durationSec}
          lastAction={view.lastAction}
          onCommand={props.onCommand}
        />
      ) : (
        <p className="body muted">{hostName(view) ?? 'The host'} has the controls</p>
      )}

      {showingForOther && (
        <div className="tv-note" role="status">
          <span className="caption">Pip is answering {assist.askedByName} on the TV</span>
          <button className="button button--small" onClick={props.onHideTv}>
            Hide
          </button>
        </div>
      )}

      <AskPanel
        chips={state.chips}
        say={state.say}
        isThinking={isThinking}
        error={state.askError}
        focusSignal={props.focusSignal}
        onAsk={props.onAsk}
        onDone={props.onDone}
      />

      {isHost && (
        <button
          className="button button--small button--quiet"
          onClick={() => props.onCommand({ type: 'lobby' })}
        >
          Back to films
        </button>
      )}
    </main>
  );
}
