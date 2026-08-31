export type LnmItemType = 'jugador' | 'equipo' | 'liga';

export interface LnmStat {
  label: string;
  value: string;
}

/** Colores del logo + palabras/letras para escaneo preciso. */
export interface ScanProfile {
  id: string;
  colors: string[];
  keywords: string[];
}

export interface LnmScanItem {
  id: string;
  tipo: LnmItemType;
  nombre: string;
  subtitle: string;
  color: string;
  scanProfile?: ScanProfile;
  info: string;
  stats: LnmStat[];
  videoHint: string;
  animationLabel: string;
  tip: string;
  actions: string;
  targetImage?: string;
  equipo?: string;
  posicion?: string;
  abrev?: string;
  ciudad?: string;
  estadio?: string;
  filialLmb?: string;
  /** Figuras populares del equipo (solo tipo equipo). */
  destacados?: string[];
}

export interface LnmCatalogFile {
  tipo: LnmItemType;
  temporada: number;
  liga: string;
  items: Omit<LnmScanItem, 'tipo'>[];
}

/** Alias usado por el overlay AR (misma forma que LnmScanItem). */
export type ArMarker = LnmScanItem;
