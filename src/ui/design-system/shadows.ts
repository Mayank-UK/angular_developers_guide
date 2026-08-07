/**
 * Elevation tokens — TS mirror of the `--shadow-*` tokens in tokens.css
 * (mirrors the Flutter guide's `DSShadows`). Values are CSS `box-shadow` strings
 * that already reference the runtime CSS variables, so they respect dark mode.
 */
const v = (token: string) => `var(${token})`;

export const DSShadows = {
  buttonCard: v('--shadow-button-card'),
  buttonCardHover: v('--shadow-button-card-hover'),
  drawer: v('--shadow-drawer'),
  modal: v('--shadow-modal'),
} as const;

export type DSShadow = keyof typeof DSShadows;
