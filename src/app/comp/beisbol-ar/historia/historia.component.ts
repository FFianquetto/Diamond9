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

type VistaHistoria = 'timeline' | 'leyendas';

@Component({
  selector: 'app-historia',
  standalone: true,
  imports: [CommonModule, MatIconModule, SectionShellComponent],
  templateUrl: './historia.component.html',
  styleUrl: './historia.component.scss',
})
export class HistoriaComponent implements OnInit {
  timeline: HistoriaEvento[] = [];
  leyendas: LeyendaBeisbol[] = [];
  vista: VistaHistoria = 'leyendas';
  readonly vistaPills: SectionPill[] = [
    { id: 'leyendas', label: 'Jugadores' },
    { id: 'timeline', label: 'Línea de tiempo' },
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

  get leyendasFiltradas(): LeyendaBeisbol[] {
    return this.leyendas.filter((l) => l.origen === 'lmp');
  }

  get lede(): string {
    return this.vista === 'timeline'
      ? 'Hitos de la Liga Mexicana del Pacífico, del circuito invernal al bicampeonato de Charros.'
      : 'Figuras de la Liga del Pacífico: Naranjeros, Tomateros, Yaquis y Cañeros.';
  }

  coleccionada(id: string): boolean {
    return this.rewards.hasCarta(id);
  }

  esColeccionable(id: string): boolean {
    return this.cartaHints.has(id);
  }

  unlockHint(id: string): string {
    return this.cartaHints.get(id) ?? 'Ver Mi colección';
  }
}
