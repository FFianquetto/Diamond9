/**
 * Fuente única de los marcadores AR requeridos por la rúbrica (mínimo 3
 * elementos escaneables, cada uno con contenido propio).
 *
 * La consumen el escáner (`/ar`) y la guía (`/marcadores`). Al integrar el
 * tracking real (MindAR) solo hay que llenar `targetImage` y `model3d`.
 */
export interface ArMarker {
  id: string;
  name: string;
  subtitle: string;
  color: string;
  info: string;
  stats: { label: string; value: string }[];
  videoHint: string;
  animationLabel: string;
  /** Cómo usar el detonador físico (guía de marcadores). */
  tip: string;
  /** Resumen de acciones disponibles en la ventana AR. */
  actions: string;
  /** Imagen detonadora en public/assets/markers (pendiente de integrar). */
  targetImage?: string;
  /** Modelo glTF/glb en public/assets/models3d (pendiente de integrar). */
  model3d?: string;
}

export const AR_MARKERS: ArMarker[] = [
  {
    id: 'escudo',
    name: 'Escudo LMB',
    subtitle: 'Identidad de la Liga Mexicana',
    color: '#00C2D7',
    info: 'La Liga Mexicana de Beisbol se fundó en 1925. Este marcador despliega el escudo oficial y datos históricos del torneo.',
    stats: [
      { label: 'Fundación', value: '1925' },
      { label: 'Equipos', value: '20' },
      { label: 'Temporada', value: '2026' },
    ],
    videoHint: 'Clip histórico: orígenes de la LMB',
    animationLabel: 'Rotación 360° del escudo',
    tip: 'Imprime o muestra en pantalla el escudo. Activa el escáner y selecciona “Escudo LMB”.',
    actions: 'Info · Stats · Video histórico · Rotación 360°',
  },
  {
    id: 'jugador',
    name: 'Jugador estrella',
    subtitle: 'Carta AR de bateador',
    color: '#8BEAF2',
    info: 'Modelo 3D de un bateador legendario. Usa los controles para celebrar, ver stats de temporada y reproducir highlights.',
    stats: [
      { label: 'AVG', value: '.312' },
      { label: 'HR', value: '28' },
      { label: 'RBI', value: '89' },
    ],
    videoHint: 'Highlight: jonrón decisivo',
    animationLabel: 'Celebración / swing',
    tip: 'Usa la carta / póster del bateador. Desbloquea celebración, AVG/HR/RBI y highlight.',
    actions: 'Info · Stats · Video highlight · Animación swing',
  },
  {
    id: 'estadio',
    name: 'Estadio diamante',
    subtitle: 'Vista del campo',
    color: '#3E688C',
    info: 'Recorrido AR del diamante: home, bases y outfield. Ideal para explicar geometría del campo a aficionados nuevos.',
    stats: [
      { label: 'Capacidad', value: '21,000' },
      { label: 'LF', value: '325 ft' },
      { label: 'CF', value: '400 ft' },
    ],
    videoHint: 'Tour virtual del estadio',
    animationLabel: 'Flyover del diamante',
    tip: 'Marcador del campo. Ideal para flyover y medidas del parque.',
    actions: 'Info · Stats del estadio · Tour · Animación flyover',
  },
];
