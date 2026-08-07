# Angular developer's guide

A teaching artifact: a small, production-shaped **Angular 22** app that
demonstrates how to structure an Angular codebase — clean architecture layers,
an end-to-end error pipeline, dependency wiring, a token design system, and a
screen-per-topic guide. Mirrors the sibling `react_developers_guide`.

> **Docker-first.** All tooling (Node, Angular CLI, deps, the test runner) runs
> inside Docker. The host needs only Docker — there is intentionally **no
> `node_modules` on the host**. See `ARCHITECTURE.md` for the why.

## Prerequisites

- Docker (with the Compose plugin)

## Run (dev, with HMR)

```bash
docker compose -f .docker/docker-compose.dev.yml up
# app at http://localhost:4200
```

The project dir is bind-mounted into the container; `node_modules` lives in a
container-only volume, so the host stays clean and edits hot-reload.

## Run a one-off command inside the dev container

```bash
docker compose -f .docker/docker-compose.dev.yml run --rm app <cmd>
# e.g.
docker compose -f .docker/docker-compose.dev.yml run --rm app npm test
docker compose -f .docker/docker-compose.dev.yml run --rm app npm run build
docker compose -f .docker/docker-compose.dev.yml run --rm app npm run start:staging
```

## Build & serve the prod image (nginx)

```bash
docker compose -f .docker/docker-compose.prod.yml up
# app at http://localhost:80  (container nginx on :8080, run as non-root `nginx`)
```

## Test

```bash
docker compose -f .docker/docker-compose.dev.yml run --rm app npm test
```

Vitest via the Angular `@angular/build:unit-test` builder (jsdom). Integration
specs render the real DI/router tree; pure units cover `core` (result, guards,
config) and `data/providers`.

## Environments / flavours

Swapped via Angular `fileReplacements` in `angular.json`:

- `development` — `ng serve` / `npm run start` (fakes wired)
- `staging` — `npm run start:staging` / `npm run build:staging` (live backend)
- `production` — `npm run build` (default)

## Project layout

See [`ARCHITECTURE.md`](./ARCHITECTURE.md) for the layering, the error pipeline
(`AppException → Failure → Result<T>`), key decisions, and the testing posture.

```
src/
  domain/   pure models + repository contracts + use cases
  data/     remote (HttpClient/DTOs/interceptors), local (Dexie/DAOs),
            repositories (offline-first), fake (in-memory)
  core/     Result<T>, error-handling pipeline, config, scenario, DI tokens
  ui/       design-system tokens + shared presentational components
  app/      shell, lazy route table, views (one folder per screen)
  environments/  prod / development / staging
```
