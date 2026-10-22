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
        }
        // Settled — success, error, or cancel all hide the bar immediately.
        this.endRoutePending();
      });

    // The pending reveal timer must never fire into a destroyed component.
    this.destroyRef.onDestroy(() => this.endRoutePending());
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
