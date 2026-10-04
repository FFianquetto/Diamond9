import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { LnmCatalogFile } from '../lnm-catalog.types';
import { LeyendaBeisbol } from '../content.types';
import { LnmDataService } from '../lnm-data.service';
import { ParticleFxService } from '../../shared/particle-fx/particle-fx.service';
import {
  SectionPill,
  SectionShellComponent,
} from '../../shared/section-shell/section-shell.component';

interface StandingRow {
  pos: number;
  nombre: string;
  abrev: string;
  record: string;
  pct: string;
  color: string;
}

/** Standing general de ganados y perdidos, LMP 2025-26 (68 juegos). */
const LMP_STANDING: { id: string; record: string; pct: string }[] = [
  { id: 'lmp-jaguares', record: '40-28', pct: '.588' },
  { id: 'lmp-tomateros', record: '40-28', pct: '.588' },
  { id: 'lmp-yaquis', record: '40-28', pct: '.588' },
  { id: 'lmp-naranjeros', record: '40-28', pct: '.588' },
  { id: 'lmp-caneros', record: '38-30', pct: '.559' },
  { id: 'lmp-charros', record: '38-30', pct: '.559' },
  { id: 'lmp-aguilas', record: '33-35', pct: '.485' },
  { id: 'lmp-algodoneros-guasave', record: '26-42', pct: '.382' },
  { id: 'lmp-mayos', record: '23-45', pct: '.338' },
  { id: 'lmp-venados', record: '22-46', pct: '.324' },
];

@Component({
  selector: 'app-stats',
  standalone: true,
  imports: [CommonModule, SectionShellComponent],
  templateUrl: './stats.component.html',
  styleUrl: './stats.component.scss',
})
export class StatsComponent implements OnInit {
  private readonly lnm = inject(LnmDataService);
  private readonly http = inject(HttpClient);
  private readonly fx = inject(ParticleFxService);

  standing = signal<StandingRow[]>([]);
  leyendas = signal<LeyendaBeisbol[]>([]);
  ligaResumen = signal<{ label: string; value: string }[]>([
    { label: 'Campeón', value: 'Charros 4-0' },
    { label: 'Subcampeón', value: 'Tomateros' },
    { label: 'Equipos', value: '10' },
  ]);
  tab = signal<'lmp' | 'leyendas'>('lmp');

  readonly pills: SectionPill[] = [
    { id: 'lmp', label: 'Liga del Pacífico' },
    { id: 'leyendas', label: 'Leyendas' },
  ];

  ngOnInit(): void {
    this.http
      .get<LnmCatalogFile>('assets/data/equipos-lmp.json')
      .subscribe((file) => {
        const byId = new Map((file.items ?? []).map((item) => [item.id, item]));
        const rows: StandingRow[] = LMP_STANDING.flatMap((row, i) => {
          const team = byId.get(row.id);
          if (!team) return [];
          return [
            {
              pos: i + 1,
              nombre: team.nombre,
              abrev: team.abrev ?? '—',
              record: row.record,
              pct: row.pct,
              color: team.color,
            },
          ];
        });
        this.standing.set(rows);
      });

    this.lnm.loadHistoria().subscribe((data) => {
      this.leyendas.set(data.leyendas);
    });
  }

  setTab(t: string): void {
    if (t !== 'lmp' && t !== 'leyendas') return;
    this.tab.set(t);
    this.fx.burstCenter('spark');
  }

  get leyendasFiltradas(): LeyendaBeisbol[] {
    return this.leyendas().filter((l) => l.origen === 'lmp');
  }

  get lede(): string {
    return this.tab() === 'lmp'
      ? 'Standing de ganados y perdidos, Liga del Pacífico 2025-26 (68 juegos). Campeón: Charros, barrida 4-0 a Tomateros. Mayos aparece con el récord de esa campaña, cuando la franquicia jugó como Tucson Baseball Team.'
      : 'Figuras de la Liga del Pacífico: Espino, Romo, Valenzuela, Barrera y Durazo.';
  }
}
