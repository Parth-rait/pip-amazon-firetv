// RESULTS: my score, the standings and the family total; the host goes on (section 3.3).
import { familyLine } from '../lib/quiz-lines';
import type { HostCommand, SessionView } from '../shared/protocol';

interface Props {
  view: SessionView;
  myId: string;
  isHost: boolean;
  onCommand: (command: HostCommand) => void;
}

export function ResultsScreen({ view, myId, isHost, onCommand }: Props) {
  const results = view.results;
  if (!results) return null;
  const me = results.ranking.find((r) => r.playerId === myId);
  const content = view.content;
  const canKeepWatching = content !== null && !view.playback?.ended;
  return (
    <main className="screen">
      {me && (
        <h1 className="title">
          You got {me.score} of {results.questions}.
        </h1>
      )}
      <ol className="standings">
        {results.ranking.map((row) => (
          <li key={row.playerId} className="standings__row">
            <span className="standings__place">{row.place}</span>
            <span className="standings__name">{row.name}</span>
            <span>{row.score}</span>
          </li>
        ))}
      </ol>
      <p className="body">{familyLine(results.correct, results.answers)}</p>
      {isHost && (
        <section className="stack">
          {canKeepWatching && (
            <button
              className="button button--wide button--accent"
              onClick={() => onCommand({ type: 'watch', contentId: content.id })}
            >
              Keep watching
            </button>
          )}
          <button className="button button--wide" onClick={() => onCommand({ type: 'lobby' })}>
            Back to lobby
          </button>
        </section>
      )}
    </main>
  );
}
