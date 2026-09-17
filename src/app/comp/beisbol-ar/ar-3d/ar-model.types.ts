import { LnmItemType } from '../lnm-catalog.types';

export type ArModelFormat = 'glb' | 'gltf' | 'obj';
export type ArModelFallback = 'bate' | 'pelota' | 'gorra' | 'guante' | 'trofeo';
export type ArAnimMode = 'idle' | 'spin' | 'spinAxis' | 'static' | 'swing' | 'pulse3d';

export interface ArModelEntry {
  label: string;
  file: string;
  format: ArModelFormat;
  scale: number;
  fallback: ArModelFallback;
  /** Mapa de color (diffuse): png, jpg o jpeg */
  texture?: string;
  /** Mapa de normales: png, jpg o jpeg */
  normalMap?: string;
}

export interface ArModelsManifest {
  nota: string;
  formatoRecomendado: string;
  defaults: Record<LnmItemType, string>;
  overrides: Record<string, string>;
  models: Record<string, ArModelEntry>;
}

export interface ArModelResolveInput {
  markerId: string;
  tipo: LnmItemType;
}

export interface ArModelResolved {
  key: string;
  entry: ArModelEntry;
}
