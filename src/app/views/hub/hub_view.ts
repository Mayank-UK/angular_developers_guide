import {
  ChangeDetectionStrategy,
  Component,
  input,
} from '@angular/core';
import { LinkCard, LinkCardItem } from '../../../ui/components/link-card/link-card';

/**
 * HubView — a reusable grid of LinkCards used by the home, UI, and
 * state-management hubs. Pass a heading, an intro line, and the nav items.
 *
 * This is a view-level composition (not a generic design-system primitive), so
 * it lives under `app/views` rather than `src/ui/components`.
 */
@Component({
  selector: 'app-hub-view',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LinkCard],
  templateUrl: './hub_view.html',
  styleUrl: './hub_view.scss',
})
export class HubView {
  readonly heading = input.required<string>();
  readonly intro = input<string>('');
  readonly items = input.required<readonly LinkCardItem[]>();
}
