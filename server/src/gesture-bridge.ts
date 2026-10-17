// Starts the Python gesture bridge (gesture/pip_bridge) and hands over each line it prints, parsed.
// Shared by `npm run gesture` and the lab's gesture scenario. Outside core/: it spawns a process.
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { parseBridgeLine, type BridgeLine } from './core/gesture.js';

export const GESTURE_DIR = fileURLToPath(new URL('../../gesture/', import.meta.url));
/** The bridge's own Python, made by gesture/README.md's setup; never the system one. */
export const BRIDGE_PYTHON = `${GESTURE_DIR}.venv/bin/python`;

export function bridgeInstalled(): boolean {
  return existsSync(BRIDGE_PYTHON);
}

export type BridgeMode = { mode: 'camera'; preview: boolean } | { mode: 'replay'; trace: string };

export interface Bridge {
  /** Resolves with the exit code once the bridge has stopped and every line was handed over. */
  exited: Promise<number>;
  stop(): void;
}

export function startBridge(
  how: BridgeMode,
  onLine: (line: BridgeLine) => void,
  onLog: (text: string) => void = () => {},
): Bridge {
  const args =
    how.mode === 'camera'
      ? ['-m', 'pip_bridge', 'camera', ...(how.preview ? ['--preview'] : [])]
      : ['-m', 'pip_bridge', 'replay', how.trace];
  const child = spawn(BRIDGE_PYTHON, args, {
    cwd: GESTURE_DIR,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, PYTHONUNBUFFERED: '1' },
  });
  const lines = createInterface({ input: child.stdout });
  lines.on('line', (text) => {
    const line = parseBridgeLine(text);
    if (line) onLine(line);
    else if (text.trim()) onLog(text);
  });
  createInterface({ input: child.stderr }).on('line', onLog); // MediaPipe's own logging
  const exited = new Promise<number>((resolve, reject) => {
    child.on('error', reject);
    // 'close' comes after the exit and after stdout ended, so every line was handed over
    child.on('close', (code) => resolve(code ?? 1));
  });
  return { exited, stop: () => void child.kill('SIGINT') };
}
