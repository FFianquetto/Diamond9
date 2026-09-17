import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { CartaColeccion, CartaUnlockSource } from '../content.types';
import { RewardsService } from '../rewards.service';
import {
  SectionPill,
  SectionShellComponent,
} from '../../shared/section-shell/section-shell.component';

type FiltroCartas = 'mlb' | 'mex';

@Component({
  selector: 'app-recompensas',
  standalone: true,
  imports: [CommonModule, MatIconModule, SectionShellComponent],
  templateUrl: './recompensas.component.html',
  styleUrl: './recompensas.component.scss',
})
export class RecompensasComponent implements OnInit {
  cartas: CartaColeccion[] = [];
  filtro: FiltroCartas = 'mex';

  readonly pills: SectionPill[] = [
    { id: 'mex', label: 'México' },
    { id: 'mlb', label: 'MLB' },
  ];

  private readonly rewards = inject(RewardsService);

  readonly totalCartas = this.rewards.totalCartas;

  ngOnInit(): void {
    this.rewards.loadCartas().subscribe((file) => {
      this.cartas = file.cartas ?? [];
    });
  }

  setFiltro(id: string): void {
    if (id === 'mlb' || id === 'mex') this.filtro = id;
  }

  get cartasFiltradas(): CartaColeccion[] {
    return this.cartas
      .filter((c) => c.origen === this.filtro)
      .sort((a, b) => a.numero - b.numero);
  }

  get lede(): string {
    return this.filtro === 'mex'
      ? 'Coleccionables de México. Completa todo y gana el emblema legendario.'
      : 'Coleccionables MLB. Completa todo y gana el emblema legendario.';
  }

  tieneCarta(id: string): boolean {
    return this.rewards.hasCarta(id);
  }

  sourceOf(id: string): CartaUnlockSource | null {
    return this.rewards.cartaSource(id);
  }

  sourceLabel(c: CartaColeccion): string {
    return this.rewards.originBadge(c);
  }

  unlockHint(c: CartaColeccion): string {
    return this.rewards.unlockHint(c);
  }

  countOwned(origen: 'mlb' | 'mex'): number {
    const ids = this.rewards.state().cartas;
    return this.cartas.filter((c) => c.origen === origen && ids.includes(c.id))
      .length;
  }

  countTotal(origen: 'mlb' | 'mex'): number {
    return this.cartas.filter((c) => c.origen === origen).length;
  }
}
