// A fake TV for the Virtual Pip Lab: says hello, plays the chosen film by a clock, applies each
// command and confirms it with tv:applied, like the Vega app's player. Faults: ignore commands (no
// confirmation at all), fail them (confirmed as failed), or never report playback.
import { io, type Socket } from 'socket.io-client';
import type {
  ClientToServerEvents,
  HelloResult,
  BranchView,
  PipSay,
  Playback,
  ServerToClientEvents,
  SessionView,
  TvCommand,
} from '../shared/protocol.js';

type TvSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export interface FakeTvOptions {
  url: string;
  now: () => number; // the lab's manual clock
}

export class FakeTv {
  socket: TvSocket;
  code: string | null = null;
  tvKey: string | null = null;
  playback: Playback | null = null;
  commands: TvCommand[] = [];
  views: SessionView[] = [];
  says: PipSay[] = [];
  branches: { ownerId: string; branch: BranchView | null }[] = [];
  volume = 1;
  brightness = 1;
  ignoreCommands = false; // fault: the player never answers
  failCommands = false; // fault: the player answers that it could not do it
  silent = false; // fault: the player obeys but never reports playback
  private reportedAt = 0;

  constructor(private readonly options: FakeTvOptions) {
    this.socket = this.connect();
  }

  private connect(): TvSocket {
    const socket: TvSocket = io(this.options.url, {
      forceNew: true,
      reconnectionDelay: 50,
      reconnectionDelayMax: 200,
    });
    // Like the real TV: hello on every connect, with the code, key and playback it remembers.
    socket.on('connect', () => void this.hello().catch(() => null));
    socket.on('session:view', (view) => this.onView(view));
    socket.on('tv:command', (command) => this.apply(command));
    socket.on('pip:say', (say) => this.says.push(say));
    socket.on('pip:branch', (update) => this.branches.push(update));
    return socket;
  }

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
      this.reportedAt = this.options.now();
      this.report();
    }
    if (view.stage !== 'watch') this.playback = null;
  }

  /** Moves the position on by the clock while playing. */
  advance(): void {
    const now = this.options.now();
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
    if (this.ignoreCommands) return;
    if (this.failCommands || !this.playback) {
      this.socket.emit('tv:applied', { id: command.id, ok: false, detail: 'fault' });
      return;
    }
    this.advance();
    if (command.type === 'play') this.playback.paused = false;
    if (command.type === 'pause') this.playback.paused = true;
    if (command.type === 'seek') this.jumpTo(this.playback.positionSec + command.deltaSec);
    if (command.type === 'volume') this.volume = command.level;
    if (command.type === 'brightness') this.brightness = command.level;
    this.socket.emit('tv:applied', { id: command.id, ok: true });
    this.report();
  }

  /** Someone paused on the TV itself (the remote's play/pause). */
  pauseHere(): void {
    if (!this.playback) return;
    this.advance();
    this.playback.paused = true;
    this.report();
  }

  /** Someone scrubbed on the TV itself. */
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

  close(): void {
    this.socket.close();
  }

  /** Reconnects with a fresh socket, as after an app or network restart that keeps memory. */
  reconnect(): void {
    this.socket.close();
    this.socket = this.connect();
  }
}
