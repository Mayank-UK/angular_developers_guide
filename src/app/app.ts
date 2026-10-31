import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  NavigationCancel,
  NavigationEnd,
  NavigationError,
  NavigationStart,
  Router,
  RouterLink,
  RouterOutlet,
} from '@angular/router';
import { filter } from 'rxjs';
import { ThemeToggle } from '../ui/components/theme-toggle/theme-toggle';
import { initAnalytics, trackEvent } from '../ui/analytics/analytics';
import { initCrashTelemetry } from '../ui/analytics/crash-telemetry';
import { RoutePaths } from './layout/route-paths';

/** The route-progress bar is revealed only after this much pending time, so
 *  instant navigations (already-preloaded chunks, same-view redirects) never
 *  flash it. */
const ROUTE_BAR_REVEAL_MS = 180;

/**
 * App — the root component / app shell. Mirrors the react `<RootLayout/>`:
 * a sticky header (back arrow on sub-pages, page title, About link, hamburger
 * drawer toggle, theme toggle) wrapping a `<router-outlet>`.
 *
 * The drawer is a simple signal toggle for now (mobile-only via CSS).
 */
@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, RouterLink, ThemeToggle],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  /** Reactive current URL, used to show the back arrow on non-home pages. */
  readonly pathname = signal<string>('/');

  /** Mobile drawer open/close state. */
  readonly drawerOpen = signal(false);

  /** True while a lazy-route navigation is pending AND past the reveal delay. */
  readonly routeLoading = signal(false);

  readonly routes = RoutePaths;

  private revealTimer: ReturnType<typeof setTimeout> | null = null;

  /** The router's bootstrap navigation must not flash the bar. With blocking
   *  initialization the bootstrap navigation has often already completed (and
   *  its events been emitted) before this component subscribes, so seed the
   *  flag from the router's state rather than assuming we will see it. */
  private sawFirstNavigationStart = this.router.navigated;

  constructor() {
    // Umami beacon: injected once per document from the root component's
    // init (the shell constructs exactly once per bootstrap). Idempotent,
    // and a complete no-op when the config placeholders were never swapped
    // — dev, test, and CI builds without the Docker build args never see a
    // script tag.
    initAnalytics();

    // Grafana Faro crash-telemetry beacon: same carrier and same unset
    // discipline as the Umami beacon above — a complete no-op unless BOTH
    // Faro placeholder tokens were swapped by the Docker build.
    initCrashTelemetry();

    this.pathname.set(this.router.url);
    this.router.events
      .pipe(
        filter(
          (
            e,
          ): e is
            | NavigationStart
            | NavigationEnd
            | NavigationError
            | NavigationCancel =>
            e instanceof NavigationStart ||
            e instanceof NavigationEnd ||
            e instanceof NavigationError ||
            e instanceof NavigationCancel,
        ),
        // Tied to the root component's injection context — the guide's own
        // best-practices screen mandates this over a bare .subscribe().
        takeUntilDestroyed(),
      )
      .subscribe((e) => {
        if (e instanceof NavigationStart) {
          if (!this.sawFirstNavigationStart) {
            this.sawFirstNavigationStart = true;
            return;
          }
          this.startRoutePending();
          return;
        }
        if (e instanceof NavigationEnd) {
          this.pathname.set(e.urlAfterRedirects);
          this.drawerOpen.set(false);
          this.reportTopicOpen(e.urlAfterRedirects);
        }
        // Settled — success, error, or cancel all hide the bar immediately.
        this.endRoutePending();
      });

    // Deep links / refreshes: when the bootstrap navigation already
    // completed before this component subscribed (see
    // sawFirstNavigationStart), its NavigationEnd was never seen above —
    // report the landed topic directly. Otherwise the subscription
    // delivers the bootstrap NavigationEnd and reports exactly once there.
    if (this.sawFirstNavigationStart) {
      this.reportTopicOpen(this.router.url);
    }

    // The pending reveal timer must never fire into a destroyed component.
    this.destroyRef.onDestroy(() => this.endRoutePending());
  }

  /** Analytics: one topic-open per topic-view activation. The path is the
   *  route URL with query/fragment stripped — the same identifier
   *  copy-code uses, so the events join per topic in the dashboard. Home
   *  is the guide index and About is app chrome — neither is a topic. A
   *  no-op in unconfigured builds. */
  private reportTopicOpen(url: string): void {
    const topic = url.split('?')[0].split('#')[0];
    if (topic === RoutePaths.home || topic === RoutePaths.about) {
      return;
    }
    trackEvent('topic-open', { topic });
  }

  toggleDrawer(): void {
    this.drawerOpen.update((o) => !o);
  }

  closeDrawer(): void {
    this.drawerOpen.set(false);
  }

  goBack(): void {
    this.router.navigateByUrl('/');
  }

  /** A navigation started: (re)start the delayed bar reveal. Restarting on a
   *  second NavigationStart keeps an already-visible bar up without a
   *  flicker (the CSS transition is not retriggered while it stays active). */
  private startRoutePending(): void {
    this.clearRevealTimer();
    this.revealTimer = setTimeout(() => {
      this.revealTimer = null;
      this.routeLoading.set(true);
    }, ROUTE_BAR_REVEAL_MS);
  }

  /** The navigation settled: cancel any pending reveal and hide the bar. */
  private endRoutePending(): void {
    this.clearRevealTimer();
    this.routeLoading.set(false);
  }

  private clearRevealTimer(): void {
    if (this.revealTimer !== null) {
      clearTimeout(this.revealTimer);
      this.revealTimer = null;
    }
  }
}
