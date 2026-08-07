import { LinkCardItem } from '../../../ui/components/link-card/link-card';

/**
 * STATE_MANAGEMENT_NAV_ITEMS — sub-screens of the state-management hub.
 *
 * React -> Angular mapping applied:
 *   hooks           -> signals
 *   redux           -> ngrx
 *   zustand         -> signal-store
 *   tanstack_query  -> rxjs-server-state
 */
export const STATE_MANAGEMENT_NAV_ITEMS: readonly LinkCardItem[] = [
  {
    title: 'Signals',
    route: '/state-management/signals',
    description:
      'signal / computed / effect — built-in local and component state, no library.',
  },
  {
    title: 'NgRx Store',
    route: '/state-management/ngrx',
    description:
      'A single global store for large, predictable apps — actions, reducers, selectors.',
  },
  {
    title: 'NgRx SignalStore',
    route: '/state-management/signal-store',
    description:
      'A lightweight signal-based store — the sweet spot for most apps that need shared state.',
  },
  {
    title: 'RxJS / server state',
    route: '/state-management/rxjs-server-state',
    description:
      'HttpClient + interceptors / caching. Server state, not a UI-state replacement.',
  },
];
