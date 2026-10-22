// Pip's speech bubble on the TV: who asked, then the reply, at most four lines (nine for a story).
export function Bubble({
  above,
  text,
  tone = 'surface',
  isStory = false,
}: {
  above?: string;
  text: string;
  tone?: 'surface' | 'accent';
  isStory?: boolean; // a made-up "what if": more lines, and room to read them
}) {
  return (
    <div className={`bubble bubble--${tone}${isStory ? ' bubble--story' : ''}`} role="status">
      {above && <p className="bubble-above">{above}</p>}
      <p className="bubble-text">{text}</p>
    </div>
  );
}
