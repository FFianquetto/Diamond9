export type LnmItemType =
  | 'jugador'
  | 'equipo'
  | 'liga'
  | 'gorra'
  | 'pelota'
  | 'logo';

/** Modo del escáner AR MindAR. */
export type ScanModo = 'pelota' | 'gorra' | 'logo';

export interface LnmStat {
  label: string;
  value: string;
}

export interface LnmScanItem {
  id: string;
  tipo: LnmItemType;
  nombre: string;
  subtitle: string;
  color: string;
  info: string;
  stats: LnmStat[];
  videoHint: string;
  /** Clip local opcional para el botón Video del escáner AR. */
  videoSrc?: string;
  animationLabel: string;
  tip: string;
  actions: string;
  targetImage?: string;
  /** Clave en ar-models.json (opcional; si no, usa defaults por tipo). */
  modelKey?: string;
  equipo?: string;
  posicion?: string;
  abrev?: string;
  ciudad?: string;
  estadio?: string;
  filialLmb?: string;
  destacados?: string[];
  equipoReconocido?: boolean;
  ligaOrigen?: string;
}

export interface LnmCatalogFile {
  tipo: LnmItemType;
  temporada: number;
  liga: string;
  items: Omit<LnmScanItem, 'tipo'>[];
}

/** Alias usado por el overlay AR (misma forma que LnmScanItem). */
export type ArMarker = LnmScanItem;
