export interface HistoriaEvento {
  year: number;
  titulo: string;
  descripcion: string;
}

export interface LeyendaBeisbol {
  id: string;
  nombre: string;
  pais: string;
  era: string;
  posicion: string;
  liga: string;
  /** mlb | mex — filtro de colección */
  origen: 'mlb' | 'mex';
  color: string;
  foto?: string;
  resumen: string;
  stats: { label: string; value: string }[];
  logros: string[];
}

export interface HistoriaFile {
  titulo: string;
  nota: string;
  timeline: HistoriaEvento[];
  leyendas: LeyendaBeisbol[];
}

export type CartaUnlockVia = 'inicial' | 'juego' | 'scanner' | 'completo';
export type CartaUnlockSource = CartaUnlockVia;
export type CartaJuegoId = 'jonron' | 'rebote' | 'trivia';
export type CartaScanModo = 'pelota' | 'logo' | 'gorra';

export interface CartaUnlockRule {
  via: CartaUnlockVia;
  /** Solo si via === 'juego' */
  juego?: CartaJuegoId;
  /** Solo si via === 'scanner' */
  modo?: CartaScanModo;
}

export interface CartaColeccion {
  id: string;
  nombre: string;
  origen: 'mlb' | 'mex';
  liga: string;
  serie: string;
  numero: number;
  color: string;
  foto: string;
  rareza: string;
  resumen: string;
  unlock: CartaUnlockRule;
}

export interface CartasColeccionFile {
  titulo: string;
  nota: string;
  cartas: CartaColeccion[];
}

export interface Premio {
  id: string;
  titulo: string;
  descripcion: string;
  icono: string;
}

export interface RecompensasFile {
  titulo: string;
  nota: string;
  premios: Premio[];
}

export interface RewardsProgress {
  scans: string[];
  premios: string[];
  /** IDs de cartas coleccionables desbloqueadas */
  cartas: string[];
  /** Origen visual: inicial / juego (oro) / scanner (plata) */
  cartaSources: Record<string, CartaUnlockSource>;
  /** Modos de escáner que ya otorgaron carta */
  scanModesDone: CartaScanModo[];
  juegoJonron: boolean;
  juegoRebote: boolean;
  triviaHecha: boolean;
}
