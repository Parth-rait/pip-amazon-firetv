// npm run lab:film: renders "The Lantern Fox", our original 96-second test film, with ffmpeg.
// Each scene is a colour card with captions that appear at known times, so the video pipeline can
// be checked against ground truth (scene cuts and reveal times) that we wrote ourselves.
// Output: media/lantern-fox.mp4 (gitignored) and pipeline/truth/lantern-fox.truth.json.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'media', 'lantern-fox.mp4');
const TRUTH = join(ROOT, 'pipeline', 'truth', 'lantern-fox.truth.json');
const SIZE = '1280x720';
const FPS = 24;
const TITLE_Y = 220;
const CAPTION_Y = 40;
const CAPTION_STEP = 56;

interface Caption {
  atSec: number; // when it appears, in film time
  text: string;
  big?: boolean;
}

interface Scene {
  startSec: number;
  endSec: number;
  color: string;
  captions: Caption[];
  // A plain box (drawbox's own "t" means thickness, not time, so boxes do not move).
  box?: { color: string; x: string; y: number; w: number; h: number; fromSec?: number };
}

// The script. Caption times match the reveal times in src/core/context/fixture.ts.
const SCENES: Scene[] = [
  {
    startSec: 0,
    endSec: 10,
    color: '0x0d1b2a',
    captions: [
      { atSec: 0, text: 'The Lantern Fox', big: true },
      { atSec: 2, text: 'Night in a snowy forest under a full moon' },
    ],
    box: { color: 'white', x: '1050', y: 90, w: 90, h: 90 },
  },
  {
    startSec: 10,
    endSec: 22,
    color: '0x1b263b',
    captions: [
      { atSec: 12, text: 'A small orange fox called Ember' },
      { atSec: 13, text: 'walks through the snowy forest' },
    ],
    box: { color: '0xff8c1a', x: '420', y: 470, w: 160, h: 90 },
  },
  {
    startSec: 22,
    endSec: 34,
    color: '0x22333b',
    captions: [
      { atSec: 24, text: 'Ember finds an old brass lantern' },
      { atSec: 25, text: 'half buried in the snow' },
    ],
    box: { color: '0xd4a017', x: '580', y: 500, w: 80, h: 110 },
  },
  {
    startSec: 34,
    endSec: 46,
    color: '0x2d3a2e',
    captions: [
      { atSec: 36, text: 'Hoot the owl watches from a pine tree' },
      { atSec: 39, text: 'Hoot says the lantern belongs to someone' },
    ],
    box: { color: '0x8d6e63', x: '980', y: 200, w: 90, h: 120 },
  },
  {
    startSec: 46,
    endSec: 60,
    color: '0x14213d',
    captions: [
      { atSec: 47, text: 'Ember carries the lantern to a frozen lake' },
      { atSec: 52, text: 'The lantern starts to glow blue by itself' },
    ],
    box: { color: '0x4fc3f7', x: '600', y: 480, w: 100, h: 130, fromSec: 52 },
  },
  {
    startSec: 60,
    endSec: 72,
    color: '0x0b132b',
    captions: [
      { atSec: 61, text: 'Across the lake stands a dark lighthouse' },
      { atSec: 63, text: 'Its light is out' },
    ],
    box: { color: '0x5c677d', x: '1000', y: 160, w: 90, h: 400 },
  },
  {
    startSec: 72,
    endSec: 84,
    color: '0x1c2541',
    captions: [
      { atSec: 73, text: 'Ember climbs the lighthouse' },
      { atSec: 76, text: 'and sets the lantern at the top' },
      { atSec: 79, text: 'The lighthouse shines again' },
    ],
    box: { color: '0xfff59d', x: '1000', y: 160, w: 90, h: 400, fromSec: 79 },
  },
  {
    startSec: 84,
    endSec: 96,
    color: '0x3a506b',
    captions: [
      { atSec: 85, text: 'An old badger called Moss thanks Ember' },
      { atSec: 88, text: 'The lantern was his. He is the lighthouse keeper' },
      { atSec: 92, text: 'Ember becomes his helper' },
      { atSec: 94, text: 'They light the lamp together every night' },
    ],
  },
];

const FONT_CANDIDATES = [
  process.env.LAB_FONT,
  '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
  '/System/Library/Fonts/Supplemental/Arial.ttf',
  '/Library/Fonts/Arial.ttf',
  'C:/Windows/Fonts/arial.ttf',
].filter((f): f is string => Boolean(f));

function findFont(): string {
  const font = FONT_CANDIDATES.find((f) => existsSync(f));
  if (!font) throw new Error('No font found for drawtext; set LAB_FONT to a .ttf file');
  return font.replace(/:/g, '\\:');
}

/** One scene as a filter chain; times inside a scene start at 0, so captions are shifted. */
function sceneFilter(scene: Scene, index: number, font: string): string {
  const parts: string[] = [];
  if (scene.box) {
    const b = scene.box;
    const enable = b.fromSec !== undefined ? `:enable='gte(t,${b.fromSec - scene.startSec})'` : '';
    parts.push(`drawbox=x=${b.x}:y=${b.y}:w=${b.w}:h=${b.h}:color=${b.color}:t=fill${enable}`);
  }
  const lines = scene.captions.filter((c) => !c.big);
  for (const c of scene.captions) {
    const y = c.big ? TITLE_Y : CAPTION_Y + lines.indexOf(c) * CAPTION_STEP;
    const at = c.atSec - scene.startSec;
    parts.push(
      `drawtext=fontfile='${font}':text='${c.text}':fontcolor=white:fontsize=${c.big ? 72 : 40}:x=(w-text_w)/2:y=${y}:enable='gte(t,${at})'`,
    );
  }
  return `[${index}:v]${parts.length ? parts.join(',') : 'null'}[v${index}]`;
}

function render(): void {
  const font = findFont();
  const inputs = SCENES.flatMap((s) => [
    '-f',
    'lavfi',
    '-i',
    `color=c=${s.color}:s=${SIZE}:d=${s.endSec - s.startSec}:r=${FPS}`,
  ]);
  const total = SCENES[SCENES.length - 1]?.endSec ?? 0;
  const filters = SCENES.map((s, i) => sceneFilter(s, i, font));
  const concat = `${SCENES.map((_, i) => `[v${i}]`).join('')}concat=n=${SCENES.length}:v=1:a=0[v]`;
  mkdirSync(dirname(OUT), { recursive: true });
  const args = [
    '-hide_banner',
    '-loglevel',
    'error',
    '-y',
    ...inputs,
    '-f',
    'lavfi',
    '-i',
    `anullsrc=r=48000:cl=stereo:d=${total}`,
    '-filter_complex',
    [...filters, concat].join(';'),
    '-map',
    '[v]',
    '-map',
    `${SCENES.length}:a`,
    '-c:v',
    'libx264',
    '-preset',
    'veryfast',
    '-crf',
    '23',
    '-pix_fmt',
    'yuv420p',
    '-g',
    String(FPS * 2),
    '-c:a',
    'aac',
    '-b:a',
    '64k',
    '-shortest',
    '-movflags',
    '+faststart',
    OUT,
  ];
  const result = spawnSync('ffmpeg', args, { stdio: 'inherit' });
  if (result.status !== 0) throw new Error(`ffmpeg failed with status ${result.status}`);
}

function writeTruth(): void {
  mkdirSync(dirname(TRUTH), { recursive: true });
  const truth = {
    schemaVersion: 1,
    assetId: 'lantern-fox',
    durationSec: SCENES[SCENES.length - 1]?.endSec ?? 0,
    note: 'Ground truth by construction: scripts/make-lab-film.ts renders exactly these scenes and captions.',
    sceneCutsSec: SCENES.slice(1).map((s) => s.startSec),
    captions: SCENES.flatMap((s) => s.captions.map((c) => ({ atSec: c.atSec, text: c.text }))),
  };
  writeFileSync(TRUTH, `${JSON.stringify(truth, null, 2)}\n`);
}

render();
writeTruth();
console.log(`wrote ${OUT}\nwrote ${TRUTH}`);
