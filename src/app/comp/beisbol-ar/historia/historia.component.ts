import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { HistoriaEvento, LeyendaBeisbol } from '../content.types';
import { LnmDataService } from '../lnm-data.service';

@Component({
  selector: 'app-historia',
  standalone: true,
  imports: [CommonModule, RouterLink, MatIconModule],
  templateUrl: './historia.component.html',
  styleUrl: './historia.component.scss',
})
export class HistoriaComponent implements OnInit {
  timeline: HistoriaEvento[] = [];
  leyendas: LeyendaBeisbol[] = [];
  filtroLiga = 'todas';

  private readonly lnm = inject(LnmDataService);

  ngOnInit(): void {
    this.lnm.loadHistoria().subscribe((data) => {
      this.timeline = data.timeline;
      this.leyendas = data.leyendas;
    });
  }

  get leyendasFiltradas(): LeyendaBeisbol[] {
    if (this.filtroLiga === 'todas') return this.leyendas;
    if (this.filtroLiga === 'mlb') {
      return this.leyendas.filter((l) => l.liga === 'MLB' || l.liga.includes('MLB'));
    }
    return this.leyendas.filter((l) => l.liga === 'LMB' || l.liga.includes('LMB'));
  }

  setFiltro(f: string): void {
    this.filtroLiga = f;
  }
}
