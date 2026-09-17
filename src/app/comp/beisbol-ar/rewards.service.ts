import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, of, tap } from 'rxjs';
import {
  CartaColeccion,
  CartaJuegoId,
  CartaScanModo,
  CartaUnlockSource,
  CartasColeccionFile,
  Premio,
  RecompensasFile,
  RewardsProgress,
} from './content.types';
import { ScanModo } from './lnm-catalog.types';

export interface CartaUnlockCelebration {
  title: string;
  subtitle: string;
  tone: 'gold' | 'silver' | 'cyan';
  cartas: CartaColeccion[];
}

const STORAGE_KEY = 'd9-coleccion-v2';
const LEGACY_KEYS = ['d9-coleccion-v1', 'd9-rewards-v2'];

const EMPTY: RewardsProgress = {
  scans: [],
  premios: [],
  cartas: [],
  cartaSources: {},
  scanModesDone: [],
  juegoJonron: false,
  juegoRebote: false,
  triviaHecha: false,
};

const JUEGO_LABEL: Record<CartaJuegoId, string> = {
  jonron: 'Jonrón al toque',
  rebote: 'Hockey de rebote',
  trivia: 'Trivia',
};

const SCAN_LABEL: Record<CartaScanModo, string> = {
  tarjeta: 'Escáner · Tarjeta',
  logo: 'Escáner · Logo',
  gorra: 'Escáner · Gorra',
};

@Injectable({ providedIn: 'root' })
export class RewardsService {
  private readonly http = inject(HttpClient);
  private readonly base = 'assets/data';

  private catalog: RecompensasFile | null = null;
  private cartasFile: CartasColeccionFile | null = null;
  private readonly progress = signal<RewardsProgress>(this.load());
  private readonly celebrationSig = signal<CartaUnlockCelebration | null>(null);

  readonly state = this.progress.asReadonly();
  readonly celebration = this.celebrationSig.asReadonly();
  readonly totalScans = computed(() => this.progress().scans.length);
  readonly totalPremios = computed(() => this.progress().premios.length);
  readonly totalCartas = computed(() => this.progress().cartas.length);

  constructor() {
    // Precarga reglas de desbloqueo (juegos / escáner pueden ocurrir antes de abrir Colección).
    this.loadCartas().subscribe();
    this.loadCatalog().subscribe();
  }

  loadCatalog(): Observable<RecompensasFile> {
    if (this.catalog) return of(this.catalog);
    return this.http.get<RecompensasFile>(`${this.base}/recompensas.json`).pipe(
      tap((file) => (this.catalog = file)),
      catchError(() => of({ titulo: 'Premios', nota: '', premios: [] })),
    );
  }

  loadCartas(): Observable<CartasColeccionFile> {
    if (this.cartasFile) {
      this.ensureInitialCarta();
      return of(this.cartasFile);
    }
    return this.http
      .get<CartasColeccionFile>(`${this.base}/cartas-coleccion.json`)
      .pipe(
        tap((file) => {
          this.cartasFile = file;
          this.ensureInitialCarta();
          this.syncUnlockedFromProgress();
        }),
        catchError(() =>
          of({ titulo: 'Mi colección', nota: '', cartas: [] }),
        ),
      );
  }

  hasPremio(id: string): boolean {
    return this.progress().premios.includes(id);
  }

  hasCarta(id: string): boolean {
    return this.progress().cartas.includes(id);
  }

  cartaSource(id: string): CartaUnlockSource | null {
    return this.progress().cartaSources[id] ?? null;
  }

  wasScanned(markerId: string): boolean {
    return this.progress().scans.includes(markerId);
  }

  /**
   * Registra un escaneo AR. Si es la primera vez en ese modo
   * (tarjeta / logo / gorra), desbloquea la carta plateada asociada.
   */
  recordScan(markerId: string, modo?: ScanModo): string | null {
    const p = this.progress();
    const scans = p.scans.includes(markerId) ? p.scans : [...p.scans, markerId];
    this.patch({ scans });

    let cartaMsg: string | null = null;
    if (modo) cartaMsg = this.unlockScannerMode(modo);

    const premioMsg = this.tryUnlockScanPremios(scans.length);
    return cartaMsg ?? premioMsg;
  }

  recordJonronPlayed(): string | null {
    if (this.progress().juegoJonron) return null;
    this.patch({ juegoJonron: true });
    const cartas = this.unlockGamePair('jonron', true);
    const premio = this.unlockPremio('jonron');
    return this.formatUnlockMessage(
      cartas.map((c) => c.nombre),
      premio,
    );
  }

  recordReboteWin(): string | null {
    if (this.progress().juegoRebote) return null;
    this.patch({ juegoRebote: true });
    const cartas = this.unlockGamePair('rebote', true);
    const premio = this.unlockPremio('rebote');
    return this.formatUnlockMessage(
      cartas.map((c) => c.nombre),
      premio,
    );
  }

  recordTriviaDone(): string | null {
    if (this.progress().triviaHecha) return null;
    this.patch({ triviaHecha: true });
    const cartas = this.unlockGamePair('trivia', true);
    const premio = this.unlockPremio('trivia');
    return this.formatUnlockMessage(
      cartas.map((c) => c.nombre),
      premio,
    );
  }

  dismissCelebration(): void {
    this.celebrationSig.set(null);
  }

  /** Etiqueta corta: dónde se ganó (sin “filtro dorado/plateado”). */
  originBadge(carta: CartaColeccion): string {
    const u = carta.unlock;
    if (u.via === 'inicial') return 'Carta inicial';
    if (u.via === 'juego' && u.juego) return JUEGO_LABEL[u.juego];
    if (u.via === 'scanner' && u.modo) return SCAN_LABEL[u.modo];
    if (u.via === 'completo') return 'Colección completa';
    return 'Colección';
  }

  /** Texto de ayuda según regla de desbloqueo. */
  unlockHint(carta: CartaColeccion): string {
    const u = carta.unlock;
    if (u.via === 'inicial') return 'Carta inicial';
    if (u.via === 'completo') return 'Completa las 10 cartas';
    if (u.via === 'juego') {
      return u.juego ? `Juega: ${JUEGO_LABEL[u.juego]}` : 'Completa un juego';
    }
    return u.modo ? SCAN_LABEL[u.modo] : 'Escanea en AR';
  }

  private ensureInitialCarta(): void {
    const iniciales =
      this.cartasFile?.cartas.filter((c) => c.unlock.via === 'inicial') ?? [];
    for (const c of iniciales) {
      this.grantCarta(c.id, 'inicial');
    }
  }

  /** Si ya jugó/escaneó antes de cargar el catálogo, otorga las cartas pendientes. */
  private syncUnlockedFromProgress(): void {
    const p = this.progress();
    if (p.juegoJonron) this.unlockGamePair('jonron', false);
    if (p.juegoRebote) this.unlockGamePair('rebote', false);
    if (p.triviaHecha) this.unlockGamePair('trivia', false);
    for (const modo of p.scanModesDone) {
      const carta = this.cartasFile?.cartas.find(
        (c) => c.unlock.via === 'scanner' && c.unlock.modo === modo,
      );
      if (carta) this.grantCarta(carta.id, 'scanner');
    }
    this.tryUnlockCompletion(false);
  }

  private unlockGamePair(
    juego: CartaJuegoId,
    celebrate: boolean,
  ): CartaColeccion[] {
    const list =
      this.cartasFile?.cartas.filter(
        (c) => c.unlock.via === 'juego' && c.unlock.juego === juego,
      ) ?? [];
    const granted: CartaColeccion[] = [];
    for (const c of list) {
      if (this.grantCarta(c.id, 'juego')) granted.push(c);
    }
    if (celebrate && granted.length) {
      this.showCelebration({
        title: '¡Cartas desbloqueadas!',
        subtitle: JUEGO_LABEL[juego],
        tone: 'gold',
        cartas: granted,
      });
    }
    this.tryUnlockCompletion(celebrate);
    return granted;
  }

  private unlockScannerMode(modo: CartaScanModo): string | null {
    const p = this.progress();
    if (p.scanModesDone.includes(modo)) return null;

    const carta = this.cartasFile?.cartas.find(
      (c) => c.unlock.via === 'scanner' && c.unlock.modo === modo,
    );
    this.patch({ scanModesDone: [...p.scanModesDone, modo] });
    if (!carta) return null;
    const ok = this.grantCarta(carta.id, 'scanner');
    if (ok) {
      this.showCelebration({
        title: '¡Carta desbloqueada!',
        subtitle: SCAN_LABEL[modo],
        tone: 'silver',
        cartas: [carta],
      });
      this.tryUnlockCompletion(true);
      return `Carta: ${carta.nombre}`;
    }
    return null;
  }

  /** Al tener las 10 base, otorga los emblemas legendarios MLB + LMB. */
  private tryUnlockCompletion(celebrate: boolean): CartaColeccion[] {
    const base =
      this.cartasFile?.cartas.filter((c) => c.unlock.via !== 'completo') ?? [];
    if (!base.length) return [];
    const allBase = base.every((c) => this.hasCarta(c.id));
    if (!allBase) return [];

    const bonus =
      this.cartasFile?.cartas.filter((c) => c.unlock.via === 'completo') ?? [];
    const granted: CartaColeccion[] = [];
    for (const c of bonus) {
      if (this.grantCarta(c.id, 'completo')) granted.push(c);
    }
    if (celebrate && granted.length) {
      this.showCelebration({
        title: '¡Colección completa!',
        subtitle: 'Emblemas legendarios',
        tone: 'cyan',
        cartas: granted,
      });
    }
    return granted;
  }

  private showCelebration(payload: CartaUnlockCelebration): void {
    this.celebrationSig.set(payload);
  }

  private grantCarta(id: string, source: CartaUnlockSource): boolean {
    if (this.hasCarta(id)) {
      const sources = { ...this.progress().cartaSources };
      if (!sources[id]) {
        sources[id] = source;
        this.patch({ cartaSources: sources });
      }
      return false;
    }
    const p = this.progress();
    this.patch({
      cartas: [...p.cartas, id],
      cartaSources: { ...p.cartaSources, [id]: source },
    });
    return true;
  }

  private formatUnlockMessage(
    names: string[],
    premio: string | null,
  ): string | null {
    const parts: string[] = [];
    if (names.length) parts.push(`Cartas: ${names.join(' · ')}`);
    if (premio) parts.push(`Premio: ${premio}`);
    return parts.length ? parts.join(' · ') : null;
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
    const premio = this.catalog?.premios.find((p: Premio) => p.id === id);
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
      const raw =
        localStorage.getItem(STORAGE_KEY) ??
        LEGACY_KEYS.map((k) => localStorage.getItem(k)).find(Boolean) ??
        null;
      if (!raw) return { ...EMPTY, cartaSources: {}, scanModesDone: [] };
      const parsed = JSON.parse(raw) as Partial<RewardsProgress>;
      return {
        ...EMPTY,
        scans: parsed.scans ?? [],
        premios: parsed.premios ?? [],
        cartas: parsed.cartas ?? [],
        cartaSources: parsed.cartaSources ?? {},
        scanModesDone: parsed.scanModesDone ?? [],
        juegoJonron: parsed.juegoJonron ?? false,
        juegoRebote: parsed.juegoRebote ?? false,
        triviaHecha: parsed.triviaHecha ?? false,
      };
    } catch {
      return { ...EMPTY, cartaSources: {}, scanModesDone: [] };
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
