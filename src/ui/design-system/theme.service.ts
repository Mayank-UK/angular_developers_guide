import { DOCUMENT } from '@angular/common';
import {
  effect,
  inject,
  Injectable,
  signal,
  WritableSignal,
} from '@angular/core';

/**
 * ThemeMode — the two visual modes the token system supports. Kept as a literal
 * union (no enum) per project convention.
 */
export type ThemeMode = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'adg-theme';

/**
 * Initial mode resolution, extracted so it can be reused / tested without the
 * service. Mirrors the react `getInitialMode`.
 */
export function resolveInitialThemeMode(
  windowRef: Pick<Window, 'localStorage' | 'matchMedia'> = window,
): ThemeMode {
  const stored = windowRef.localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === 'light' || stored === 'dark') return stored;
  return windowRef.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

/**
 * ThemeService — owns light/dark mode for the Angular shell. Mirrors the react
 * `<ThemeProvider/>`: the active mode is exposed as a signal and written to
 * `document.documentElement.dataset.theme`, which `tokens.css` keys off of.
 *
 * The initial value is read once at construction (localStorage, then
 * prefers-color-scheme). An `effect` keeps the DOM attribute + localStorage in
 * sync whenever the signal changes.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);

  readonly mode: WritableSignal<ThemeMode> = signal<ThemeMode>(
    resolveInitialThemeMode(),
  );

  constructor() {
    effect(() => {
      const mode = this.mode();
      const root = this.document.documentElement;
      root.setAttribute('data-theme', mode);
      try {
        this.document.defaultView?.localStorage.setItem(
          THEME_STORAGE_KEY,
          mode,
        );
      } catch {
        /* localStorage may be unavailable (private mode); ignore. */
      }
    });
  }

  /** Switch to an explicit mode. */
  setMode(mode: ThemeMode): void {
    this.mode.set(mode);
  }

  /** Flip between light and dark. */
  toggle(): void {
    this.mode.update((m) => (m === 'dark' ? 'light' : 'dark'));
  }
}
