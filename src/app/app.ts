import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  NavigationEnd,
  Router,
  RouterLink,
  RouterOutlet,
} from '@angular/router';
import { filter } from 'rxjs';
import { ThemeToggle } from '../ui/components/theme-toggle/theme-toggle';
import { RoutePaths } from './layout/route-paths';

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

  /** Reactive current URL, used to show the back arrow on non-home pages. */
  readonly pathname = signal<string>('/');

  /** Mobile drawer open/close state. */
  readonly drawerOpen = signal(false);

  readonly routes = RoutePaths;

  constructor() {
    this.pathname.set(this.router.url);
    this.router.events
      .pipe(
        filter((e): e is NavigationEnd => e instanceof NavigationEnd),
        // Tied to the root component's injection context — the guide's own
        // best-practices screen mandates this over a bare .subscribe().
        takeUntilDestroyed(),
      )
      .subscribe((e) => {
        this.pathname.set(e.urlAfterRedirects);
        this.drawerOpen.set(false);
      });
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
}
