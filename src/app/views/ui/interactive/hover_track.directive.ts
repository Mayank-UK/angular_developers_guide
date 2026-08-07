import {
  Directive,
  ElementRef,
  HostBinding,
  HostListener,
  inject,
  input,
} from '@angular/core';

/**
 * HoverTrackDirective — the directive equivalent of `(mouseenter)` /
 * `(mouseleave)` / `(focus)` / `(blur)` template bindings.
 *
 * `@HostListener` attaches a listener to the **host** element (the element the
 * directive sits on), so the same behaviour can be reused across many elements
 * without repeating the bindings in every template. `@HostBinding` wires a host
 * property/attribute/style back to a value the directive controls. Together
 * they let a directive fully own one slice of a host's appearance or behaviour.
 *
 * This file is itself teaching material — its source is rendered verbatim in a
 * `<ui-code-block>` on the Interactive behaviours screen, so keep it readable.
 */
@Directive({
  selector: '[appHoverTrack]',
})
export class HoverTrackDirective {
  /** A CSS colour the host's background snaps to while hovered. */
  readonly appHoverTrack = input<string>('var(--color-primary-container)');

  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef);

  /** Bind the host's `style.transition` — set once, kept in sync for free. */
  @HostBinding('style.transition')
  readonly transition = 'background-color 120ms ease, transform 120ms ease';

  /** Host mouse enter → tint the background. */
  @HostListener('mouseenter')
  onEnter(): void {
    this.el.nativeElement.style.backgroundColor = this.appHoverTrack();
  }

  /** Host mouse leave → clear the tint. */
  @HostListener('mouseleave')
  onLeave(): void {
    this.el.nativeElement.style.backgroundColor = '';
  }

  /** Host keyboard focus → lift slightly so focus state is visible. */
  @HostListener('focus')
  onFocus(): void {
    this.el.nativeElement.style.transform = 'translateY(-2px)';
  }

  /** Host blur → drop back to rest position. */
  @HostListener('blur')
  onBlur(): void {
    this.el.nativeElement.style.transform = '';
  }
}
