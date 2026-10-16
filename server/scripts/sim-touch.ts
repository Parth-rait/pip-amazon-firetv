// npm run sim:touch -- <trace> [code] [--dry]
// Replays a touch trace (sim/traces/<trace>.json, or a path) through the touch adapter, at the
// trace's own timing. With a code it joins that TV as a player called "Touch" and sends each input
// with pad:input, like a paired touch controller; media inputs need that player to be the host.
// With --dry it prints the inputs and sends nothing.
import 'dotenv/config';
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { io, type Socket } from 'socket.io-client';
import { loadConfig } from '../src/config.js';
import { replay, type TouchSample } from '../src/core/touch.js';
import type { ClientToServerEvents, ServerToClientEvents } from '../src/shared/protocol.js';

const args = process.argv.slice(2);
const isDry = args.includes('--dry');
const [traceArg, code] = args.filter((a) => !a.startsWith('--'));
if (!traceArg || (!code && !isDry)) {
  console.error('usage: npm run sim:touch -- <trace> <code> | npm run sim:touch -- <trace> --dry');
  process.exit(2);
}
const path = existsSync(traceArg)
  ? traceArg
  : new URL(`../sim/traces/${traceArg}.json`, import.meta.url);
const trace = JSON.parse(readFileSync(path, 'utf8')) as {
  name: string;
  description: string;
  samples: TouchSample[];
};
const outputs = replay(trace.samples);
console.log(`${trace.name}: ${trace.description}`);
console.log(`${trace.samples.length} readings -> ${outputs.length} inputs`);

const describe = (o: (typeof outputs)[number]) =>
  `t=${String(o.t).padStart(5)} ms  ${o.source.padEnd(23)} ${JSON.stringify(o.event)}`;

if (isDry) {
  for (const o of outputs) console.log(describe(o));
  process.exit(0);
}

const config = loadConfig();
const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(
  `http://localhost:${config.PORT}`,
);
const playerId = randomBytes(16).toString('hex');
const run = Date.now().toString(36);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

socket.on('connect', async () => {
  const joined = await socket
    .timeout(5000)
    .emitWithAck('pad:join', { code: code!.toUpperCase(), playerId, name: 'Touch' });
  if (!joined.ok) {
    console.error(`join refused: ${joined.reason}`);
    process.exit(1);
  }
  const isHost = joined.view.hostId === playerId;
  console.log(`joined ${joined.view.code} as Touch${isHost ? ' (host)' : ' (not the host)'}`);
  const started = Date.now();
  let sent = 0;
  let refused = 0;
  for (const [i, o] of outputs.entries()) {
    await sleep(Math.max(0, started + o.t - Date.now()));
    const at = Date.now();
    const result = await socket
      .timeout(5000)
      .emitWithAck('pad:input', { id: `sim-${run}-${i}`, source: o.source, at, event: o.event });
    const ms = Date.now() - at;
    sent += 1;
    if (!result.ok) refused += 1;
    console.log(
      `${describe(o)}  -> ${result.ok ? result.action : `refused: ${result.reason}`} (${ms} ms)`,
    );
  }
  console.log(`done: ${sent} sent, ${sent - refused} accepted, ${refused} refused`);
  socket.disconnect();
  process.exit(0);
});

socket.on('connect_error', (err) => {
  console.error(`cannot reach the server: ${err.message}`);
  process.exit(1);
});
