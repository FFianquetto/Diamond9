import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LnmScanItem } from '../lnm-catalog.types';
import { LeyendaBeisbol } from '../content.types';
import { LnmDataService } from '../lnm-data.service';
import { ParticleFxService } from '../../shared/particle-fx/particle-fx.service';
import {
  SectionPill,
  SectionShellComponent,
} from '../../shared/section-shell/section-shell.component';
import { PillSwitchComponent } from '../../shared/pill-switch/pill-switch.component';

interface StandingRow {
  pos: number;
  nombre: string;
  abrev: string;
  record: string;
  pct: string;
  color: string;
  pctNum?: number;
}

interface LeaderRow {
  nombre: string;
  equipo: string;
  stat: string;
  value: string;
}

@Component({
  selector: 'app-stats',
  standalone: true,
  imports: [
    CommonModule,
    SectionShellComponent,
    PillSwitchComponent,
  ],
  templateUrl: './stats.component.html',
  styleUrl: './stats.component.scss',
})
export class StatsComponent implements OnInit {
  private readonly lnm = inject(LnmDataService);
  private readonly fx = inject(ParticleFxService);

  standing = signal<StandingRow[]>([]);
  lnmLeaders = signal<LeaderRow[]>([]);
  leyendas = signal<LeyendaBeisbol[]>([]);
  ligaResumen = signal<{ label: string; value: string }[]>([]);
  tab = signal<'lnm' | 'leyendas'>('lnm');
  origen = signal<'mlb' | 'mex'>('mex');

  readonly pills: SectionPill[] = [
    { id: 'lnm', label: 'Liga Norte' },
    { id: 'leyendas', label: 'Leyendas' },
  ];

  readonly origenPills: SectionPill[] = [
    { id: 'mex', label: 'México' },
    { id: 'mlb', label: 'MLB' },
  ];

  ngOnInit(): void {
    this.lnm.loadCatalog().subscribe((bundle) => {
      const rows: StandingRow[] = bundle.equipos
        .map((e) => {
          const gp = e.stats.find((s) => s.label === 'G-P')?.value ?? '—';
          const pct = e.stats.find((s) => s.label === 'Pct')?.value ?? '—';
          const pctNum = parseFloat(pct.replace(/^\./, '0.')) || 0;
          return {
            pos: 0,
            nombre: e.nombre,
            abrev: e.abrev ?? '—',
            record: gp,
            pct,
            color: e.color,
            pctNum,
          };
        })
        .sort((a, b) => b.pctNum - a.pctNum)
        .map((row, i) => ({ ...row, pos: i + 1 }));
      this.standing.set(rows);

      const leaders = this.buildLnmLeaders(bundle.jugadores);
      this.lnmLeaders.set(leaders);

      const liga = bundle.liga[0];
      if (liga) {
        this.ligaResumen.set(liga.stats);
      }
    });

    this.lnm.loadHistoria().subscribe((data) => {
      this.leyendas.set(data.leyendas);
    });
  }

  setTab(t: string): void {
    if (t !== 'lnm' && t !== 'leyendas') return;
    this.tab.set(t);
    this.fx.burstCenter('spark');
  }

  setOrigen(t: string): void {
    if (t !== 'mlb' && t !== 'mex') return;
    this.origen.set(t);
  }

  get leyendasFiltradas(): LeyendaBeisbol[] {
    return this.leyendas().filter((l) => l.origen === this.origen());
  }

  get lede(): string {
    return this.tab() === 'lnm'
      ? 'Standing y líderes reales de la LNM 2026. Campeón: Bucaneros (4-2 vs Barbanegras).'
      : 'Récords de las 10 leyendas coleccionables (MLB y México).';
  }

  private buildLnmLeaders(jugadores: LnmScanItem[]): LeaderRow[] {
    const rows: LeaderRow[] = [];
    for (const j of jugadores) {
      const avg = j.stats.find((s) => s.label === 'AVG');
      const rbi = j.stats.find((s) => s.label === 'RBI');
      const hr = j.stats.find((s) => s.label === 'HR');
      const era = j.stats.find((s) => s.label === 'ERA');
      if (avg) {
        rows.push({
          nombre: j.nombre,
          equipo: j.equipo ?? '—',
          stat: 'AVG',
          value: avg.value,
        });
      }
      if (rbi) {
        rows.push({
          nombre: j.nombre,
          equipo: j.equipo ?? '—',
          stat: 'RBI',
          value: rbi.value,
        });
      }
      if (hr) {
        rows.push({
          nombre: j.nombre,
          equipo: j.equipo ?? '—',
          stat: 'HR',
          value: hr.value,
        });
      }
      if (era) {
        rows.push({
          nombre: j.nombre,
          equipo: j.equipo ?? '—',
          stat: 'ERA',
          value: era.value,
        });
      }
    }
    return rows.slice(0, 8);
  }
}
