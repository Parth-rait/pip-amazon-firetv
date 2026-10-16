import { describe, expect, it } from 'vitest';
import { lanternFoxTimeline } from '../core/context/fixture.js';
import { checkTimelineFile } from '../film/timeline-file.js';
import { frameId, type CandidatesFile } from './artifacts.js';
import { buildDataset } from './dataset.js';
import {
  boundaryScore,
  cutsAt,
  fixedScenes,
  parseProbe,
  parseSceneLog,
  parseShowinfoTime,
  samplePlan,
  scenesFromCuts,
  sweepThresholds,
} from './media-math.js';
import { buildTimelineFile, pendingReview } from './review.js';

describe('ffmpeg output parsing', () => {
  it('reads the probe JSON', () => {
    const probe = parseProbe({
      format: { duration: '96.000000', start_time: '0.000000' },
      streams: [
        {
          codec_type: 'video',
          codec_name: 'h264',
          width: 1280,
          height: 720,
          avg_frame_rate: '24/1',
        },
        { codec_type: 'audio', codec_name: 'aac', channels: 2, tags: { language: 'und' } },
      ],
    });
    expect(probe).toMatchObject({
      durationSec: 96,
      video: { fps: 24, width: 1280 },
      audio: [{ codec: 'aac', language: 'und' }],
    });
    expect(() => parseProbe({ streams: [] })).toThrow(/video/);
  });

  it('reads scdet change events with scores, and showinfo frame times', () => {
    const log =
      '[scdet @ 0x1] lavfi.scd.score: 50.4, lavfi.scd.time: 10\n[scdet] lavfi.scd.score: 2.9, lavfi.scd.time: 22.04\nlavfi.scd.score: 1, lavfi.scd.time: 10';
    expect(parseSceneLog(log)).toEqual([
      { timeSec: 10, score: 50.4 },
      { timeSec: 22.04, score: 2.9 },
    ]);
    expect(parseShowinfoTime('[Parsed_showinfo_0] n:0 pts:82 pts_time:3.41667 duration')).toBe(
      3.41667,
    );
    expect(parseShowinfoTime('nothing')).toBeNull();
  });
});

describe('scenes and sampling', () => {
  it('turns cuts into scenes and merges ones that are too short', () => {
    expect(scenesFromCuts([10, 10.5, 22], 30, 2).map((s) => [s.startSec, s.endSec])).toEqual([
      [0, 10],
      [10, 22],
      [22, 30],
    ]);
    expect(scenesFromCuts([29.5], 30, 2).map((s) => s.endSec)).toEqual([30]);
  });

  it('builds the fixed-interval baseline', () => {
    expect(fixedScenes(20, 6).map((s) => s.startSec)).toEqual([0, 6, 12, 18]);
  });

  it('picks cuts by threshold and sweeps thresholds against truth', () => {
    const events = [
      { timeSec: 2, score: 0.6 },
      { timeSec: 10, score: 5.9 },
      { timeSec: 34, score: 3.1 },
      { timeSec: 79, score: 2.9 },
    ];
    expect(cutsAt(events, 3)).toEqual([10, 34]);
    const sweep = sweepThresholds(events, [10, 34], [1, 3, 10], 0.5);
    expect(sweep.map((r) => [r.threshold, r.f1])).toEqual([
      [1, 0.8], // 3 predicted, 2 hits: precision 2/3, recall 1
      [3, 1],
      [10, 0],
    ]);
  });

  it('scores boundaries with a tolerance, matching each true cut once', () => {
    expect(boundaryScore([10.2, 22, 40], [10, 22, 34], 0.5)).toEqual({
      precision: 2 / 3,
      recall: 2 / 3,
      f1: 2 / 3,
    });
    expect(boundaryScore([10, 10.1], [10], 0.5).precision).toBe(0.5);
  });

  it('samples after each scene start and then regularly, with stable ids', () => {
    const plan = samplePlan(scenesFromCuts([10], 16, 1), {
      everySec: 4,
      sceneOffsetSec: 0.5,
      minGapSec: 1,
    });
    expect(plan.map((p) => p.requestedSec)).toEqual([0.5, 4.5, 8.5, 10.5, 14.5]);
    expect(plan[3]).toEqual({ id: frameId(10.5), requestedSec: 10.5, sceneId: 'sc-002' });
    expect(frameId(53.04)).toBe('fr-00530');
  });

  it('adds frames at smaller change events, replacing a regular frame that is too close', () => {
    const plan = samplePlan(scenesFromCuts([], 10, 1), {
      everySec: 4,
      sceneOffsetSec: 0.5,
      minGapSec: 1,
      eventsSec: [4.3],
    });
    expect(plan.map((p) => p.requestedSec)).toEqual([0.5, 4.8, 8.5]);
  });
});

describe('review and export', () => {
  const candidates: CandidatesFile = {
    schemaVersion: 1,
    assetId: 'clip',
    generator: 'test',
    createdAt: '2026-10-16',
    method: 'unit test',
    entities: [{ id: 'fox', name: 'Fox', aliases: [], firstSeenSec: 2, intro: 'That is Fox.' }],
    facts: [
      {
        id: 'a1',
        startSec: 1,
        revealSec: 3,
        kind: 'appearance',
        text: 'Fox appears.',
        entities: ['fox'],
        spoilerTerms: [],
        evidence: ['fr-00025'],
        confidence: 0.8,
      },
      {
        id: 'a2',
        startSec: 6,
        revealSec: 8,
        kind: 'event',
        text: 'Fox jumps.',
        entities: ['fox'],
        spoilerTerms: ['jumps'],
        evidence: ['fr-00075'],
        confidence: 0.6,
      },
    ],
  };
  const base = {
    asset: { assetId: 'clip', sha256: 'a'.repeat(64), license: 'MIT', rights: 'ours' },
    contentId: 'clip',
    durationSec: 10,
    scenes: [{ id: 'sc-001', startSec: 0, endSec: 10 }],
    frames: [
      {
        id: 'fr-00025',
        requestedSec: 2.5,
        atSec: 2.5,
        sceneId: 'sc-001',
        path: 'frames/fr-00025.jpg',
      },
      {
        id: 'fr-00075',
        requestedSec: 7.5,
        atSec: 7.5,
        sceneId: 'sc-001',
        path: 'frames/fr-00075.jpg',
      },
    ],
    candidates,
  };

  it('exports unreviewed candidates as candidates, without a reviewer', () => {
    const file = buildTimelineFile({ ...base, review: null });
    expect(checkTimelineFile(file).ok).toBe(true);
    expect(file.facts.map((f) => f.review.status)).toEqual(['candidate', 'candidate']);
    expect(pendingReview(candidates, null)).toEqual(['entity:fox', 'a1', 'a2']);
  });

  it('applies decisions and corrections with the reviewer recorded', () => {
    const file = buildTimelineFile({
      ...base,
      review: {
        schemaVersion: 1,
        assetId: 'clip',
        reviewer: 'Parth',
        reviewedAt: '2026-10-17',
        decisions: {
          'entity:fox': { status: 'accepted' },
          a1: { status: 'accepted' },
          a2: { status: 'rejected', note: 'it hops' },
        },
        edits: { a1: { text: 'A fox appears in the snow.' } },
      },
    });
    expect(checkTimelineFile(file).ok).toBe(true);
    expect(file.facts[0]).toMatchObject({
      text: 'A fox appears in the snow.',
      review: { status: 'accepted', by: 'Parth' },
    });
    expect(file.facts[1]?.review).toMatchObject({ status: 'rejected', note: 'it hops' });
  });
});

describe('buildDataset', () => {
  const examples = buildDataset(lanternFoxTimeline());

  it('derives every task, all held out, with provenance', () => {
    const tasks = new Set(examples.map((e) => e.task));
    expect([...tasks].sort()).toEqual([
      'identify',
      'recap',
      'routing',
      'spoiler-probe',
      'unknown-fact',
      'unseen-entity',
    ]);
    expect(
      examples.every((e) => e.split === 'test' && e.provenance.timelineVersion === 'fixture-1'),
    ).toBe(true);
    expect(new Set(examples.map((e) => e.id)).size).toBe(examples.length);
  });

  it('only allows facts revealed by the question time, and protects the later ones', () => {
    for (const e of examples.filter((x) => x.task === 'spoiler-probe')) {
      expect(e.expect.mustNotMention?.length).toBeGreaterThan(0);
      expect(e.allowedFacts).not.toContain(e.provenance.derivedFrom[0]);
    }
  });

  it('never uses facts that were not accepted', () => {
    expect(
      examples.some(
        (e) => e.provenance.derivedFrom.includes('d1') || e.provenance.derivedFrom.includes('x1'),
      ),
    ).toBe(false);
  });
});
