import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';

/**
 * Severity of a failure, mirrored from the (data/domain-owned) Failure model.
 * Duplicated here as a literal union so this presentation component stays
 * decoupled from the data layer; the wiring screen passes plain fields in.
 */
export type FailureSeverity = 'info' | 'warning' | 'critical';

/**
 * A coarse classification of *why* a failure happened — purely cosmetic, used
 * only to pick the glyph. Kept local so the UI owns no dependency on the
 * error-handling module.
 */
export const FAILURE_KIND = {
  network: 'network',
  server: 'server',
  cache: 'cache',
  auth: 'auth',
  database: 'database',
  unknown: 'unknown',
} as const;
export type FailureKind = (typeof FAILURE_KIND)[keyof typeof FAILURE_KIND];

const FAILURE_KIND_ICONS: Record<FailureKind, string> = {
  network: '📶',
  server: '☁︎',
  cache: '🗄',
  auth: '🔒',
  database: '🛢',
  unknown: '⚠︎',
};

/**
 * ShowError — full-screen blocking error for *critical* failures, with an
 * optional Retry. Mirrors the react `<ShowError/>`.
 *
 * Decoupled from `core/`/`domain/`: it accepts plain inputs ({severity,
 * message, kind}) instead of importing a Failure type. The host view is
 * responsible for translating its domain model into these fields.
 */
@Component({
  selector: 'ui-show-error',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './show-error.html',
  styleUrl: './show-error.scss',
})
export class ShowError {
  /** User-facing message. */
  readonly message = input.required<string>();
  /** Severity — currently all variants render the same blocking layout; the
   *  field is kept for future severity-driven styling. */
  readonly severity = input<FailureSeverity>('critical');
  /** Coarse failure kind — picks the glyph. Defaults to "unknown". */
  readonly kind = input<FailureKind>('unknown');

  /** Emitted when the user clicks Retry. Host decides what to do. */
  readonly retry = output<void>();

  /** Glyph for the current kind — derived from the `kind` input via computed. */
  readonly icon = computed(() => FAILURE_KIND_ICONS[this.kind()]);
}
