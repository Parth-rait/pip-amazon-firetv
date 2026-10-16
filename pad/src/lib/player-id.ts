// What this device remembers: its player id, the last code and the first name (localStorage).
import { AVATAR_COLORS } from '../shared/protocol';
const KEYS = {
  playerId: 'pip.playerId',
  code: 'pip.code',
  name: 'pip.name',
  avatar: 'pip.avatar',
} as const;
const ID_BYTES = 16;

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null; // storage can be blocked (private mode); the pad still works for this visit
  }
}

function write(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // Same as above: nothing to do when storage is blocked.
  }
}

/** 32 lowercase hex characters, made once per device and kept. */
export function getPlayerId(): string {
  const saved = read(KEYS.playerId);
  if (saved && /^[0-9a-f]{32}$/.test(saved)) return saved;
  const bytes = crypto.getRandomValues(new Uint8Array(ID_BYTES));
  const id = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
  write(KEYS.playerId, id);
  return id;
}

export const getSavedCode = () => read(KEYS.code);
export const saveCode = (code: string | null) => write(KEYS.code, code);
export const getSavedName = () => read(KEYS.name);
export const saveName = (name: string) => write(KEYS.name, name);
/** The avatar color this device picked (an index into AVATAR_COLORS), if any. */
export function getSavedAvatar(): number | null {
  const raw = read(KEYS.avatar);
  const avatar = raw === null ? Number.NaN : Number(raw);
  return Number.isInteger(avatar) && avatar >= 0 && avatar < AVATAR_COLORS.length ? avatar : null;
}
export const saveAvatar = (avatar: number) => write(KEYS.avatar, String(avatar));
