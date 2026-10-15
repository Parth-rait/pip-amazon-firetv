// Players and the host: names, joining, leaving and the hand-over (PROJECT.md 4.5 Join and Host).
import { LIMITS } from '../shared/protocol.js';

export interface Player {
  id: string; // 32 lowercase hex characters, made by the pad
  name: string;
  socketIds: Set<string>; // online while not empty
  score: number;
  joinedAt: number;
  lastSeenAt: number; // when the last socket left (ms)
  lastAskAt: number; // when this player last asked Pip (ms)
}

/** The part of a session the player functions use, so any Pip product can reuse them. */
export interface Roster {
  players: Map<string, Player>; // insertion order is join order
  hostId: string | null;
}

export type JoinOutcome =
  { ok: true; player: Player; isNew: boolean } | { ok: false; reason: 'full' };

// Control characters (C0, DEL, C1) and invisible format characters.
const CONTROL_CHARS = /[\p{Cc}\p{Cf}]/gu;

/** A first name fit to show on the TV, or null when nothing usable is left. */
export function cleanName(raw: string): string | null {
  const name = raw.replace(CONTROL_CHARS, '').replace(/\s+/g, ' ').trim();
  if (name.length === 0 || [...name].length > LIMITS.nameMaxChars) return null;
  return name;
}

/** The name, or "Name 2", "Name 3"... (shortened to fit) when another player has it, ignoring case. */
export function uniqueName(name: string, taken: Iterable<string>): string {
  const lower = new Set([...taken].map((t) => t.toLowerCase()));
  if (!lower.has(name.toLowerCase())) return name;
  for (let n = 2; ; n += 1) {
    const suffix = ` ${n}`;
    const base = [...name]
      .slice(0, LIMITS.nameMaxChars - suffix.length)
      .join('')
      .trimEnd();
    const candidate = `${base}${suffix}`;
    if (!lower.has(candidate.toLowerCase())) return candidate;
  }
}

export function isOnline(player: Player): boolean {
  return player.socketIds.size > 0;
}

/** Adds a socket to a known player, or adds a new player. The caller cleans the name first. */
export function joinPlayer(
  roster: Roster,
  input: { playerId: string; name: string; socketId: string },
  nowMs: number,
): JoinOutcome {
  const known = roster.players.get(input.playerId);
  if (known) {
    known.socketIds.add(input.socketId);
    return { ok: true, player: known, isNew: false };
  }
  if (roster.players.size >= LIMITS.maxPlayers) return { ok: false, reason: 'full' };
  const taken = [...roster.players.values()].map((p) => p.name);
  const player: Player = {
    id: input.playerId,
    name: uniqueName(input.name, taken),
    socketIds: new Set([input.socketId]),
    score: 0,
    joinedAt: nowMs,
    lastSeenAt: nowMs,
    lastAskAt: 0,
  };
  roster.players.set(player.id, player);
  return { ok: true, player, isNew: true };
}

/** Removes one socket from a player. Returns true when that was the player's last socket. */
export function leaveSocket(
  roster: Roster,
  playerId: string,
  socketId: string,
  nowMs: number,
): boolean {
  const player = roster.players.get(playerId);
  if (!player || !player.socketIds.delete(socketId)) return false;
  if (player.socketIds.size > 0) return false;
  player.lastSeenAt = nowMs;
  return true;
}

/**
 * Keeps the host while they are online or within the grace period; otherwise passes the role
 * to the earliest-joined online player. With nobody online the role stays where it is.
 */
export function pickHost(roster: Roster, nowMs: number): string | null {
  const host = roster.hostId ? roster.players.get(roster.hostId) : undefined;
  if (host && (isOnline(host) || nowMs - host.lastSeenAt < LIMITS.hostGraceMs)) {
    return host.id;
  }
  const next = [...roster.players.values()].find(isOnline);
  if (next) roster.hostId = next.id;
  else if (!host) roster.hostId = null;
  return roster.hostId;
}
