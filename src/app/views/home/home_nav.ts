import { LinkCardItem } from '../../../ui/components/link-card/link-card';

/**
 * HOME_NAV_ITEMS — the single source of truth for the home hub grid. Mirrors
 * the react `HOME_NAV_ITEMS` (with react-specific terms mapped to Angular:
 * react fundamentals -> angular fundamentals; the state-management sub-screens
 * become signals / ngrx / signal-store / rxjs-server-state).
 */
export const HOME_NAV_ITEMS: readonly LinkCardItem[] = [
  {
    title: 'Angular fundamentals',
    route: '/angular-fundamentals',
    description:
      'Components, templates, directives, pipes, signals, two-way binding, content projection.',
  },
  {
    title: 'TypeScript / JavaScript fundamentals',
    route: '/typescript-javascript-fundamentals',
    description: 'Variables, types, control flow, async, modules.',
  },
  {
    title: 'UI',
    route: '/ui',
    description:
      'Layout, styling (CSS / Bootstrap / Tailwind), interactions, responsive, design system.',
  },
  {
    title: 'Lifecycle',
    route: '/lifecycle',
    description: 'ngOnInit, ngDoCheck, After* hooks, ngOnDestroy, effects.',
  },
  {
    title: 'Navigation and routing',
    route: '/navigation-routing',
    description: 'Angular Router, lazy loading, guards, resolvers, child routes.',
  },
  {
    title: 'State management',
    route: '/state-management',
    description: 'Signals, NgRx Store, NgRx SignalStore, RxJS server state — with todos.',
  },
  {
    title: 'API handling',
    route: '/api-handling',
    description: 'The full clean-arch posts pipeline, end to end.',
  },
  {
    title: 'Database handling',
    route: '/database-handling',
    description: 'Local persistence with IndexedDB / Dexie + DAOs.',
  },
  {
    title: 'Exception handling',
    route: '/exception-handling',
    description: 'AppException -> Failure -> Result, severity-driven UI, chaining.',
  },
  {
    title: 'Dependency management',
    route: '/dependency-management',
    description: 'Angular native DI: InjectionToken + providers, fake/live wiring.',
  },
  {
    title: 'Architecture',
    route: '/architecture',
    description: 'Domain / Data / Core / UI layers and maintainability.',
  },
  {
    title: 'Testing',
    route: '/testing',
    description: 'Angular test runner + Testing Library for layers and components.',
  },
  {
    title: 'Debugging',
    route: '/debugging',
    description: 'Angular DevTools, source maps, RxJS tap, error pipeline logs.',
  },
  {
    title: 'Environments / Flavours',
    route: '/environments',
    description: 'dev / staging / prod via angular.json fileReplacements.',
  },
  {
    title: 'Best practices',
    route: '/best-practices',
    description: 'OnPush, signals, lazy loading, trackBy, standalone.',
  },
];
