import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, of, tap } from 'rxjs';

export interface PerfilPublico {
  nombreUsuario: string;
  lema: string;
  estado: string;
}

const STORAGE_KEY = 'd9-perfil-usuario';
const DEFAULT: PerfilPublico = {
  nombreUsuario: 'Fan Diamante',
  lema: 'Listo para el diamante',
  estado: 'En el parque',
};

@Injectable({ providedIn: 'root' })
export class ProfileService {
  private readonly http = inject(HttpClient);
  private defaults: PerfilPublico = { ...DEFAULT };
  private readonly perfil = signal<PerfilPublico>({ ...DEFAULT });

  readonly state = this.perfil.asReadonly();
  readonly displayName = computed(() => this.perfil().nombreUsuario.trim() || DEFAULT.nombreUsuario);

  load(): Observable<PerfilPublico> {
    return this.http.get<PerfilPublico>('assets/data/perfil.json').pipe(
      tap((file) => {
        this.defaults = {
          nombreUsuario: file.nombreUsuario?.trim() || DEFAULT.nombreUsuario,
          lema: file.lema?.trim() || DEFAULT.lema,
          estado: file.estado?.trim() || DEFAULT.estado,
        };
        const saved = this.readSavedName();
        this.perfil.set({
          ...this.defaults,
          nombreUsuario: saved || this.defaults.nombreUsuario,
        });
      }),
      catchError(() => {
        const saved = this.readSavedName();
        this.perfil.set({
          ...DEFAULT,
          nombreUsuario: saved || DEFAULT.nombreUsuario,
        });
        return of(this.perfil());
      }),
    );
  }

  setNombreUsuario(nombre: string): void {
    const clean = nombre.trim().slice(0, 24) || this.defaults.nombreUsuario;
    this.perfil.update((p) => ({ ...p, nombreUsuario: clean }));
    try {
      localStorage.setItem(STORAGE_KEY, clean);
    } catch {
      /* private mode */
    }
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
}
