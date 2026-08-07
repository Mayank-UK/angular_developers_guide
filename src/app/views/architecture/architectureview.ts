import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { SectionWrapper } from '../../../ui/components/section-wrapper/section-wrapper';
import { ContentGroupWrapper } from '../../../ui/components/content-group-wrapper/content-group-wrapper';
import { TextBlock } from '../../../ui/components/text-block/text-block';
import { CodeBlock } from '../../../ui/components/code-block/code-block';
import { Example } from '../../../ui/components/example/example';

/**
 * ArchitectureView — the bird's-eye view of how THIS app's code is organised
 * so it stays maintainable. The companion to ARCHITECTURE.md.
 *
 * "Architecture" here is the rule about which code may depend on which other
 * code. The app separates concerns into four layers — `domain`, `data`,
 * `core`, `ui` — and points every dependency one direction (inward, toward the
 * domain), with Angular's native DI as the single seam that lets the outer
 * `ui` layer reach `data` without taking a hard dependency on it. The payoff is
 * that each layer can change, be swapped, or be tested without the others
 * moving: the UI does not know whether posts come from a REST API or a fake,
 * the domain does not know it is running in a browser, and the data layer can
 * be exercised against an in-memory fake without rendering a component.
 *
 * This screen is the map; every other screen (API handling, Database handling,
 * Exception handling, Dependency management) is a deep-dive into one seam.
 * Every code excerpt below is the REAL source in src/domain + src/data +
 * src/core + src/app.
 *
 * NOTE: the exported `ArchitectureView` is declared at the BOTTOM of this file.
 * Its `imports` reference local helper components (LayerExplorer, ImportChecker,
 * RequestTracer) that are block-scoped declarations — the main component must
 * come AFTER every helper it names so its decorator does not read an
 * uninitialized binding at module-evaluation time (the TDZ rule the other view
 * screens follow).
 */

/* -------------------------------------------------------------------------- */
/* Shared layer vocabulary (const-object + literal union — NEVER enum).       */
/* -------------------------------------------------------------------------- */

/** The four layers, innermost-first as the dependency rule sees them. */
const LAYERS = {
  domain: 'domain',
  core: 'core',
  data: 'data',
  ui: 'ui',
} as const;
type Layer = (typeof LAYERS)[keyof typeof LAYERS];

/** One layer per card in the explorer. */
interface LayerInfo {
  key: Layer;
  name: string;
  owns: string;
  mayDepend: string;
  mayNotDepend: string;
  files: readonly string[];
}

const LAYER_INFO: Record<Layer, LayerInfo> = {
  domain: {
    key: LAYERS.domain,
    name: 'domain/',
    owns:
      'Enterprise rules — the models (Post), the repository contracts (PostRepository interface), and the use cases (GetPostsUseCase). The "what the business is" layer.',
    mayDepend:
      "Only core/'s pure types — Result<T> and the Failure classes. No framework, no browser API, no Angular.",
    mayNotDepend:
      'data/, ui/, @angular/*, HttpClient, Dexie — anything concrete or platform-specific.',
    files: [
      'domain/models/post.ts',
      'domain/models/link.ts',
      'domain/repositories/post-repository.ts',
      'domain/usecases/get-posts-usecase.ts',
    ],
  },
  core: {
    key: LAYERS.core,
    name: 'core/',
    owns:
      'The shared kernel every layer uses — Result<T>, the exception→failure pipeline, config, scenario, and the InjectionTokens (the DI seam).',
    mayDepend:
      'Pure core has no deps. core/di imports @angular/core (for InjectionToken) and references the domain contracts via TYPE-ONLY imports — no runtime coupling.',
    mayNotDepend:
      'ui/, and the data concretes. The composition root (provideData in data/providers.ts) is the one place allowed to know about both.',
    files: [
      'core/result.ts',
      'core/error-handling/{exceptions,failure,guards}.ts',
      'core/config/{app-config,logger}.ts',
      'core/scenario/scenario.service.ts',
      'core/di/tokens.ts  ← the DI seam',
    ],
  },
  data: {
    key: LAYERS.data,
    name: 'data/',
    owns:
      'The implementations of the domain contracts — remote source (HttpClient + DTOs), local store (Dexie + DAOs), the offline-first PostRepositoryImpl, and the dev fakes.',
    mayDepend:
      'domain/ (models + contracts), core/ (guards, result, logger, tokens). Owns ALL framework imports (HttpClient, Dexie, RxJS).',
    mayNotDepend:
      'ui/. It must stay unaware that a screen exists — no component, no template, no signal the UI owns.',
    files: [
      'data/remote/{post-api.service,post-dto,retry.interceptor}.ts',
      'data/local/{app-database,post-dao}.ts',
      'data/repositories/post-repository-impl.ts',
      'data/fake/{fake-api-service,fake-app-database}.ts',
      'data/providers.ts  ← provideData(config) composition root',
    ],
  },
  ui: {
    key: LAYERS.ui,
    name: 'ui/ (+ app/)',
    owns:
      'Presentation — screens (app/views), shared presentational primitives (ui/components), and the design system (tokens + ThemeService). Owns the DOM and Angular templates.',
    mayDepend:
      'domain/ (use cases, models) and core/ (tokens, Failure, Result). It resolves data services through inject(TOKEN) — never by importing a concrete.',
    mayNotDepend:
      'data/ concretes. A view never imports PostRepositoryImpl, PostApiService, a DTO, PostDAO, or HttpClient. It depends on the contract, filled by DI.',
    files: [
      'app/views/<screen>/<screen>view.ts',
      'ui/components/* (shared presentational primitives)',
      'ui/design-system/tokens.css',
      'app/app.config.ts (bootstrap providers)',
      'app/app.routes.ts (lazy loadComponent table)',
    ],
  },
};

const LAYER_ORDER: readonly Layer[] = [
  LAYERS.domain,
  LAYERS.core,
  LAYERS.data,
  LAYERS.ui,
];

/* -------------------------------------------------------------------------- */
/* Local live demos — declared BEFORE the exported view (TDZ rule).           */
/* -------------------------------------------------------------------------- */

/**
 * LayerExplorer — CENTERPIECE #1. The dependency rule as a clickable contract.
 * Selecting a layer card shows what it owns, what it may depend on, what it is
 * forbidden from depending on, and the real files in it. The "may NOT depend
 * on" line is the rule that keeps the architecture from rotting.
 */
@Component({
  selector: 'app-arch-layer-explorer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [],
  template: `
    <div class="explorer">
      <div class="cards">
        @for (layer of order; track layer) {
          <button
            type="button"
            class="card"
            [class.is-active]="selected() === layer"
            (click)="select(layer)"
          >
            <span class="card-name">{{ info(layer).name }}</span>
            <span class="card-hint">
              {{ selected() === layer ? 'selected' : 'tap to view' }}
            </span>
          </button>
        }
      </div>

      @if (info(selected()); as l) {
        <div class="contract">
          <div class="field">
            <p class="field-label">Owns</p>
            <p class="field-value">{{ l.owns }}</p>
          </div>
          <div class="field field--allow">
            <p class="field-label">May depend on</p>
            <p class="field-value">{{ l.mayDepend }}</p>
          </div>
          <div class="field field--deny">
            <p class="field-label">May NOT depend on</p>
            <p class="field-value">{{ l.mayNotDepend }}</p>
          </div>
          <div class="files">
            <p class="field-label">Real files</p>
            <div class="file-list">
              @for (f of l.files; track f) {
                <span class="file">{{ f }}</span>
              }
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .explorer {
        display: flex;
        flex-direction: column;
        gap: var(--space-sm);
      }
      .cards {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
        gap: var(--space-xs);
      }
      .card {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: var(--space-xxs);
        padding: var(--space-sm);
        border: 1px solid var(--color-outline);
        border-radius: var(--radius-md);
        background: var(--color-surface-variant);
        text-align: left;
        cursor: pointer;
        transition:
          border-color 120ms ease,
          background 120ms ease;
      }
      .card:hover {
        background: var(--color-surface);
      }
      .card.is-active {
        border-color: var(--color-primary);
        background: var(--color-surface);
        box-shadow: var(--shadow-button-card);
      }
      .card-name {
        font-family: var(--font-mono);
        font-size: var(--text-body-sm);
        font-weight: 600;
        color: var(--color-on-surface);
      }
      .card.is-active .card-name {
        color: var(--color-primary);
      }
      .card-hint {
        font-size: var(--text-caption);
        color: var(--color-on-surface-variant);
      }
      .contract {
        display: flex;
        flex-direction: column;
        gap: var(--space-sm);
        padding: var(--space-md);
        border: 1px solid var(--color-outline);
        border-radius: var(--radius-md);
        background: var(--color-surface);
      }
      .field {
        display: flex;
        flex-direction: column;
        gap: var(--space-xxs);
        border-left: 3px solid transparent;
        padding-left: var(--space-sm);
      }
      .field--allow {
        border-left-color: var(--color-secondary);
      }
      .field--deny {
        border-left-color: var(--color-critical);
      }
      .field-label {
        margin: 0;
        font-size: var(--text-overline);
        font-weight: 600;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--color-on-surface-variant);
      }
      .field-value {
        margin: 0;
        font-size: var(--text-body-sm);
        line-height: 1.6;
        color: var(--color-on-surface);
      }
      .files {
        display: flex;
        flex-direction: column;
        gap: var(--space-xs);
      }
      .file-list {
        display: flex;
        flex-direction: column;
        gap: var(--space-xxs);
        padding: var(--space-sm);
        border-radius: var(--radius-md);
        background: var(--color-surface-variant);
      }
      .file {
        font-family: var(--font-mono);
        font-size: var(--text-caption);
        color: var(--color-on-surface);
      }
    `,
  ],
})
class LayerExplorer {
  private readonly _selected = signal<Layer>(LAYERS.domain);
  readonly selected = this._selected.asReadonly();
  readonly order = LAYER_ORDER;

  info(layer: Layer): LayerInfo {
    return LAYER_INFO[layer];
  }

  select(layer: Layer): void {
    this._selected.set(layer);
  }
}

/* -------------------------------------------------------------------------- */
/* CENTERPIECE #2 — the import-rule checker.                                  */
/* -------------------------------------------------------------------------- */

/** Maps an import path to the layer/category it belongs to. Pure. */
function categoriseImport(rawPath: string): Layer | 'angular' | 'external' {
  // Strip relative prefixes ('./', '../') so paths from anywhere resolve.
  const path = rawPath.replace(/^(\.\.\/)+/, '').replace(/^\.\//, '');
  if (path.startsWith('domain/')) return LAYERS.domain;
  if (path.startsWith('data/')) return LAYERS.data;
  if (path.startsWith('core/')) return LAYERS.core;
  if (path.startsWith('ui/') || path.startsWith('app/')) return LAYERS.ui;
  if (
    path.startsWith('@angular/') ||
    path.startsWith('rxjs') ||
    path.startsWith('dexie') ||
    path.startsWith('@ngrx/')
  ) {
    return 'angular';
  }
  return 'external';
}

interface Verdict {
  legal: boolean;
  reason: string;
}

/**
 * The dependency rule encoded as a pure function. Given the layer of the FILE
 * doing the importing and the path it imports, decide legality.
 *
 * Invariant being enforced (from ARCHITECTURE.md): dependencies point inward
 * toward the domain; the domain is framework-free; ui reaches data ONLY through
 * the DI tokens in core/di (never by importing a concrete).
 */
function classifyImport(sourceLayer: Layer, rawPath: string): Verdict {
  const category = categoriseImport(rawPath);

  // No layer may import from ui/ (presentation is the outermost shell).
  if (category === LAYERS.ui && sourceLayer !== LAYERS.ui) {
    return {
      legal: false,
      reason: `ui/ is the outermost shell — ${sourceLayer}/ may not depend on a screen, component, or template. Outer layers must not be seen by inner ones.`,
    };
  }

  switch (sourceLayer) {
    case LAYERS.domain: {
      // domain depends ONLY on core's pure types (Result + Failure). No Angular,
      // no data, no ui.
      if (category === LAYERS.core) {
        const pure =
          rawPath.includes('core/result') ||
          rawPath.includes('core/error-handling/failure');
        return pure
          ? {
              legal: true,
              reason: 'core pure type (Result<T> / Failure) — the single outward dependency domain is allowed.',
            }
          : {
              legal: false,
              reason: 'That core module imports Angular (e.g. core/di/tokens). Domain must stay framework-free — depend only on core/result + core/error-handling/failure.',
            };
      }
      if (category === LAYERS.data) {
        return {
          legal: false,
          reason: 'data/ is OUTER than domain — domain must not know how it is fetched or stored. This is the seam inversion that keeps domain portable.',
        };
      }
      if (category === 'angular' || category === 'external') {
        return {
          legal: false,
          reason: `Domain is framework-free. ${category === 'angular' ? 'Angular / RxJS / Dexie' : 'Third-party'} imports are forbidden here — domain must run unchanged in Node, a worker, or a test.`,
        };
      }
      return { legal: true, reason: 'Same layer — domain importing domain.' };
    }

    case LAYERS.core: {
      if (category === LAYERS.data) {
        return {
          legal: false,
          reason: 'core/ must not know about data implementations. The composition root (data/providers.ts) is the one place allowed to wire concretes, not core.',
        };
      }
      if (category === LAYERS.domain) {
        return {
          legal: true,
          reason: 'Domain contract referenced via a TYPE-ONLY import (core/di/tokens does this) — no runtime coupling.',
        };
      }
      return {
        legal: true,
        reason: 'Angular / own / external — core is the shared kernel and may use the platform.',
      };
    }

    case LAYERS.data: {
      if (category === LAYERS.ui) {
        return {
          legal: false,
          reason: 'data/ must stay unaware that a screen exists. Data flows up through Result<T>, never by importing a component.',
        };
      }
      return {
        legal: true,
        reason: 'domain/ (inward) + core/ + framework — exactly what data is allowed to depend on.',
      };
    }

    case LAYERS.ui: {
      if (category === LAYERS.data) {
        return {
          legal: false,
          reason: 'A view must NOT import a data concrete (repository impl, DTO, DAO, HttpClient). Resolve it through inject(POST_REPOSITORY) / inject(GET_POSTS_USE_CASE) — the DI seam.',
        };
      }
      return {
        legal: true,
        reason: 'domain/ (inward) + core/ (tokens, Failure, Result) + the platform — ui may use all of these directly.',
      };
    }
  }
}

/** A sample import line the checker can classify. */
interface SampleImport {
  readonly id: string;
  readonly label: string;
  readonly code: string;
  readonly path: string;
}

/** Realistic sample imports drawn from this app's actual modules. */
const SAMPLE_IMPORTS: readonly SampleImport[] = [
  {
    id: 'domain-core-result',
    label: 'domain → core/result',
    code: `import type { Result } from '../../core/result';`,
    path: '../../core/result',
  },
  {
    id: 'domain-data-dto',
    label: 'domain → data/remote/post-dto',
    code: `import { dtoToPost } from '../../data/remote/post-dto';`,
    path: '../../data/remote/post-dto',
  },
  {
    id: 'domain-angular',
    label: 'domain → @angular/core',
    code: `import { Injectable } from '@angular/core';`,
    path: '@angular/core',
  },
  {
    id: 'data-domain-post',
    label: 'data → domain/models/post',
    code: `import type { Post } from '../../domain/models/post';`,
    path: '../../domain/models/post',
  },
  {
    id: 'data-ui',
    label: 'data → ui/components',
    code: `import { SectionWrapper } from '../../ui/components/section-wrapper/section-wrapper';`,
    path: '../../ui/components/section-wrapper/section-wrapper',
  },
  {
    id: 'core-data-impl',
    label: 'core → data/repositories',
    code: `import { PostRepositoryImpl } from '../../data/repositories/post-repository-impl';`,
    path: '../../data/repositories/post-repository-impl',
  },
  {
    id: 'ui-domain-usecase',
    label: 'ui → domain/usecases (type)',
    code: `import type { GetPostsUseCase } from '../../../domain/usecases/get-posts-usecase';`,
    path: '../../../domain/usecases/get-posts-usecase',
  },
  {
    id: 'ui-core-token',
    label: 'ui → core/di/tokens',
    code: `import { GET_POSTS_USE_CASE } from '../../../core/di/tokens';`,
    path: '../../../core/di/tokens',
  },
  {
    id: 'ui-data-repo',
    label: 'ui → data/repositories (impl)',
    code: `import { PostRepositoryImpl } from '../../../data/repositories/post-repository-impl';`,
    path: '../../../data/repositories/post-repository-impl',
  },
  {
    id: 'ui-data-dto',
    label: 'ui → data/remote/post-dto',
    code: `import type { PostDTO } from '../../../data/remote/post-dto';`,
    path: '../../../data/remote/post-dto',
  },
  {
    id: 'data-http',
    label: 'data → @angular/common/http',
    code: `import { HttpClient } from '@angular/common/http';`,
    path: '@angular/common/http',
  },
  {
    id: 'ui-http',
    label: 'ui → @angular/common/http',
    code: `import { HttpClient } from '@angular/common/http';`,
    path: '@angular/common/http',
  },
];

@Component({
  selector: 'app-arch-import-checker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [],
  template: `
    <div class="checker">
      <div class="source">
        <p class="source-label">
          You are editing a file in layer:
        </p>
        <div class="source-chips">
          @for (layer of order; track layer) {
            <button
              type="button"
              class="chip"
              [class.is-active]="sourceLayer() === layer"
              (click)="pick(layer)"
            >
              {{ layer }}/
            </button>
          }
        </div>
        <p class="source-hint">
          {{ info(sourceLayer()).mayDepend }}
        </p>
      </div>

      <div class="rows">
        @for (s of samples; track s.id) {
          @let v = verdict(s);
          <div class="row" [class.is-legal]="v.legal" [class.is-illegal]="!v.legal">
            <div class="row-head">
              <span class="badge">{{ v.legal ? 'LEGAL' : 'ILLEGAL' }}</span>
              <span class="row-label">{{ s.label }}</span>
            </div>
            <pre class="row-code"><code>{{ s.code }}</code></pre>
            <p class="row-reason">{{ v.reason }}</p>
          </div>
        }
      </div>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .checker {
        display: flex;
        flex-direction: column;
        gap: var(--space-md);
      }
      .source {
        display: flex;
        flex-direction: column;
        gap: var(--space-xs);
        padding: var(--space-sm) var(--space-md);
        border: 1px solid var(--color-outline);
        border-radius: var(--radius-md);
        background: var(--color-surface-variant);
      }
      .source-label {
        margin: 0;
        font-size: var(--text-overline);
        font-weight: 600;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--color-on-surface-variant);
      }
      .source-chips {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-xs);
      }
      .chip {
        padding: var(--space-xxs) var(--space-sm);
        border: 1px solid var(--color-outline);
        border-radius: var(--radius-pill);
        background: var(--color-surface);
        font-family: var(--font-mono);
        font-size: var(--text-caption);
        color: var(--color-on-surface);
        cursor: pointer;
        transition: all 120ms ease;
      }
      .chip:hover {
        border-color: var(--color-on-surface-variant);
      }
      .chip.is-active {
        border-color: var(--color-primary);
        color: var(--color-primary);
        background: var(--color-surface);
      }
      .source-hint {
        margin: 0;
        font-size: var(--text-caption);
        line-height: 1.6;
        color: var(--color-on-surface-variant);
      }
      .rows {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
        gap: var(--space-xs);
      }
      .row {
        display: flex;
        flex-direction: column;
        gap: var(--space-xxs);
        padding: var(--space-sm);
        border: 1px solid var(--color-outline);
        border-left-width: 3px;
        border-radius: var(--radius-md);
        background: var(--color-surface);
      }
      .row.is-legal {
        border-left-color: var(--color-secondary);
      }
      .row.is-illegal {
        border-left-color: var(--color-critical);
      }
      .row-head {
        display: flex;
        align-items: center;
        gap: var(--space-xs);
      }
      .badge {
        padding: var(--space-xxs) var(--space-xs);
        border-radius: var(--radius-pill);
        font-size: var(--text-overline);
        font-weight: 700;
        letter-spacing: 0.06em;
      }
      .is-legal .badge {
        background: var(--color-secondary);
        color: var(--color-on-secondary);
      }
      .is-illegal .badge {
        background: var(--color-critical);
        color: var(--color-on-error);
      }
      .row-label {
        font-family: var(--font-mono);
        font-size: var(--text-caption);
        color: var(--color-on-surface-variant);
      }
      .row-code {
        margin: 0;
        padding: var(--space-xs) var(--space-sm);
        border-radius: var(--radius-sm);
        background: var(--color-surface-variant);
        font-family: var(--font-mono);
        font-size: var(--text-caption);
        line-height: 1.5;
        color: var(--color-on-surface);
        overflow-x: auto;
        white-space: pre;
      }
      .row-reason {
        margin: 0;
        font-size: var(--text-caption);
        line-height: 1.6;
        color: var(--color-on-surface-variant);
      }
    `,
  ],
})
class ImportChecker {
  readonly order = LAYER_ORDER;
  readonly samples = SAMPLE_IMPORTS;
  private readonly _sourceLayer = signal<Layer>(LAYERS.ui);
  readonly sourceLayer = this._sourceLayer.asReadonly();

  info(layer: Layer): LayerInfo {
    return LAYER_INFO[layer];
  }

  pick(layer: Layer): void {
    this._sourceLayer.set(layer);
  }

  verdict(sample: SampleImport): Verdict {
    return classifyImport(this._sourceLayer(), sample.path);
  }
}

/* -------------------------------------------------------------------------- */
/* CENTERPIECE #3 — the request-flow tracer.                                  */
/* -------------------------------------------------------------------------- */

interface TraceStep {
  readonly layer: Layer;
  readonly title: string;
  readonly file: string;
  readonly detail: string;
}

const SUCCESS_STEPS: readonly TraceStep[] = [
  {
    layer: LAYERS.ui,
    title: 'User action → component method',
    file: 'app/views/<screen>view.ts',
    detail:
      'A (click) handler calls fetch(). The component calls inject(GET_POSTS_USE_CASE).execute() and stores the Result in a signal.',
  },
  {
    layer: LAYERS.domain,
    title: 'Use case',
    file: 'domain/usecases/get-posts-usecase.ts',
    detail:
      'GetPostsUseCase.execute() delegates to the repository contract — a one-liner today, the seam where future policy (caching rules, combining repos) will live.',
  },
  {
    layer: LAYERS.domain,
    title: 'Repository contract',
    file: 'domain/repositories/post-repository.ts',
    detail:
      'The component depends on this interface (getPosts(): Promise<Result<Post[]>>), resolved via the POST_REPOSITORY token — never on the implementation.',
  },
  {
    layer: LAYERS.data,
    title: 'Repository implementation',
    file: 'data/repositories/post-repository-impl.ts',
    detail:
      'PostRepositoryImpl orchestrates: fetch remote, write-through to cache, fall back to cache on failure (the offline-first pattern).',
  },
  {
    layer: LAYERS.data,
    title: 'Remote + local sources',
    file: 'data/remote/post-api.service.ts · data/local/post-dao.ts',
    detail:
      'PostApiService (HttpClient + DTOs) and AppDatabase/PostDAO (Dexie/IndexedDB) — the only place frameworks appear. DTOs are mapped to domain Post HERE.',
  },
  {
    layer: LAYERS.core,
    title: 'Result returned up the stack',
    file: 'core/result.ts · core/error-handling/guards.ts',
    detail:
      'safeRepositoryCall wraps the call; success({ ok: true, value }) travels back up — never a thrown exception crossing the boundary.',
  },
  {
    layer: LAYERS.ui,
    title: 'Render',
    file: 'component template (@switch on result.ok)',
    detail:
      'The component sets a signal from the Result; @switch renders the post list on Success or <ui-show-error/> on Failed — no try/catch in the view.',
  },
];

const FAILURE_THROW: TraceStep = {
  layer: LAYERS.data,
  title: 'Remote throws',
  file: 'data/remote/post-api.service.ts',
  detail:
    'The remote call rejects with a typed AppException (NetworkException) instead of returning posts.',
};

const FAILURE_INSERT: TraceStep = {
  layer: LAYERS.core,
  title: 'Exception → Failure at the boundary',
  file: 'core/error-handling/guards.ts',
  detail:
    'mapExceptionToFailure maps the AppException to a Failure with a severity. Result.Failed travels up. The UI branches: blocking <ui-show-error/> or a non-blocking banner — no try/catch in the component.',
};

@Component({
  selector: 'app-arch-request-tracer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [],
  template: `
    <div class="tracer">
      <div class="controls">
        <button
          type="button"
          class="btn btn--primary"
          (click)="run()"
          [disabled]="running()"
        >
          {{ active() === -1 ? 'Run request' : 'Re-run' }}
        </button>
        <button type="button" class="btn" (click)="reset()">Reset</button>
        <label class="toggle">
          <input
            type="checkbox"
            [checked]="injectFailure()"
            (change)="toggleFailure($event)"
          />
          <span>inject a network failure</span>
        </label>
      </div>

      <ol class="steps">
        @for (step of steps(); track $index) {
          @let i = $index;
          @let done = i <= active();
          @let isActive = i === active();
          <li
            class="step"
            [class.is-active]="isActive"
            [class.is-done]="done && !isActive"
            [class.is-pending]="!done"
          >
            <div class="step-head">
              <span class="step-no" [class.is-done]="done">
                {{ done ? '✓' : i + 1 }}
              </span>
              <span class="step-layer">{{ step.layer }}/</span>
              <span class="step-title">{{ step.title }}</span>
            </div>
            <span class="step-file">{{ step.file }}</span>
            @if (isActive) {
              <span class="step-detail">{{ step.detail }}</span>
            }
          </li>
        }
      </ol>

      <p class="caption">{{ caption() }}</p>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .tracer {
        display: flex;
        flex-direction: column;
        gap: var(--space-md);
      }
      .controls {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: var(--space-xs);
      }
      .btn {
        padding: var(--space-xxs) var(--space-sm);
        border: 1px solid var(--color-outline);
        border-radius: var(--radius-md);
        background: var(--color-surface);
        color: var(--color-on-surface);
        font-size: var(--text-body-sm);
        cursor: pointer;
        transition: background 120ms ease;
      }
      .btn:hover {
        background: var(--color-surface-variant);
      }
      .btn--primary {
        border-color: var(--color-primary);
        background: var(--color-primary);
        color: var(--color-on-primary);
      }
      .btn--primary:hover {
        background: var(--color-primary-container);
      }
      .btn--primary:disabled {
        opacity: 0.5;
        cursor: default;
      }
      .toggle {
        display: inline-flex;
        align-items: center;
        gap: var(--space-xs);
        margin-left: var(--space-xs);
        font-size: var(--text-caption);
        color: var(--color-on-surface-variant);
      }
      .toggle input {
        accent-color: var(--color-primary);
      }
      .steps {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: var(--space-xs);
      }
      .step {
        display: flex;
        flex-direction: column;
        gap: var(--space-xxs);
        padding: var(--space-sm);
        border: 1px solid var(--color-outline);
        border-radius: var(--radius-md);
        background: var(--color-surface-variant);
        transition: all 180ms ease;
      }
      .step.is-pending {
        opacity: 0.55;
      }
      .step.is-done {
        background: var(--color-surface);
        border-color: var(--color-outline);
      }
      .step.is-active {
        background: var(--color-surface);
        border-color: var(--color-primary);
        box-shadow: var(--shadow-button-card);
      }
      .step-head {
        display: flex;
        align-items: center;
        gap: var(--space-sm);
      }
      .step-no {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 20px;
        height: 20px;
        border: 1px solid var(--color-outline);
        border-radius: var(--radius-pill);
        font-family: var(--font-mono);
        font-size: 11px;
        color: var(--color-on-surface-variant);
        flex-shrink: 0;
      }
      .step-no.is-done {
        border-color: var(--color-primary);
        background: var(--color-primary);
        color: var(--color-on-primary);
      }
      .step-layer {
        font-family: var(--font-mono);
        font-size: var(--text-caption);
        font-weight: 600;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: var(--color-on-surface-variant);
      }
      .is-active .step-layer {
        color: var(--color-primary);
      }
      .step-title {
        font-size: var(--text-body-sm);
        font-weight: 600;
        color: var(--color-on-surface);
      }
      .step-file {
        padding-left: 28px;
        font-family: var(--font-mono);
        font-size: var(--text-caption);
        color: var(--color-on-surface-variant);
      }
      .step-detail {
        padding-left: 28px;
        font-size: var(--text-body-sm);
        line-height: 1.6;
        color: var(--color-on-surface);
      }
      .caption {
        margin: 0;
        font-size: var(--text-caption);
        color: var(--color-on-surface-variant);
      }
    `,
  ],
})
class RequestTracer {
  private readonly _active = signal(-1);
  private readonly _running = signal(false);
  private readonly _injectFailure = signal(false);
  private timer: ReturnType<typeof setTimeout> | null = null;
  private readonly destroyRef = inject(DestroyRef);

  readonly active = this._active.asReadonly();
  readonly running = this._running.asReadonly();
  readonly injectFailure = this._injectFailure.asReadonly();

  constructor() {
    // If the component is unmounted mid-trace, cancel the pending tick so the
    // recursive setTimeout chain doesn't fire on a destroyed instance.
    this.destroyRef.onDestroy(() => {
      if (this.timer) clearTimeout(this.timer);
    });
  }

  /** Steps depend on the inject-failure toggle (inserts the throw + boundary). */
  readonly steps = computed<readonly TraceStep[]>(() => {
    if (this._injectFailure()) {
      return [
        ...SUCCESS_STEPS.slice(0, 4),
        FAILURE_THROW,
        FAILURE_INSERT,
        ...SUCCESS_STEPS.slice(6),
      ];
    }
    return SUCCESS_STEPS;
  });

  readonly caption = computed(() => {
    const active = this._active();
    const steps = this.steps();
    if (active === -1) {
      return 'Press "Run request" to walk the request down through ui → domain → data → core and back.';
    }
    if (active >= steps.length - 1) {
      return this._injectFailure()
        ? 'Done — the exception was caught at the boundary and returned as a Failure; the UI rendered the error treatment without a try/catch.'
        : 'Done — the posts returned as a Success and rendered. No layer knew about the ones below its contract.';
    }
    return `Crossing the ${steps[active]?.layer ?? '?'}/ boundary…`;
  });

  run(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this._active.set(0);
    this._running.set(true);
    this.tick();
  }

  reset(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this._running.set(false);
    this._active.set(-1);
  }

  toggleFailure(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this._injectFailure.set(checked);
    this.reset();
  }

  private tick(): void {
    if (!this._running()) return;
    const steps = this.steps();
    if (this._active() >= steps.length - 1) {
      this._running.set(false);
      return;
    }
    this.timer = setTimeout(() => {
      this._active.update((a) => a + 1);
      this.tick();
    }, 850);
  }
}

/* -------------------------------------------------------------------------- */
/* The exported view — declared AFTER the local demos (TDZ rule).             */
/* -------------------------------------------------------------------------- */

@Component({
  selector: 'app-architecture-view',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    SectionWrapper,
    ContentGroupWrapper,
    TextBlock,
    CodeBlock,
    Example,
    LayerExplorer,
    ImportChecker,
    RequestTracer,
  ],
  templateUrl: './architecture_view.html',
  styleUrl: './architecture_view.scss',
})
export class ArchitectureView {
  /** Code listings rendered by the page's CodeBlocks (REAL source excerpts). */
  readonly snippets = SNIPPETS;
}

/* -------------------------------------------------------------------------- */
/* Code listings shown in the page's <ui-code-block> elements.                */
/* All excerpts are the REAL source in src/domain + src/data + src/core.      */
/* -------------------------------------------------------------------------- */

const SNIPPETS = {
  layerMap: `domain/   enterprise rules — models, repository contracts (interfaces), use cases
data/     the implementations of those contracts — remote, local, DTOs, DAOs, fakes
core/     shared kernel — Result<T>, the exception→failure pipeline, config, DI tokens
ui/       presentation — views (app/views/), components, design system (+ app/ shell)`,
  layerOneLiners: `domain  → "what a Post IS, and what the app can do with one"
data    → "how posts are actually fetched and stored"
core    → "the plumbing every layer shares (Result, errors, the DI tokens)"
ui      → "what the user sees and how they drive those actions"`,
  depRuleAscii: `        ┌──────────────────────────────────────────────┐
        │  ui/  +  app/   (views, components, design system) │  talks to use cases
        │    └───────────────────────────────────────────┘  │  + resolves via inject()
        │       ┌─────────────────────────────────────┐     │
        │       │  data/  (impls: remote, local, fake)│     │  implements domain contracts
        │       │    └───────────────────────────────┘ │     │  owns ALL framework imports
        │       │       ┌─────────────────────────┐    │     │
        │       │       │  core/  (Result, errors, │    │     │  shared kernel underpinning
        │       │       │  config, the DI tokens)  │    │     │  every layer above
        │       │       │    └───────────────────┐ │    │     │
        │       │       │    │ domain/ (models,  │ │    │     │  depends on NOTHING outside
        │       │       │    │ contracts, usecases)│ │    │     │  core's pure Result/Failure
        │       │       │    └───────────────────┘ │    │     │
        │       │       └─────────────────────────┘    │     │
        │       └─────────────────────────────────────┘     │
        └──────────────────────────────────────────────┘
   dependency direction: every arrow points INWARD, toward the domain.
   the ONE escape hatch: ui → data only through the DI tokens in core/di.`,
  folderTree: `src/
├── domain/                      # enterprise rules — plain TS, no framework
│   ├── models/                  #   Post, Link (the nouns of the business)
│   ├── repositories/            #   PostRepository INTERFACE (the contract)
│   └── usecases/                #   GetPostsUseCase (the verbs of the business)
│
├── data/                        # implementations of domain contracts
│   ├── remote/                  #   post-api.service, post-dto, retry.interceptor
│   ├── local/                   #   app-database contract, post-dao (Dexie/IndexedDB)
│   ├── repositories/            #   PostRepositoryImpl (orchestrates remote + local)
│   └── fake/                    #   FakeApiService, FakeAppDatabase (dev/test stand-ins)
│
├── core/                        # shared kernel + the DI seam
│   ├── result.ts                #   Result<T> = Success<T, warning?> | Failed
│   ├── error-handling/          #   exceptions → guards → failures (chained, severity)
│   ├── config/                  #   AppConfig, Logger
│   ├── scenario/                #   dev knobs for failure injection (ScenarioService)
│   └── di/tokens.ts             #   APP_CONFIG / POST_REPOSITORY / GET_POSTS_USE_CASE
│
├── app/                         # the application shell + routing + screen folders
│   ├── app.config.ts            #   providers: router, HttpClient, provideData(config)
│   ├── app.routes.ts            #   lazy loadComponent route table
│   ├── layout/                  #   route-path constants
│   └── views/                   #   one folder per topic screen
│
└── ui/                          # presentation primitives (consumed by app/views)
    ├── components/              #   shared presentational pieces (standalone, OnPush)
    └── design-system/           #   tokens.css (CSS vars) + ThemeService signal`,
  tokensExcerpt: `// src/core/di/tokens.ts — the DI seam. core/ may import @angular/core; the
// domain layer must stay framework-free, so the tokens reference the domain
// contracts via TYPE-ONLY imports (no runtime coupling).
import { InjectionToken } from '@angular/core';
import type { AppConfig } from '../config/app-config';
import type { PostRepository } from '../../domain/repositories/post-repository';
import type { GetPostsUseCase } from '../../domain/usecases/get-posts-usecase';

export const APP_CONFIG = new InjectionToken<AppConfig>('APP_CONFIG');
export const POST_REPOSITORY = new InjectionToken<PostRepository>('POST_REPOSITORY');
export const GET_POSTS_USE_CASE = new InjectionToken<GetPostsUseCase>('GET_POSTS_USE_CASE');`,
  usecaseExcerpt: `// src/domain/usecases/get-posts-usecase.ts — pure TS, framework-free.
// A thin orchestration layer over the repository. The value is the SEAM: this
// is where future cross-cutting policy (caching rules, combining repos, business
// rules) will live, keeping repositories focused on a single source.
import type { Post } from '../models/post';
import type { Result } from '../../core/result';
import type { PostRepository } from '../repositories/post-repository';

export class GetPostsUseCase {
  constructor(private readonly repository: PostRepository) {}

  execute(): Promise<Result<Post[]>> {
    return this.repository.getPosts();
  }
}`,
  repoContractExcerpt: `// src/domain/repositories/post-repository.ts — the CONTRACT. The UI / use cases
// depend on this interface, never on the implementation. Framework-free.
import type { Post } from '../models/post';
import type { Result } from '../../core/result';

export interface PostRepository {
  getPosts(): Promise<Result<Post[]>>;
}`,
  repoImplExcerpt: `// src/data/repositories/post-repository-impl.ts — implements the domain contract.
// Orchestrates remote + local sources and the offline-first fallback strategy.
export class PostRepositoryImpl implements PostRepository {
  constructor(
    private readonly remote: PostRemoteDataSource,
    private readonly local: AppDatabase,
    private readonly logger: Logger,
  ) {}

  async getPosts() {
    return safeRepositoryCall<Post[]>({
      logger: this.logger,
      call: async () => {
        const remotePosts = await this.remote.getPosts();   // DTOs from the wire
        try { await this.local.insertPosts(remotePosts); }  // write-through cache
        catch (e) { this.logger.warning('Failed to cache posts', e); }
        return remotePosts.map(dtoToPost);                  // DTO → domain Post, HERE
      },
      onNetworkError: (cause) => this.serveFromCache(cause), // cache fallback
      onServerError:   (cause) => this.serveFromCache(cause),
    });
  }
}`,
  remoteExcerpt: `// src/data/remote/post-api.service.ts — the ONLY layer that imports HttpClient.
// Raw HttpErrorResponse errors are upgraded to typed AppExceptions by guards.
@Injectable()
export class PostApiService implements PostRemoteDataSource {
  private readonly http = inject(HttpClient);
  private readonly config = inject(APP_CONFIG);

  getPosts(): Promise<PostDTO[]> {
    return guardedApiCall(async () => {
      const data = await firstValueFrom(
        this.http.get<unknown>(\`\${this.config.apiBaseUrl}/posts\`),
      );
      if (!Array.isArray(data)) throw new ServerException('Expected a list of posts');
      return (data as Record<string, unknown>[]).map((item) => postDtoFromJson(item));
    });
  }
}`,
  dtoExcerpt: `// src/data/remote/post-dto.ts — the wire shape. Validates rather than coerces
// (a malformed payload throws, so NaN ids never reach the UI). DTOs NEVER leave
// the data layer — views import the domain Post, never PostDTO.
export interface PostDTO { id: number; title: string; body: string; }

export function postDtoFromJson(json: Record<string, unknown>): PostDTO { /* validate */ }

/** Convert a transport DTO into a domain model. Called once, in the repo impl. */
export function dtoToPost(dto: PostDTO): Post {
  return { id: dto.id, title: dto.title, body: dto.body };
}`,
  resultExcerpt: `// src/core/result.ts — the domain return type for anything fallible. Pure TS.
// Failures are VALUES, not throws — every call site acknowledges failure at the
// type level (discriminated union on 'ok'), so forgotten try/catch is impossible.
export type Result<T> = Success<T> | Failed;

export interface Success<T> { ok: true;  value: T;       warning?: Failure; }
export interface Failed      { ok: false; failure: Failure; }

export const success = <T>(value: T, warning?: Failure): Success<T> => ({ ok: true, value, warning });
export const failed  = (failure: Failure): Failed => ({ ok: false, failure });`,
  providersExcerpt: `// src/data/providers.ts — the composition root (the ONE escape hatch).
// Reads AppConfig.wiring (fake | live) and binds the domain contracts to the
// tokens through factories. This is the single arrow allowed to point "outward":
// every other file depends on an interface; this one file is where interfaces
// meet instances.
export function provideData(config: AppConfig): EnvironmentProviders {
  const RemoteImpl = config.wiring.remote === 'fake' ? FakeApiService : PostApiService;
  const DbImpl     = config.wiring.db     === 'fake' ? FakeAppDatabase : AppDatabaseImpl;

  const providers: Provider[] = [
    { provide: APP_CONFIG, useValue: config },
    RemoteImpl,                                            // shorthand: useClass
    DbImpl,
    { provide: POST_REPOSITORY,                            // useFactory + deps
      useFactory: (remote, db, logger) => new PostRepositoryImpl(remote, db, logger),
      deps: [RemoteImpl, DbImpl, Logger] },
    { provide: GET_POSTS_USE_CASE,
      useFactory: (repo) => new GetPostsUseCase(repo),
      deps: [POST_REPOSITORY] },
  ];
  return makeEnvironmentProviders(providers);
}`,
  consumeExcerpt: `// A view resolves data ONLY through the DI seam — never a concrete repo impl,
// never HttpClient, never a DTO. The same component runs unchanged against the
// fake (dev) or the live REST backend (staging); the token abstracts which one.
@Component({ /* … */ })
class PostsDemo {
  private readonly useCase = inject(GET_POSTS_USE_CASE);   // the SEAM
  readonly state = signal<{ status: 'idle' | 'loading' | 'success' | 'error'; }>(
    { status: 'idle' },
  );

  async fetch(): Promise<void> {
    const result: Result<Post[]> = await this.useCase.execute();
    if (result.ok) this.state.set({ status: 'success', /* posts: result.value */ });
    else           this.state.set({ status: 'error',   /* failure: result.failure */ });
  }
}`,
  flowTrace: `// Trace fetching the posts list from a button press to pixels. Each hop is a
// layer boundary, and each boundary has a reason: the UI stays free of fetching
// details, the use case stays free of storage strategy, the repository impl
// stays free of UI state. The return path carries a Result<T> — never a thrown
// exception — so the UI can branch on severity without a try/catch.

// ui/  — the component owns presentation state, nothing else.
const result = await this.useCase.execute();        // inject(GET_POSTS_USE_CASE)
//   ↓ delegates to the repository CONTRACT (an interface)

// domain/ — defines the contract; data/ implements it.
interface PostRepository { getPosts(): Promise<Result<Post[]>>; }  // domain/
class PostRepositoryImpl implements PostRepository { … }           // data/

// data/ — the only layer that imports HttpClient / Dexie.
const remotePosts = await this.remote.getPosts();   // data/remote/post-api.service.ts
await this.local.insertPosts(remotePosts);          // data/local/post-dao.ts
return remotePosts.map(dtoToPost);                  // DTO → domain Post, here

// core/ — exceptions are mapped to Failures at the boundary, never thrown past it.
return safeRepositoryCall({ call: …, onNetworkError: … }); // core/error-handling/guards.ts

// ui/ — the template branches on result.ok via @switch.
@if (result.ok) { <app-post-list [posts]="result.value" /> }
@else           { <ui-show-error [failure]="result.failure" /> }`,
  smartVsPresentational: `Angular-idiomatic component split (this app's convention):

• Smart / container components — resolve data through inject() (use cases,
  stores, tokens), own interaction state as signals, and pass data DOWN to
  presentational children. The screen-level <app-*-view> components are smart;
  they sit under app/views/ and wire the DI seam to the template.

• Presentational / dumb components — take signal inputs (input()), emit events
  via output()/model(), and contain zero data-fetching logic. The shared
  primitives in ui/components/ (section-wrapper, code-block, example,
  show-error, theme-toggle) are all presentational — they are reused across
  every screen precisely because they depend on nothing but their inputs.

• Folder rule — a component used by MORE than one file lives in ui/components/;
  a component used by ONE screen stays local to that screen's folder (often
  declared in the same file, before the exported view, to satisfy the TDZ rule).
  app/views/<screen>/ is a feature folder: its teaching artifacts, demo
  components, and SCSS are colocated with the view that owns them.`,
  errorPipeline: `The error pipeline crosses every layer — but only as VALUES, never as throws:

  engine error (HttpClient / IndexedDB / JSON parse)
     │  PostApiService / PostDAO catch
     ▼
  AppException      (data-layer only; typed, chained via .cause)
     │  httpErrorToException     (HttpErrorResponse → AppException, status-based)
     │  mapExceptionToFailure    (recursive over the cause chain)
     ▼
  Failure           (domain/presentation; kind + severity + user message)
     │  PostRepositoryImpl       (optional cache fallback → chained CacheFailure)
     ▼
  Result<T>         (Success<T, warning?> | Failed) — the value the UI consumes

Severity drives presentation: critical → full-screen <ui-show-error/>; warning/info
→ non-blocking banner. The deep dive is the Exception-handling screen.`,
  payoff: `• Testability — every layer is testable in isolation. The repository is
  exercised against FakeApiService + FakeAppDatabase with no network and no DOM;
  the use case is a pure delegation you can call in one line; a view is driven
  with the real DI tree (TestBed) against the fakes. No layer needs the others
  mounted to be tested.

• Swappability — because ui depends on the contract, not the implementation,
  the same screen runs against the live REST API in staging and a canned fake
  in development, selected by ONE field (wiring) at bootstrap. The screen never
  changes; provideData(config) re-wires the entire graph.

• Parallel work — the dependency rule lets a team split along the seams. One
  person builds a feature against the domain contract while another writes the
  data implementation against the same interface; the UI is built against the
  token. They merge without conflicts because no two people edit the same seam.

• Framework isolation — Angular, HttpClient, and Dexie appear in exactly one
  layer each (ui / data / data). If Dexie is replaced by a different store, the
  blast radius is a single data file. The domain and the UI rules do not move,
  because they never knew the framework's name.`,
};
