import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { ArMarker } from '../ar-markers';
import { LnmDataService } from '../lnm-data.service';
import { LnmCatalogFile } from '../lnm-catalog.types';
import {
  SectionPill,
  SectionShellComponent,
} from '../../shared/section-shell/section-shell.component';

type EquipoFiltro = 'mlb' | 'lnm';

@Component({
  selector: 'app-markers-guide',
  standalone: true,
  imports: [CommonModule, SectionShellComponent],
  templateUrl: './markers-guide.component.html',
  styleUrl: './markers-guide.component.scss',
})
export class MarkersGuideComponent implements OnInit {
  filtro: EquipoFiltro = 'lnm';
  equiposLnm: ArMarker[] = [];
  equiposMlb: ArMarker[] = [];
  ligaItems: ArMarker[] = [];

  readonly pills: SectionPill[] = [
    { id: 'lnm', label: 'Liga Norte' },
    { id: 'mlb', label: 'MLB' },
  ];

  private readonly lnm = inject(LnmDataService);
  private readonly http = inject(HttpClient);

  ngOnInit(): void {
    this.lnm.loadCatalog().subscribe((bundle) => {
      this.equiposLnm = bundle.equipos;
      this.ligaItems = bundle.liga;
    });
    this.http.get<LnmCatalogFile>('assets/data/equipos-mlb.json').subscribe({
      next: (file) => {
        this.equiposMlb = (file.items ?? []).map((item) => ({
          ...item,
          tipo: 'equipo' as const,
          ligaOrigen: item.ligaOrigen ?? 'MLB',
        }));
      },
      error: () => (this.equiposMlb = []),
    });
  }

  setFiltro(id: string): void {
    if (id === 'mlb' || id === 'lnm') this.filtro = id;
  }

  get equipos(): ArMarker[] {
    return this.filtro === 'mlb' ? this.equiposMlb : this.equiposLnm;
  }

  get tituloLista(): string {
    return this.filtro === 'mlb'
      ? 'Franquicias icónicas MLB'
      : 'Equipos Liga Norte de México · 2026';
  }

  get lede(): string {
    return this.filtro === 'mlb'
      ? 'Seis equipos de referencia de Grandes Ligas.'
      : 'Los 6 equipos oficiales de la temporada LNM 2026.';
  }
}
