import { Injectable, signal } from '@angular/core';

export interface ScanPhoto {
  id: string;
  title: string;
  caption: string;
  src: string;
  tag: string;
  createdAt: number;
  markerId?: string;
}

const STORAGE_KEY = 'd9-scan-photos';
const MAX_PHOTOS = 12;
const MAX_EDGE = 960;
const JPEG_QUALITY = 0.72;

/**
 * Capturas del escáner AR → Galería (Imágenes).
 * Persistidas en localStorage como data URL comprimida.
 */
@Injectable({ providedIn: 'root' })
export class ScanPhotosService {
  private readonly photosSig = signal<ScanPhoto[]>(this.read());

  readonly photos = this.photosSig.asReadonly();

  async addFromBlob(
    blob: Blob,
    meta: { markerId?: string; markerName?: string } = {},
  ): Promise<ScanPhoto | null> {
    try {
      const src = await this.compressBlob(blob);
      const name = meta.markerName?.trim() || 'Captura AR';
      const photo: ScanPhoto = {
        id: `scan-${Date.now()}`,
        title: name,
        caption: 'Tomada en el escáner AR',
        src,
        tag: 'Captura',
        createdAt: Date.now(),
        markerId: meta.markerId,
      };
      this.photosSig.update((list) => [photo, ...list].slice(0, MAX_PHOTOS));
      this.persist();
      return photo;
    } catch {
      return null;
    }
  }

  remove(id: string): void {
    this.photosSig.update((list) => list.filter((p) => p.id !== id));
    this.persist();
  }

  clear(): void {
    this.photosSig.set([]);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* private mode */
    }
  }

  private persist(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.photosSig()));
    } catch {
      // Quota: ir quitando las más viejas
      const list = [...this.photosSig()];
      while (list.length > 1) {
        list.pop();
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
          this.photosSig.set(list);
          return;
        } catch {
          /* keep shrinking */
        }
      }
    }
  }

  private read(): ScanPhoto[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as ScanPhoto[];
      if (!Array.isArray(parsed)) return [];
      return parsed
        .filter(
          (p) =>
            p &&
            typeof p.id === 'string' &&
            typeof p.src === 'string' &&
            p.src.startsWith('data:image'),
        )
        .slice(0, MAX_PHOTOS);
    } catch {
      return [];
    }
  }

  private async compressBlob(blob: Blob): Promise<string> {
    const bitmap = await createImageBitmap(blob);
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      bitmap.close();
      throw new Error('Canvas 2D no disponible');
    }
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();
    return canvas.toDataURL('image/jpeg', JPEG_QUALITY);
  }
}
