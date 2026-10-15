// WATCH: the host's controls, or who has them. Ask Pip joins this screen in Step 7.
import { HostControls } from '../components/HostControls';
import type { HostCommand, SessionView } from '../shared/protocol';
import { hostName } from '../state/store';

interface Props {
  view: SessionView;
  playbackAt: number;
  isHost: boolean;
  onCommand: (command: HostCommand) => void;
}

export function WatchScreen({ view, playbackAt, isHost, onCommand }: Props) {
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
      {isHost ? (
        <HostControls
          playback={view.playback}
          playbackAt={playbackAt}
          durationSec={durationSec}
          onCommand={onCommand}
        />
      ) : (
        <p className="body muted">{hostName(view) ?? 'The host'} has the controls</p>
      )}
    </main>
  );
}
