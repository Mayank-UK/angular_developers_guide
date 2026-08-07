import { Component, DestroyRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { createMediaQuerySignal } from './media-query';

/**
 * createMediaQuerySignal is an injection-context helper that reads
 * window.matchMedia and wires a listener cleaned up in DestroyRef.onDestroy.
 * Test it by mounting a tiny host component whose constructor calls the helper
 * (so inject() resolves DOCUMENT + DestroyRef), then assert the signal tracks
 * matchMedia and detaches on destroy.
 */

@Component({
  selector: 'app-mq-host',
  standalone: true,
  template: `<span>{{ matches() }}</span>`,
})
class MediaQueryHost {
  readonly matches = createMediaQuerySignal('(min-width: 9999px)');
}

describe('createMediaQuerySignal', () => {
  it('seeds the signal from matchMedia.matches', () => {
    TestBed.configureTestingModule({ imports: [MediaQueryHost] });
    const fixture = TestBed.createComponent(MediaQueryHost);
    // jsdom matchMedia (polyfilled in setup.ts) returns matches: false.
    expect(fixture.componentInstance.matches()).toBe(false);
  });

  it('updates when the matchMedia listener fires a change event', () => {
    const listeners: ((e: MediaQueryListEvent) => void)[] = [];
    const original = window.matchMedia;
    window.matchMedia = ((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: (_: string, fn: (e: MediaQueryListEvent) => void) =>
        listeners.push(fn),
      removeEventListener: (_: string, fn: (e: MediaQueryListEvent) => void) => {
        const i = listeners.indexOf(fn);
        if (i >= 0) listeners.splice(i, 1);
      },
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;

    try {
      TestBed.configureTestingModule({ imports: [MediaQueryHost] });
      const fixture = TestBed.createComponent(MediaQueryHost);
      expect(fixture.componentInstance.matches()).toBe(false);

      // Simulate the viewport crossing the threshold.
      for (const fn of listeners) {
        fn({ matches: true, media: '(min-width: 9999px)' } as MediaQueryListEvent);
      }
      expect(fixture.componentInstance.matches()).toBe(true);
    } finally {
      window.matchMedia = original;
    }
  });

  it('detaches the matchMedia listener on component destroy', () => {
    let removed = 0;
    const original = window.matchMedia;
    window.matchMedia = ((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {
        removed++;
      },
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;

    try {
      TestBed.configureTestingModule({ imports: [MediaQueryHost] });
      const fixture = TestBed.createComponent(MediaQueryHost);
      fixture.componentRef.injector.get(DestroyRef).onDestroy(() => {});
      fixture.destroy();
      expect(removed).toBe(1);
    } finally {
      window.matchMedia = original;
    }
  });
});
