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
  readonly bursts = this.bursts$.asObservable();

  burst(
    kind: ParticleKind = 'confetti',
    source?: Event | { clientX: number; clientY: number },
  ): void {
    const point = this.resolvePoint(source);
    this.bursts$.next({ ...point, kind });
  }

  burstCenter(kind: ParticleKind = 'confetti'): void {
    this.bursts$.next({
      x: window.innerWidth / 2,
      y: window.innerHeight * 0.38,
      kind,
    });
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
    return {
      x: window.innerWidth / 2,
      y: window.innerHeight * 0.42,
    };
  }
}
