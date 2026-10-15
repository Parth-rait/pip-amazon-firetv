import { describe, expect, it } from 'vitest';
import { joinPlayer, leaveSocket } from './core/players.js';
import type { Content } from './film/content.js';
import { createSession } from './sessions.js';
import { buildView } from './view.js';

const film: Content = {
  id: 'test-film',
  title: 'Test',
  url: '/media/test.mp4',
  credit: 'Credit',
  durationSec: 100,
  premise: 'Premise.',
  notes: [{ atSec: 0, text: 'Start.' }],
  quiz: [10, 50].map((atSec) => ({
    atSec,
    question: 'Q?',
    choices: ['A', 'B', 'C', 'D'],
    answer: 2,
    explanation: 'Because.',
  })),
};

function watching() {
  const session = createSession('ABCD', 'a'.repeat(32), 'tv', 0);
  session.stage = 'watch';
  session.contentId = film.id;
  session.playback = {
    contentId: film.id,
    positionSec: 20,
    durationSec: 100,
    paused: true,
    ended: false,
  };
  return session;
}

describe('buildView', () => {
  it('marks who is online and whether the TV is', () => {
    const session = createSession('ABCD', 'a'.repeat(32), 'tv', 0);
    joinPlayer(session, { playerId: '1'.repeat(32), name: 'A', socketId: 's1' }, 0);
    joinPlayer(session, { playerId: '2'.repeat(32), name: 'B', socketId: 's2' }, 0);
    leaveSocket(session, '2'.repeat(32), 's2', 1);
    session.tvSocketId = null;
    const view = buildView(session, [film], 'http://x', 0);
    expect(view.tvOnline).toBe(false);
    expect(view.players.map((p) => [p.name, p.online])).toEqual([
      ['A', true],
      ['B', false],
    ]);
  });

  it('counts unlocked questions only in watch', () => {
    const session = watching();
    expect(buildView(session, [film], 'http://x', 0).quizUnlocked).toBe(1);
    session.stage = 'lobby';
    expect(buildView(session, [film], 'http://x', 0).quizUnlocked).toBe(0);
  });

  it('includes the film with a full URL and never the notes, the quiz or the answers', () => {
    const view = buildView(watching(), [film], 'https://pip.example.com', 0);
    expect(view.content?.url).toBe('https://pip.example.com/media/test.mp4');
    const json = JSON.stringify(view);
    expect(json).not.toContain('Start.');
    expect(json).not.toContain('Because.');
    expect(view.quiz).toBeNull();
    expect(view.results).toBeNull();
  });
});
