// WATCH: the film's progress for everyone, the host's remote, a "What happens next?" card when
// Pip asks, and three tabs: Pip (ask), Story (catch me up) and Who's who. Reactions are always
// at hand (sections 3.3 and 2.4).
import { useState } from 'react';
import { AskPip } from '../components/AskPip';
import { CharactersTab } from '../components/CharactersTab';
import { FilmProgress } from '../components/FilmProgress';
import { HostControls } from '../components/HostControls';
import { PredictionCard } from '../components/PredictionCard';
import { ReactionBar } from '../components/ReactionBar';
import { StoryTab } from '../components/StoryTab';
import type {
  AskResult,
  AskVia,
  HostCommand,
  PipSay,
  ReactionKind,
  SessionView,
} from '../shared/protocol';
import { hostName, type ChipKind } from '../state/store';

type Tab = 'pip' | 'story' | 'cast';

const TABS: { tab: Tab; label: string }[] = [
  { tab: 'pip', label: 'Pip' },
  { tab: 'story', label: 'Story' },
  { tab: 'cast', label: "Who's who" },
];

interface Props {
  view: SessionView;
  myId: string;
  playbackAt: number;
  isHost: boolean;
  chips: { kind: ChipKind; items: string[] };
  say: PipSay | null;
  onCommand: (command: HostCommand) => void;
  onAsk: (text: string, via: AskVia) => Promise<AskResult | null>;
  onSomethingElse: () => void;
  onReact: (kind: ReactionKind) => void;
  onVote: (id: string, choice: number) => void;
}

export function WatchScreen(props: Props) {
  const { view, isHost, onCommand } = props;
  const [tab, setTab] = useState<Tab>('pip');
  const companion = view.companion;
  const onlineCount = view.players.filter((p) => p.online).length;

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
      {companion?.prediction && (
        <PredictionCard
          key={companion.prediction.id}
          prediction={companion.prediction}
          myId={props.myId}
          playerCount={onlineCount}
          onVote={props.onVote}
        />
      )}
      <div className="segmented" role="tablist" aria-label="Watch">
        {TABS.map(({ tab: t, label }) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            className={tab === t ? 'segmented__item is-on' : 'segmented__item'}
            onClick={() => setTab(t)}
          >
            {label}
          </button>
        ))}
      </div>
      <div hidden={tab !== 'pip'}>
        <AskPip
          pip={view.pip}
          chips={props.chips}
          say={props.say}
          isThinking={view.pip === 'thinking'}
          onAsk={props.onAsk}
          onSomethingElse={props.onSomethingElse}
        />
      </div>
      {tab === 'story' && <StoryTab chapters={companion?.chapters ?? []} />}
      {tab === 'cast' && <CharactersTab characters={companion?.characters ?? []} />}
      <ReactionBar isRaised={tab === 'pip'} onReact={props.onReact} />
    </main>
  );
}
