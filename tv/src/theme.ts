// Design tokens (PROJECT.md section 3.2). The pad has the same values in pad/src/styles/tokens.css.
export const color = {
  bg: '#0B0B0F',
  surface: '#15151C',
  surface2: '#1E1E27',
  text: '#F4F4F6',
  textMuted: '#9B9BA8',
  accent: '#7CE7C4',
  danger: '#FF6B6B',
} as const;

/**
 * PROJECT.md gives TV sizes in pixels at 1080p. React Native 0.83 on Vega lays out on a
 * 960 x 540 dp canvas (scale factor 2 at 1080p), so every size goes through dp().
 */
export const dp = (px1080: number) => px1080 / 2;

export const radius = dp(20);

/** The spacing scale; use nothing else. */
export const space = {
  xs: dp(4),
  s: dp(8),
  m: dp(12),
  l: dp(16),
  xl: dp(24),
  xxl: dp(32),
  xxxl: dp(48),
} as const;

/** TV type scale (PROJECT.md 3.2, given at 1080p). */
export const type = {
  caption: dp(24),
  body: dp(36),
  title: dp(48),
  display: dp(72),
} as const;

/** TV text sits inside a 5% safe margin of the 1920 x 1080 screen. */
export const safe = {horizontal: dp(96), vertical: dp(54)} as const;

export const motionFastMs = 180;
export const motionPipMs = 2400;
