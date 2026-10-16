// WATCH: the film's progress for everyone, the host's remote, and Ask Pip as a chat (section 3.3).
import { AskPip } from '../components/AskPip';
import { FilmProgress } from '../components/FilmProgress';
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
  return (
    <main className="screen screen--watch">
      <header className="watch-header">
        <div className="watch-header__text">
          <h1 className="large-title">{view.content?.title ?? 'Film'}</h1>
          <FilmProgress
            playback={view.playback}
            playbackAt={props.playbackAt}
            durationSec={view.content?.durationSec ?? 0}
          />
        </div>
        {isHost && (
          <button className="button button--small" onClick={() => onCommand({ type: 'lobby' })}>
            Films
          </button>
        )}
      </header>
      {isHost ? (
        <HostControls
          quizUnlocked={view.quizUnlocked}
          playback={view.playback}
          onCommand={onCommand}
        />
      ) : (
        <p className="caption">{hostName(view) ?? 'The host'} has the remote</p>
      )}
      <AskPip
        pip={view.pip}
        chips={props.chips}
        say={props.say}
        isThinking={view.pip === 'thinking'}
        onAsk={props.onAsk}
        onSomethingElse={props.onSomethingElse}
      />
    </main>
  );
}
