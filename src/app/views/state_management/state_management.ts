import { ChangeDetectionStrategy, Component } from '@angular/core';
import { HubView } from '../hub/hub_view';
import { STATE_MANAGEMENT_NAV_ITEMS } from './state_management_nav';

/** StateManagementView — the state-management section landing grid. */
@Component({
  selector: 'app-state-management',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [HubView],
  template: `
    <app-hub-view
      heading="State management"
      intro="Which state are you managing? Pick the lightest tool that fits."
      [items]="nav"
    />
  `,
})
export class StateManagementView {
  readonly nav = STATE_MANAGEMENT_NAV_ITEMS;
}
