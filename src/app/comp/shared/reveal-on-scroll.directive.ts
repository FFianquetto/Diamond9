import {
  Directive,
  ElementRef,
  OnDestroy,
  OnInit,
  inject,
} from '@angular/core';

/**
 * Revela un bloque cuando entra al viewport. Si el navegador no soporta
 * IntersectionObserver el contenido se muestra de inmediato.
 */
@Directive({
  selector: '[appReveal]',
  standalone: true,
})
export class RevealOnScrollDirective implements OnInit, OnDestroy {
  private readonly host = inject(ElementRef<HTMLElement>);
  private observer?: IntersectionObserver;

  ngOnInit(): void {
    const el = this.host.nativeElement as HTMLElement;
    el.classList.add('reveal-on-scroll');

    if (typeof IntersectionObserver === 'undefined') {
      el.classList.add('visible');
      return;
    }

    this.observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) {
            continue;
          }
          entry.target.classList.add('visible');
          this.observer?.unobserve(entry.target);
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -8% 0px' },
    );

    this.observer.observe(el);
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
  }
}
