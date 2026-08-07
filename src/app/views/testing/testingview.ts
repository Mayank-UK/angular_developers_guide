import {
  ChangeDetectionStrategy,
  Component,
  computed,
  signal,
} from '@angular/core';
import { SectionWrapper } from '../../../ui/components/section-wrapper/section-wrapper';
import { ContentGroupWrapper } from '../../../ui/components/content-group-wrapper/content-group-wrapper';
import { TextBlock } from '../../../ui/components/text-block/text-block';
import { CodeBlock } from '../../../ui/components/code-block/code-block';
import { Example } from '../../../ui/components/example/example';

/**
 * TestingView — how this app tests Angular code, and how to think about it.
 *
 * The stack is the Angular CLI's built-in test runner (Vitest under the hood,
 * via the `@angular/build:unit-test` builder) + jsdom (a fake DOM) + Angular's
 * `TestBed` (the harness that mounts components through a real DI/router tree).
 * The philosophy mirrors the React sibling: test behaviour, not implementation
 * — assert what the user sees, never the component's private fields or the
 * framework's internals, so a refactor never breaks a test that wasn't actually
 * about correctness.
 *
 * This app has two kinds of test already, both shown verbatim below:
 *   - pure-unit tests of the core (error pipeline, Result, config, Failure) —
 *     no TestBed, no DOM, plain `describe`/`it` over plain TS;
 *   - TestBed integration tests that mount a component (App, a directive, a
 *     pipe, the responsive matchMedia helper) through the real providers so the
 *     DI graph + templates are exercised the way a user experiences them.
 *
 * The current suite is 71 tests across 12 spec files (see the "what's covered"
 * panel). This screen documents the patterns and ships a live, in-page
 * miniature of the runner so the red→green feedback loop is visible.
 *
 * NOTE: the exported `TestingView` is declared at the BOTTOM of this file. Its
 * `imports` reference a local helper component (SpecRunnerDemo) that is a
 * block-scoped declaration — the main component must come AFTER every helper it
 * names so its decorator does not read an uninitialized binding at
 * module-evaluation time (the TDZ rule every other view screen follows).
 */

/* -------------------------------------------------------------------------- */
/* Local live demo — declared BEFORE the exported view (TDZ rule).             */
/* -------------------------------------------------------------------------- */

/**
 * The state of one "assertion" in the simulated spec runner. Mirrors the shape
 * a real Vitest reporter prints: a name, a pass flag, and an expected-vs-actual
 * detail line for failures.
 */
interface AssertionResult {
  readonly name: string;
  readonly pass: boolean;
  readonly detail: string;
}

/**
 * A tiny signals-based component under test — same shape as a real feature
 * component (signals + computed), small enough to reason about. The `buggy`
 * flag injects the kind of mistake a real test exists to catch.
 */
@Component({
  selector: 'app-testing-counter',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  template: `
    <div class="counter">
      <button type="button" class="btn" (click)="dec()" aria-label="decrement">−</button>
      <span class="value" data-testid="count">{{ count() }}</span>
      <button type="button" class="btn" (click)="inc()" aria-label="increment">+</button>
      <button type="button" class="btn ghost" (click)="reset()">reset</button>
    </div>
  `,
  styles: [
    `
      .counter {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: var(--space-xs);
      }
      .btn {
        border: 1px solid var(--color-outline);
        background: var(--color-surface);
        color: var(--color-on-surface);
        padding: var(--space-xs) var(--space-md);
        border-radius: var(--radius-sm);
        font-family: var(--font-body);
        cursor: pointer;
      }
      .btn:hover {
        border-color: var(--color-primary);
      }
      .btn.ghost {
        color: var(--color-on-surface-variant);
      }
      .value {
        min-width: 2.5rem;
        text-align: center;
        font-family: var(--font-mono);
        font-weight: 600;
        color: var(--color-on-surface);
      }
    `,
  ],
})
class CounterComponent {
  readonly buggy = signal(false);
  readonly count = signal(0);

  readonly inc = (): void => {
    // Bug: never increments (stays at the same value).
    this.count.update((c) => (this.buggy() ? c : c + 1));
  };
  readonly dec = (): void => {
    // Bug: double-decrement instead of -1.
    this.count.update((c) => (this.buggy() ? c - 2 : c - 1));
  };
  readonly reset = (): void => this.count.set(0);
}

/**
 * SpecRunnerDemo — the CENTERPIECE. A self-contained, in-page miniature of the
 * test loop: a component under test, three behavioural assertions over its
 * value, and a switch that injects a bug so a failing assertion goes red with
 * the expected-vs-actual line a real runner prints.
 *
 * This is a SIMULATED harness — it does not wire into the actual test runner
 * (the runner only executes at `npm test`). It demonstrates the shape of the
 * feedback loop: arrange → act → assert, then read pass/fail + the detail line.
 */
@Component({
  selector: 'app-testing-runner-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CounterComponent],
  template: `
    <div class="runner">
      <div class="row">
        <span class="caption">Component under test:</span>
        <app-testing-counter />
      </div>

      <label class="toggle">
        <input
          type="checkbox"
          [checked]="buggy()"
          (change)="onToggle($event)"
        />
        introduce a bug (break +/−)
      </label>

      <div class="row">
        <button type="button" class="run-btn" (click)="run()">run tests</button>
        @if (results()) {
          <span class="badge" [class.pass]="allPass()" [class.fail]="!allPass()">
            {{ allPass() ? '3 passed' : summary() }}
          </span>
        }
      </div>

      @if (results(); as rs) {
        <ul class="results">
          @for (r of rs; track r.name) {
            <li class="result" [class.is-pass]="r.pass" [class.is-fail]="!r.pass">
              <span class="glyph" [class.pass]="r.pass" [class.fail]="!r.pass">
                {{ r.pass ? '✓' : '✗' }}
              </span>
              <div class="body">
                <span class="name">it {{ r.name }}</span>
                <span class="detail">
                  {{ r.pass ? 'passed' : 'AssertionError: ' + r.detail }}
                </span>
              </div>
            </li>
          }
        </ul>
      }

      <p class="footnote">
        These are behavioural assertions — they read the counter's rendered
        value, not any private field. Flip the bug, run again, and the failing
        test reports expected-vs-actual the way the real suite would.
      </p>
    </div>
  `,
  styles: [
    `
      .runner {
        display: flex;
        flex-direction: column;
        gap: var(--space-md);
      }
      .row {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: var(--space-sm);
      }
      .caption {
        font-size: 0.8rem;
        color: var(--color-on-surface-variant);
      }
      .toggle {
        display: inline-flex;
        align-items: center;
        gap: var(--space-xs);
        width: fit-content;
        font-size: 0.8rem;
        color: var(--color-on-surface-variant);
        cursor: pointer;
      }
      .toggle input {
        accent-color: var(--color-primary);
      }
      .run-btn {
        border: 1px solid var(--color-primary);
        background: var(--color-primary);
        color: var(--color-on-primary);
        padding: var(--space-xs) var(--space-md);
        border-radius: var(--radius-sm);
        font-family: var(--font-body);
        font-weight: 600;
        cursor: pointer;
      }
      .badge {
        border: 1px solid var(--color-outline);
        color: var(--color-on-surface-variant);
        padding: 2px var(--space-sm);
        border-radius: var(--radius-pill);
        font-size: 0.7rem;
        text-transform: uppercase;
        letter-spacing: 0.08em;
      }
      .badge.pass {
        border-color: var(--color-primary);
        color: var(--color-primary);
      }
      .badge.fail {
        border-color: var(--color-critical);
        color: var(--color-critical);
      }
      .results {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: var(--space-xs);
      }
      .result {
        display: flex;
        align-items: flex-start;
        gap: var(--space-sm);
        border: 1px solid var(--color-outline);
        padding: var(--space-sm) var(--space-md);
        border-radius: var(--radius-sm);
        background: var(--color-surface);
      }
      .result.is-fail {
        background: var(--color-surface-variant);
      }
      .glyph {
        margin-top: 2px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        height: 16px;
        width: 16px;
        border-radius: var(--radius-pill);
        font-size: 11px;
        line-height: 16px;
        flex: 0 0 auto;
      }
      .glyph.pass {
        background: var(--color-primary);
        color: var(--color-on-primary);
      }
      .glyph.fail {
        background: var(--color-critical);
        color: var(--color-on-error);
      }
      .body {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .name {
        font-weight: 600;
        color: var(--color-on-surface);
        font-size: 0.875rem;
      }
      .detail {
        font-family: var(--font-mono);
        color: var(--color-on-surface-variant);
        font-size: 0.75rem;
      }
      .footnote {
        margin: 0;
        color: var(--color-on-surface-variant);
        font-size: 0.8rem;
      }
    `,
  ],
})
class SpecRunnerDemo {
  private readonly counter = new CounterComponent();

  readonly buggy = signal(false);
  readonly results = signal<AssertionResult[] | null>(null);
  readonly allPass = computed(() => {
    const rs = this.results();
    return rs !== null && rs.every((r) => r.pass);
  });
  readonly summary = computed(() => {
    const rs = this.results();
    if (rs === null) return '';
    const passed = rs.filter((r) => r.pass).length;
    return `${passed} passed · ${rs.length - passed} failed`;
  });

  onToggle(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.buggy.set(checked);
    this.results.set(null);
  }

  /**
   * Simulate the test sequence against a fresh counter state. The assertions
   * mirror the style of core/result.spec.ts: arrange a value, act, then assert
   * on the observable result (not on any internals).
   */
  run(): void {
    // Re-create the "component" fresh and walk the same sequence a spec would.
    const buggy = this.buggy();
    const counter = new CounterComponent();
    counter.buggy.set(buggy);

    // it 'starts at 0'
    const initial = counter.count();
    counter.inc();
    const afterInc = counter.count(); // expect 1
    counter.dec();
    const afterDec = counter.count(); // expect 0 (back from 1)

    this.results.set([
      {
        name: 'starts at 0',
        pass: initial === 0,
        detail: `expected 0, got ${initial}`,
      },
      {
        name: '+ increments by 1',
        pass: afterInc === 1,
        detail: `expected 1, got ${afterInc}`,
      },
      {
        name: '− decrements by 1',
        pass: afterDec === 0,
        detail: `from 1, expected 0, got ${afterDec}`,
      },
    ]);
  }
}

/* -------------------------------------------------------------------------- */
/* The exported view — declared AFTER its helpers (TDZ rule).                  */
/* -------------------------------------------------------------------------- */

@Component({
  selector: 'app-testing-view',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    SectionWrapper,
    ContentGroupWrapper,
    TextBlock,
    CodeBlock,
    Example,
    SpecRunnerDemo,
  ],
  templateUrl: './testing_view.html',
  styleUrl: './testing_view.scss',
})
export class TestingView {
  /** Code listings rendered by the page's CodeBlocks (REAL spec excerpts). */
  readonly snippets = SNIPPETS;

  /** The real current counts, referenced in the "what's covered" panel. */
  readonly totalTests = 71;
  readonly specFiles = 12;
}

/* -------------------------------------------------------------------------- */
/* Code listings shown in the page's <ui-code-block> elements.                 */
/* All excerpts are the REAL specs in src/ (+ the runner config in angular.json) */
/* and the real src/test/setup.ts polyfill.                                    */
/* -------------------------------------------------------------------------- */

const SNIPPETS = {
  angularJson: `// angular.json — the unit-test builder + setup file (no karma, no jasmine
// configured separately; @angular/build:unit-test brings Vitest + jsdom).
"test": {
  "builder": "@angular/build:unit-test",
  "options": {
    "setupFiles": ["src/test/setup.ts"]   // runs before any spec
  }
}

// npm test → ng test → Vitest in jsdom. Watch mode + a single-run CI shape
// come from the same builder; filter with \`ng test --include='**/*.spec.ts'\`.`,
  setupTs: `// src/test/setup.ts — runs once before any spec, after TestBed initialises.
// jsdom omits window.matchMedia, which ThemeService touches during construction.
// Polyfill it with a static non-matching MediaQueryList so components mount.
if (typeof window !== 'undefined' && typeof window.matchMedia !== 'function') {
  window.matchMedia = (query: string): MediaQueryList =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList;
}
export {};`,
  specAnatomy: `// The three primitives every spec file is built from.
describe('Thing under test', () => {           // a group of related tests
  let thing: Thing;

  beforeEach(() => {                            // arrange — runs before each \`it\`
    thing = new Thing();
  });

  it('does the expected behaviour', () => {     // one test, one assertion target
    // act
    const result = thing.doStuff('input');
    // assert — on the observable result, never on internals
    expect(result).toBe('expected');
  });
});

// arrange → act → assert. One logical assertion per \`it\`; group related \`it\`s
// in a \`describe\`. \`beforeEach\` rebuilds the world so tests stay independent.`,
  pureUnit: `// src/core/result.spec.ts — a PURE unit test. No TestBed, no DOM, no Angular.
// Construct the value, call the function, assert on the result. These are fast
// (microseconds) and pin down the logic every screen depends on.
import { success, failed, type Result } from './result';
import { NetworkFailure, type Failure } from './error-handling/failure';

describe('Result', () => {
  it('success carries a value and is ok', () => {
    const r: Result<number> = success(42);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe(42);
    expect(r.ok && r.warning).toBeUndefined();
  });

  it('failed carries a failure and is not ok', () => {
    const failure = new NetworkFailure('offline');
    const r: Result<number> = failed(failure);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.failure).toBe(failure);
  });
});`,
  testbedComponent: `// src/app/app.spec.ts — TestBed integration test. Mounts the REAL component
// through the REAL DI tree (only the router is stubbed with provideRouter([])).
// Guards against white-screen runtime errors tsc can never catch.
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { App } from './app';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([])],           // stub the router, keep everything else real
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should render the header title', async () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    await fixture.whenStable();                 // settle async + effects
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent)
      .toContain("Angular developer's guide");
  });
});`,
  httpTesting: `// HttpClient testing — provideHttpClientTesting swaps in a backend you assert
// against with HttpTestingController. No real network; the spec says "expect
// exactly one GET to /posts, flush this body, assert the mapped result".
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController }
  from '@angular/common/http/testing';
import { PostApiService } from './post-api.service';

describe('PostApiService', () => {
  let service: PostApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        PostApiService,
        provideHttpClient(),
        provideHttpClientTesting(),             // intercepts HttpClient calls
        { provide: APP_CONFIG, useValue: stubConfig },
      ],
    });
    service = TestBed.inject(PostApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());           // no unhandled requests

  it('maps a 200 payload to domain Posts', async () => {
    const promise = service.getPosts();
    const req = httpMock.expectOne(stubConfig.apiBaseUrl + '/posts');
    expect(req.request.method).toBe('GET');
    req.flush([{ id: 1, title: 'Hello' }]);      // fake the server response

    const posts = await promise;
    expect(posts[0].title).toBe('Hello');
  });
});`,
  signalsTest: `// Testing signals: drive them like the template does — call .set()/.update(),
// then read the value (or a computed) and assert. For effects that schedule
// side-effects after change detection, wrap in TestBed.runTaskInjectionContext
// or read the result they write to a signal you control.
it('computed re-derives when its source changes', () => {
  const count = signal(1);
  const double = computed(() => count() * 2);
  expect(double()).toBe(2);
  count.set(5);
  expect(double()).toBe(10);       // memoised recompute on read
});

// TestBed + signals in a component: write the input signal, detectChanges,
// then assert on the rendered output — exactly how a user drives the UI.
it('renders the doubled count', () => {
  const fixture = TestBed.createComponent(CounterComponent);
  fixture.componentInstance.count.set(4);
  fixture.detectChanges();
  const host: HTMLElement = fixture.nativeElement;
  expect(host.querySelector('[data-testid="count"]')?.textContent).toContain('4');
});`,
  overrideProvider: `// Testing the DI seam — override a token with a fake WITHOUT touching the
// real wiring. TestBed.overrideProvider swaps one binding for this spec only;
// the consumer still resolves it via inject(TOKEN) and never notices.
describe('PostsDemo with a fake use case', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PostsDemo],
      providers: [
        provideRouter([]),
        { provide: GET_POSTS_USE_CASE, useValue: fakeUseCase },  // the override
      ],
    }).compileComponents();
  });

  it('renders the fake posts', () => {
    fakeUseCase.execute.and.returnValue(success([postA, postB]));
    const fixture = TestBed.createComponent(PostsDemo);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(postA.title);
  });
});

// Two flavours: { provide: TOKEN, useValue: stub } for a hand-written fake, or
// { provide: TOKEN, useClass: FakeXyz } to let Angular construct it. Both keep
// the component under test agnostic to which impl filled the slot — which is
// the whole point of the DI seam.`,
  pipeDirectiveTest: `// Pure pipes are the cheapest thing to test — no TestBed, no fixture.
// src/app/views/angular_fundamentals/truncate.pipe.spec.ts
describe('TruncatePipe', () => {
  let pipe: TruncatePipe;
  beforeEach(() => { pipe = new TruncatePipe(); });

  it('truncates and appends the default ellipsis when over the limit', () => {
    expect(pipe.transform('Hello world this is long', 11)).toBe('Hello world…');
  });

  it('accepts a custom ellipsis argument', () => {
    expect(pipe.transform('Hello world this is long', 5, '...')).toBe('Hello...');
  });
});

// Attribute directives need TestBed — they mutate a host element through the
// Angular event + change-detection pipeline.
// src/app/views/angular_fundamentals/highlight.directive.spec.ts
@Component({
  standalone: true,
  imports: [HighlightDirective],
  template: \`<span appHighlight>hover me</span>\`,
})
class HighlightHost {}

it('paints the background on mouseenter and clears it on mouseleave', async () => {
  await TestBed.configureTestingModule({ imports: [HighlightHost] }).compileComponents();
  const fixture = TestBed.createComponent(HighlightHost);
  fixture.detectChanges();
  const host: HTMLElement = fixture.nativeElement.querySelector('span')!;
  host.dispatchEvent(new Event('mouseenter'));
  expect(host.style.cssText).toContain('background-color');
  host.dispatchEvent(new Event('mouseleave'));
  expect(host.style.backgroundColor).toBe('');
});`,
  errorPipelineTest: `// src/core/error-handling/guards.spec.ts — the error pipeline, pure-unit.
// Construct an exception, call mapExceptionToFailure, assert on the resulting
// Failure's kind/severity/chained-cause. This is the one piece of logic every
// screen's error treatment depends on, so it earns the most thorough spec.
it('maps a network exception to a critical network failure', () => {
  const failure = mapExceptionToFailure(new NetworkException('offline'));
  expect(failure).toBeInstanceOf(NetworkFailure);
  expect(failure.severity).toBe(FailureSeverity.Critical);
  expect(failure.kind).toBe('network');
});

it('chains nested causes into a single failure trail', () => {
  const network = new NetworkException('no internet');
  const dbError = new AppDatabaseException('cache read failed', { cause: network });
  const failure = mapExceptionToFailure(dbError);
  expect(failure.chain).toContain('caused by: no internet');
  expect(failure.chain).toContain('cache read failed');
});`,
  fakesVsReal: `// src/data/providers.spec.ts — the SAME tokens bind fake-vs-live from
// AppConfig.wiring. The spec mounts provideData(config) with each wiring slot
// and asserts which concrete class the injector built — proving the swap is a
// one-field change with zero view-side consequences.
describe('provideData (fake wiring)', () => {
  it('wires the fake remote + fake db for the fake slot', async () => {
    await TestBed.configureTestingModule({
      providers: [provideData(makeConfig({ remote: 'fake', db: 'fake' }))],
    }).compileComponents();
    expect(TestBed.inject(FakeApiService)).toBeInstanceOf(FakeApiService);
    expect(() => TestBed.inject(PostApiService)).toThrow();  // live NOT registered
  });
});

describe('provideData (live wiring)', () => {
  it('wires the live remote + live db', async () => {
    await TestBed.configureTestingModule({
      providers: [
        provideData(makeConfig({ remote: 'live', db: 'live' })),
        provideHttpClient(),       // live remote needs HttpClient
      ],
    }).compileComponents();
    expect(TestBed.inject(PostApiService)).toBeInstanceOf(PostApiService);
  });
});

// The fake (FakeApiService) reads ScenarioService to inject failures on demand,
// so the same integration test can drive the genuine Result.Failed path by
// flipping a scenario signal — no mock framework required.`,
  running: `# inside the dev container (Docker-only — no node_modules on the host)
npm test                         # whole suite, single run (CI-shaped)
npm run test -- --watch          # watch mode for development
ng test --include='**/error-handling/**'   # one folder
ng test --include='**/*pipe*.spec.ts'      # one kind of spec`,
  angularVsReact: `Angular (this app)            React sibling
─────────────────────────     ─────────────────────────────
Vitest via                    Vitest (standalone)
 @angular/build:unit-test     + React Testing Library
TestBed is the harness        render() from RTL is the harness
configureTestingModule +      render(<App/>) under the real
 provideRouter/provideHttp    RouterProvider/ThemeProvider
ClientTesting                 (no equivalent DI to wire)
                              ──
jsdom (same)                  jsdom (same)
globals: describe/it/expect   globals: describe/it/expect
  available without import      + jest-dom matchers via setup

Both suites: pure-unit specs for the core + integration specs that mount each
screen through the real provider tree. The Angular difference is TestBed — the
DI-aware harness that resolves inject(TOKEN) the same way the live app does.`,
};
