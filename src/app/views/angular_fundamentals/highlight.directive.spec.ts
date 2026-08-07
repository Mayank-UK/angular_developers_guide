import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { HighlightDirective } from './highlight.directive';

/**
 * HighlightDirective is an attribute directive — it mutates the host element it
 * is applied to. Directives need TestBed: create a tiny host component that
 * declares the directive on a real DOM node, render it, then assert on the
 * rendered host (the directive's HostBinding/HostListener only fire through the
 * Angular change-detection + event-dispatch pipeline).
 */
@Component({
  selector: 'app-highlight-host',
  standalone: true,
  imports: [HighlightDirective],
  template: `<span appHighlight>hover me</span>`,
})
class HighlightHost {}

describe('HighlightDirective', () => {
  it('applies the chip styles (padding/radius/cursor) on init', async () => {
    await TestBed.configureTestingModule({
      imports: [HighlightHost],
    }).compileComponents();

    const fixture = TestBed.createComponent(HighlightHost);
    fixture.detectChanges();

    const host: HTMLElement =
      fixture.nativeElement.querySelector('span')!;
    expect(host.style.padding).toContain('var(--space');
    expect(host.style.borderRadius).toContain('var(--radius');
    expect(host.style.cursor).toBe('default');
  });

  it('sets a transition HostBinding', async () => {
    await TestBed.configureTestingModule({
      imports: [HighlightHost],
    }).compileComponents();

    const fixture = TestBed.createComponent(HighlightHost);
    fixture.detectChanges();

    const host: HTMLElement =
      fixture.nativeElement.querySelector('span')!;
    expect(host.style.transition).toBe('background-color 120ms ease');
  });

  it('paints the background on mouseenter and clears it on mouseleave', async () => {
    await TestBed.configureTestingModule({
      imports: [HighlightHost],
    }).compileComponents();

    const fixture = TestBed.createComponent(HighlightHost);
    fixture.detectChanges();

    const host: HTMLElement =
      fixture.nativeElement.querySelector('span')!;
    // Default background is empty (no inline style yet).
    expect(host.style.backgroundColor).toBe('');

    // jsdom does not resolve var(--…) when reading style.backgroundColor back,
    // so assert on the raw cssText which carries the authored value verbatim.
    host.dispatchEvent(new Event('mouseenter'));
    expect(host.style.cssText).toContain('background-color');

    host.dispatchEvent(new Event('mouseleave'));
    expect(host.style.backgroundColor).toBe('');
  });

  it('accepts a custom color via the input alias', async () => {
    @Component({
      selector: 'app-highlight-custom',
      standalone: true,
      imports: [HighlightDirective],
      template: `<span [appHighlight]="'#f00'">hover</span>`,
    })
    class CustomHost {}

    await TestBed.configureTestingModule({
      imports: [CustomHost],
    }).compileComponents();

    const fixture = TestBed.createComponent(CustomHost);
    fixture.detectChanges();

    const host: HTMLElement =
      fixture.nativeElement.querySelector('span')!;
    host.dispatchEvent(new Event('mouseenter'));
    // jsdom normalizes '#f00' to its rgb() form when read back.
    expect(host.style.backgroundColor).toBe('rgb(255, 0, 0)');
  });
});
