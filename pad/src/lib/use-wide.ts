// True on a tablet-sized screen, where Pip sits beside the remote instead of behind a button.
import { useEffect, useState } from 'react';

const WIDE = '(min-width: 900px)';

export function useWide(): boolean {
  const [isWide, setIsWide] = useState(() => window.matchMedia(WIDE).matches);
  useEffect(() => {
    const query = window.matchMedia(WIDE);
    const onChange = () => setIsWide(query.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);
  return isWide;
}
