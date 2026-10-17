// npm run gesture -- <code> [--preview] | npm run gesture -- --replay <trace> [code] [--dry]
// Hand gestures from the webcam (or a recorded trace of poses) through the vendored
// gesture-tv-remote pipeline in gesture/. With a code it joins that TV as a player called
// "Gestures" and sends each gesture with pad:input, like sim:touch; media inputs need that player
// to be the host. --preview shows upstream's camera window with the hand and joystick overlay.
// --dry prints the inputs and sends nothing. Setup: gesture/README.md.
import 'dotenv/config';
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { io, type Socket } from 'socket.io-client';
import { loadConfig } from '../src/config.js';
import { createRepeatFilter, gestureEvent, type BridgeLine } from '../src/core/gesture.js';
import { bridgeInstalled, GESTURE_DIR, startBridge } from '../src/gesture-bridge.js';
import type {
  ClientToServerEvents,
  PipInput,
  ServerToClientEvents,
} from '../src/shared/protocol.js';

const args = process.argv.slice(2);
const isDry = args.includes('--dry');
const preview = args.includes('--preview');
const replayAt = args.indexOf('--replay');
const traceArg = replayAt >= 0 ? args[replayAt + 1] : undefined;
const [code] = args.filter((a, i) => !a.startsWith('--') && (replayAt < 0 || i !== replayAt + 1));
if ((replayAt >= 0 && !traceArg) || (!code && !isDry)) {
  console.error(
    'usage: npm run gesture -- <code> [--preview] | npm run gesture -- --replay <trace> [<code>|--dry]',
  );
  process.exit(2);
}
if (!bridgeInstalled()) {
  console.error(`no gesture bridge: set up ${GESTURE_DIR}.venv as gesture/README.md says`);
  process.exit(1);
}
const trace = traceArg && (existsSync(traceArg) ? traceArg : `traces/${traceArg}.json`);

const run = Date.now().toString(36);
let sent = 0;
let refused = 0;
let socket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null;
let queue = Promise.resolve();
const firstSend = createRepeatFilter();
const explained = new Set<string>();

/** What a refusal means and what to do, said once per reason so the terminal stays readable. */
const REFUSAL_HELP: Record<string, string> = {
  'no-tv':
    'The TV app is not connected to the server. Bring the Vega Virtual Device to the front (or\n' +
    '  relaunch Pip on it) and wait for the TV to show the film again.',
  'not-allowed':
    'Gestures is not the host, so playback gestures are refused. Join with gestures first, or have\n' +
    '  the host leave so it takes over.',
  'not-watching': 'Nothing is playing yet: start a film from the host pad first.',
  unsupported: 'Pointing up or down is for browsing, which is not built yet.',
};

function explain(reason: string): void {
  if (explained.has(reason) || !REFUSAL_HELP[reason]) return;
  explained.add(reason);
  console.log(`  ^ ${REFUSAL_HELP[reason]}`);
}

async function send(line: Extract<BridgeLine, { type: 'command' }>): Promise<void> {
  const event = gestureEvent(line.command);
  const label = `${line.command.padEnd(11)} ${JSON.stringify(event)}`;
  if (!socket) return void console.log(label);
  const input: PipInput = {
    id: `gesture-${run}-${sent}`,
    source: 'hand_gesture_cam',
    at: Date.now(),
    event,
  };
  const pipe = input.at - line.at; // bridge to here
  const result = await socket.timeout(5000).emitWithAck('pad:input', input);
  sent += 1;
  if (!result.ok) refused += 1;
  const ack = Date.now() - input.at;
  console.log(
    `${label}  -> ${result.ok ? result.action : `refused: ${result.reason}`} (pipe ${pipe} ms, ack ${ack} ms)`,
  );
  if (!result.ok) explain(result.reason);
}

/** The camera run ended without a gesture: show the bridge's own errors, which go to its log. */
function explainEarlyStop(): void {
  const logFile = `${GESTURE_DIR}logs/bridge.log`;
  const errors = existsSync(logFile)
    ? readFileSync(logFile, 'utf8')
        .split('\n')
        .filter((line) => line.startsWith('[ERROR]'))
    : [];
  if (errors.length === 0) return;
  console.error(`the gesture bridge stopped:\n  ${errors.slice(-3).join('\n  ')}`);
  if (errors.some((line) => line.includes('webcam'))) {
    console.error(
      '  Allow the camera for this terminal app (System Settings > Privacy & Security > Camera),\n' +
        '  quit and reopen it, and run again. With more than one camera (an iPhone through\n' +
        '  Continuity Camera), try GESTURE_TV_WEBCAM_INDEX=1.',
    );
  }
}

function startGestures(): void {
  const bridge = startBridge(
    trace ? { mode: 'replay', trace } : { mode: 'camera', preview },
    (line) => {
      if (line.type === 'ready') console.log(`gesture bridge ready (${line.mode})`);
      // a held point repeats about 3 times a second upstream; one seek per point (core/gesture.ts)
      if (line.type === 'command' && firstSend(line.command, line.at))
        queue = queue.then(() => send(line)).catch(console.error);
    },
    (text) => process.env.GESTURE_VERBOSE && console.error(text),
  );
  process.on('SIGINT', () => bridge.stop());
  void bridge.exited.then(async (exitCode) => {
    await queue;
    if (!trace && sent === 0) explainEarlyStop();
    if (socket) console.log(`done: ${sent} sent, ${sent - refused} accepted, ${refused} refused`);
    socket?.disconnect();
    process.exit(exitCode);
  });
}

if (isDry) {
  startGestures();
} else {
  const config = loadConfig();
  const client: Socket<ServerToClientEvents, ClientToServerEvents> = io(
    `http://localhost:${config.PORT}`,
  );
  const playerId = randomBytes(16).toString('hex');
  // Joins again after every reconnect, with the same player id, so the server knows the socket.
  client.on('connect', async () => {
    const joined = await client
      .timeout(5000)
      .emitWithAck('pad:join', { code: code!.toUpperCase(), playerId, name: 'Gestures' });
    if (!joined.ok) {
      console.error(`join refused: ${joined.reason}`);
      if (!socket) process.exit(1);
      return;
    }
    const isHost = joined.view.hostId === playerId;
    console.log(`joined ${joined.view.code} as Gestures${isHost ? ' (host)' : ' (not the host)'}`);
    if (socket) return;
    socket = client;
    startGestures();
  });
  client.on('connect_error', (err) => {
    if (socket) return;
    console.error(`cannot reach the server: ${err.message}`);
    process.exit(1);
  });
}
