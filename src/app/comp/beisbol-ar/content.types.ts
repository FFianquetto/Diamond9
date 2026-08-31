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
  color: string;
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
  juegoJonron: boolean;
  juegoRebote: boolean;
  triviaHecha: boolean;
}
