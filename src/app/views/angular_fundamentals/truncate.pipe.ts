import { Pipe, PipeTransform } from '@angular/core';

/**
 * TruncatePipe — a custom pure pipe demo for the Angular fundamentals screen.
 * Pipes are template-side value transformers: `{{ value | truncate:20:'…' }}`.
 *
 * Pure pipes only re-run when their input or args change (the default), so they
 * are cheap to use in lists. Impure pipes (`{ pure: false }`) run every change
 * detection cycle and should be avoided unless you understand the cost.
 *
 * Pipes are plain classes and can use DI like any service (declare a constructor
 * and `inject(...)` a dependency — e.g. `DatePipe` or a translation service).
 * This pipe needs no dependency, so it has no constructor.
 *
 * The source of this file is rendered verbatim in the page.
 */
@Pipe({
  name: 'truncate',
  // pure: true is the default — left as a comment so the lesson is explicit.
  standalone: true,
})
export class TruncatePipe implements PipeTransform {
  transform(value: string, limit = 30, ellipsis = '…'): string {
    if (!value) return '';
    if (value.length <= limit) return value;
    return `${value.slice(0, limit).trimEnd()}${ellipsis}`;
  }
}
