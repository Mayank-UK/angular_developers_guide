import {
  ChangeDetectionStrategy,
  Component,
  input,
  linkedSignal,
  signal,
} from '@angular/core';

/**
 * CodeBlock — a styled, monospace, copyable code listing that collapses by
 * default. Mirrors the react `<CodeBlock/>`.
 *
 * Collapsible (collapsed by default) so pages full of examples don't become a
 * wall of code: the language label + toggle stays visible, the source is one
 * click away. The copy button works whether open or closed.
 */
@Component({
  selector: 'ui-code-block',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './code-block.html',
  styleUrl: './code-block.scss',
})
export class CodeBlock {
  /** The source text to display. */
  readonly code = input.required<string>();
  /** Optional language label (defaults to "code"). */
  readonly language = input<string>('code');
  /** Optional caption rendered under the code. */
  readonly caption = input<string>('');
  /** Start expanded instead of collapsed. */
  readonly defaultOpen = input<boolean>(false);

  /**
   * Expansion state. Seeded from `defaultOpen` via `linkedSignal` so the
   * initial open/closed state tracks that input, then the user owns the
   * toggle (each `set`/`update` writes here without re-running the link).
   */
  readonly open = linkedSignal(() => this.defaultOpen());
  readonly copied = signal(false);

  private resetTimer: ReturnType<typeof setTimeout> | undefined;

  /** Toggle the expanded state. */
  toggleOpen(): void {
    this.open.update((o) => !o);
  }

  /** Copy the code to the clipboard and flash a "copied" indicator. */
  async copy(event: Event): Promise<void> {
    event.stopPropagation();
    try {
      await navigator.clipboard.writeText(this.code());
      this.copied.set(true);
      if (this.resetTimer) clearTimeout(this.resetTimer);
      this.resetTimer = setTimeout(() => this.copied.set(false), 1500);
    } catch {
      /* clipboard may be unavailable; ignore */
    }
  }
}
