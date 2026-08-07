/**
 * Spacing scale — TS mirror of the `--space-*` tokens in tokens.css
 * (mirrors the Flutter guide's `DSSizes`). Use these when a JS value is needed
 * (e.g. dynamic gaps); otherwise prefer the CSS custom properties directly.
 */
export const DSSizes = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 16,
  lg: 32,
  xl: 64,
  xxl: 128,
} as const;

export type DSSize = keyof typeof DSSizes;
