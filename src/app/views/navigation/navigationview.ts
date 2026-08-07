import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Params, Router } from '@angular/router';
import { SectionWrapper } from '../../../ui/components/section-wrapper/section-wrapper';
import { ContentGroupWrapper } from '../../../ui/components/content-group-wrapper/content-group-wrapper';
import { TextBlock } from '../../../ui/components/text-block/text-block';
import { CodeBlock } from '../../../ui/components/code-block/code-block';
import { Example } from '../../../ui/components/example/example';

/**
 * NavigationView — the Angular Router, end to end, taught with live demos.
 *
 * Mental model: the Router treats the URL as state. Each path maps to a
 * component; changing the URL renders the matching screen WITHOUT a full page
 * reload, so a single-page app behaves like a multi-page site — refresh works,
 * the back button works, deep links land on the right screen.
 *
 * Coverage: route configuration (`Routes`), lazy loading (`loadComponent` /
 * `loadChildren`), route `data` + `title`, child/nested routes with a nested
 * `<router-outlet>`, functional guards (`canMatch` / `canActivate` /
 * `canDeactivate`), functional resolvers (`resolve`), query params + fragments
 * (read via `ActivatedRoute`, written via `Router.navigate` / `RouterLink`),
 * `routerLink` + `routerLinkActive`, and redirect / wildcard `**` routes.
 *
 * The canonical route table shown throughout is THIS APP'S real
 * `src/app/app.routes.ts` + `src/app/layout/route-paths.ts`.
 *
 * TWO kinds of live demo:
 *   1. The Query-params + fragment demo uses the REAL router — this view is on
 *      a real route (`/navigation-routing`), so it reads/writes its own
 *      `?q=` / `#frag` via `ActivatedRoute` + `Router.navigate`.
 *   2. The Mini-router centerpiece + the canDeactivate guard demo use a
 *      SELF-CONTAINED simulated router built on signals. Nesting another real
 *      `<router-outlet>` here would require polluting `app.routes.ts` with demo
 *      child paths and risk colliding with the real route table, so the demo
 *      reproduces a router's behaviour (history stack, parsed params, guards)
 *      in local state. The CODE BLOCKS show the real API you would ship; the
 *      simulation is only so you can click through it without leaving the page.
 *
 * NOTE: the exported `NavigationView` is declared at the BOTTOM of this file.
 * Its `imports` reference local helper classes that are block-scoped class
 * declarations (TDZ), so the main component must come AFTER every helper it
 * names — otherwise the decorator would read an uninitialized binding at
 * module-evaluation time.
 */

/* -------------------------------------------------------------------------- */
/* Shared local types + simulated router                                      */
/* -------------------------------------------------------------------------- */

/** Parsed out of the simulated URL string, mirroring the real router's shape. */
interface MiniLocation {
  readonly pathname: string;
  readonly search: URLSearchParams;
  readonly raw: string;
}

/** A matched mini-route's resolution: which screen + any `:id` param. */
interface MiniMatch {
  readonly screen: MiniScreen;
  readonly id?: string;
  /** Where a guard redirected from, or null. */
  readonly redirectedFrom: string | null;
}

const MINI_SCREEN = {
  home: 'home',
  users: 'users',
  userDetail: 'userDetail',
  search: 'search',
  compose: 'compose',
  login: 'login',
  notFound: 'notFound',
} as const;
type MiniScreen = (typeof MINI_SCREEN)[keyof typeof MINI_SCREEN];

const MINI_USERS: readonly { readonly id: string; readonly name: string }[] = [
  { id: '7', name: 'Ada' },
  { id: '42', name: 'Alan' },
  { id: '99', name: 'Grace' },
];

const HANDLE_TITLES: Record<MiniScreen, string> = {
  home: 'Mini app — home',
  users: 'Mini app — users',
  userDetail: 'Mini app — user detail',
  search: 'Mini app — search',
  compose: 'Mini app — compose (guarded)',
  login: 'Mini app — sign in',
  notFound: 'Mini app — not found',
};

/** Parse a simulated URL string into pathname + search params. */
function parseLocation(raw: string): MiniLocation {
  const [pathname = '', query = ''] = raw.split('?');
  return { pathname, search: new URLSearchParams(query), raw };
}

/**
 * Match a pathname against the mini route table → screen + `:id` param, then
 * apply the auth guard: `/compose` requires `authed`, else redirects to login.
 */
function matchRoute(pathname: string, authed: boolean): MiniMatch {
  const ok = (screen: MiniScreen, id?: string): MiniMatch => ({
    screen,
    id,
    redirectedFrom: null,
  });
  const redirect = (to: MiniScreen): MiniMatch => ({
    screen: to,
    redirectedFrom: pathname,
  });
  if (pathname === '/' || pathname === '') return ok(MINI_SCREEN.home);
  if (pathname === '/users') return ok(MINI_SCREEN.users);
  const m = pathname.match(/^\/users\/([^/]+)$/);
  if (m) {
    const id = decodeURIComponent(m[1] ?? '');
    return ok(MINI_SCREEN.userDetail, id);
  }
  if (pathname === '/search') return ok(MINI_SCREEN.search);
  if (pathname === '/compose') {
    return authed ? ok(MINI_SCREEN.compose) : redirect(MINI_SCREEN.login);
  }
  if (pathname === '/login') return ok(MINI_SCREEN.login);
  return ok(MINI_SCREEN.notFound);
}

/* -------------------------------------------------------------------------- */
/* QueryParamsDemo — REAL ActivatedRoute + Router on this screen's own URL.    */
/* -------------------------------------------------------------------------- */

/**
 * QueryParamsDemo — a genuine, live query-param + fragment read/write using
 * THIS view's real route (`/navigation-routing`). Reads `?q=` via
 * `ActivatedRoute.queryParams` (converted to a signal with `toSignal`) and the
 * `#frag` fragment the same way; writes both imperatively via
 * `Router.navigate([], { relativeTo, queryParams, fragment })`. Because it
 * touches only this screen's own URL params, it cannot collide with other
 * routes — and the URL readout updates live as you type.
 */
@Component({
  selector: 'app-nav-query-params-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mini-shell">
      <div class="addr">
        <span class="url">
          url: <code>{{ currentUrl }}</code>
        </span>
      </div>

      <div class="body">
        <label class="field">
          <span class="lbl">?q=</span>
          <input
            [value]="q()"
            (input)="onQ($event)"
            placeholder="type to update ?q="
          />
        </label>

        <div class="frag-row">
          <span class="lbl">fragment:</span>
          @for (f of fragments; track f) {
            <button
              type="button"
              class="chip"
              [class.active]="frag() === f"
              (click)="setFrag(f)"
            >
              #{{ f }}
            </button>
          }
          <button
            type="button"
            class="chip ghost"
            (click)="setFrag('')"
            [disabled]="!frag()"
          >
            clear
          </button>
        </div>

        <p class="readout">
          ActivatedRoute → queryParams.q = <strong>"{{ q() }}"</strong> ·
          fragment = <strong>"{{ frag() }}"</strong>
        </p>
      </div>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .mini-shell {
        border: 1px solid var(--color-outline);
        border-radius: var(--radius-md);
        background-color: var(--color-surface);
        overflow: hidden;
      }
      .addr {
        padding: var(--space-xxs) var(--space-sm);
        background-color: var(--color-surface-variant);
        border-bottom: 1px solid var(--color-outline);
      }
      .url code {
        font-family: var(--font-mono);
        font-size: var(--text-caption);
        color: var(--color-primary);
        word-break: break-all;
      }
      .body {
        padding: var(--space-sm);
        display: flex;
        flex-direction: column;
        gap: var(--space-sm);
      }
      .field {
        display: flex;
        flex-direction: column;
        gap: var(--space-xxs);
      }
      .lbl {
        font-family: var(--font-mono);
        font-size: var(--text-overline);
        letter-spacing: 0.06em;
        color: var(--color-on-surface-variant);
      }
      input {
        padding: var(--space-xxs) var(--space-sm);
        border: 1px solid var(--color-outline);
        border-radius: var(--radius-sm);
        background-color: var(--color-surface);
        color: var(--color-on-surface);
        font-family: var(--font-mono);
        font-size: var(--text-body-sm);
      }
      input:focus {
        outline: none;
        border-color: var(--color-primary);
      }
      .frag-row {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: var(--space-xs);
      }
      .chip {
        padding: var(--space-xxs) var(--space-sm);
        border: 1px solid var(--color-outline);
        border-radius: var(--radius-pill);
        background: transparent;
        color: var(--color-on-surface-variant);
        font-family: var(--font-mono);
        font-size: var(--text-caption);
        cursor: pointer;
      }
      .chip:hover:not(:disabled) {
        background-color: var(--color-surface-variant);
      }
      .chip.active {
        border-color: var(--color-primary);
        color: var(--color-primary);
        background-color: var(--color-surface-tint);
      }
      .chip.ghost {
        color: var(--color-on-surface-variant);
      }
      .chip:disabled {
        opacity: 0.4;
        cursor: not-allowed;
      }
      .readout {
        margin: 0;
        padding: var(--space-xs) var(--space-sm);
        border-top: 1px dashed var(--color-outline);
        font-size: var(--text-caption);
        color: var(--color-on-surface-variant);
        font-family: var(--font-mono);
        word-break: break-all;
      }
      .readout strong {
        color: var(--color-primary);
      }
    `,
  ],
})
class QueryParamsDemo {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  /** Reactive query params + fragment (Observables → signals via toSignal). */
  private readonly queryParams = toSignal(this.route.queryParams, {
    initialValue: {} as Params,
  });
  private readonly fragmentObs = toSignal(this.route.fragment, {
    initialValue: null as string | null,
  });

  readonly q = computed(() => (this.queryParams()['q'] as string) ?? '');
  readonly frag = computed(() => this.fragmentObs() ?? '');
  /** Frozen list of fragment chips the user can pick from. */
  readonly fragments = ['top', 'guards', 'lazy'] as const;

  /** The live URL (path + query + fragment) for the address-bar readout. */
  get currentUrl(): string {
    const tree = this.router.url;
    return tree;
  }

  onQ(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { q: value || null },
      queryParamsHandling: 'merge',
      fragment: this.frag() || undefined,
    });
  }

  setFrag(f: string): void {
    this.router.navigate([], {
      relativeTo: this.route,
      fragment: f || undefined,
    });
  }
}

/* -------------------------------------------------------------------------- */
/* CanDeactivateGuardDemo — a self-contained dirty-form guard simulation.      */
/* -------------------------------------------------------------------------- */

/**
 * CanDeactivateGuardDemo — simulates a `canDeactivate` guard: a form with a
 * "dirty" flag; clicking any mini-link while dirty runs a `confirm()` (exactly
 * what a `CanDeactivateFn` would do) and either blocks or allows the navigation.
 * The real `CanDeactivateFn` source is shown in a code block beside it.
 */
@Component({
  selector: 'app-nav-can-deactivate-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="gd-shell">
      <div class="addr">
        <span class="url">
          url: <code>{{ currentUrl() }}</code>
          @if (blocked()) {
            <span class="badge">↳ guard BLOCKED the navigation</span>
          }
        </span>
      </div>

      <div class="body">
        <div class="route-row">
          <span class="lbl">target route:</span>
          @for (r of targets; track r.path) {
            <button
              type="button"
              class="chip"
              [class.active]="currentUrl() === r.path"
              (click)="go(r.path)"
            >
              {{ r.label }}
            </button>
          }
        </div>

        <div class="form">
          <label class="field">
            <span class="lbl">draft message</span>
            <input
              [value]="text()"
              (input)="onInput($event)"
              placeholder="type something to make the form dirty…"
            />
          </label>
          <span class="state" [class.dirty]="dirty()">
            {{ dirty() ? 'DIRTY — guard will prompt' : 'clean — guard allows' }}
          </span>
          <button type="button" class="reset" (click)="reset()">reset form</button>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .gd-shell {
        border: 1px solid var(--color-outline);
        border-radius: var(--radius-md);
        background-color: var(--color-surface);
        overflow: hidden;
      }
      .addr {
        padding: var(--space-xxs) var(--space-sm);
        background-color: var(--color-surface-variant);
        border-bottom: 1px solid var(--color-outline);
        display: flex;
        align-items: center;
        gap: var(--space-sm);
      }
      .url code {
        font-family: var(--font-mono);
        font-size: var(--text-caption);
        color: var(--color-primary);
      }
      .badge {
        font-family: var(--font-mono);
        font-size: var(--text-overline);
        color: var(--color-error, var(--color-primary));
        letter-spacing: 0.04em;
      }
      .body {
        padding: var(--space-sm);
        display: flex;
        flex-direction: column;
        gap: var(--space-sm);
      }
      .route-row {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: var(--space-xs);
      }
      .lbl {
        font-family: var(--font-mono);
        font-size: var(--text-overline);
        letter-spacing: 0.06em;
        color: var(--color-on-surface-variant);
      }
      .chip {
        padding: var(--space-xxs) var(--space-sm);
        border: 1px solid var(--color-outline);
        border-radius: var(--radius-sm);
        background: transparent;
        color: var(--color-on-surface-variant);
        font-family: var(--font-mono);
        font-size: var(--text-caption);
        cursor: pointer;
      }
      .chip:hover {
        background-color: var(--color-surface-variant);
      }
      .chip.active {
        border-color: var(--color-primary);
        color: var(--color-primary);
      }
      .form {
        display: flex;
        flex-direction: column;
        gap: var(--space-xs);
        padding: var(--space-sm);
        border: 1px dashed var(--color-outline);
        border-radius: var(--radius-md);
        background-color: var(--color-surface-tint);
      }
      .field {
        display: flex;
        flex-direction: column;
        gap: var(--space-xxs);
      }
      input {
        padding: var(--space-xxs) var(--space-sm);
        border: 1px solid var(--color-outline);
        border-radius: var(--radius-sm);
        background-color: var(--color-surface);
        color: var(--color-on-surface);
        font-family: var(--font-mono);
        font-size: var(--text-body-sm);
      }
      input:focus {
        outline: none;
        border-color: var(--color-primary);
      }
      .state {
        font-family: var(--font-mono);
        font-size: var(--text-caption);
        color: var(--color-on-surface-variant);
      }
      .state.dirty {
        color: var(--color-primary);
        font-weight: 600;
      }
      .reset {
        align-self: flex-start;
        padding: var(--space-xxs) var(--space-sm);
        border: 1px solid var(--color-outline);
        border-radius: var(--radius-sm);
        background: transparent;
        color: var(--color-on-surface-variant);
        font-family: var(--font-mono);
        font-size: var(--text-caption);
        cursor: pointer;
      }
      .reset:hover {
        background-color: var(--color-surface-variant);
      }
    `,
  ],
})
class CanDeactivateGuardDemo {
  private readonly destroyRef = inject(DestroyRef);
  /** Tracked so a pending "blocked" flash can be cancelled on destroy. */
  private flashTimer: ReturnType<typeof setTimeout> | null = null;

  /** The simulated route the user is currently "on". */
  private readonly _current = signal('/compose');
  readonly currentUrl = this._current.asReadonly();

  readonly text = signal('');
  /** True once the user has typed — the `dirty` flag a real guard would read. */
  readonly dirty = signal(false);
  /** Flashes true for a moment when the guard blocks a navigation. */
  readonly blocked = signal(false);

  constructor() {
    // Cancel any in-flight "blocked" flash if the component is torn down before
    // the timer fires (otherwise the callback runs on a destroyed instance).
    this.destroyRef.onDestroy(() => {
      if (this.flashTimer !== null) clearTimeout(this.flashTimer);
    });
  }

  readonly targets = [
    { path: '/compose', label: '/compose' },
    { path: '/users', label: '/users' },
    { path: '/search', label: '/search' },
    { path: '/', label: '/' },
  ] as const;

  onInput(event: Event): void {
    this.text.set((event.target as HTMLInputElement).value);
    this.dirty.set(true);
  }

  reset(): void {
    this.text.set('');
    this.dirty.set(false);
  }

  /** Try to leave — the simulated `canDeactivate` runs here. */
  go(target: string): void {
    if (target === this._current()) return;
    if (this.dirty()) {
      // This is exactly what a real CanDeactivateFn returns: a boolean (or
      // UrlTree / Observable / Promise). window.confirm is the common UX.
      const allow = window.confirm(
        'canDeactivate guard: you have unsaved changes. Leave anyway?',
      );
      if (!allow) {
        this.flashBlocked();
        return;
      }
    }
    this.dirty.set(false);
    this.text.set('');
    this._current.set(target);
  }

  private flashBlocked(): void {
    this.blocked.set(true);
    // Clear any in-flight flash so rapid re-triggers don't short-circuit early.
    if (this.flashTimer !== null) clearTimeout(this.flashTimer);
    this.flashTimer = setTimeout(() => {
      this.blocked.set(false);
      this.flashTimer = null;
    }, 1800);
  }
}

/* -------------------------------------------------------------------------- */
/* MiniRouterDemo — the centerpiece. A simulated router (signals) showing a    */
/* shared layout + nested <router-outlet>, NavLink active state, dynamic :id,   */
/* a canMatch-style auth guard, redirect, and a wildcard 404.                  */
/* -------------------------------------------------------------------------- */

/**
 * MiniRouterDemo — a self-contained simulated router that demonstrates, live,
 * everything the surrounding sections describe: a shared layout shell (the
 * "outlet" never re-mounts when you navigate), NavLink-style active styling,
 * dynamic `:id` params, a `canMatch`-style auth guard that redirects `/compose`
 * to `/login` when signed out, and a wildcard `**` 404. The simulation owns a
 * URL history stack + parsed params in signals; the CODE BLOCKS in the page
 * show the real Angular API you would ship in `app.routes.ts`.
 */
@Component({
  selector: 'app-nav-mini-router-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mini-shell">
      <!-- address bar + nav (NavLink-style active state lives here) -->
      <div class="addr">
        <span class="url">
          url: <code>{{ loc().pathname }}</code>
          @if (loc().raw.includes('?')) {
            <code class="q">?{{ loc().search.toString() }}</code>
          }
        </span>
        <nav class="nav">
          @for (item of navItems; track item.path) {
            <button
              type="button"
              class="navlink"
              [class.active]="isActive(item.path, item.exact)"
              [attr.data-to]="item.path"
              (click)="navigate(item.path)"
            >
              {{ item.label }}
            </button>
          }
          <button
            type="button"
            class="navlink"
            (click)="navigate('/totally-made-up')"
          >
            /unknown
          </button>
        </nav>
      </div>

      <p class="title-readout">
        route title → "<strong>{{ title() }}</strong>"
        @if (match().redirectedFrom) {
          <span class="redirect">
            ↳ guard redirected {{ match().redirectedFrom }} → /login
          </span>
        }
      </p>

      <!-- the simulated <router-outlet>: the shared shell stays put,
           only this body block swaps as the URL changes. -->
      <div class="outlet">
        @switch (match().screen) {
          @case ('home') {
            <div class="card">
              <strong>Home</strong> — try the links above.
              <ul class="links">
                <li>
                  <button class="link" type="button" (click)="navigate('/users')">
                    /users
                  </button>
                  — list with dynamic <code>:id</code> params
                </li>
                <li>
                  <button class="link" type="button" (click)="navigate('/search')">
                    /search
                  </button>
                  — query string
                </li>
                <li>
                  <button class="link" type="button" (click)="navigate('/compose')">
                    /compose
                  </button>
                  — guarded (auth)
                </li>
              </ul>
            </div>
          }
          @case ('users') {
            <div class="card">
              <strong>Users</strong> — pick one:
              <ul class="links">
                @for (u of miniUsers; track u.id) {
                  <li>
                    <button
                      class="link"
                      type="button"
                      [attr.data-testid]="'user-' + u.id"
                      (click)="navigate('/users/' + u.id)"
                    >
                      {{ u.name }} (#{{ u.id }})
                    </button>
                  </li>
                }
              </ul>
            </div>
          }
          @case ('userDetail') {
            <div class="card">
              <strong>User detail</strong>
              <p class="mono">paramMap → &#123; id: "{{ match().id }}" &#125;</p>
              <p>{{ userLabel() }}</p>
              <button class="link" type="button" (click)="navigate('/users')">
                ← back to list
              </button>
            </div>
          }
          @case ('search') {
            <div class="card">
              <strong>Search</strong>
              <input
                [value]="qParam()"
                placeholder="filter by name…"
                (input)="onSearch($event)"
              />
              <p class="mono">?q={{ qParam() || ' ' }} → {{ matchCount() }} match(s)</p>
            </div>
          }
          @case ('compose') {
            <div class="card">
              <strong>Compose</strong> — authed as a simulated session.
              <button class="btn" type="button" (click)="signOut()">
                sign out
              </button>
            </div>
          }
          @case ('login') {
            <div class="card">
              <strong>Sign in</strong> to reach <code>/compose</code>.
              <button class="btn primary" type="button" (click)="signIn()">
                sign in
              </button>
            </div>
          }
          @default {
            <div class="card">
              <strong>404</strong> — no route matched <code>{{ loc().pathname }}</code>.
              <button class="link" type="button" (click)="navigate('/')">
                ← go home
              </button>
            </div>
          }
        }
      </div>

      <div class="controls">
        <button
          type="button"
          class="btn"
          (click)="back()"
          [disabled]="!canGoBack()"
        >
          ← back (history)
        </button>
        <span class="hint">
          stack depth: {{ stack().length }} · index: {{ index() }}
        </span>
      </div>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .mini-shell {
        border: 1px solid var(--color-outline);
        border-radius: var(--radius-md);
        background-color: var(--color-surface-tint);
        padding: var(--space-sm);
        display: flex;
        flex-direction: column;
        gap: var(--space-sm);
      }
      .addr {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: space-between;
        gap: var(--space-sm);
        padding: var(--space-xs) var(--space-sm);
        border: 1px solid var(--color-outline);
        border-radius: var(--radius-md);
        background-color: var(--color-surface);
      }
      .url code {
        font-family: var(--font-mono);
        font-size: var(--text-caption);
        color: var(--color-primary);
      }
      .url code.q {
        color: var(--color-secondary);
      }
      .nav {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-xxs);
      }
      .navlink {
        padding: var(--space-xxs) var(--space-sm);
        border: 1px solid transparent;
        border-radius: var(--radius-sm);
        background: transparent;
        color: var(--color-on-surface-variant);
        font-family: var(--font-mono);
        font-size: var(--text-caption);
        cursor: pointer;
      }
      .navlink:hover {
        background-color: var(--color-surface-variant);
      }
      .navlink.active {
        background-color: var(--color-surface);
        color: var(--color-on-surface);
        border-color: var(--color-outline);
        box-shadow: var(--shadow-button-card);
      }
      .title-readout {
        margin: 0;
        font-family: var(--font-mono);
        font-size: var(--text-caption);
        color: var(--color-on-surface-variant);
      }
      .title-readout strong {
        color: var(--color-primary);
      }
      .redirect {
        color: var(--color-primary);
        margin-left: var(--space-xs);
      }
      .outlet {
        min-height: 120px;
        padding: var(--space-xs);
        border: 1px dashed var(--color-outline);
        border-radius: var(--radius-md);
        background-color: var(--color-surface);
      }
      .card {
        display: flex;
        flex-direction: column;
        gap: var(--space-xs);
        padding: var(--space-sm) var(--space-md);
        border: 1px solid var(--color-outline);
        border-radius: var(--radius-md);
        background-color: var(--color-surface);
        color: var(--color-on-surface);
        font-size: var(--text-body-sm);
      }
      .links {
        margin: 0;
        padding-left: var(--space-md);
        display: flex;
        flex-direction: column;
        gap: var(--space-xxs);
        color: var(--color-on-surface-variant);
      }
      .link {
        background: none;
        border: none;
        padding: 0;
        color: var(--color-primary);
        font-family: var(--font-mono);
        cursor: pointer;
        text-align: left;
      }
      .link:hover {
        text-decoration: underline;
      }
      .mono {
        margin: 0;
        font-family: var(--font-mono);
        font-size: var(--text-caption);
        color: var(--color-on-surface-variant);
      }
      input {
        padding: var(--space-xxs) var(--space-sm);
        border: 1px solid var(--color-outline);
        border-radius: var(--radius-sm);
        background-color: var(--color-surface);
        color: var(--color-on-surface);
        font-family: var(--font-mono);
        font-size: var(--text-body-sm);
      }
      input:focus {
        outline: none;
        border-color: var(--color-primary);
      }
      .btn {
        align-self: flex-start;
        padding: var(--space-xxs) var(--space-sm);
        border: 1px solid var(--color-outline);
        border-radius: var(--radius-md);
        background: transparent;
        color: var(--color-on-surface);
        font-family: var(--font-mono);
        font-size: var(--text-caption);
        cursor: pointer;
      }
      .btn:hover {
        background-color: var(--color-surface-variant);
      }
      .btn.primary {
        border-color: var(--color-primary);
        color: var(--color-primary);
      }
      .controls {
        display: flex;
        align-items: center;
        gap: var(--space-sm);
      }
      .controls .btn {
        align-self: auto;
      }
      .controls .btn:disabled {
        opacity: 0.4;
        cursor: not-allowed;
      }
      .hint {
        font-family: var(--font-mono);
        font-size: var(--text-overline);
        color: var(--color-on-surface-variant);
      }
      code {
        font-family: var(--font-mono);
      }
    `,
  ],
})
class MiniRouterDemo {
  /** Simulated auth store (shared, like the react mirror's module-scoped one). */
  private readonly authed = signal(false);

  /** History stack + cursor. */
  private readonly _stack = signal<string[]>(['/']);
  readonly stack = this._stack.asReadonly();
  private readonly _index = signal(0);
  readonly index = this._index.asReadonly();

  readonly canGoBack = computed(() => this._index() > 0);

  /** Current location parsed out of the stack entry at the cursor. */
  readonly loc = computed<MiniLocation>(() =>
    parseLocation(this._stack()[this._index()] ?? '/'),
  );

  /** Matched screen + `:id` + redirect info, applying the auth guard. */
  readonly match = computed<MiniMatch>(() =>
    matchRoute(this.loc().pathname, this.authed()),
  );

  readonly title = computed(() => HANDLE_TITLES[this.match().screen]);

  readonly qParam = computed(() => this.loc().search.get('q') ?? '');

  readonly matchCount = computed(() => {
    const q = this.qParam().toLowerCase();
    if (!q) return MINI_USERS.length;
    return MINI_USERS.filter((u) =>
      u.name.toLowerCase().includes(q),
    ).length;
  });

  readonly userLabel = computed(() => {
    const id = this.match().id;
    const u = MINI_USERS.find((x) => x.id === id);
    return u ? `Hello, ${u.name}.` : `No user with id ${id}.`;
  });

  readonly miniUsers = MINI_USERS;

  readonly navItems = [
    { path: '/', label: 'home', exact: true },
    { path: '/users', label: 'users', exact: false },
    { path: '/search', label: 'search', exact: false },
    { path: '/compose', label: 'compose', exact: false },
  ] as const;

  isActive(path: string, exact: boolean): boolean {
    const here = this.loc().pathname;
    return exact ? here === path : here === path || here.startsWith(path + '/');
  }

  navigate(to: string, replace = false): void {
    const idx = this._index();
    if (replace) {
      this._stack.update((s) => s.map((p, i) => (i === idx ? to : p)));
    } else {
      this._stack.update((s) => [...s.slice(0, idx + 1), to]);
      this._index.set(idx + 1);
    }
  }

  back(): void {
    this._index.update((i) => Math.max(0, i - 1));
  }

  onSearch(event: Event): void {
    const v = (event.target as HTMLInputElement).value;
    this.navigate(v ? `/search?q=${encodeURIComponent(v)}` : '/search', true);
  }

  signIn(): void {
    this.authed.set(true);
    this.navigate('/compose', true);
  }

  signOut(): void {
    this.authed.set(false);
    this.navigate('/login', true);
  }
}

/* -------------------------------------------------------------------------- */
/* Main view — declared last (TDZ note at the top of the file).               */
/* -------------------------------------------------------------------------- */

@Component({
  selector: 'app-navigation-view',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    SectionWrapper,
    ContentGroupWrapper,
    TextBlock,
    CodeBlock,
    Example,
    QueryParamsDemo,
    CanDeactivateGuardDemo,
    MiniRouterDemo,
  ],
  templateUrl: './navigation_view.html',
  styleUrl: './navigation_view.scss',
})
export class NavigationView {
  /** Code listings rendered by the page's CodeBlocks. */
  readonly snippets = SNIPPETS;
}

/* -------------------------------------------------------------------------- */
/* Code listings shown in the page's <ui-code-block> elements.                */
/* -------------------------------------------------------------------------- */

const SNIPPETS = {
  bootstrap: `// app.config.ts — the router is provided at the root, once.
import { ApplicationConfig, provideRouter } from '@angular/core';
import { routes } from './app.routes';
import { withComponentInputBinding } from '@angular/router';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes, withComponentInputBinding()),
    // withComponentInputBinding() binds route params/query to @Input() signals.
  ],
};

// app.html — the shell has ONE <router-outlet>. The matched route's component
// renders into it; the shared chrome (header, theme toggle) lives here, never
// re-mounting on navigation.
//   <header>…shared header…</header>
//   <main><router-outlet /></main>`,
  realRoutes: `// src/app/app.routes.ts — THIS APP'S real route table (excerpt).
// Lazy loadComponent for every screen → the initial bundle ships only the shell
// + the landing view. Each route carries a 'title' consumed by the router's
// TitleStrategy so the document title stays in sync.
import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', loadComponent: () => import('./views/home/home')
      .then(m => m.HomeView), title: "Angular developer's guide" },
  { path: 'about', loadComponent: () => import('./views/about/aboutview')
      .then(m => m.AboutView), title: 'About' },
  { path: 'angular-fundamentals', loadComponent: () =>
      import('./views/angular_fundamentals/angular_fundamentalsview')
      .then(m => m.AngularFundamentalsView), title: 'Angular fundamentals' },
  // …every other screen, each lazy-loaded the same way…
  { path: '**', redirectTo: '' },   // wildcard → home (must be LAST)
];`,
  routePaths: `// src/app/layout/route-paths.ts — single source of truth for URLs.
// A const-object + literal union (never enum — this project targets erasable-
// only TypeScript). Screens reference RoutePaths.home instead of string literals.
export const RoutePaths = {
  home: '/',
  about: '/about',
  angularFundamentals: '/angular-fundamentals',
  lifecycle: '/lifecycle',
  navigation: '/navigation-routing',
  // …
} as const;

export type RoutePath = (typeof RoutePaths)[keyof typeof RoutePaths];`,
  lazyAndChildren: `// loadComponent — one component in its own chunk (preferred for leaf screens).
{
  path: 'navigation-routing',
  loadComponent: () => import('./views/navigation/navigationview')
    .then(m => m.NavigationView),
  title: 'Navigation and routing',
}

// loadChildren — a WHOLE child Routes array (use for feature areas that ship
// their own nested <router-outlet> + shared sub-layout). The child module
// exports its own 'routes'.
export const ADMIN_ROUTES: Routes = [
  {
    path: 'admin',
    loadComponent: () => import('./admin/admin-shell').then(m => m.AdminShell),
    // children render into AdminShell's <router-outlet>
    children: [
      { path: 'users', loadComponent: () => import('./admin/users').then(m => m.AdminUsers) },
      { path: 'settings', loadComponent: () => import('./admin/settings').then(m => m.AdminSettings) },
    ],
  },
];

// AdminShell.html — a NESTED outlet is just another <router-outlet> inside the
// parent component. Nesting the routes nests the URL too: /admin/users.
//   <nav>…admin sub-nav…</nav>
//   <router-outlet />   <!-- the matched child renders here -->`,
  dataAndTitle: `// 'title' (string | (route, data) => string) — the router's TitleStrategy
// sets document.title from it. With a custom TitleStrategy you can also read
// route.data for breadcrumbs / page labels.
{
  path: 'users/:id',
  loadComponent: () => import('./user-detail').then(m => m.UserDetail),
  title: 'User detail',
  data: { breadcrumb: 'Users', scope: 'admin' as const },
}

// reading it in the component — route.data is reactive (an Observable),
// commonly converted to a signal:
import { toSignal } from '@angular/core/rxjs-interop';
readonly data = toSignal(this.route.data, {
  initialValue: {} as { breadcrumb?: string; scope?: string },
});`,
  routerLinkActive: `<!-- routerLink — declarative navigation (renders an <a>). routerLinkActive
     adds the given class when the link's target matches the current URL —
     exactly what nav bars need. [routerLinkActiveOptions] = { exact: true }
     avoids '/' matching every path. -->
<a routerLink="/" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }">
  Home
</a>
<a routerLink="/users" routerLinkActive="active">Users</a>

<!-- imperative navigation from a handler — Router.navigate / navigateByUrl.
     Use it when navigation is a side-effect of logic (after login, a form
     submit). Reach for routerLink first; use the imperative API only when
     there is no element to attach the link to. -->
<button type="button" (click)="goHome()">Home</button>

// component
constructor(private router: Router, private route: ActivatedRoute) {}
goHome() {
  this.router.navigate(['/']);               // absolute segments
  this.router.navigateByUrl('/');            // or a URL string
  this.router.navigate(['..'], { relativeTo: this.route }); // relative
  this.router.navigate(['/users', id], {     // dynamic :id
    queryParams: { tab: 'profile' },         // ?tab=profile
    fragment: 'bio',                         // #bio
  });
}`,
  queryParams: `// Reading query params + fragment reactively — ActivatedRoute exposes them
// as Observables; convert to a signal with toSignal (from @angular/core/rxjs-interop).
import { toSignal } from '@angular/core/rxjs-interop';

readonly params = toSignal(this.route.queryParams, { initialValue: {} as Params });
readonly q = computed(() => (this.params()['q'] as string) ?? '');
readonly frag = toSignal(this.route.fragment, { initialValue: null as string | null });

// Writing — Router.navigate on the CURRENT route (relativeTo: this.route) with
// queryParamsHandling: 'merge' preserves the others. Pass null to clear a param.
onFilter(value: string) {
  this.router.navigate([], {
    relativeTo: this.route,
    queryParams: { q: value || null },
    queryParamsHandling: 'merge',
    fragment: 'results',
  });
}

// Declarative alternative — [queryParams] + [fragment] on a routerLink:
//   <a routerLink="/users" [queryParams]="{ q: 'ada' }" fragment="top">…</a>`,
  redirectAndWildcard: `// Redirects — 'redirectTo' + pathMatch. Use 'prefix' (default) for redirecting
// a whole branch, 'full' when the ENTIRE path must match.
{ path: '', redirectTo: 'home', pathMatch: 'full' },   // '' -> /home
{ path: 'old-users', redirectTo: 'users' },            // moved

// Wildcard '**' — catches every unmatched URL. Must be the LAST route (the
// router matches first-wins, so a wildcard earlier would shadow everything).
// This app redirects unknown URLs home so a typo never strands the user:
{ path: '**', redirectTo: '' }`,
  guards: `import {
  CanActivateFn, CanMatchFn, CanDeactivateFn, Router,
} from '@angular/router';
import { inject } from '@angular/core';
import { of } from 'rxjs';

// Modern guards are FUNCTIONS (not classes). Return a boolean | UrlTree |
// Observable/Promise. Each has a specific phase:
//   canMatch        — runs during MATCHING; decides if a route is even eligible.
//   canActivate     — runs after match, before activation; the classic guard.
//   canDeactivate   — runs before LEAVING a route; the only guard that gets
//                     the COMPONENT instance (so it can ask "are you dirty?").

// 1. canMatchFn / canActivateFn — auth gate. Inject your auth service, redirect
//    to /login on failure by returning router.parseUrl('/login').
export const requireAuth: CanMatchFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.isLoggedIn() ? true : router.parseUrl('/login');
};

// 2. canDeactivateFn<T> — receives the component instance. The generic is your
//    component type so you can call its isDirty()/canLeave() method. Returning
//    a boolean | Observable<boolean> lets you wire a confirm dialog.
export const confirmLeave: CanDeactivateFn<EditForm> = (component) => {
  return component.isDirty() ? window.confirm('Discard changes?') : true;
};

// Attach to routes:
{
  path: 'admin',
  canMatch: [requireAuth],                       // 'canActivate' works too
  loadComponent: () => import('./admin').then(m => m.Admin),
},
{
  path: 'edit/:id',
  component: EditForm,
  canDeactivate: [confirmLeave],                 // guards leaving, not entering
}`,
  resolver: `import { ResolveFn } from '@angular/router';
import { inject } from '@angular/core';
import { Observable } from 'rxjs';

// Modern resolvers are FUNCTIONS (ResolveFn<T>). They pre-fetch data BEFORE the
// route activates so the component renders with its data already in hand.
// Resolve through your DI tokens — a view never imports a DTO/DAO/HttpClient.
export const resolvePost: ResolveFn<Observable<Post>> = (route) => {
  const repo = inject(POST_REPOSITORY);          // the DI seam
  const id = route.paramMap.get('id')!;
  return repo.byId(id);                           // resolve to the value
};

// Attach to the route — the resolved value lands in route.data under the key.
{
  path: 'posts/:id',
  resolve: { post: resolvePost },                 // route.data['post']
  loadComponent: () => import('./post-detail').then(m => m.PostDetail),
}

// Reading it in the component (reactive) — route.data is an Observable; the
// resolved value is under the key you used in resolve: {}.
readonly data = toSignal(this.route.data, { initialValue: {} as { post?: Post } });
readonly post = computed(() => this.data()['post']);`,
};
