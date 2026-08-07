import { ChangeDetectionStrategy, Component } from '@angular/core';
import { HubView } from '../hub/hub_view';
import { HOME_NAV_ITEMS } from './home_nav';

/**
 * HomeView — the landing hub. Renders the top-level navigation grid.
 */
@Component({
  selector: 'app-home',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [HubView],
  template: `
    <app-hub-view
      heading="Angular developer's guide"
      intro="A tour of the Angular ecosystem, screen by screen — fundamentals, UI, lifecycle, routing, state, data, error handling, architecture, testing, and more."
      [items]="nav"
    />
  `,
})
export class HomeView {
  readonly nav = HOME_NAV_ITEMS;
}
