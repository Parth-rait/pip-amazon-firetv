// WATCH: Ask Pip for everyone, and the host's controls or who has them (section 3.3).
import { AskPip } from '../components/AskPip';
import { HostControls } from '../components/HostControls';
import type { AskResult, AskVia, HostCommand, PipSay, SessionView } from '../shared/protocol';
import { hostName, type ChipKind } from '../state/store';

interface Props {
  view: SessionView;
  playbackAt: number;
  isHost: boolean;
  chips: { kind: ChipKind; items: string[] };
  say: PipSay | null;
  onCommand: (command: HostCommand) => void;
  onAsk: (text: string, via: AskVia) => Promise<AskResult | null>;
  onSomethingElse: () => void;
}

export function WatchScreen(props: Props) {
  const { view, isHost, onCommand } = props;
  const durationSec = view.content?.durationSec ?? 0;
  return (
    <main className="screen">
      <header className="watch-header">
        {isHost && (
          <button className="button button--small" onClick={() => onCommand({ type: 'lobby' })}>
            Lobby
          </button>
        )}
        <h1 className="title">{view.content?.title ?? 'Film'}</h1>
      </header>
      <AskPip
        chips={props.chips}
        say={props.say}
        isThinking={view.pip === 'thinking'}
        onAsk={props.onAsk}
        onSomethingElse={props.onSomethingElse}
      />
      {isHost ? (
        <HostControls
          quizUnlocked={view.quizUnlocked}
          playback={view.playback}
          playbackAt={props.playbackAt}
          durationSec={durationSec}
          onCommand={onCommand}
        />
      ) : (
        <p className="body muted">{hostName(view) ?? 'The host'} has the controls</p>
      )}
    </main>
  );
}
