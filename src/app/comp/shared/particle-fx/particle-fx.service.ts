import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

export type ParticleKind = 'confetti' | 'homer' | 'spark' | 'strike';

export interface ParticleBurst {
  x: number;
  y: number;
  kind: ParticleKind;
}

@Injectable({ providedIn: 'root' })
export class ParticleFxService {
  private readonly bursts$ = new Subject<ParticleBurst>();
  private readonly clear$ = new Subject<void>();
  private rainTimer: ReturnType<typeof setInterval> | null = null;
  /** Ancla opcional (p. ej. marco de cámara) para centrar bursts. */
  private originEl: HTMLElement | null = null;

  readonly bursts = this.bursts$.asObservable();
  readonly clears = this.clear$.asObservable();

  setOrigin(el: HTMLElement | null): void {
    this.originEl = el;
  }

  burst(
    kind: ParticleKind = 'confetti',
    source?: Event | { clientX: number; clientY: number },
  ): void {
    const point = this.resolvePoint(source);
    this.bursts$.next({ ...point, kind });
  }

  burstCenter(kind: ParticleKind = 'confetti'): void {
    this.bursts$.next({ ...this.resolveCenter(), kind });
  }

  /** Lluvia continua de confeti (sigue aunque se quite el modelo). */
  startRain(kind: ParticleKind = 'confetti', intervalMs = 650): void {
    if (this.rainTimer) return;
    this.burstCenter(kind);
    this.rainTimer = setInterval(() => this.burstCenter(kind), intervalMs);
  }

  stopRain(): void {
    if (this.rainTimer) {
      clearInterval(this.rainTimer);
      this.rainTimer = null;
    }
  }

  isRaining(): boolean {
    return this.rainTimer != null;
  }

  /** Detiene la lluvia y limpia partículas visibles. */
  clear(): void {
    this.stopRain();
    this.clear$.next();
  }

  private resolveCenter(): { x: number; y: number } {
    const el = this.originEl;
    if (el?.isConnected) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) {
        return {
          x: r.left + r.width / 2,
          y: r.top + r.height / 2,
        };
      }
    }
    return {
      x: window.innerWidth / 2,
      y: window.innerHeight * 0.38,
    };
  }

  private resolvePoint(
    source?: Event | { clientX: number; clientY: number },
  ): { x: number; y: number } {
    if (source && 'clientX' in source && typeof source.clientX === 'number') {
      return { x: source.clientX, y: source.clientY };
    }
    if (source instanceof Event) {
      const evt = source as MouseEvent & TouchEvent;
      const touch = evt.changedTouches?.[0] ?? evt.touches?.[0];
      if (touch) {
        return { x: touch.clientX, y: touch.clientY };
      }
      if (typeof evt.clientX === 'number' && typeof evt.clientY === 'number') {
        return { x: evt.clientX, y: evt.clientY };
      }
    }
    return this.resolveCenter();
  }
}
