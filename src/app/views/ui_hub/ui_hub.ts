import { ChangeDetectionStrategy, Component } from '@angular/core';
import { HubView } from '../hub/hub_view';
import { UI_HUB_NAV_ITEMS } from './ui_hub_nav';

/** UiHubView — the UI section landing grid. */
@Component({
  selector: 'app-ui-hub',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [HubView],
  template: `
    <app-hub-view
      heading="UI"
      intro="Layout, styling, interaction, responsiveness, and the design system."
      [items]="nav"
    />
  `,
})
export class UiHubView {
  readonly nav = UI_HUB_NAV_ITEMS;
}
