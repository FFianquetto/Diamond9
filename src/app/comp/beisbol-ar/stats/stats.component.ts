import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { LnmScanItem } from '../lnm-catalog.types';
import { LeyendaBeisbol } from '../content.types';
import { LnmDataService } from '../lnm-data.service';
import { ParticleFxService } from '../../shared/particle-fx/particle-fx.service';

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
  imports: [CommonModule, RouterLink],
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
      this.leyendas.set(data.leyendas.slice(0, 6));
    });
  }

  setTab(t: 'lnm' | 'leyendas'): void {
    this.tab.set(t);
    this.fx.burstCenter('spark');
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
