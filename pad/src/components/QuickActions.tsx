// Quick actions on the Pip Pad: the questions people ask most, one tap each. Each is an ordinary
// question to Pip, answered from what the film has shown so far.
const ACTIONS = [
  { label: 'Explain this scene', question: 'What just happened?' },
  { label: 'Who is that?', question: 'Who is that?' },
  { label: 'What did I miss?', question: 'What did I miss?' },
  { label: 'What if…?', question: 'What if it went differently?' },
];

export function QuickActions({
  isDisabled,
  onAsk,
}: {
  isDisabled: boolean;
  onAsk: (question: string) => void;
}) {
  return (
    <section className="quick" aria-label="Quick actions">
      {ACTIONS.map((action) => (
        <button
          key={action.label}
          className="quick__button"
          disabled={isDisabled}
          onClick={() => onAsk(action.question)}
        >
          {action.label}
        </button>
      ))}
    </section>
  );
}
