import {
  ChangeDetectionStrategy,
  Component,
  computed,
  signal,
} from '@angular/core';
import { SectionWrapper } from '../../../ui/components/section-wrapper/section-wrapper';
import { TextBlock } from '../../../ui/components/text-block/text-block';
import { CodeBlock } from '../../../ui/components/code-block/code-block';
import { Example } from '../../../ui/components/example/example';
import { ContentGroupWrapper } from '../../../ui/components/content-group-wrapper/content-group-wrapper';

/**
 * TsJsFundamentalsView — one consolidated screen for the JavaScript + TypeScript
 * language fundamentals the rest of this app leans on. Covers: variables
 * (let/const/var), primitive & reference data types, type annotations &
 * inference, union/intersection/literal types, objects/arrays/tuples, functions
 * & arrow functions, control flow & loops, spread/rest & destructuring, nullish
 * coalescing & optional chaining, classes, generics, async/await & promises,
 * modules, exceptions, and utility types.
 *
 * Where a concept is TypeScript-only it is tagged (TS); everything else is
 * plain JS that runs unchanged when types are erased.
 *
 * The screen leans on the shared design-system primitives (SectionWrapper,
 * ContentGroupWrapper, TextBlock, CodeBlock, Example) so styling stays
 * consistent with the rest of the app. Interactive demos are kept as local
 * components in this file: they are only used here (see the "single file →
 * local helper" rule).
 *
 * All components are standalone + OnPush and use the signal `input()` /
 * `output()` / `model()` APIs. Modern control flow (@if / @for / @switch) is
 * used throughout. const-object + literal-union types are used in place of
 * enums (the project targets erasable-only TS).
 *
 * NOTE: the exported `TsJsFundamentalsView` component is declared at the
 * BOTTOM of this file. Its `imports` reference local helper classes, which are
 * block-scoped class declarations (TDZ), so the main component must come after
 * every helper it names — otherwise the decorator would read an uninitialized
 * binding at module-evaluation time.
 */

/* -------------------------------------------------------------------------- */
/* Shared local types                                                         */
/* -------------------------------------------------------------------------- */

const STATUS = {
  idle: 'idle',
  pending: 'pending',
  success: 'success',
  error: 'error',
} as const;
type Status = (typeof STATUS)[keyof typeof STATUS];

interface Person {
  readonly id: number;
  name: string;
  role: string;
  city?: string;
}

interface DemoItem {
  readonly id: number;
  readonly label: string;
  readonly category: 'fruit' | 'tool' | 'lang';
}

/* -------------------------------------------------------------------------- */
/* 1. Variables & types — live: const + inferred number                       */
/* -------------------------------------------------------------------------- */

/**
 * VariablesDemo — the canonical "variables + inference" demo. `count` is a
 * signal holding a number; `doubled` is a `computed` that derives from it.
 * Feeding only numbers into the setter (enforced by the TS type of the click
 * handler's payload) is exactly the class of bug static types prevent at edit
 * time — the runtime never sees a NaN.
 */
@Component({
  selector: 'app-variables-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="row">
      <button type="button" class="ghost" (click)="dec()">−</button>
      <span class="value">{{ count() }}</span>
      <button type="button" class="solid" (click)="inc()">+</button>
      <span class="mirror">
        doubled = <span class="strong">{{ doubled() }}</span>
      </span>
    </div>
  `,
  styles: [
    `
      .row {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: var(--space-sm);
      }
      .value {
        min-width: 2ch;
        text-align: center;
        font-size: var(--text-title);
        font-weight: 500;
        font-variant-numeric: tabular-nums;
        color: var(--color-on-surface);
      }
      .ghost {
        padding: var(--space-xs) var(--space-md);
        font-size: var(--text-body);
        border: 1px solid var(--color-outline);
        border-radius: var(--radius-md);
        background: transparent;
        color: var(--color-on-surface);
      }
      .ghost:hover {
        background-color: var(--color-surface-variant);
      }
      .solid {
        padding: var(--space-xs) var(--space-md);
        font-size: var(--text-body);
        border: none;
        border-radius: var(--radius-md);
        background-color: var(--color-primary);
        color: var(--color-on-primary);
        box-shadow: var(--shadow-button-card);
      }
      .solid:hover {
        background-color: var(--color-primary-container);
        box-shadow: var(--shadow-button-card-hover);
      }
      .mirror {
        font-size: var(--text-body-sm);
        color: var(--color-on-surface-variant);
      }
      .strong {
        color: var(--color-on-surface);
        font-variant-numeric: tabular-nums;
      }
    `,
  ],
})
class VariablesDemo {
  readonly count = signal(0);
  /** computed() derives a value; re-runs only when `count` changes. */
  readonly doubled = computed(() => this.count() * 2);

  inc(): void {
    this.count.update((c) => c + 1);
  }
  dec(): void {
    this.count.update((c) => c - 1);
  }
}

/* -------------------------------------------------------------------------- */
/* 2. Types/objects — live: edit a typed object                               */
/* -------------------------------------------------------------------------- */

/**
 * TypedObjectDemo — binds form inputs to a typed `Person`. Editing a field
 * rewrites the signal immutably (spread + override), and the rendered card
 * reflects the new shape. The optional `city` field demonstrates optional
 * properties (`?`) and `??` for a default when it is absent.
 */
@Component({
  selector: 'app-typed-object-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="col">
      <div class="grid">
        <label class="field">
          <span class="caption">name</span>
          <input
            class="input"
            #nameInput
            [value]="person().name"
            (input)="patch({ name: nameInput.value })"
          />
        </label>
        <label class="field">
          <span class="caption">role</span>
          <input
            class="input"
            #roleInput
            [value]="person().role"
            (input)="patch({ role: roleInput.value })"
          />
        </label>
        <label class="field">
          <span class="caption">city (optional)</span>
          <input
            class="input"
            #cityInput
            [value]="person().city ?? ''"
            (input)="patch({ city: cityInput.value })"
          />
        </label>
      </div>
      <div class="card">
        <p class="name">{{ person().name }}</p>
        <p class="meta">{{ person().role }}</p>
        <p class="meta">{{ person().city ?? '— no city set —' }}</p>
        <p class="id">id #{{ person().id }} (readonly)</p>
      </div>
    </div>
  `,
  styles: [
    `
      .col {
        display: flex;
        flex-direction: column;
        gap: var(--space-sm);
      }
      .grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        gap: var(--space-sm);
      }
      .field {
        display: flex;
        flex-direction: column;
        gap: var(--space-xs);
      }
      .caption {
        font-size: var(--text-caption);
        color: var(--color-on-surface-variant);
      }
      .input {
        padding: var(--space-xs) var(--space-sm);
        border: 1px solid var(--color-outline);
        border-radius: var(--radius-md);
        background-color: var(--color-surface);
        color: var(--color-on-surface);
        font-size: var(--text-body);
        outline: none;
      }
      .input:focus {
        border-color: var(--color-primary);
      }
      .card {
        padding: var(--space-sm) var(--space-md);
        border: 1px solid var(--color-outline);
        border-radius: var(--radius-md);
        background-color: var(--color-surface-variant);
      }
      .name {
        margin: 0;
        font-size: var(--text-title-sm);
        font-weight: 600;
        color: var(--color-on-surface);
      }
      .meta {
        margin: 0;
        font-size: var(--text-body-sm);
        color: var(--color-on-surface-variant);
      }
      .id {
        margin: var(--space-xs) 0 0;
        font-size: var(--text-caption);
        color: var(--color-on-surface-variant);
        font-family: var(--font-mono);
      }
    `,
  ],
})
class TypedObjectDemo {
  readonly person = signal<Person>({
    id: 7,
    name: 'Ada Lovelace',
    role: 'Engineer',
  });

  /** Immutable update via spread — the original object is never mutated. */
  patch(changes: Partial<Person>): void {
    this.person.update((p) => ({ ...p, ...changes }));
  }
}

/* -------------------------------------------------------------------------- */
/* 3. Functions & loops — live: filter + map over an array                   */
/* -------------------------------------------------------------------------- */

/**
 * ArrayMethodsDemo — a live search box exercising arrow functions and the
 * functional array methods (filter, map, sort). Typing filters `items` by
 * label; the result count and list re-render reactively via `computed`.
 */
@Component({
  selector: 'app-array-methods-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="col">
      <input
        class="input"
        #queryInput
        [value]="query()"
        (input)="query.set(queryInput.value)"
        placeholder="filter (try: tool, a, lang)…"
      />
      <p class="muted">{{ visible().length }} of {{ items.length }} match</p>
      <ul class="list">
        @for (it of visible(); track it.id) {
          <li class="item">
            <span class="label">{{ it.label }}</span>
            <span class="chip">{{ it.category }}</span>
          </li>
        } @empty {
          <li class="muted">No matches.</li>
        }
      </ul>
    </div>
  `,
  styles: [
    `
      .col {
        display: flex;
        flex-direction: column;
        gap: var(--space-xs);
      }
      .input {
        max-width: 360px;
        padding: var(--space-xs) var(--space-sm);
        border: 1px solid var(--color-outline);
        border-radius: var(--radius-md);
        background-color: var(--color-surface);
        color: var(--color-on-surface);
        font-size: var(--text-body);
        outline: none;
      }
      .input:focus {
        border-color: var(--color-primary);
      }
      .muted {
        margin: 0;
        font-size: var(--text-caption);
        color: var(--color-on-surface-variant);
      }
      .list {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: var(--space-xs);
      }
      .item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--space-sm);
        padding: var(--space-xs) var(--space-sm);
        border: 1px solid var(--color-outline);
        border-radius: var(--radius-md);
        font-size: var(--text-body-sm);
        color: var(--color-on-surface);
      }
      .chip {
        padding: 2px var(--space-xs);
        border-radius: var(--radius-pill);
        font-size: var(--text-caption);
        background-color: var(--color-surface-tint);
        color: var(--color-on-surface-variant);
      }
    `,
  ],
})
class ArrayMethodsDemo {
  /** A plain readonly array — the source of truth for the filter. */
  readonly items: readonly DemoItem[] = [
    { id: 1, label: 'Apple', category: 'fruit' },
    { id: 2, label: 'Angular', category: 'lang' },
    { id: 3, label: 'Hammer', category: 'tool' },
    { id: 4, label: 'TypeScript', category: 'lang' },
    { id: 5, label: 'Avocado', category: 'fruit' },
    { id: 6, label: 'Wrench', category: 'tool' },
  ];

  readonly query = signal('');

  /** Arrow functions + filter + sort, all reactive. */
  readonly visible = computed<readonly DemoItem[]>(() => {
    const q = this.query().trim().toLowerCase();
    const filtered = q
      ? this.items.filter((it) => it.label.toLowerCase().includes(q))
      : this.items;
    return [...filtered].sort((a, b) => a.label.localeCompare(b.label));
  });
}

/* -------------------------------------------------------------------------- */
/* 4. Classes — live: an Account class with deposit / withdraw               */
/* -------------------------------------------------------------------------- */

/**
 * Account — a plain TS class (declared outside the component so its source can
 * be mirrored in the page's CodeBlock). Demonstrates parameter properties,
 * private state, and a guard that throws on invalid input.
 */
class Account {
  constructor(
    public readonly id: number,
    public owner: string,
    private balance: number,
  ) {}

  deposit(amount: number): void {
    if (amount <= 0) throw new Error('amount must be positive');
    this.balance += amount;
  }

  withdraw(amount: number): void {
    if (amount <= 0) throw new Error('amount must be positive');
    if (amount > this.balance) throw new Error('insufficient funds');
    this.balance -= amount;
  }

  getBalance(): number {
    return this.balance;
  }
}

/**
 * AccountDemo — wraps the `Account` class in a live UI. Each action calls a
 * method; the rendered balance reflects the class's private state through the
 * public getter. The error output demonstrates try/catch around thrown errors.
 */
@Component({
  selector: 'app-account-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="col">
      <div class="row">
        <input
          class="input"
          type="number"
          #amountInput
          [value]="amount()"
          (input)="amount.set(num(amountInput.value))"
        />
        <button type="button" class="solid" (click)="deposit()">Deposit</button>
        <button type="button" class="ghost" (click)="withdraw()">Withdraw</button>
      </div>
      <p class="balance">
        Balance:
        <span class="amount">{{ balance() }}</span>
      </p>
      @if (message()) {
        <p class="message" [class.err]="isError()">{{ message() }}</p>
      }
    </div>
  `,
  styles: [
    `
      .col {
        display: flex;
        flex-direction: column;
        gap: var(--space-xs);
      }
      .row {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: var(--space-sm);
      }
      .input {
        width: 120px;
        padding: var(--space-xs) var(--space-sm);
        border: 1px solid var(--color-outline);
        border-radius: var(--radius-md);
        background-color: var(--color-surface);
        color: var(--color-on-surface);
        font-size: var(--text-body);
        outline: none;
      }
      .input:focus {
        border-color: var(--color-primary);
      }
      .solid {
        padding: var(--space-xs) var(--space-md);
        font-size: var(--text-body);
        border: none;
        border-radius: var(--radius-md);
        background-color: var(--color-primary);
        color: var(--color-on-primary);
        box-shadow: var(--shadow-button-card);
      }
      .solid:hover {
        background-color: var(--color-primary-container);
        box-shadow: var(--shadow-button-card-hover);
      }
      .ghost {
        padding: var(--space-xs) var(--space-md);
        font-size: var(--text-body);
        border: 1px solid var(--color-outline);
        border-radius: var(--radius-md);
        background: transparent;
        color: var(--color-on-surface);
      }
      .ghost:hover {
        background-color: var(--color-surface-variant);
      }
      .balance {
        margin: 0;
        font-size: var(--text-body-sm);
        color: var(--color-on-surface-variant);
      }
      .amount {
        font-size: var(--text-title-sm);
        font-weight: 600;
        color: var(--color-on-surface);
        font-variant-numeric: tabular-nums;
      }
      .message {
        margin: 0;
        font-size: var(--text-caption);
        color: var(--color-on-surface-variant);
      }
      .message.err {
        color: var(--color-critical);
      }
    `,
  ],
})
class AccountDemo {
  readonly account = new Account(1, 'Sam', 100);
  readonly amount = signal(20);
  readonly message = signal('');
  readonly isError = signal(false);

  /**
   * A version counter so OnPush re-renders after the mutable `Account` changes.
   * (This is exactly the kind of bookkeeping signals spare you for state held
   * *inside* a signal — included here because the demo deliberately illustrates
   * a mutable class instance.) `balance` reads it so the computed re-runs.
   */
  private readonly bump = signal(0);

  /** Mirrors the class's private balance through a reactivity tick. */
  readonly balance = computed(() => {
    this.bump();
    return this.account.getBalance();
  });

  deposit(): void {
    try {
      this.account.deposit(this.amount());
      this.isError.set(false);
      this.message.set(`Deposited ${this.amount()}.`);
    } catch (err) {
      this.isError.set(true);
      this.message.set(err instanceof Error ? err.message : String(err));
    }
    this.bump.set(this.bump() + 1);
  }

  withdraw(): void {
    try {
      this.account.withdraw(this.amount());
      this.isError.set(false);
      this.message.set(`Withdrew ${this.amount()}.`);
    } catch (err) {
      this.isError.set(true);
      this.message.set(err instanceof Error ? err.message : String(err));
    }
    this.bump.set(this.bump() + 1);
  }

  /** Coerce an input event's value to a finite number, falling back to 0. */
  num(raw: string): number {
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : 0;
  }
}

/* -------------------------------------------------------------------------- */
/* 5. Generics — live: a Stack<T>                                             */
/* -------------------------------------------------------------------------- */

/**
 * Stack — a tiny generic class. `<T>` is a type parameter: the caller picks the
 * element type once and `push`/`pop` are guaranteed to handle only that type.
 */
class Stack<T> {
  private readonly items: T[] = [];

  push(item: T): void {
    this.items.push(item);
  }

  pop(): T | undefined {
    return this.items.pop();
  }

  peek(): T | undefined {
    return this.items.at(-1);
  }

  get size(): number {
    return this.items.length;
  }
}

/**
 * GenericsDemo — a Stack<number>. Pushing and popping keeps the element type
 * narrow (number), so the top-of-stack read renders without any cast.
 */
@Component({
  selector: 'app-generics-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="col">
      <div class="row">
        <button type="button" class="solid" (click)="push()">push number</button>
        <button type="button" class="ghost" (click)="pop()" [disabled]="size() === 0">
          pop
        </button>
        <button type="button" class="link" (click)="reset()" [disabled]="size() === 0">
          reset
        </button>
      </div>
      <p class="muted">
        size = {{ size() }}
        @if (top() !== undefined) {
          · top = <span class="strong">{{ top() }}</span>
        }
      </p>
      <p class="muted">A Stack&lt;number&gt; — pop() always returns number | undefined.</p>
    </div>
  `,
  styles: [
    `
      .col {
        display: flex;
        flex-direction: column;
        gap: var(--space-xs);
      }
      .row {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: var(--space-sm);
      }
      .solid {
        padding: var(--space-xs) var(--space-md);
        font-size: var(--text-body);
        border: none;
        border-radius: var(--radius-md);
        background-color: var(--color-primary);
        color: var(--color-on-primary);
        box-shadow: var(--shadow-button-card);
      }
      .solid:hover {
        background-color: var(--color-primary-container);
        box-shadow: var(--shadow-button-card-hover);
      }
      .ghost {
        padding: var(--space-xs) var(--space-md);
        font-size: var(--text-body);
        border: 1px solid var(--color-outline);
        border-radius: var(--radius-md);
        background: transparent;
        color: var(--color-on-surface);
      }
      .ghost:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
      .link {
        border: none;
        background: transparent;
        padding: var(--space-xs) var(--space-sm);
        color: var(--color-on-surface-variant);
        font-size: var(--text-caption);
      }
      .link:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
      .muted {
        margin: 0;
        font-size: var(--text-caption);
        color: var(--color-on-surface-variant);
      }
      .strong {
        color: var(--color-on-surface);
        font-variant-numeric: tabular-nums;
      }
    `,
  ],
})
class GenericsDemo {
  readonly stack = new Stack<number>();
  private counter = 0;
  private readonly bump = signal(0);

  /** Reactive mirrors of the generic stack's mutable state. */
  readonly size = computed(() => {
    this.bump();
    return this.stack.size;
  });
  readonly top = computed(() => {
    this.bump();
    return this.stack.peek();
  });

  push(): void {
    this.counter += 1;
    this.stack.push(this.counter * 10);
    this.bump.set(this.bump() + 1);
  }

  pop(): void {
    this.stack.pop();
    this.bump.set(this.bump() + 1);
  }

  reset(): void {
    while (this.stack.size > 0) this.stack.pop();
    this.counter = 0;
    this.bump.set(this.bump() + 1);
  }
}

/* -------------------------------------------------------------------------- */
/* 6. Async — live: a simulated async/await with status states               */
/* -------------------------------------------------------------------------- */

/**
 * AsyncDemo — kicks off a fake async task (a Promise that resolves after a
 * short timeout) and surfaces its lifecycle through a `Status` literal union.
 * The button is disabled while pending; the result panel switches on status
 * via @switch. This is the same shape as a real HttpClient call, minus the
 * network — see the API-handling screen for the full pipeline.
 */
@Component({
  selector: 'app-async-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="col">
      <div class="row">
        <button
          type="button"
          class="solid"
          (click)="run()"
          [disabled]="status() === 'pending'"
        >
          {{ status() === 'pending' ? 'Loading…' : 'Fetch (simulated)' }}
        </button>
        <button type="button" class="ghost" (click)="reset()">reset</button>
      </div>
      @switch (status()) {
        @case ('idle') {
          <p class="muted">Idle — nothing requested yet.</p>
        }
        @case ('pending') {
          <p class="muted">Pending… awaiting a Promise.</p>
        }
        @case ('success') {
          <p class="ok">✅ Resolved: {{ result() }}</p>
        }
        @case ('error') {
          <p class="err">✖️ Rejected: {{ result() }}</p>
        }
      }
    </div>
  `,
  styles: [
    `
      .col {
        display: flex;
        flex-direction: column;
        gap: var(--space-xs);
      }
      .row {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: var(--space-sm);
      }
      .solid {
        padding: var(--space-xs) var(--space-md);
        font-size: var(--text-body);
        border: none;
        border-radius: var(--radius-md);
        background-color: var(--color-primary);
        color: var(--color-on-primary);
        box-shadow: var(--shadow-button-card);
      }
      .solid:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }
      .solid:not(:disabled):hover {
        background-color: var(--color-primary-container);
        box-shadow: var(--shadow-button-card-hover);
      }
      .ghost {
        padding: var(--space-xs) var(--space-md);
        font-size: var(--text-body);
        border: 1px solid var(--color-outline);
        border-radius: var(--radius-md);
        background: transparent;
        color: var(--color-on-surface);
      }
      .ghost:hover {
        background-color: var(--color-surface-variant);
      }
      .muted {
        margin: 0;
        font-size: var(--text-body-sm);
        color: var(--color-on-surface-variant);
      }
      .ok {
        margin: 0;
        font-size: var(--text-body-sm);
        color: var(--color-secondary);
      }
      .err {
        margin: 0;
        font-size: var(--text-body-sm);
        color: var(--color-critical);
      }
    `,
  ],
})
class AsyncDemo {
  readonly status = signal<Status>(STATUS.idle);
  readonly result = signal('');

  async run(): Promise<void> {
    this.status.set(STATUS.pending);
    this.result.set('');
    try {
      const value = await this.fakeFetch();
      this.result.set(value);
      this.status.set(STATUS.success);
    } catch (err) {
      this.result.set(err instanceof Error ? err.message : String(err));
      this.status.set(STATUS.error);
    }
  }

  reset(): void {
    this.status.set(STATUS.idle);
    this.result.set('');
  }

  /** A deterministic fake — resolves ~70% of the time, rejects otherwise. */
  private fakeFetch(): Promise<string> {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (Math.random() < 0.7) resolve(`post #${1 + Math.floor(Math.random() * 99)}`);
        else reject(new Error('network timeout (simulated)'));
      }, 650);
    });
  }
}

/* -------------------------------------------------------------------------- */
/* 7. Spread/destructuring — live: merge + override                           */
/* -------------------------------------------------------------------------- */

/**
 * SpreadDemo — toggle a base object through a spread override and an array
 * spread. Demonstrates (a) shallow object copy + override and (b) array
 * concat/spread, both rendered live so the before/after is visible.
 */
@Component({
  selector: 'app-spread-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="col">
      <div class="row">
        <button type="button" class="solid" (click)="toggle()">
          {{ overridden() ? 'Restore base' : 'Spread + override' }}
        </button>
      </div>
      <div class="grid">
        <div class="panel">
          <p class="caption">base</p>
          <pre class="code">{{ format(base) }}</pre>
        </div>
        <div class="panel">
          <p class="caption">derived (spread)</p>
          <pre class="code">{{ format(derived()) }}</pre>
        </div>
      </div>
      <p class="muted">
        derived = overridden ? &#123; …base, …overrides &#125; : &#123; …base &#125;
      </p>
    </div>
  `,
  styles: [
    `
      .col {
        display: flex;
        flex-direction: column;
        gap: var(--space-sm);
      }
      .row {
        display: flex;
        align-items: center;
        gap: var(--space-sm);
      }
      .solid {
        padding: var(--space-xs) var(--space-md);
        font-size: var(--text-body);
        border: none;
        border-radius: var(--radius-md);
        background-color: var(--color-primary);
        color: var(--color-on-primary);
        box-shadow: var(--shadow-button-card);
      }
      .solid:hover {
        background-color: var(--color-primary-container);
        box-shadow: var(--shadow-button-card-hover);
      }
      .grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: var(--space-sm);
      }
      .panel {
        padding: var(--space-sm);
        border: 1px solid var(--color-outline);
        border-radius: var(--radius-md);
        background-color: var(--color-surface-variant);
      }
      .caption {
        margin: 0 0 var(--space-xs);
        font-size: var(--text-caption);
        color: var(--color-on-surface-variant);
      }
      .code {
        margin: 0;
        font-family: var(--font-mono);
        font-size: var(--text-body-sm);
        color: var(--color-on-surface);
        white-space: pre-wrap;
      }
      .muted {
        margin: 0;
        font-size: var(--text-caption);
        color: var(--color-on-surface-variant);
        font-family: var(--font-mono);
      }
    `,
  ],
})
class SpreadDemo {
  readonly base = { id: 1, name: 'Sam', role: 'engineer', tags: ['a', 'b'] };
  readonly overridden = signal(false);

  readonly derived = computed(() =>
    this.overridden()
      ? { ...this.base, name: 'Jo', role: 'lead', tags: [...this.base.tags, 'c'] }
      : { ...this.base, tags: [...this.base.tags] },
  );

  toggle(): void {
    this.overridden.update((v) => !v);
  }

  format(value: unknown): string {
    return JSON.stringify(value, null, 2);
  }
}

/* -------------------------------------------------------------------------- */
/* Main view — declared last (see the TDZ note at the top of the file).       */
/* -------------------------------------------------------------------------- */

@Component({
  selector: 'app-ts-js-fundamentals',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    SectionWrapper,
    TextBlock,
    CodeBlock,
    Example,
    ContentGroupWrapper,
    VariablesDemo,
    TypedObjectDemo,
    ArrayMethodsDemo,
    AccountDemo,
    GenericsDemo,
    AsyncDemo,
    SpreadDemo,
  ],
  templateUrl: './ts_js_fundamentals_view.html',
  styleUrl: './ts_js_fundamentals_view.scss',
})
export class TsJsFundamentalsView {
  /** Code listings rendered by the page's <ui-code-block> elements. Kept here
   *  (not inline in the HTML) so the template stays readable and the strings
   *  get full TS string-literal highlighting/editing. */
  readonly snippets = SNIPPETS;
}

/* -------------------------------------------------------------------------- */
/* Code listings shown in the page's <ui-code-block> elements.                */
/* -------------------------------------------------------------------------- */

const SNIPPETS = {
  variables: `// const — binding can't be reassigned (the object can still mutate)
const pi = 3.14159;
const user = { name: 'Sam' };
user.name = 'Jo';            // OK — object mutates, binding unchanged
// user = { name: 'Jo' };   // ERROR — can't reassign a const

// let — block-scoped, reassignable
let count = 0;
count = count + 1;

// var — function-scoped + hoisted. Avoid in modern code.
var legacy = 'hoisted, uninitialized before its line';`,
  tdz: `// let/const are hoisted but stay uninitialized until their line runs
// (the "temporal dead zone"). Using them early throws.
console.log(later); // ReferenceError (TDZ)
let later = 1;

// var hoists AND initializes to undefined — the source of many bugs.
console.log(old); // undefined
var old = 2;`,
  primitives: `// Seven primitives: string, number, boolean, null, undefined, bigint, symbol
const str: string = 'hi';
const n: number = 42;            // one number type — ints & floats unified
const big: bigint = 9007199254740993n;
const flag: boolean = true;
const nothing: null = null;
const missing: undefined = undefined;

// typeof is a RUNTIME operator on values (not TS types):
typeof 'hi';        // 'string'
typeof 42;          // 'number'
typeof null;        // 'object'   <- famous JS quirk, not 'null'
typeof undefined;   // 'undefined'

// Objects (incl. arrays & functions) are compared by REFERENCE, not value:
{} === {};           // false — two different objects
[1] === [1];         // false`,
  equality: `// == coerces types (surprising). === compares without coercion.
0 == '';             // true   (avoid)
0 === '';            // false
null == undefined;   // true
null === undefined;  // false

// Rule this codebase's lint enforces: always === and !==.`,
  annotations: `// TS infers most types — annotate boundaries, not everything.
let age = 30;            // inferred number — no annotation needed
let score: number;       // declared without a value: annotate

// Parameters always need types; return type is inferred but often declared.
function add(a: number, b: number): number {
  return a + b;
}`,
  unions: `// A value can be one of several types with a union (|).
type Status = 'idle' | 'loading' | 'success' | 'error';
type ID = string | number;

function label(s: Status): string {
  switch (s) {                       // TS narrows per case
    case 'idle':    return 'Not started';
    case 'loading': return 'Working…';
    case 'success': return 'Done';
    case 'error':   return 'Failed';
  }
}`,
  intersections: `// Intersection (&) combines multiple types into one — the value must
// satisfy ALL of them. Useful for mixing capabilities (composition).
type Named = { name: string };
type Timestamped = { createdAt: Date };

type Record = Named & Timestamped;
// = { name: string; createdAt: Date }

const r: Record = { name: 'Sam', createdAt: new Date() };

// interface supports the same via 'extends':
interface Animal { name: string }
interface Pet extends Animal { owner: string }`,
  objects: `type User = {
  id: number;
  name: string;
  role?: string;            // optional — may be absent
  readonly createdAt: string;  // can't be reassigned
};

const u: User = { id: 1, name: 'Sam', createdAt: '2024-01-01' };`,
  arraysTuples: `const nums: number[] = [1, 2, 3];        // or Array<number>
const users: User[] = [];

// tuple — fixed length, positional types. Great for pairs / returns.
const pair: [string, number] = ['Sam', 30];
const [name, age] = pair;                  // destructure by position
const name0 = pair[0];                      // string`,
  interfaceVsType: `// Both describe a shape; largely interchangeable.
interface Animal { name: string; speak(): void; }

class Dog implements Animal {
  constructor(public name: string) {}
  speak() { return 'woof'; }
}

// Convention: interface for extensible object contracts (can be implemented /
// declaration-merged). type for unions and computed/mapped shapes.
type JSON = string | number | boolean | null | JSON[] | { [k: string]: JSON };`,
  functions: `// 1. declaration — hoisted (callable before its line)
function add(a: number, b: number): number { return a + b; }

// 2. expression — not hoisted
const add2 = function (a: number, b: number): number { return a + b; };

// 3. arrow — concise, lexical \`this\` (does not bind its own)
const add3 = (a: number, b: number): number => a + b;`,
  arrowThis: `// Arrow functions don't bind their own \`this\` — they read it lexically.
//  This matters inside class methods that pass callbacks around.
class Counter {
  private count = 0;
  start() {
    // \`this\` inside the arrow is the Counter — correct.
    setInterval(() => this.count++, 1000);
  }
}`,
  params: `// Optional params (?) must follow required ones. Defaults with =.
// Rest params (...) collect trailing args into an array.
function greet(name: string, greeting = 'Hello', ...tags: string[]): string {
  const suffix = tags.length ? \` [\${tags.join(',')}]\` : '';
  return \`\${greeting}, \${name}!\${suffix}\`;
}

greet('Sam');                       // 'Hello, Sam!'
greet('Sam', 'Hi');                 // 'Hi, Sam!'
greet('Sam', 'Hi', 'vip', 'new');   // 'Hi, Sam! [vip,new]'`,
  controlFlow: `function classify(n: number): string {
  if (n < 0) return 'negative';
  else if (n === 0) return 'zero';
  else return 'positive';
}

// switch is most useful over unions — TS narrows the value per case.
switch (status) {
  case 'loading':
    showSpinner();
    break;                 // without break, falls into the next case
  case 'error':
    showError();
    break;
  default:
    render();
}`,
  loops: `const nums = [1, 2, 3];

// for...of iterates VALUES (arrays, strings, sets).
for (const n of nums) console.log(n);           // 1, 2, 3

// for...in iterates KEYS — avoid for arrays (order/prototype noise).
for (const key in { a: 1, b: 2 }) console.log(key);  // 'a', 'b'

// Functional array methods — the idiomatic, preferred form:
const doubled = nums.map((n) => n * 2);           // [2, 4, 6]
const evens   = nums.filter((n) => n % 2 === 0);  // [2]
const sum     = nums.reduce((acc, n) => acc + n, 0); // 6
nums.forEach((n) => console.log(n));              // side effect, no return`,
  spread: `// spread (...) expands an iterable into elements, or collects them back.
const a = [1, 2];
const b = [...a, 3];                       // [1, 2, 3]  (shallow copy)

// object spread — copy + override selected fields (shallow!):
const merged = { ...user, name: 'Jo' };

// rest pattern — bundle the rest into an array:
const [first, ...rest] = [1, 2, 3];        // first=1, rest=[2,3]`,
  destructuring: `// object — pull values out by name (with rename + default):
const { name, role = 'guest' } = user;
const { name: fullName } = user;           // rename

// array — by position:
const [x, y] = [10, 20];

// function-param destructuring — everywhere in component inputs:
function render(props: { title: string; subtitle?: string }) {
  const { title, subtitle } = props;
}`,
  nullish: `// ?? returns the right side ONLY for null/undefined (keeps 0 and '').
const name = input ?? 'anonymous';          // use this, not ||
const fallback = 0 || 'default';            // BUG: returns 'default' (0 is falsy)

// ?. short-circuits on null/undefined instead of throwing.
const city = user?.address?.city;            // undefined if any link is missing
const len = user?.name?.length ?? 0;         // safe default at the end`,
  classes: `class Account {
  // parameter properties — shorthand for declare + assign in constructor
  constructor(
    public readonly id: number,
    public owner: string,
    private balance: number,
  ) {}

  deposit(amount: number): void {
    if (amount <= 0) throw new Error('amount must be positive');
    this.balance += amount;
  }

  withdraw(amount: number): void {
    if (amount > this.balance) throw new Error('insufficient funds');
    this.balance -= amount;
  }

  getBalance(): number { return this.balance; }   // private — read via method
}`,
  generics: `// <T> is a type parameter — the caller picks the element type once.
function first<T>(items: T[]): T | undefined {
  return items[0];
}
const n = first([1, 2, 3]);   // number | undefined (T captured from the arg)
const s = first(['a', 'b']);  // string | undefined

// constrained generic — T must have a \`length\` property:
function longest<T extends { length: number }>(a: T, b: T): T {
  return a.length >= b.length ? a : b;
}

// generic classes — this app's Stack<T>, Result<T, E>, Repository<T> …
class Stack<T> {
  private items: T[] = [];
  push(x: T) { this.items.push(x); }
  pop(): T | undefined { return this.items.pop(); }
}`,
  promises: `// A Promise is a value-available-later object.
const p: Promise<number> = fetch('/api/x')
  .then((r) => r.json())
  .then((body) => body.count)
  .catch((err) => { console.error(err); return 0; });`,
  asyncAwait: `// async/await is sugar over promises — reads top-to-bottom.
async function loadPosts(): Promise<void> {
  try {
    const res = await fetch('/api/posts');   // pauses until settled
    const posts = await res.json();
    console.log(posts);
  } catch (err) {
    console.error(err);                        // rejected promise lands here
  }
}

// Parallel — independent tasks should run together, not sequentially:
const [user, posts] = await Promise.all([getUser(), getPosts()]);`,
  modules: `// ES modules — each file is a module with its own scope.
// math.ts — named exports:
export const add = (a: number, b: number) => a + b;
export type Vec = { x: number; y: number };

// default export — one per module:
export default function square(n: number) { return n * n; }

// consumer:
import square, { add, type Vec } from './math';   // \`type\` is erased at build
import * as math from './math';                    // namespace import`,
  exceptions: `function divide(a: number, b: number): number {
  if (b === 0) throw new Error('divide by zero');   // throw Error subclasses
  return a / b;
}

try {
  divide(1, 0);
} catch (err) {
  // \`err\` is \`unknown\` by default — narrow it before using:
  const msg = err instanceof Error ? err.message : String(err);
  console.error(msg);
} finally {
  // always runs — release locks, close files, etc.
}`,
  utilityTypes: `type User = { id: number; name: string; email: string; role: string };

type UserSummary = Pick<User, 'id' | 'name'>;   // { id, name }
type CreateUser  = Omit<User, 'id'>;             // everything but id
type UserPatch   = Partial<User>;                // all fields optional
type GuestUser   = Readonly<User>;               // all fields readonly
type UserRecord  = Record<string, User>;         // { [k: string]: User }

// Built-ins you'll see across this codebase:
type T = any;      // avoid — opts out of type-checking
type U = unknown;  // safe "I don't know yet" — must narrow before use
type V = void;     // function returns nothing
type N = never;    // unreachable / impossible`,
} as const;
