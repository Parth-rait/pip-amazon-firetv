// A fake Pip Pad for the Virtual Pip Lab: joins with a name, rejoins after every reconnect, sends
// host commands, asks Pip and sends semantic inputs from any adapter source.
import { randomBytes } from 'node:crypto';
import { io, type Socket } from 'socket.io-client';
import type {
  AskResult,
  AskVia,
  ClientToServerEvents,
  HostCommand,
  InputResult,
  InputSource,
  JoinResult,
  PipInputEvent,
  PipMissed,
  PipSay,
  ServerToClientEvents,
  SessionView,
} from '../shared/protocol.js';

type PadSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let counter = 0;
const REJOIN_ATTEMPTS = 40;
const REJOIN_EVERY_MS = 100;

/** A unique input id, as an adapter makes one. */
export function labId(prefix: string): string {
  counter += 1;
  return `${prefix}-${String(counter).padStart(6, '0')}-${randomBytes(4).toString('hex')}`;
}

export class FakePad {
  readonly playerId = randomBytes(16).toString('hex');
  socket: PadSocket;
  views: SessionView[] = [];
  says: PipSay[] = [];
  missed: PipMissed[] = [];
  private code: string | null = null;

  constructor(
    private readonly url: string,
    readonly name: string,
    private readonly now: () => number,
  ) {
    this.socket = this.connect();
  }

  private connect(): PadSocket {
    const socket: PadSocket = io(this.url, {
      forceNew: true,
      reconnectionDelay: 50,
      reconnectionDelayMax: 200,
    });
    socket.on('session:view', (view) => this.views.push(view));
    socket.on('pip:say', (say) => this.says.push(say));
    socket.on('pip:missed', (missed) => this.missed.push(missed));
    socket.on('connect', () => {
      if (this.code) void this.rejoin(this.code);
    });
    return socket;
  }

  /** Like the real pad: rejoin with the saved code, retrying until the TV has re-created it. */
  private async rejoin(code: string): Promise<void> {
    for (let attempt = 0; attempt < REJOIN_ATTEMPTS && this.socket.connected; attempt += 1) {
      const result = await this.join(code).catch(() => null);
      if (result?.ok || (result && result.reason !== 'unknown-code')) return;
      await new Promise((resolve) => setTimeout(resolve, REJOIN_EVERY_MS));
    }
  }

  async join(code: string): Promise<JoinResult> {
    const result = await this.socket.emitWithAck('pad:join', {
      code,
      playerId: this.playerId,
      name: this.name,
    });
    if (result.ok) {
      this.code = code;
      this.views.push(result.view);
    }
    return result;
  }

  latest(): SessionView | null {
    return this.views[this.views.length - 1] ?? null;
  }

  /** Pip's replies meant for this pad (the pad shows only its own player's answers). */
  mine(): PipSay[] {
    return this.says.filter((say) => say.askedBy === this.playerId);
  }

  host(command: HostCommand): void {
    this.socket.emit('pad:host', command);
  }

  ask(text: string, via: AskVia = 'typed'): Promise<AskResult> {
    return this.socket.emitWithAck('pad:ask', { text, via });
  }

  input(
    event: PipInputEvent,
    source: InputSource = 'simulator',
    id = labId('in'),
  ): Promise<InputResult> {
    return this.socket.emitWithAck('pad:input', { id, source, at: this.now(), event });
  }

  /** The pad was hidden (phone locked) or shown again. */
  away(away: boolean): void {
    this.socket.emit('pad:away', { away });
  }

  close(): void {
    this.socket.close();
  }
}
