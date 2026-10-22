// Thin wrappers around ffprobe and ffmpeg. Arguments are arrays (no shell), so file names and
// options can never be read as commands.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { parseProbe, parseSceneLog, parseShowinfoTime, type ChangeEvent } from './media-math.js';
import type { Probe } from './artifacts.js';

function run(tool: 'ffmpeg' | 'ffprobe', args: string[]): { stdout: string; stderr: string } {
  const result = spawnSync(tool, args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (result.error) throw new Error(`${tool} could not start: ${result.error.message}`);
  if (result.status !== 0)
    throw new Error(`${tool} failed (${result.status}): ${result.stderr.slice(-400)}`);
  return { stdout: result.stdout, stderr: result.stderr };
}

export function hasMediaTools(): boolean {
  return ['ffmpeg', 'ffprobe'].every(
    (tool) => spawnSync(tool, ['-version'], { encoding: 'utf8' }).status === 0,
  );
}

/** True when this ffmpeg build has the filter (Homebrew's default build has no `drawtext`). */
export function hasFilter(name: string): boolean {
  const result = spawnSync('ffmpeg', ['-hide_banner', '-filters'], { encoding: 'utf8' });
  return result.status === 0 && new RegExp(`^\\s*\\S+\\s+${name}\\s`, 'm').test(result.stdout);
}

export async function sha256File(path: string): Promise<string> {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(path)) hash.update(chunk as Buffer);
  return hash.digest('hex');
}

export function probeFile(file: string): Probe {
  const { stdout } = run('ffprobe', [
    '-v',
    'error',
    '-print_format',
    'json',
    '-show_format',
    '-show_streams',
    file,
  ]);
  return parseProbe(JSON.parse(stdout));
}

/** Every change ffmpeg's scdet filter scores at or above `floor` (0 to 100), in one pass. */
export function detectChanges(file: string, floor: number): ChangeEvent[] {
  const { stderr } = run('ffmpeg', [
    '-hide_banner',
    '-nostats',
    '-i',
    file,
    '-an',
    '-vf',
    `scdet=threshold=${floor}:sc_pass=1`,
    '-f',
    'null',
    '-',
  ]);
  return parseSceneLog(stderr);
}

/**
 * Extracts the first frame at or after `sec`, keeping source timestamps (-copyts) so the frame's
 * real time can be read back. Writes the evidence image and a labelled thumbnail for the sheets.
 */
export function extractFrame(
  file: string,
  sec: number,
  out: { image: string; thumb: string; label: string; font: string | null },
): number {
  const label = out.font
    ? `,drawtext=fontfile='${out.font.replace(/:/g, '\\:')}':text='${out.label}':fontcolor=white:fontsize=20:box=1:boxcolor=black@0.6:x=8:y=h-th-8`
    : '';
  const { stderr } = run('ffmpeg', [
    '-hide_banner',
    '-y',
    '-copyts',
    '-ss',
    String(sec),
    '-i',
    file,
    '-filter_complex',
    `[0:v]showinfo,split=2[a][b];[a]scale=640:-2[img];[b]scale=320:-2${label}[th]`,
    // -frames:v is an output option: each of the two outputs needs its own.
    '-map',
    '[img]',
    '-frames:v',
    '1',
    '-update',
    '1',
    '-q:v',
    '3',
    out.image,
    '-map',
    '[th]',
    '-frames:v',
    '1',
    '-update',
    '1',
    '-q:v',
    '4',
    out.thumb,
  ]);
  const at = parseShowinfoTime(stderr);
  if (at === null) throw new Error(`could not read the frame time at ${sec}s`);
  return at;
}

/** Tiles labelled thumbnails (listed in `listFile`, ffconcat format) into contact sheets. */
export function tileSheets(listFile: string, cols: number, rows: number, outPattern: string): void {
  run('ffmpeg', [
    '-hide_banner',
    '-y',
    '-f',
    'concat',
    '-safe',
    '0',
    '-i',
    listFile,
    '-vf',
    `tile=${cols}x${rows}:padding=4:color=black`,
    '-fps_mode',
    'passthrough',
    outPattern,
  ]);
}
