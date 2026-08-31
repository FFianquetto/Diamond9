import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, of, tap } from 'rxjs';
import { Premio, RecompensasFile, RewardsProgress } from './content.types';

const STORAGE_KEY = 'd9-rewards-v2';

const EMPTY: RewardsProgress = {
  scans: [],
  premios: [],
  juegoJonron: false,
  juegoRebote: false,
  triviaHecha: false,
};

@Injectable({ providedIn: 'root' })
export class RewardsService {
  private readonly http = inject(HttpClient);
  private readonly base = 'assets/data';

  private catalog: RecompensasFile | null = null;
  private readonly progress = signal<RewardsProgress>(this.load());

  readonly state = this.progress.asReadonly();
  readonly totalScans = computed(() => this.progress().scans.length);
  readonly totalPremios = computed(() => this.progress().premios.length);

  loadCatalog(): Observable<RecompensasFile> {
    if (this.catalog) return of(this.catalog);
    return this.http.get<RecompensasFile>(`${this.base}/recompensas.json`).pipe(
      tap((file) => (this.catalog = file)),
      catchError(() =>
        of({ titulo: 'Premios', nota: '', premios: [] }),
      ),
    );
  }

  hasPremio(id: string): boolean {
    return this.progress().premios.includes(id);
  }

  wasScanned(markerId: string): boolean {
    return this.progress().scans.includes(markerId);
  }

  /** Registra un escaneo AR. Devuelve título del premio nuevo, si hay. */
  recordScan(markerId: string): string | null {
    const p = this.progress();
    const scans = p.scans.includes(markerId) ? p.scans : [...p.scans, markerId];
    this.patch({ scans });
    return this.tryUnlockScanPremios(scans.length);
  }

  /** Terminó una entrada del juego de jonrón. */
  recordJonronPlayed(): string | null {
    if (this.progress().juegoJonron) return null;
    this.patch({ juegoJonron: true });
    return this.unlockPremio('jonron');
  }

  /** Ganó el juego de rebote. */
  recordReboteWin(): string | null {
    if (this.progress().juegoRebote) return null;
    this.patch({ juegoRebote: true });
    return this.unlockPremio('rebote');
  }

  /** Completó la trivia (sin importar puntaje). */
  recordTriviaDone(): string | null {
    if (this.progress().triviaHecha) return null;
    this.patch({ triviaHecha: true });
    return this.unlockPremio('trivia');
  }

  private tryUnlockScanPremios(scanCount: number): string | null {
    if (scanCount >= 1) {
      const a = this.unlockPremio('primer-escaneo');
      if (a) return a;
    }
    if (scanCount >= 3) {
      return this.unlockPremio('explorador');
    }
    return null;
  }

  private unlockPremio(id: string): string | null {
    if (this.hasPremio(id)) return null;
    const premio = this.catalog?.premios.find((p) => p.id === id);
    const p = this.progress();
    this.patch({ premios: [...p.premios, id] });
    return premio?.titulo ?? id;
  }

  private patch(partial: Partial<RewardsProgress>): void {
    const next = { ...this.progress(), ...partial };
    this.progress.set(next);
    this.save(next);
  }

  private load(): RewardsProgress {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { ...EMPTY };
      const parsed = JSON.parse(raw) as Partial<RewardsProgress>;
      return {
        ...EMPTY,
        scans: parsed.scans ?? [],
        premios: parsed.premios ?? [],
        juegoJonron: parsed.juegoJonron ?? false,
        juegoRebote: parsed.juegoRebote ?? false,
        triviaHecha: parsed.triviaHecha ?? false,
      };
    } catch {
      return { ...EMPTY };
    }
  }

  private save(data: RewardsProgress): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      /* quota / private mode */
    }
  }
}
