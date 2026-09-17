import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { HistoriaEvento, LeyendaBeisbol } from '../content.types';
import { LnmDataService } from '../lnm-data.service';
import { RewardsService } from '../rewards.service';
import {
  SectionPill,
  SectionShellComponent,
} from '../../shared/section-shell/section-shell.component';
import { PillSwitchComponent } from '../../shared/pill-switch/pill-switch.component';

type VistaHistoria = 'timeline' | 'leyendas';
type FiltroOrigen = 'mlb' | 'mex';

@Component({
  selector: 'app-historia',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    SectionShellComponent,
    PillSwitchComponent,
  ],
  templateUrl: './historia.component.html',
  styleUrl: './historia.component.scss',
})
export class HistoriaComponent implements OnInit {
  timeline: HistoriaEvento[] = [];
  leyendas: LeyendaBeisbol[] = [];
  vista: VistaHistoria = 'leyendas';
  filtroOrigen: FiltroOrigen = 'mex';
  readonly vistaPills: SectionPill[] = [
    { id: 'leyendas', label: 'Jugadores' },
    { id: 'timeline', label: 'Línea de tiempo' },
  ];

  readonly origenPills: SectionPill[] = [
    { id: 'mex', label: 'México' },
    { id: 'mlb', label: 'MLB' },
  ];

  private readonly lnm = inject(LnmDataService);
  private readonly rewards = inject(RewardsService);
  private cartaHints = new Map<string, string>();

  ngOnInit(): void {
    this.lnm.loadHistoria().subscribe((data) => {
      this.timeline = data.timeline;
      this.leyendas = data.leyendas;
    });
    this.rewards.loadCartas().subscribe((file) => {
      this.cartaHints.clear();
      for (const c of file.cartas ?? []) {
        this.cartaHints.set(c.id, this.rewards.unlockHint(c));
      }
    });
  }

  setVista(id: string): void {
    if (id === 'timeline' || id === 'leyendas') this.vista = id;
  }

  setFiltro(id: string): void {
    if (id === 'mlb' || id === 'mex') this.filtroOrigen = id;
  }

  get leyendasFiltradas(): LeyendaBeisbol[] {
    return this.leyendas.filter((l) => l.origen === this.filtroOrigen);
  }

  get lede(): string {
    return this.vista === 'timeline'
      ? 'Hitos del béisbol desde sus orígenes hasta la era moderna.'
      : 'Las mismas 10 leyendas de Mi colección. Desbloquéalas jugando o escaneando.';
  }

  coleccionada(id: string): boolean {
    return this.rewards.hasCarta(id);
  }

  unlockHint(id: string): string {
    return this.cartaHints.get(id) ?? 'Ver Mi colección';
  }
}
