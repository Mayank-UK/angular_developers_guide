import { Routes } from '@angular/router';

/**
 * Route table — mirrors the react guide's hub -> sub-screen hierarchy, mapped
 * to Angular `Routes` with lazy `loadComponent` for every screen (the initial
 * bundle ships only the shell + the landing view).
 *
 * React -> Angular path/title mapping applied:
 *   /react-fundamentals              -> /angular-fundamentals
 *   /state-management/hooks          -> /state-management/signals
 *   /state-management/redux          -> /state-management/ngrx
 *   /state-management/zustand        -> /state-management/signal-store
 *   /state-management/tanstack-query -> /state-management/rxjs-server-state
 *
 * Each route carries a `title` (consumed by the router's TitleStrategy) so the
 * header label and document title stay in sync.
 */
export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./views/home/home').then((m) => m.HomeView),
    title: "Angular developer's guide",
  },
  {
    path: 'about',
    loadComponent: () =>
      import('./views/about/aboutview').then((m) => m.AboutView),
    title: 'About',
  },

  // Fundamentals
  {
    path: 'angular-fundamentals',
    loadComponent: () =>
      import('./views/angular_fundamentals/angular_fundamentalsview').then(
        (m) => m.AngularFundamentalsView,
      ),
    title: 'Angular fundamentals',
  },
  {
    path: 'typescript-javascript-fundamentals',
    loadComponent: () =>
      import('./views/ts_js_fundamentals/tsjsfundamentalsview').then(
        (m) => m.TsJsFundamentalsView,
      ),
    title: 'TypeScript / JavaScript fundamentals',
  },

  // UI hub + sub-screens
  {
    path: 'ui',
    loadComponent: () =>
      import('./views/ui_hub/ui_hub').then((m) => m.UiHubView),
    title: 'UI',
  },
  {
    path: 'ui/layout',
    loadComponent: () =>
      import('./views/ui/layout_structure/layoutstructureview').then(
        (m) => m.LayoutStructureView,
      ),
    title: 'Layout and structure',
  },
  {
    path: 'ui/styling/css',
    loadComponent: () =>
      import('./views/ui/css/cssview').then((m) => m.CssView),
    title: 'CSS',
  },
  {
    path: 'ui/styling/bootstrap',
    loadComponent: () =>
      import('./views/ui/bootstrap/bootstrapview').then((m) => m.BootstrapView),
    title: 'Bootstrap',
  },
  {
    path: 'ui/styling/tailwind',
    loadComponent: () =>
      import('./views/ui/tailwind/tailwindview').then((m) => m.TailwindView),
    title: 'Tailwind',
  },
  {
    path: 'ui/interactive',
    loadComponent: () =>
      import('./views/ui/interactive/interactiveview').then(
        (m) => m.InteractiveView,
      ),
    title: 'Interactive behaviours',
  },
  {
    path: 'ui/responsive',
    loadComponent: () =>
      import('./views/ui/responsive/responsiveview').then(
        (m) => m.ResponsiveView,
      ),
    title: 'Responsive layout',
  },
  {
    path: 'ui/design-system',
    loadComponent: () =>
      import('./views/ui/design_system/designsystemview').then(
        (m) => m.DesignSystemView,
      ),
    title: 'Design system',
  },

  // Lifecycle + navigation
  {
    path: 'lifecycle',
    loadComponent: () =>
      import('./views/lifecycle/lifecycleview').then((m) => m.LifecycleView),
    title: 'Lifecycle',
  },
  {
    path: 'navigation-routing',
    loadComponent: () =>
      import('./views/navigation/navigationview').then((m) => m.NavigationView),
    title: 'Navigation and routing',
  },

  // State management hub + sub-screens
  {
    path: 'state-management',
    loadComponent: () =>
      import('./views/state_management/state_management').then(
        (m) => m.StateManagementView,
      ),
    title: 'State management',
  },
  {
    path: 'state-management/signals',
    loadComponent: () =>
      import('./views/state_management/signals/signalsview').then(
        (m) => m.SignalsView,
      ),
    title: 'State management — Signals',
  },
  {
    path: 'state-management/ngrx',
    loadComponent: () =>
      import('./views/state_management/ngrx/ngrxview').then((m) => m.NgrxView),
    title: 'State management — NgRx Store',
  },
  {
    path: 'state-management/signal-store',
    loadComponent: () =>
      import('./views/state_management/signal_store/signalstoreview').then(
        (m) => m.SignalStoreView,
      ),
    title: 'State management — NgRx SignalStore',
  },
  {
    path: 'state-management/rxjs-server-state',
    loadComponent: () =>
      import(
        './views/state_management/rxjs_server_state/rxjsserverstateview'
      ).then((m) => m.RxjsServerStateView),
    title: 'State management — RxJS / server state',
  },

  // Data + error + engineering
  {
    path: 'api-handling',
    loadComponent: () =>
      import('./views/api_handling/apihandlingview').then(
        (m) => m.ApiHandlingView,
      ),
    title: 'API handling',
  },
  {
    path: 'database-handling',
    loadComponent: () =>
      import('./views/database_handling/databasehandlingview').then(
        (m) => m.DatabaseHandlingView,
      ),
    title: 'Database handling',
  },
  {
    path: 'exception-handling',
    loadComponent: () =>
      import('./views/exception_handling/exceptionhandlingview').then(
        (m) => m.ExceptionHandlingView,
      ),
    title: 'Exception handling',
  },
  {
    path: 'dependency-management',
    loadComponent: () =>
      import('./views/dependency_management/dependencymanagementview').then(
        (m) => m.DependencyManagementView,
      ),
    title: 'Dependency management',
  },
  {
    path: 'architecture',
    loadComponent: () =>
      import('./views/architecture/architectureview').then(
        (m) => m.ArchitectureView,
      ),
    title: 'Architecture',
  },
  {
    path: 'testing',
    loadComponent: () =>
      import('./views/testing/testingview').then((m) => m.TestingView),
    title: 'Testing',
  },
  {
    path: 'debugging',
    loadComponent: () =>
      import('./views/debugging/debuggingview').then((m) => m.DebuggingView),
    title: 'Debugging',
  },
  {
    path: 'environments',
    loadComponent: () =>
      import('./views/environments/environmentsview').then(
        (m) => m.EnvironmentsView,
      ),
    title: 'Environments / Flavours',
  },
  {
    path: 'best-practices',
    loadComponent: () =>
      import('./views/best_practices/bestpracticesview').then(
        (m) => m.BestPracticesView,
      ),
    title: 'Best practices',
  },

  // Unknown routes -> home.
  { path: '**', redirectTo: '' },
];
