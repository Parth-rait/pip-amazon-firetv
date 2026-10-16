import { describe, expect, it } from 'vitest';
import { LIMITS } from '../shared/protocol.js';
import {
  cleanName,
  joinPlayer,
  leaveSocket,
  pickHost,
  uniqueName,
  type Roster,
} from './players.js';

const id = (n: number) => n.toString(16).padStart(32, '0');

function roster(): Roster {
  return { players: new Map(), hostId: null };
}

function join(r: Roster, n: number, name = `P${n}`, now = n) {
  const outcome = joinPlayer(r, { playerId: id(n), name, socketId: `s${n}` }, now);
  pickHost(r, now);
  return outcome;
}

describe('cleanName', () => {
  it('collapses whitespace, removes control characters and trims', () => {
    expect(cleanName('  Sam \t  Lee\n')).toBe('Sam Lee');
    expect(cleanName('Sa\u0000m​')).toBe('Sam');
  });

  it('returns null when the name is empty or too long', () => {
    expect(cleanName('   ')).toBeNull();
    expect(cleanName('\u0007')).toBeNull();
    expect(cleanName('a'.repeat(LIMITS.nameMaxChars + 1))).toBeNull();
    expect(cleanName('a'.repeat(LIMITS.nameMaxChars))).toHaveLength(LIMITS.nameMaxChars);
  });
});

describe('uniqueName', () => {
  it('turns a second "Sam" into "Sam 2", ignoring case', () => {
    expect(uniqueName('sam', ['Sam'])).toBe('sam 2');
    expect(uniqueName('Sam', ['Sam', 'sam 2'])).toBe('Sam 3');
  });

  it('shortens a 12-character duplicate so the result still fits', () => {
    const long = 'Alexandriana';
    const result = uniqueName(long, [long]);
    expect(result).toBe('Alexandria 2');
    expect(result.length).toBeLessThanOrEqual(LIMITS.nameMaxChars);
  });
});

describe('joinPlayer and pickHost', () => {
  it('makes the first player the host', () => {
    const r = roster();
    join(r, 1);
    join(r, 2);
    expect(r.hostId).toBe(id(1));
  });

  it('gives a known id its old name and score back', () => {
    const r = roster();
    join(r, 1, 'Sam');
    const player = r.players.get(id(1));
    if (!player) throw new Error('missing');
    player.score = 3;
    leaveSocket(r, id(1), 's1', 5);
    const again = joinPlayer(r, { playerId: id(1), name: 'Other', socketId: 'x' }, 6);
    expect(again).toMatchObject({ ok: true, isNew: false, player: { name: 'Sam', score: 3 } });
  });

  it('refuses the 9th player', () => {
    const r = roster();
    for (let n = 1; n <= LIMITS.maxPlayers; n += 1) expect(join(r, n).ok).toBe(true);
    expect(join(r, 99)).toEqual({ ok: false, reason: 'full' });
  });

  it('keeps the host within the grace period, then passes it to the earliest-joined online player', () => {
    const r = roster();
    join(r, 1);
    join(r, 2);
    join(r, 3);
    expect(leaveSocket(r, id(1), 's1', 1000)).toBe(true);
    expect(pickHost(r, 1000 + LIMITS.hostGraceMs - 1)).toBe(id(1));
    expect(pickHost(r, 1000 + LIMITS.hostGraceMs)).toBe(id(2));
  });

  it('keeps the host when nobody is online', () => {
    const r = roster();
    join(r, 1);
    join(r, 2);
    leaveSocket(r, id(1), 's1', 10);
    leaveSocket(r, id(2), 's2', 10);
    expect(pickHost(r, 10 + LIMITS.hostGraceMs * 5)).toBe(id(1));
  });

  it('keeps a player online while another of their sockets is connected', () => {
    const r = roster();
    join(r, 1);
    joinPlayer(r, { playerId: id(1), name: 'P1', socketId: 'second' }, 2);
    expect(leaveSocket(r, id(1), 's1', 3)).toBe(false);
    expect(leaveSocket(r, id(1), 'second', 4)).toBe(true);
  });
});

describe('avatars', () => {
  it('gives each new player the first free avatar color, unless they picked one', () => {
    const r = roster();
    join(r, 1);
    expect(r.players.get(id(1))?.avatar).toBe(0);
    expect(
      joinPlayer(r, { playerId: id(2), name: 'Leo', socketId: 's2', avatar: 3 }, 2),
    ).toMatchObject({
      ok: true,
      player: { avatar: 3 },
    });
    join(r, 3);
    expect(r.players.get(id(3))?.avatar).toBe(1);
  });

  it('lets a returning player change their avatar', () => {
    const r = roster();
    join(r, 1);
    joinPlayer(r, { playerId: id(1), name: 'P1', socketId: 's9', avatar: 5 }, 9);
    expect(r.players.get(id(1))?.avatar).toBe(5);
  });
});
