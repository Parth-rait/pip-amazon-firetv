// Speech recognition with whisper.cpp (MIT, ggml-org/whisper.cpp), built locally by
// video/setup.sh. Runs on the Mac's GPU through Metal; no Python and no network at run time.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { parseWhisperJson, type TranscriptLine } from './transcript.js';

export interface WhisperSetup {
  cli: string;
  model: string;
}

/** whisper-cli and the model from video/setup.sh, or the WHISPER_CLI and WHISPER_MODEL overrides. */
export function whisperSetup(repoRoot: string, env = process.env): WhisperSetup {
  return {
    cli: env.WHISPER_CLI ?? join(repoRoot, 'video/.tools/whisper.cpp/build/bin/whisper-cli'),
    model: env.WHISPER_MODEL ?? join(repoRoot, 'video/models/ggml-small.en.bin'),
  };
}

function run(cmd: string, args: string[]): string {
  const result = spawnSync(cmd, args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (result.error) throw new Error(`${cmd} could not start: ${result.error.message}`);
  if (result.status !== 0)
    throw new Error(`${cmd} failed (${result.status}): ${result.stderr.slice(-400)}`);
  return result.stdout;
}

/**
 * 16 kHz mono PCM, the input whisper.cpp expects. It starts where the container starts, so line
 * times are on the same clock as frame times (both relative to the container's start).
 */
export function extractAudio(film: string, wav: string): void {
  mkdirSync(dirname(wav), { recursive: true });
  run('ffmpeg', [
    '-hide_banner',
    '-loglevel',
    'error',
    '-y',
    '-i',
    film,
    '-vn',
    '-ac',
    '1',
    '-ar',
    '16000',
    '-c:a',
    'pcm_s16le',
    wav,
  ]);
}

/**
 * Transcribes a 16 kHz WAV. `-mc 0` (no text context) was the best of four settings tried on
 * Sintel: with context whisper skipped the lines after a long stretch of music, `-sns` misheard
 * names, and VAD at this commit merged minutes into one segment (docs/extractions). Sound captions
 * and repetition loops are dropped by parseWhisperJson. Times are seconds from the audio's start.
 */
export function transcribe(setup: WhisperSetup, wav: string, outBase: string): TranscriptLine[] {
  for (const path of [setup.cli, setup.model]) {
    if (!existsSync(path)) throw new Error(`${path} is missing; run video/setup.sh`);
  }
  run(setup.cli, [
    '-m',
    setup.model,
    '-f',
    wav,
    '-l',
    'en',
    '-mc',
    '0',
    '-oj',
    '-of',
    outBase,
    '-np',
  ]);
  return parseWhisperJson(JSON.parse(readFileSync(`${outBase}.json`, 'utf8')));
}

/** The commit whisper.cpp was built from, for provenance. */
export function whisperCommit(setup: WhisperSetup): string {
  const repo = join(dirname(setup.cli), '../../');
  const result = spawnSync('git', ['-C', repo, 'rev-parse', 'HEAD'], { encoding: 'utf8' });
  return result.status === 0 ? result.stdout.trim().slice(0, 12) : 'unknown';
}
