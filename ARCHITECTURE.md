# Architecture

This app is a **teaching artifact**: it is itself a small, production-shaped
Angular 22 app whose job is to demonstrate how an Angular codebase can be
structured. It mirrors a sibling React guide concept-for-concept. The hard
parts — layering, error handling, dependency wiring — are done the way they are
on purpose, and this document records *why*.

## Docker-first

All tooling (Node, Angular CLI, deps, the test runner) lives **in Docker**. The
host machine only needs Docker. There is intentionally **no `node_modules` on the
host** — install/build/test/serve all run inside the container.

- Dev: `.docker/docker-compose.dev.yml` (HMR dev server on :4200). Prod: `.docker/docker-compose.prod.yml` (nginx on :80). See `README.md`.
- The dev container (`.docker/Dockerfile.dev`) mounts the project and keeps its
  own `node_modules` in an anonymous volume, so the host stays clean.
- The prod image (`.docker/Dockerfile.prod`) is a two-stage build: Node builds
  the bundle, nginx serves `dist/<app>/browser` on the unprivileged port 8080,
  running fully as the non-root `nginx` user (pid + temp paths relocated to
  `/tmp` via `.docker/nginx/nginx.conf`).

## Layering

```
domain/        ← pure business models + contracts. No framework, no I/O.
  models/         value objects (Post, Link)
  repositories/   interfaces (PostRepository) — the seam data implements
  usecases/       application logic (GetPostsUseCase)

data/          ← implements the domain contracts. Talks to the outside world.
  remote/         HttpClient + DTOs + functional interceptors
  local/          IndexedDB (Dexie) + DAOs
  repositories/   PostRepositoryImpl — orchestrates remote + local, offline-first
  fake/           in-memory fakes for dev + tests

core/          ← cross-cutting infra shared by every layer.
  result.ts       Result<T> — the domain return type for fallible work
  error-handling/ AppException (data) → Failure (domain) pipeline
  config/         AppConfig built from Angular environment files
  scenario/       dev-only failure-injection knobs (ScenarioService signals)
  di/tokens.ts    InjectionToken seam (POST_REPOSITORY, GET_POSTS_USE_CASE, APP_CONFIG)

ui/            ← presentation. Reads domain + core, never data internals.
  design-system/  tokens (CSS vars) + ThemeService signal
  components/     shared presentational primitives (standalone, OnPush, signals)
app/           ← the application shell + routing + screen folders.
  app.routes.ts   lazy route table (loadComponent), named `routes` export
  app.config.ts   providers: router, HttpClient+interceptors, provideData(config)
  views/          one folder per topic screen; hubs → sub-screens
  layout/         route-path constants
environments/  ← Angular environment files swapped per flavour via fileReplacements
```

**Invariant:** dependencies point inward/downward. `domain` depends on nothing
but `core/result`. `data` depends on `domain` + `core` (+ Angular + Dexie).
`ui`/`app` depend on `domain` + `core`, and on `data` *only* through the DI
tokens in `core/di/tokens.ts`. A view never imports a DTO, a DAO, or
`HttpClient` — except for two deliberately-localised **teaching zones** that
exist to demonstrate the very thing the rule otherwise forbids:

- `app/views/database_handling/demo-cache-wiring.ts` — a hand-written wiring
  file showing how the repository/cache slots are composed, and
- `app/views/state_management/rxjs_server_state/**` — a self-contained
  HttpClient / RxJS / caching teaching module that builds its own
  **component-scoped** `HttpClient` (via a child `EnvironmentInjector` in
  `scoped-http-client.ts`) so it never touches the app's real pipeline or the
  global `retryInterceptor`.

Both are enforced as the only allowed exceptions by
`src/architecture-invariants.spec.ts`. `getWiring(config)` in `data/providers`
is a pure metadata helper (returns `{ remote, db }` strings) and may be
imported by the Dependency-management screen for introspection — it leaks no
concrete class.

## The error pipeline

This is the part most teams get wrong, so it is the spine of the app.

```
engine error (HttpClient / IndexedDB / JSON)
   │  PostApiService / PostDAO catch
   ▼
AppException   (data-layer only; typed, chained via .cause)
   │  httpErrorToException      (HttpErrorResponse → AppException, status-based)
   │  mapExceptionToFailure     (recursive over the cause chain)
   ▼
Failure        (domain/presentation; kind + severity + user message)
   │  PostRepositoryImpl         (with optional cache fallback → chained CacheFailure)
   ▼
Result<T>      (Success<T, warning?> | Failed)  — the value the UI consumes
```

- **Two stages, not one.** `AppException` is technical (what broke: network,
  server, db). `Failure` is semantic (what to show the user, how loudly). They
  are decoupled so the UI reasons only about `Failure.kind`/`severity` and
  never imports HTTP concepts.
- **Causality is preserved.** Both `AppException.cause` and `Failure.cause`
  chain, so a compound failure ("served stale cache *because* the network
  failed *because* the request timed out") reconstructs the whole story for
  logs (`Failure.chain`).
- **Severity drives presentation.** Critical → full-screen `<ui-show-error/>`;
  Warning/Info → non-blocking snackbar. `Result.Success` may carry a
  non-blocking `warning` (stale data + network failure in one value) — the
  offline-first pattern.

## Key decisions

- **`Result<T>` instead of exceptions across the domain boundary.** Forces every
  fallible call site to acknowledge failure at the type level; no forgotten
  `try/catch`. Exceptions still exist *inside* `data/` (typed `AppException`s)
  but are converted to `Result` before crossing into the domain.
- **Const-object + literal union instead of `enum`.** The project targets
  Angular's erasable-only TS; enums aren't erasable. `const Foo = {...} as const;
  type Foo = (typeof Foo)[keyof typeof Foo]` gives runtime values + a literal
  union with no syntax that survives compilation.
- **Angular native DI instead of a hand-rolled container.** Unlike the React
  guide (which hand-rolls a service locator), Angular has first-class DI.
  `core/di/tokens.ts` defines `InjectionToken`s; `data/providers.ts`
  `provideData(config)` registers the fake-vs-live wiring (chosen from
  `AppConfig.wiring`) and the repository/use-case tokens. Screens resolve these
  via `inject(...)` — no prop-drilling. `getWiring(config)` exposes the runtime
  swap for the dependency-management screen's introspection.
- **Functional HttpClient interceptor for retries.** `retry.interceptor.ts` is an
  `HttpInterceptorFn` (RxJS) — idempotent-only, exponential full-jitter, never
  retries errors that are already `AppException`s, and maps exhausted errors via
  `httpErrorToException`.
- **Token-driven design system.** CSS custom properties are the single source of
  truth (`ui/design-system/tokens.css`); dark mode is a `[data-theme]` attribute
  flip driven by the `ThemeService` signal. Components consume `var(--…)` tokens,
  never hard-coded colors.
- **Signals throughout the UI.** Components are standalone, `OnPush`, and use
  `signal`/`computed`/`effect` and the `input()`/`output()` signal APIs.
- **Strict TypeScript.** `strict` + `noUncheckedIndexedAccess` enforced.

## Environments / flavours

Angular environment files (`environments/environment.ts` prod default,
`environment.development.ts`, `environment.staging.ts`) are swapped wholesale by
`fileReplacements` in `angular.json`. Each carries `production`, `name`,
`wiring` (fake/live remote + db), `apiBaseUrl`, and `scenario` (dev failure
injection). `core/config` turns the raw record into a typed `AppConfig`.

## NgRx peer-dependency

The state-management screens use `@ngrx/store`, `@ngrx/effects`,
`@ngrx/store-devtools`, and `@ngrx/signals`. The latest **stable** NgRx line is
**21.1.1**, whose `peerDependencies` pin `@angular/core ^21`; this project is on
**Angular 22.1**. NgRx 22 exists only as beta/rc (no stable cut as of
2026-08-06), so a teaching artifact shouldn't adopt it yet. The two stacks are
runtime-compatible (NgRx's public API did not change between 21 and 22 in ways
this app touches), so the install is done with `--legacy-peer-deps` to tolerate
the peer mismatch:

- `.docker/Dockerfile.dev`'s `npm ci --legacy-peer-deps` bakes the deps into
  the dev image; one-off `docker compose run … npm i` commands inside the
  container must pass the same flag.
- When `@ngrx/*@22` ships a **stable** release, upgrade (`npm i @ngrx/store@^22
  @ngrx/effects@^22 @ngrx/store-devtools@^22 @ngrx/signals@^22`), drop the
  `--legacy-peer-deps` flag from Dockerfile.dev, and remove this section.

This is a deliberate, documented workaround — not an oversight.

## Testing posture

The test runner is Vitest via the `@angular/build:unit-test` builder (`ng test`,
runs in jsdom). Specs render the **real** DI/router tree (integration-style
smoke tests — e.g. `app.spec.ts`) rather than a mock shell, plus unit tests for
the pure core (`result`, `error-handling/guards` + `stringify`, `config`,
`data/providers`). A global `src/test/setup.ts` polyfills `window.matchMedia`
(jsdom omits it) so `ThemeService` constructs under test.

`src/architecture-invariants.spec.ts` is a static, source-scanning regression
guard (it reads every `.ts` file under `src/` raw, via Vite's
`import.meta.glob('?raw')`, and strips template-literal code samples before
matching real `import` statements). It locks the four invariants from the
Layering + Key decisions sections: `domain/` is framework-free; `data/` never
imports `ui/`/`app/`; views reach `data/` only through the DI seam (with the two
documented teaching zones above as the sole exceptions); and no `enum` is
declared anywhere in `src/`.
