import {
  Directive,
  ElementRef,
  HostBinding,
  HostListener,
  input,
  OnDestroy,
  OnInit,
  inject,
} from '@angular/core';

/**
 * HighlightDirective — a small attribute directive demo for the Angular
 * fundamentals screen. Attribute directives change the appearance or behaviour
 * of an existing element without replacing it (structural directives add/remove
 * elements instead — see the structural-directives section).
 *
 * Shown live in the page and the source is rendered verbatim in a CodeBlock, so
 * keep this file readable: it is itself the teaching material.
 */
@Directive({
  selector: '[appHighlight]',
})
export class HighlightDirective implements OnInit, OnDestroy {
  /** A CSS color the host element's background snaps to on hover. */
  readonly appHighlight = input<string>('var(--color-secondary-container)');

  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef);

  @HostBinding('style.transition')
  readonly transition = 'background-color 120ms ease';

  @HostListener('mouseenter')
  onEnter(): void {
    this.el.nativeElement.style.backgroundColor = this.appHighlight();
  }

  @HostListener('mouseleave')
  onLeave(): void {
    this.el.nativeElement.style.backgroundColor = '';
  }

  ngOnInit(): void {
    // A rounded surface reads as a "chip" — applied once on init, not on every
    // hover, so the transition only animates the background token.
    const node = this.el.nativeElement;
    node.style.padding = 'var(--space-xs) var(--space-sm)';
    node.style.borderRadius = 'var(--radius-sm)';
    node.style.cursor = 'default';
  }

  ngOnDestroy(): void {
    // No timers/listeners to clean (HostListener is auto-cleaned), but the hook
    // is shown on purpose so the directive mirrors a real one.
  }
}
