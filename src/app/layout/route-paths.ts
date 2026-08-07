/**
 * RoutePaths — the single source of truth for route URLs. Mirrors the react
 * guide's `RoutePaths`. Collected here so screens, hubs, and the shell reference
 * the same constants instead of string literals. A const-object + literal union
 * (no enum) per project convention.
 */
export const RoutePaths = {
  home: '/',
  about: '/about',
  angularFundamentals: '/angular-fundamentals',
  tsJsFundamentals: '/typescript-javascript-fundamentals',
  ui: '/ui',
  layoutStructure: '/ui/layout',
  css: '/ui/styling/css',
  bootstrap: '/ui/styling/bootstrap',
  tailwind: '/ui/styling/tailwind',
  interactive: '/ui/interactive',
  responsive: '/ui/responsive',
  designSystem: '/ui/design-system',
  lifecycle: '/lifecycle',
  navigation: '/navigation-routing',
  stateManagement: '/state-management',
  signals: '/state-management/signals',
  ngrx: '/state-management/ngrx',
  signalStore: '/state-management/signal-store',
  rxjsServerState: '/state-management/rxjs-server-state',
  apiHandling: '/api-handling',
  databaseHandling: '/database-handling',
  exceptionHandling: '/exception-handling',
  dependencyManagement: '/dependency-management',
  architecture: '/architecture',
  testing: '/testing',
  debugging: '/debugging',
  environments: '/environments',
  bestPractices: '/best-practices',
} as const;

export type RoutePath = (typeof RoutePaths)[keyof typeof RoutePaths];
