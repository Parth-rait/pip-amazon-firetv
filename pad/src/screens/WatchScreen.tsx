// WATCH: the film's progress, the host's remote, one voice button and the Pip button. Pip stays
// out of the way until someone opens it. The quiz, guesses and reactions show only when the host
// has turned on kids games (docs/vnext/PLAN.md 3.1).
import { useEffect, useRef, useState } from 'react';
import { AskPip } from '../components/AskPip';
import { MissedCard } from '../components/MissedCard';
import { StoryMap } from '../components/StoryMap';
import { NowPlaying } from '../components/NowPlaying';
import { PipButton, PipSheet } from '../components/PipSheet';
import { PredictionCard } from '../components/PredictionCard';
import { QuickActions } from '../components/QuickActions';
import { ReactionBar } from '../components/ReactionBar';
import { Remote } from '../components/Remote';
import { VoiceButton } from '../components/VoiceButton';
import type {
  AskResult,
  AskVia,
  HostCommand,
  InputResult,
  InputSource,
  PipInputEvent,
  BranchView,
  PipMissed,
  PipSay,
  ReactionKind,
  SessionView,
} from '../shared/protocol';
import { describeCommand, parseTypedCommand } from '../lib/commands';
import { useWide } from '../lib/use-wide';
import { hostName, type ChipKind } from '../state/store';

type Refusal = Extract<InputResult, { ok: false }>['reason'];

const REFUSALS: Partial<Record<Refusal, string>> = {
  'not-allowed': 'Only the host can do that.',
  'no-tv': 'The TV is not connected right now.',
  'not-watching': 'Start a film first.',
  stale: 'That took too long to arrive. Try again.',
  unsupported: "Pip can't do that yet.",
};
const NO_ANSWER = "The TV didn't answer. Try again.";

interface Props {
  view: SessionView;
  myId: string;
  playbackAt: number;
  isHost: boolean;
  chips: { kind: ChipKind; items: string[] };
  say: PipSay | null;
  missed: PipMissed | null;
  branch: BranchView | null;
  onBackToFilm: () => void;
  onMissedDone: () => void;
  onCommand: (command: HostCommand) => void;
  onInput: (event: PipInputEvent, source: InputSource) => Promise<InputResult | null>;
  onAsk: (text: string, via: AskVia) => Promise<AskResult | null>;
  onSomethingElse: () => void;
  onReact: (kind: ReactionKind) => void;
  onVote: (id: string, choice: number) => void;
}

export function WatchScreen(props: Props) {
  const { view, isHost, onCommand, onInput } = props;
  const [isPipOpen, setIsPipOpen] = useState(false);
  const isWide = useWide();
  const [notice, setNotice] = useState<string | null>(null);
  const companion = view.companion;
  const onlineCount = view.players.filter((p) => p.online).length;

  // Someone else closed Pip (or the film ended): close my sheet too.
  const wasOpen = useRef(view.assistant.open);
  useEffect(() => {
    if (wasOpen.current && !view.assistant.open) setIsPipOpen(false);
    wasOpen.current = view.assistant.open;
  }, [view.assistant.open]);

  const send = async (event: PipInputEvent, source: InputSource) => {
    setNotice(null);
    const result = await onInput(event, source);
    if (!result) setNotice(NO_ANSWER);
    else if (!result.ok) setNotice(REFUSALS[result.reason] ?? null);
  };
  // "pause" or "turn it up" typed into the Ask box is a command, not a question for Pip.
  const runTypedCommand = async (text: string): Promise<string | null> => {
    const command = parseTypedCommand(text);
    if (!command) return null;
    if (command.type === 'pip.invoke') return describeCommand(command);
    const result = await onInput(command, 'pad_touch');
    if (!result) return NO_ANSWER;
    return result.ok ? describeCommand(command) : (REFUSALS[result.reason] ?? NO_ANSWER);
  };
  const openPip = (source: InputSource) => {
    setIsPipOpen(true);
    void send({ type: 'pip.invoke' }, source);
  };
  const closePip = () => {
    setIsPipOpen(false);
    void send({ type: 'pip.dismiss' }, 'pad_touch');
  };

  const pipPanel = (
    <AskPip
      pip={view.pip}
      chips={props.chips}
      say={props.say}
      isThinking={view.pip === 'thinking'}
      onAsk={props.onAsk}
      onCommandText={runTypedCommand}
      onSomethingElse={props.onSomethingElse}
    />
  );

  return (
    <main className="screen screen--watch">
      <NowPlaying
        content={view.content}
        playback={view.playback}
        playbackAt={props.playbackAt}
        {...(isHost ? { onFilms: () => onCommand({ type: 'lobby' }) } : {})}
      />

      {props.missed && <MissedCard missed={props.missed} onDone={props.onMissedDone} />}

      {props.branch && props.branch.contentId === view.content?.id && (
        <StoryMap
          branch={props.branch}
          isBusy={view.pip === 'thinking'}
          onAsk={(question) => void props.onAsk(question, 'next')}
          onBackToFilm={props.onBackToFilm}
        />
      )}

      <div className="watch-grid">
        <div className="watch-grid__main">
          {isHost ? (
            <Remote
              playback={view.playback}
              device={view.device}
              onInput={(event) => void send(event, 'pad_touch')}
            />
          ) : (
            <p className="caption">{hostName(view) ?? 'The host'} has the remote</p>
          )}

          <QuickActions
            isDisabled={view.pip === 'thinking'}
            onAsk={(question) => {
              if (!isWide) openPip('pad_touch');
              void props.onAsk(question, 'starter');
            }}
          />

          <VoiceButton
            isHost={isHost}
            onCommand={(event) =>
              event.type === 'pip.invoke' ? openPip('pad_voice') : void send(event, 'pad_voice')
            }
            onQuestion={(text) => {
              openPip('pad_voice');
              void props.onAsk(text, 'voice');
            }}
          />
          {notice && (
            <p className="error" role="status">
              {notice}
            </p>
          )}

          {view.kidsMode && (
            <section className="stack" aria-label="Kids games">
              {companion?.prediction && (
                <PredictionCard
                  key={companion.prediction.id}
                  prediction={companion.prediction}
                  myId={props.myId}
                  playerCount={onlineCount}
                  onVote={props.onVote}
                />
              )}
              {isHost && (
                <button
                  className={
                    view.playback?.ended
                      ? 'button button--wide button--accent'
                      : 'button button--wide'
                  }
                  disabled={view.quizUnlocked === 0}
                  onClick={() => onCommand({ type: 'start-quiz' })}
                >
                  {view.quizUnlocked === 0
                    ? 'The quiz unlocks as you watch'
                    : `Start the quiz (${view.quizUnlocked} ready)`}
                </button>
              )}
            </section>
          )}
        </div>

        {/* On a tablet Pip sits beside the remote; asking there is the invocation. */}
        {isWide && (
          <aside className="pip-panel" aria-label="Pip">
            <h2 className="title">Ask Pip</h2>
            <p className="caption">About the film so far. Pip never tells what comes next.</p>
            {pipPanel}
          </aside>
        )}
      </div>

      {view.kidsMode && <ReactionBar isRaised={false} onReact={props.onReact} />}
      {!isWide && !isPipOpen && <PipButton pip={view.pip} onOpen={() => openPip('pad_touch')} />}
      {!isWide && isPipOpen && (
        <PipSheet
          pip={view.pip}
          chips={props.chips}
          say={props.say}
          onAsk={props.onAsk}
          onCommandText={runTypedCommand}
          onSomethingElse={props.onSomethingElse}
          onClose={closePip}
        />
      )}
    </main>
  );
}
