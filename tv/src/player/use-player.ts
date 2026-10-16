import {useCallback, useEffect, useRef} from 'react';
import {VideoPlayer} from '@amazon-devices/react-native-w3cmedia';
import type {Playback} from '../shared/protocol';

/** What the player reports; the caller adds the contentId to make a Playback. */
export type PlayerReport = Omit<Playback, 'contentId'>;

const REPORT_EVERY_MS = 5000;

/**
 * Wraps the W3C Media VideoPlayer in URL mode (progressive MP4, no Shaka).
 * Render KeplerVideoSurfaceView with the returned surface handlers to show the video.
 */
export function usePlayer(
  onReport: (report: PlayerReport) => void,
  onError?: (message: string) => void,
) {
  const playerRef = useRef<VideoPlayer | null>(null);
  const surfaceRef = useRef<string | null>(null);
  const onReportRef = useRef(onReport);
  onReportRef.current = onReport;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  const report = useCallback(() => {
    const p = playerRef.current;
    if (!p) return;
    onReportRef.current({
      positionSec: Number.isFinite(p.currentTime) ? p.currentTime : 0,
      durationSec: Number.isFinite(p.duration) ? p.duration : 0,
      paused: p.paused,
      ended: p.ended,
    });
  }, []);

  // Amazon's URL-mode pattern attaches the surface before setting src, so load waits for it.
  const surfaceWaitersRef = useRef<((handle: string) => void)[]>([]);
  const waitForSurface = useCallback(
    () =>
      surfaceRef.current
        ? Promise.resolve(surfaceRef.current)
        : new Promise<string>((resolve) =>
            surfaceWaitersRef.current.push(resolve),
          ),
    [],
  );

  const load = useCallback(
    async (url: string, startSec = 0) => {
      let p = playerRef.current;
      if (!p) {
        p = new VideoPlayer();
        await p.initialize();
        playerRef.current = p;
        for (const type of ['play', 'pause', 'seeked', 'ended']) {
          p.addEventListener(type, report);
        }
        const player = p;
        p.addEventListener('error', () => {
          const err = player.error;
          onErrorRef.current?.(
            err
              ? `media error ${err.code}${
                  err.message ? `: ${err.message}` : ''
                }`
              : 'media error',
          );
        });
      }
      p.setSurfaceHandle(await waitForSurface());
      p.autoplay = false;
      if (startSec > 0) {
        const player = p;
        const seekOnce = () => {
          player.currentTime = startSec;
          player.removeEventListener('loadedmetadata', seekOnce);
        };
        p.addEventListener('loadedmetadata', seekOnce);
      }
      p.src = url;
    },
    [report, waitForSurface],
  );

  const play = useCallback(() => {
    playerRef.current?.play().catch(() => report());
  }, [report]);

  const pause = useCallback(() => playerRef.current?.pause(), []);

  const seekBy = useCallback((deltaSec: number) => {
    const p = playerRef.current;
    if (!p) return;
    const end = Number.isFinite(p.duration)
      ? p.duration
      : p.currentTime + Math.max(deltaSec, 0);
    p.currentTime = Math.min(Math.max(p.currentTime + deltaSec, 0), end);
  }, []);

  const onSurfaceViewCreated = useCallback((handle: string) => {
    surfaceRef.current = handle;
    playerRef.current?.setSurfaceHandle(handle);
    const waiters = surfaceWaitersRef.current;
    surfaceWaitersRef.current = [];
    waiters.forEach((resolve) => resolve(handle));
  }, []);

  const onSurfaceViewDestroyed = useCallback((handle: string) => {
    surfaceRef.current = null;
    playerRef.current?.clearSurfaceHandle(handle);
  }, []);

  // Report every 5 s while playing.
  useEffect(() => {
    const timer = setInterval(() => {
      const p = playerRef.current;
      if (p && !p.paused && !p.ended) report();
    }, REPORT_EVERY_MS);
    return () => clearInterval(timer);
  }, [report]);

  // Release the native player when the screen goes away.
  useEffect(
    () => () => {
      const p = playerRef.current;
      playerRef.current = null;
      p?.deinitialize().catch(() => undefined);
    },
    [],
  );

  return {
    load,
    play,
    pause,
    seekBy,
    onSurfaceViewCreated,
    onSurfaceViewDestroyed,
    playerRef,
  };
}
