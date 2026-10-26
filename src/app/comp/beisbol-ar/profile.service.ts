import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, map, of } from 'rxjs';

export interface PerfilPublico {
  nombreUsuario: string;
  lema: string;
  estado: string;
  /** Data URL de la foto (localStorage). */
  avatarUrl: string | null;
}

const STORAGE_KEY = 'd9-perfil-usuario';
const AVATAR_KEY = 'd9-perfil-avatar';
const DEFAULT: PerfilPublico = {
  nombreUsuario: 'Fan Diamante',
  lema: 'Listo para el diamante',
  estado: 'En el parque',
  avatarUrl: null,
};

@Injectable({ providedIn: 'root' })
export class ProfileService {
  private readonly http = inject(HttpClient);
  private defaults: PerfilPublico = { ...DEFAULT };
  private readonly perfil = signal<PerfilPublico>({ ...DEFAULT });

  readonly state = this.perfil.asReadonly();
  readonly displayName = computed(
    () => this.perfil().nombreUsuario.trim() || DEFAULT.nombreUsuario,
  );
  readonly avatarUrl = computed(() => this.perfil().avatarUrl);

  load(): Observable<PerfilPublico> {
    return this.http
      .get<{
        nombreUsuario?: string;
        lema?: string;
        estado?: string;
      }>('assets/data/perfil.json')
      .pipe(
        map((file) => {
          this.defaults = {
            nombreUsuario: file.nombreUsuario?.trim() || DEFAULT.nombreUsuario,
            lema: file.lema?.trim() || DEFAULT.lema,
            estado: file.estado?.trim() || DEFAULT.estado,
            avatarUrl: null,
          };
          const next: PerfilPublico = {
            ...this.defaults,
            nombreUsuario: this.readSavedName() || this.defaults.nombreUsuario,
            avatarUrl: this.readSavedAvatar(),
          };
          this.perfil.set(next);
          return next;
        }),
        catchError(() => {
          const next: PerfilPublico = {
            ...DEFAULT,
            nombreUsuario: this.readSavedName() || DEFAULT.nombreUsuario,
            avatarUrl: this.readSavedAvatar(),
          };
          this.perfil.set(next);
          return of(next);
        }),
      );
  }

  setNombreUsuario(nombre: string): void {
    const typed = nombre.slice(0, 24);
    const stored = typed.trim().slice(0, 24);
    this.perfil.update((p) => ({
      ...p,
      nombreUsuario: stored || typed,
    }));
    try {
      if (stored) localStorage.setItem(STORAGE_KEY, stored);
      else localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* private mode */
    }
  }

  /** Guarda una foto ya normalizada (data URL JPEG/PNG). */
  setAvatarUrl(dataUrl: string | null): void {
    this.perfil.update((p) => ({ ...p, avatarUrl: dataUrl }));
    try {
      if (dataUrl) localStorage.setItem(AVATAR_KEY, dataUrl);
      else localStorage.removeItem(AVATAR_KEY);
    } catch {
      /* private mode / quota */
    }
  }

  clearAvatar(): void {
    this.setAvatarUrl(null);
  }

  /**
   * Lee un File de imagen, lo recorta a cuadrado centrado y lo comprime
   * para caber en localStorage.
   */
  async importAvatarFile(file: File): Promise<string> {
    if (!file.type.startsWith('image/')) {
      throw new Error('El archivo no es una imagen');
    }
    const bitmap = await createImageBitmap(file);
    const size = Math.min(bitmap.width, bitmap.height);
    const sx = Math.floor((bitmap.width - size) / 2);
    const sy = Math.floor((bitmap.height - size) / 2);
    const out = 256;
    const canvas = document.createElement('canvas');
    canvas.width = out;
    canvas.height = out;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      bitmap.close();
      throw new Error('Canvas no disponible');
    }
    ctx.drawImage(bitmap, sx, sy, size, size, 0, 0, out, out);
    bitmap.close();
    let quality = 0.85;
    let dataUrl = canvas.toDataURL('image/jpeg', quality);
    while (dataUrl.length > 180_000 && quality > 0.45) {
      quality -= 0.1;
      dataUrl = canvas.toDataURL('image/jpeg', quality);
    }
    this.setAvatarUrl(dataUrl);
    return dataUrl;
  }

  private readSavedName(): string | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const name = raw?.trim();
      return name ? name.slice(0, 24) : null;
    } catch {
      return null;
    }
  }

  private readSavedAvatar(): string | null {
    try {
      const raw = localStorage.getItem(AVATAR_KEY);
      return raw?.startsWith('data:image/') ? raw : null;
    } catch {
      return null;
    }
  }
}
