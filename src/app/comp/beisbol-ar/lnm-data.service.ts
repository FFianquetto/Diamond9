import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, forkJoin, map, catchError, of } from 'rxjs';
import {
  ArMarker,
  LnmCatalogFile,
  LnmItemType,
  LnmScanItem,
  ScanProfile,
} from './lnm-catalog.types';
import { HistoriaFile } from './content.types';

interface CatalogBundle {
  jugadores: LnmScanItem[];
  equipos: LnmScanItem[];
  liga: LnmScanItem[];
  all: LnmScanItem[];
}

const FALLBACK: LnmScanItem[] = [
  {
    id: 'walter-silva',
    tipo: 'jugador',
    nombre: 'Walter Silva',
    subtitle: 'Lanzador · carta coleccionable',
    color: '#C62828',
    info: 'Walter Silva es uno de los lanzadores más reconocidos del beisbol mexicano.',
    stats: [
      { label: 'Posición', value: 'P' },
      { label: 'ERA ref.', value: '3.12' },
      { label: 'SO ref.', value: '142' },
    ],
    videoHint: 'Highlight: dominio desde el montículo',
    animationLabel: 'Entrega / ponche',
    tip: 'Apunta la cámara a la carta de Walter Silva.',
    actions: 'Info · Stats · Video · Animación',
    targetImage: 'assets/markers/walter-silva.png',
    equipo: 'Referencia LMB / Norte',
    posicion: 'Pitcher',
  },
  {
    id: 'bucaneros-cabos',
    tipo: 'equipo',
    nombre: 'Bucaneros de Los Cabos',
    subtitle: 'Campeón LNM 2026',
    color: '#00C2D7',
    info: 'Bucaneros de Los Cabos, campeón LNM 2026.',
    stats: [
      { label: 'G-P', value: '33-24' },
      { label: 'Pct', value: '.579' },
      { label: 'Título', value: 'Campeón' },
    ],
    videoHint: 'Clip: camino al campeonato',
    animationLabel: 'Rotación del escudo',
    tip: 'Escudo de Bucaneros.',
    actions: 'Info · Stats · Video · Animación',
    targetImage: 'assets/markers/bucaneros-cabos.png',
    abrev: 'CAB',
  },
  {
    id: 'liga-lnm',
    tipo: 'liga',
    nombre: 'Liga Norte de México',
    subtitle: 'Standing y líderes 2026',
    color: '#3E688C',
    info: 'La LNM es la principal filial de la Liga Mexicana de Beisbol.',
    stats: [
      { label: 'Campeón', value: 'Bucaneros' },
      { label: 'Equipos', value: '6' },
      { label: 'Temporada', value: '2026' },
    ],
    videoHint: 'Resumen temporada LNM 2026',
    animationLabel: 'Trofeo / pulse de la liga',
    tip: 'Cartel oficial LNM.',
    actions: 'Info · Stats · Video · Animación',
    targetImage: 'assets/markers/liga-lnm.png',
  },
];

@Injectable({ providedIn: 'root' })
export class LnmDataService {
  private readonly http = inject(HttpClient);
  private readonly base = 'assets/data';

  loadCatalog(): Observable<CatalogBundle> {
    return forkJoin({
      jugadores: this.http.get<LnmCatalogFile>(`${this.base}/jugadores.json`),
      equipos: this.http.get<LnmCatalogFile>(`${this.base}/equipos.json`),
      liga: this.http.get<LnmCatalogFile>(`${this.base}/liga.json`),
    }).pipe(
      map(({ jugadores, equipos, liga }) => {
        const jugadorItems = this.mapFile(jugadores, 'jugador');
        const equipoItems = this.mapFile(equipos, 'equipo');
        const ligaItems = this.mapFile(liga, 'liga');
        return {
          jugadores: jugadorItems,
          equipos: equipoItems,
          liga: ligaItems,
          all: [...jugadorItems, ...equipoItems, ...ligaItems],
        };
      }),
      catchError(() => {
        const jugadores = FALLBACK.filter((i) => i.tipo === 'jugador');
        const equipos = FALLBACK.filter((i) => i.tipo === 'equipo');
        const liga = FALLBACK.filter((i) => i.tipo === 'liga');
        return of({ jugadores, equipos, liga, all: [...FALLBACK] });
      }),
    );
  }

  /** Compatibilidad con guía / listados planos. */
  loadMarkers(): Observable<ArMarker[]> {
    return this.loadCatalog().pipe(map((c) => c.all));
  }

  loadHistoria(): Observable<HistoriaFile> {
    return this.http.get<HistoriaFile>(`${this.base}/historia.json`).pipe(
      catchError(() =>
        of({
          titulo: 'Historia del béisbol',
          nota: '',
          timeline: [],
          leyendas: [],
        }),
      ),
    );
  }

  loadScanProfiles(): Observable<ScanProfile[]> {
    return this.http
      .get<{ profiles: ScanProfile[] }>(`${this.base}/scan-profiles.json`)
      .pipe(
        map((file) => file.profiles),
        catchError(() => of(this.fallbackScanProfiles())),
      );
  }

  private fallbackScanProfiles(): ScanProfile[] {
    return [
      {
        id: 'barbanegras-tijuana',
        colors: ['#050505', '#c62828', '#ffffff'],
        keywords: ['BARBANEGRAS', 'TIJ'],
      },
      {
        id: 'bucaneros-cabos',
        colors: ['#003840', '#00e5ff', '#ffffff'],
        keywords: ['BUCANEROS', 'CAB'],
      },
      {
        id: 'liga-lnm',
        colors: ['#0d1b2a', '#90caf9', '#ffffff'],
        keywords: ['LNM', 'LIGA', 'NORTE'],
      },
      {
        id: 'walter-silva',
        colors: ['#c62828', '#1a1a1a', '#ffffff'],
        keywords: ['WALTER', 'SILVA'],
      },
    ];
  }

  private mapFile(file: LnmCatalogFile, tipo: LnmItemType): LnmScanItem[] {
    return file.items.map((item) => ({ ...item, tipo }));
  }
}
