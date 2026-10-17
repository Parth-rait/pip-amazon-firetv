// Pip's speech bubble on the TV: who asked, then the reply, at most four lines.
export function Bubble({
  above,
  text,
  tone = 'surface',
}: {
  above?: string;
  text: string;
  tone?: 'surface' | 'accent';
}) {
  return (
    <div className={`bubble bubble--${tone}`} role="status">
      {above && <p className="bubble-above">{above}</p>}
      <p className="bubble-text">{text}</p>
    </div>
  );
}
