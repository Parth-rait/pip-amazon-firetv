// A fake TV for the Virtual Pip Lab and for `npm run fake:tv`: says hello, plays the chosen film by
// a clock, applies commands, reports playback. Faults: ignore commands, drop reports, go offline.
import { io, type Socket } from 'socket.io-client';
import type {
  ClientToServerEvents,
  HelloResult,
  InputEnvelope,
  Playback,
  ServerToClientEvents,
  SessionView,
  TvCommand,
} from '../shared/protocol.js';

type TvSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export interface FakeTvOptions {
  url: string;
  now?: () => number; // a manual clock in tests; Date.now for the script
  log?: (line: string) => void;
}

export class FakeTv {
  socket: TvSocket;
  code: string | null = null;
  tvKey: string | null = null;
  playback: Playback | null = null;
  commands: TvCommand[] = [];
  views: SessionView[] = [];
  ignoreCommands = false; // fault: the player does not obey
  silent = false; // fault: the player obeys but never reports
  private reportedAt = 0;
  private readonly now: () => number;
  private readonly log: (line: string) => void;

  constructor(private readonly options: FakeTvOptions) {
    this.now = options.now ?? Date.now;
    this.log = options.log ?? (() => {});
    this.socket = this.connect();
  }

  private connect(): TvSocket {
    const socket: TvSocket = io(this.options.url, {
      forceNew: true,
      reconnectionDelay: 50,
      reconnectionDelayMax: 200,
    });
    socket.on('connect', () => void this.hello().catch(() => null)); // a drop mid-hello retries on reconnect
    socket.on('session:view', (view) => this.onView(view));
    socket.on('tv:command', (command) => this.apply(command));
    return socket;
  }

  /** Sends tv:hello with the previous code, key and playback, as the real TV does on every connect. */
  async hello(): Promise<HelloResult> {
    this.advance();
    const result = await this.socket.emitWithAck('tv:hello', {
      previousCode: this.code,
      tvKey: this.tvKey,
      playback: this.playback,
    });
    if (result.ok) {
      this.code = result.code;
      this.tvKey = result.tvKey;
      this.log(`code ${result.code}  pad ${result.padUrl}  qr ${result.qrUrl}`);
    }
    return result;
  }

  latest(): SessionView | null {
    return this.views[this.views.length - 1] ?? null;
  }

  private onView(view: SessionView): void {
    this.views.push(view);
    if (view.stage === 'watch' && view.content && this.playback?.contentId !== view.content.id) {
      // A new film starts playing, like the real TV's watch screen.
      this.playback = {
        contentId: view.content.id,
        positionSec: 0,
        durationSec: view.content.durationSec,
        paused: false,
        ended: false,
      };
      this.reportedAt = this.now();
      this.report();
    }
    if (view.stage !== 'watch') this.playback = null;
  }

  /** Moves the position on by the clock while playing. */
  advance(): void {
    const now = this.now();
    if (this.playback && !this.playback.paused && !this.playback.ended) {
      const position = this.playback.positionSec + (now - this.reportedAt) / 1000;
      this.playback.positionSec = Math.min(position, this.playback.durationSec);
      this.playback.ended = this.playback.positionSec >= this.playback.durationSec;
    }
    this.reportedAt = now;
  }

  report(): void {
    this.advance();
    if (this.playback && !this.silent) this.socket.emit('tv:playback', { ...this.playback });
  }

  private apply(command: TvCommand): void {
    this.commands.push(command);
    this.log(
      `tv:command ${command.type}${command.type === 'seek' ? ` ${command.deltaSec}` : ''} (${command.commandId})`,
    );
    if (this.ignoreCommands || !this.playback) return;
    this.advance();
    if (command.type === 'play') this.playback.paused = false;
    if (command.type === 'pause') this.playback.paused = true;
    if (command.type === 'seek') this.jumpTo(this.playback.positionSec + command.deltaSec);
    this.report();
  }

  /** Someone scrubbed on the TV itself (or its remote handled the seek natively). */
  scrubTo(positionSec: number): void {
    if (!this.playback) return;
    this.advance();
    this.jumpTo(positionSec);
    this.report();
  }

  private jumpTo(positionSec: number): void {
    if (!this.playback) return;
    this.playback.positionSec = Math.min(Math.max(positionSec, 0), this.playback.durationSec);
    this.playback.ended = false;
  }

  /** A remote key the TV app forwards. */
  pressKey(key: Extract<InputEnvelope['input'], { kind: 'key' }>['key'], eventId: string): void {
    this.socket.emit('tv:input', {
      v: 1,
      eventId,
      source: 'remote',
      sentAt: this.now(),
      input: { kind: 'key', key },
    });
  }

  close(): void {
    this.socket.close();
  }

  /** Reconnects with a fresh socket, as after an app or network restart that keeps memory. */
  reconnect(): void {
    this.socket.close();
    this.socket = this.connect();
  }
}
