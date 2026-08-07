import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Example — a visually distinct container for live, interactive demonstrations.
 * Mirrors the react `<Example/>`.
 *
 * Unlike CodeBlock (a static listing), Example uses a dashed border on the
 * surface-variant surface with a "↳ Live example" overline, signalling
 * "this is something you can look at and touch, not just read."
 */
@Component({
  selector: 'ui-example',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './example.html',
  styleUrl: './example.scss',
})
export class Example {
  /** Optional label; defaults to "Live example". */
  readonly label = input<string>('Live example');
}
