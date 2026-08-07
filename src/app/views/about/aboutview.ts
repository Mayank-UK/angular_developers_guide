import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SectionWrapper } from '../../../ui/components/section-wrapper/section-wrapper';
import { ContentGroupWrapper } from '../../../ui/components/content-group-wrapper/content-group-wrapper';
import { TextBlock } from '../../../ui/components/text-block/text-block';
import { CodeBlock } from '../../../ui/components/code-block/code-block';
import { RoutePaths } from '../../layout/route-paths';

/**
 * Coverage area — one card in the "What it covers" grid. Links to a real route
 * in this app so the About screen doubles as a launchpad into the guide.
 */
interface CoverageArea {
  readonly index: string;
  readonly title: string;
  readonly note: string;
  readonly route: string;
}

/**
 * A single tech-stack row, rendered as label + value(s) in a fixed-gutter grid.
 */
interface StackRow {
  readonly label: string;
  readonly value: string;
}

/**
 * AboutView — what this Angular developer's guide is, what it covers, and how
 * it's built.
 *
 * This is a reference application: a hands-on Angular 22 guide that teaches by
 * VISIBLE EXAMPLE — every concept has a rendered live demo next to its source,
 * not just a code listing. It mirrors the sibling `react_developers_guide`
 * concept-for-concept, picking the Angular-idiomatic answer wherever the two
 * ecosystems differ (native DI vs a hand-rolled container, signals + OnPush,
 * functional HttpClient interceptors, the `AppException → Failure → Result<T>`
 * error pipeline).
 *
 * The screen itself is a marketing-card-style surface: stat tiles, a coverage
 * grid that links into the guide, the stack, run commands, and credits. It is
 * the canonical "about" surface for the whole app — and the only content
 * surfaced in the mobile drawer.
 */
@Component({
  selector: 'app-about-view',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, SectionWrapper, ContentGroupWrapper, TextBlock, CodeBlock],
  templateUrl: './about_view.html',
  styleUrl: './about_view.scss',
})
export class AboutView {
  /** Route paths exposed to the template for the coverage grid + credits. */
  readonly routes = RoutePaths;

  /** At-a-glance numbers (kept accurate against the real codebase). */
  readonly stats: readonly Stat[] = [
    { value: '24', label: 'topic screens' },
    { value: '4', label: 'architecture layers' },
    { value: '71+', label: 'tests' },
    { value: '1', label: 'codebase to read' },
  ];

  /** The six areas the guide covers, each linking to its hub/key screen. */
  readonly coverage: readonly CoverageArea[] = [
    {
      index: '01',
      title: 'Fundamentals',
      note: 'Angular + TypeScript/JS basics — components, signals, directives, pipes, generics, async',
      route: RoutePaths.angularFundamentals,
    },
    {
      index: '02',
      title: 'UI & styling',
      note: 'Layout, CSS, Bootstrap, Tailwind, interactive behaviours, responsive, design system',
      route: RoutePaths.ui,
    },
    {
      index: '03',
      title: 'Lifecycle & routing',
      note: 'The eight hooks + signals lifecycle, and the Angular Router end to end',
      route: RoutePaths.lifecycle,
    },
    {
      index: '04',
      title: 'State management',
      note: 'Signals (local), NgRx Store (global), NgRx SignalStore (lightweight), RxJS (server)',
      route: RoutePaths.stateManagement,
    },
    {
      index: '05',
      title: 'Data & error pipeline',
      note: 'API handling, IndexedDB/Dexie, the AppException → Failure → Result pipeline, DI',
      route: RoutePaths.apiHandling,
    },
    {
      index: '06',
      title: 'Engineering',
      note: 'Architecture, testing, debugging, environments, and the best-practices capstone',
      route: RoutePaths.architecture,
    },
  ];

  /** The stack — deliberately standard, nothing exotic. */
  readonly stack: readonly StackRow[] = [
    { label: 'UI / runtime', value: 'Angular 22, TypeScript (strict, erasable-only)' },
    { label: 'Components', value: 'Standalone + OnPush + signals + computed/effect' },
    { label: 'State (local)', value: 'signal / computed / effect / linkedSignal / input() / model()' },
    { label: 'State (global)', value: 'NgRx Store (Redux) + NgRx SignalStore, side by side' },
    { label: 'Server state', value: 'RxJS + HttpClient + functional HttpInterceptorFn' },
    { label: 'Storage', value: 'Dexie (IndexedDB) with an in-memory fallback' },
    { label: 'DI', value: 'Angular native — InjectionToken + providers + inject()' },
    { label: 'Design system', value: 'CSS-variable tokens + ThemeService (data-theme flip)' },
    { label: 'Tooling', value: 'Docker-first; no node_modules on the host' },
    { label: 'Testing', value: 'Vitest via @angular/build:unit-test + TestBed' },
  ];

  /** Docker run / build / test commands (verbatim from README.md). */
  readonly runCommands = `# Dev (HMR on :4200)
docker compose -f .docker/docker-compose.dev.yml up

# Run a one-off command inside the dev container
docker compose -f .docker/docker-compose.dev.yml run --rm app npm test
docker compose -f .docker/docker-compose.dev.yml run --rm app npm run build

# Prod (nginx on host :80, run as non-root nginx)
docker compose -f .docker/docker-compose.prod.yml up`;

  /** The conventions every screen in this app follows. */
  readonly conventions = `• Teach by visible example — every concept ships a rendered live demo
  next to its source, not just a code listing.

• Tokens first — design decisions live in tokens.css and are consumed as
  var(--…); hard-coded colours are a smell, not a shortcut.

• Standalone OnPush + signals everywhere — a signal write IS the
  change-detection trigger; no zone, no markForCheck.

• const-object + literal union, NEVER enum — erasable-only TS compatible.

• The DI seam — a view resolves inject(GET_POSTS_USE_CASE), never a DTO,
  DAO, or HttpClient. Dependencies point inward toward the domain.

• Reuse over rebuild — multi-file → ui/components; single-screen → that
  screen's folder. New screens assemble existing primitives.`;
}

/* -------------------------------------------------------------------------- */
/* Local types                                                                 */
/* -------------------------------------------------------------------------- */

interface Stat {
  readonly value: string;
  readonly label: string;
}
