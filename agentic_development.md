- Project requirements
  - I want to implement an angular project /Development/personal/angular/angular_developers_guide following the code architecture similar to Development/personal/react/react_developers_guide, separating ui, domain, data layer, error handling, state management, etc
  - I will add my requirements to this file marked as "⏳" and as you keep finishing them, you can replace "⏳" with "✅"

- Generic instructions:
  - You have to build UI using the design system implemented in the application
  - You have to follow the proper architecture that is followed in the application, for example, having use cases, repositories, repositoriesImpl, remote, DTOs, local, DAOs, exception handling, and so on
  - You have to check if existing components can be reused instead of creating new ones. If a component is to be used in a single file, then better to make it a function inside that view. If a component is to be used in multiple files, then create it inside the global ui/components
  - If feeling confused about how to do things, you are free to check how it's done in other parts of this app; the goal is to maintain consistency throughout the app
  - Before proceeding to the next task, calculate if continuing the next task in this chat will be more token efficient or continuing in new chat, and recommend me when its better to move to new chat
  - Please follow best practices of angular while building this project

# AI defined section:

## Current state
- Angular 22 teaching app (standalone + signals, strict TS, clean layering domain/data/core/ui with Angular DI as the seam).
  Read ARCHITECTURE.md (layering, error pipeline, key decisions) before touching code.
- Docker-only tooling: NO node_modules on host — ALL build/test/serve run in Docker; do NOT run npm/ng on the host.
  - dev (HMR, :4200): `docker compose -f .docker/docker-compose.dev.yml up`
  - one-off cmds: `docker compose -f .docker/docker-compose.dev.yml run --rm app <cmd>` (e.g. npm test, npm run build)
  - prod (nginx, loopback :8080): build image `docker build -f .docker/Dockerfile.prod -t ghcr.io/mayank-uk/angular-guide-web:ci .`, then
    `docker compose -f .docker/docker-compose.prod.yml -f .docker/docker-compose.ci.yml up -d --wait` (see README)
- CRITICAL install gotcha: every `npm ci` (host/CI/Docker) REQUIRES `--legacy-peer-deps` — stable NgRx 21 peer-pins @angular/core ^21 vs this
  project's Angular 22; plain npm ci dies with ERESOLVE (proven 2026-10-22). Already in Dockerfile.prod + ci.yml; keep it anywhere npm ci runs.
- `ng test` (@angular/build:unit-test, vitest) runs in RUN mode and exits in non-TTY environments — no --watch=false/CI=true needed in CI;
  explicit watch variant = `npm run test:watch`. Suite today: 79 tests / 13 spec files.
- CI/CD (2026-10-22, family spec): .github/workflows/ci.yml (test → secrets → e2e → vm-arch → build-push → ghcr-prune)
  + deploy-production.yml (blue/green via shared caddy; flip file /home/ubuntu/angular_developers_guide/platform/upstream.caddy).
  - Contracts: image ghcr.io/mayank-uk/angular-guide-web, container adg_web_<color>, network adg_frontend,
    hostname angulardevelopersguide.mayankcodeworks.com, CI compose project angular_developers_guide_ci.
  - e2e/ = standalone Playwright package (own lockfile, NO webServer, E2E_BASE_URL defaults http://127.0.0.1:8080) — run it against the booted CI stack.
  - Deploy release-scp shape: target `releases/<sha>` + strip_components: 0 (sibling rdg uses strip 1 + /.docker target — do NOT mix the two shapes; double-nests).
- Domain migrated 2026-10-23: makbuilds.duckdns.org → mayankcodeworks.com (old URLs 301 at the caddy edge).
- Umami analytics (2026-10-24, master 05d1c95): self-hosted umami.mayankcodeworks.com, website_id 21d8bbbb-f047-4209-b49c-dc4e5f07ebcf;
  token-gated beacon + typed events topic-open{topic} (NavigationEnd + bootstrap direct report, mutually exclusive — cold deep-links covered)
  + copy-code{path}.
- Angular has no env vars: src/environments/analytics.ts __UMAMI_SRC__/__UMAMI_ID__ tokens + Dockerfile sed swap fed by UMAMI_* repo-level
  GitHub Variables (never environment-scoped; unreplaced/empty = disabled).
- Beacon tag carries data-distinct-id (2026-10-25 ✅): stable per-browser visitor id — localStorage 'mcw_vid' UUID minted pre-append; Umami auto-identify dedupes visitors across IP churn.
  Verify: ng build (Docker) green + dist grep mcw_vid hits browser/chunk-*.js; runtime check pending post-deploy.
- REUSE these contracts, do not recreate: design tokens src/ui/design-system/tokens.css (consume var(--…)) + ThemeService;
  app-hub-view (src/app/views/hub/) + app-placeholder; route paths const src/app/layout/route-paths.ts.
  - UI primitives in src/ui/components/: section-wrapper, text-block, code-block, example, content-group-wrapper, link-card, show-error, theme-toggle.
- Core/domain/data layers complete; views resolve data ONLY via DI tokens (src/core/di/tokens.ts: POST_REPOSITORY, GET_POSTS_USE_CASE, APP_CONFIG)
  using inject(...). Enforced by src/architecture-invariants.spec.ts.
- Conventions: const-object + literal union, NEVER enum. A view never imports a DTO/DAO/HttpClient. Match the surrounding code's style.
  Documented teaching-zone exceptions: database_handling/demo-cache-wiring.ts, state_management/rxjs_server_state/**.
- All 24 screens implemented + polished; every screen its own lazy OnPush standalone chunk (signals input()/output()/model()/viewChild());
  route-loading progress bar in root shell + withPreloading(PreloadAllModules) (route table verified guard-free).
- Process: build each screen as a SUBAGENT pointed at the matching react_developers_guide screen (src/ui/views/<name>/) as reference,
  adapted to Angular idioms; update this file after each screen lands.
- History (one-time setup, all screens, 2026-08-07 senior review 9-10/10 + 5 surgical refactors, polish pass, 2026-10-22 CI/CD + route-loading UX) → archived in devlog.md.

## Active tasks
- Faro crash-telemetry beacon ✅ 2026-10-31 (commit 3d4cb05): Angular env-token carrier (analytics.ts placeholders + Dockerfile.prod sed + ci build-args), umami-mirrored. Tests 93/93 + build green. Needs repo Variables FARO_URL + FARO_APP=angulardevelopersguide.
- ⏳ First production deploy needs the VM dirs + caddy snippet `adg.caddy` from the infra repo (family-standard, per spec).
