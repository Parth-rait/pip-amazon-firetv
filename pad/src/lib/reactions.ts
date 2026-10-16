// The four reactions on the watch screen, with their labels and face colors.
import type { ReactionKind } from '../shared/protocol';

export const REACTIONS: { kind: ReactionKind; label: string; color: string }[] = [
  { kind: 'laugh', label: 'Funny', color: '#FFD166' },
  { kind: 'wow', label: 'Wow', color: '#6EC1FF' },
  { kind: 'love', label: 'Aww', color: '#FF9BD2' },
  { kind: 'scared', label: 'Scary', color: '#B8A6FF' },
];
