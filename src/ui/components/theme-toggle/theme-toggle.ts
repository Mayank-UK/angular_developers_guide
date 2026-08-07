import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ThemeService } from '../../design-system/theme.service';

/**
 * ThemeToggle — switches between light and dark design-system themes.
 *
 * Angular port of the react `<ThemeToggle/>`. Reads the active mode from
 * `ThemeService` and toggles it on click.
 */
@Component({
  selector: 'ui-theme-toggle',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './theme-toggle.html',
  styleUrl: './theme-toggle.scss',
})
export class ThemeToggle {
  private readonly theme = inject(ThemeService);

  /** Active mode (reactive). */
  readonly mode = this.theme.mode;

  toggle(): void {
    this.theme.toggle();
  }
}
