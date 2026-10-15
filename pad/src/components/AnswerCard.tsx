// Pip's latest answer to me, under the chips, for 8 s (section 3.3).
import { useEffect, useState } from 'react';
import type { PipSay } from '../shared/protocol';

const SHOW_MS = 8000;

export function AnswerCard({ say }: { say: PipSay | null }) {
  // The answer whose 8 s have passed; a newer answer shows again.
  const [expired, setExpired] = useState<PipSay | null>(null);
  useEffect(() => {
    if (!say) return;
    const timer = setTimeout(() => setExpired(say), SHOW_MS);
    return () => clearTimeout(timer);
  }, [say]);

  if (!say || say === expired || say.clarify.length > 0) return null;
  return (
    <div className="answer" role="status">
      <p className="caption">You asked: {say.question}</p>
      <p className="body">{say.text}</p>
    </div>
  );
}
