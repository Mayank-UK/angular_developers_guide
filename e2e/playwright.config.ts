import { defineConfig, devices } from '@playwright/test';

/**
 * Browser E2E for the guide — run against a REAL serving stack, not the
 * dev server: the suite exists to gate the production nginx image (the CI
 * workflow boots docker compose prod+ci on the loopback and points this
 * config at it).
 *
 * No `webServer` block on purpose: the stack already runs under Docker. If
 * it is down, start it from the repo root:
 *   docker compose -f .docker/docker-compose.prod.yml \
 *     -f .docker/docker-compose.ci.yml up -d --wait
 */
export default defineConfig({
  testDir: '.',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  // Deterministic by design: a red e2e test is a wiring signal, and
  // re-rolling it throws the information away. Zero retries, one worker —
  // the specs share a single stack.
  retries: 0,
  workers: 1,
  fullyParallel: false,
  reporter: 'line',
  use: {
    // CI (and local dry-runs) point this at the booted prod-image stack
    // (nginx on 127.0.0.1:8080) — the default IS that stack; the env var
    // exists for pointing at any other deployment.
    baseURL: process.env.E2E_BASE_URL ?? 'http://127.0.0.1:8080',
    headless: true,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
