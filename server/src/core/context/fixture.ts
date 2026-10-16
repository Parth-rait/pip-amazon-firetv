// "The Lantern Fox": a tiny original story (ours, MIT) used as ground truth by tests, the lab and
// the evaluation. Its last scene is a reveal, so spoiler checks have something real to protect.
import type { Entity, TimedFact, Timeline } from './timeline.js';

type FactInput = Omit<TimedFact, 'evidence' | 'confidence' | 'review'> & Partial<TimedFact>;

function fact(input: FactInput): TimedFact {
  return {
    evidence: [{ ref: `fr-${input.id}`, atSec: input.revealSec }],
    confidence: 1,
    review: 'accepted',
    ...input,
  };
}

function entity(input: Omit<Entity, 'review'> & Partial<Entity>): Entity {
  return { review: 'accepted', ...input };
}

export const LANTERN_FOX_DURATION_SEC = 96;

export function lanternFoxTimeline(): Timeline {
  return {
    contentId: 'lantern-fox',
    version: 'fixture-1',
    durationSec: LANTERN_FOX_DURATION_SEC,
    entities: [
      entity({ id: 'ember', name: 'Ember', aliases: ['the fox', 'fox'], firstSeenSec: 12, intro: 'That is Ember, a small orange fox.' }),
      entity({ id: 'lantern', name: 'lantern', aliases: ['old lantern'], firstSeenSec: 24, intro: 'That is an old brass lantern Ember found in the snow.' }),
      entity({ id: 'hoot', name: 'Hoot', aliases: ['the owl', 'owl'], firstSeenSec: 36, intro: 'That is Hoot, an owl who lives in a pine tree.' }),
      entity({ id: 'lighthouse', name: 'lighthouse', aliases: [], firstSeenSec: 62, intro: 'That is a dark lighthouse across the frozen lake.' }),
      entity({ id: 'moss', name: 'Moss', aliases: ['the badger', 'badger', 'keeper', 'lighthouse keeper'], firstSeenSec: 88, intro: 'That is Moss, an old badger who keeps the lighthouse.' }),
    ],
    facts: [
      fact({ id: 'f1', startSec: 0, revealSec: 4, kind: 'setting', text: 'It is night in a snowy forest under a full moon.', entities: [], spoilerTerms: [] }),
      fact({ id: 'f2', startSec: 10, revealSec: 14, kind: 'appearance', text: 'Ember, a small orange fox, walks through the snowy forest.', entities: ['ember'], spoilerTerms: [] }),
      fact({ id: 'f3', startSec: 22, revealSec: 26, kind: 'event', text: 'Ember finds an old brass lantern half buried in the snow.', entities: ['ember', 'lantern'], spoilerTerms: ['brass'] }),
      fact({ id: 'f4', startSec: 34, revealSec: 40, kind: 'event', text: 'Hoot the owl watches from a pine tree and says the lantern belongs to someone.', entities: ['hoot', 'lantern'], spoilerTerms: ['belongs to someone'] }),
      fact({ id: 'f5', startSec: 46, revealSec: 54, kind: 'event', text: 'Ember carries the lantern to a frozen lake, and the lantern starts to glow blue by itself.', entities: ['ember', 'lantern'], spoilerTerms: ['glow', 'blue'] }),
      fact({ id: 'f6', startSec: 60, revealSec: 64, kind: 'appearance', text: 'Across the lake stands a dark lighthouse with its light out.', entities: ['lighthouse'], spoilerTerms: ['light out'] }),
      fact({ id: 'f7', startSec: 72, revealSec: 80, kind: 'event', text: 'Ember climbs the lighthouse and sets the lantern at the top, and the lighthouse shines again.', entities: ['ember', 'lantern', 'lighthouse'], spoilerTerms: ['shines again', 'climbs'] }),
      fact({ id: 'f8', startSec: 84, revealSec: 90, kind: 'relation', text: 'Moss, an old badger, thanks Ember: the lantern was his, and he is the lighthouse keeper.', entities: ['moss', 'ember', 'lantern', 'lighthouse'], spoilerTerms: ['was his', 'thanks'] }),
      fact({ id: 'f9', startSec: 90, revealSec: 95, kind: 'event', text: 'Ember becomes the helper of Moss and they light the lamp together every night.', entities: ['ember', 'moss'], spoilerTerms: ['helper', 'together'] }),
      // Not usable by default: a draft nobody reviewed, and one a reviewer rejected.
      fact({ id: 'd1', startSec: 30, revealSec: 32, kind: 'event', text: 'Ember sniffs the lantern.', entities: ['ember', 'lantern'], spoilerTerms: [], review: 'candidate' }),
      fact({ id: 'x1', startSec: 50, revealSec: 52, kind: 'event', text: 'The lake cracks and Ember falls in.', entities: ['ember'], spoilerTerms: ['cracks'], review: 'rejected' }),
    ].sort((a, b) => a.startSec - b.startSec),
  };
}
