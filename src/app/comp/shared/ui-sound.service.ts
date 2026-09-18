import { Injectable } from '@angular/core';

export type UiSoundId = 'click' | 'filter' | 'success';

const SOUND_SRC: Record<UiSoundId, string> = {
  click: 'assets/sounds/ui-click.wav',
  filter: 'assets/sounds/ui-filter.wav',
  success: 'assets/sounds/ui-success.wav',
};

/**
 * Efectos de UI con archivos en `public/assets/sounds/`.
 * Más fiable que osciladores Web Audio (políticas de autoplay).
 */
@Injectable({ providedIn: 'root' })
export class UiSoundService {
  private unlocked = false;
  private readonly cache = new Map<UiSoundId, HTMLAudioElement>();

  /** Llamar en el primer click/tap del usuario. */
  unlock(): void {
    if (this.unlocked) return;
    this.unlocked = true;
    // Precarga silenciosa
    (Object.keys(SOUND_SRC) as UiSoundId[]).forEach((id) => {
      const a = this.getAudio(id);
      a.load();
    });
  }

  play(id: UiSoundId, volume = 0.65): void {
    this.unlock();
    try {
      const base = this.getAudio(id);
      // Clonar para solapar clicks rápidos
      const a = base.cloneNode(true) as HTMLAudioElement;
      a.volume = Math.max(0, Math.min(1, volume));
      a.currentTime = 0;
      void a.play().catch(() => {
        /* autoplay bloqueado hasta gesto del usuario */
      });
    } catch {
      /* audio opcional */
    }
  }

  private getAudio(id: UiSoundId): HTMLAudioElement {
    let a = this.cache.get(id);
    if (!a) {
      a = new Audio(SOUND_SRC[id]);
      a.preload = 'auto';
      this.cache.set(id, a);
    }
    return a;
  }
}
