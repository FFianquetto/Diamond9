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

type EquipoFiltro = 'mlb' | 'lnm' | 'lmp';

@Component({
  selector: 'app-markers-guide',
  standalone: true,
  imports: [CommonModule, SectionShellComponent],
  templateUrl: './markers-guide.component.html',
  styleUrl: './markers-guide.component.scss',
})
export class MarkersGuideComponent implements OnInit {
  filtro: EquipoFiltro = 'lmp';
  equiposLnm: ArMarker[] = [];
  equiposLmp: ArMarker[] = [];
  equiposMlb: ArMarker[] = [];

  readonly pills: SectionPill[] = [
    { id: 'lmp', label: 'Liga del Pacífico' },
    { id: 'lnm', label: 'Liga Norte' },
    { id: 'mlb', label: 'MLB' },
  ];

  private readonly lnm = inject(LnmDataService);
  private readonly http = inject(HttpClient);

  ngOnInit(): void {
    this.lnm.loadCatalog().subscribe((bundle) => {
      this.equiposLnm = bundle.equipos;
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
    this.http.get<LnmCatalogFile>('assets/data/equipos-lmp.json').subscribe({
      next: (file) => {
        this.equiposLmp = (file.items ?? []).map((item) => ({
          ...item,
          tipo: 'equipo' as const,
          ligaOrigen: item.ligaOrigen ?? 'LMP',
        }));
      },
      error: () => (this.equiposLmp = []),
    });
  }

  setFiltro(id: string): void {
    if (id === 'mlb' || id === 'lnm' || id === 'lmp') this.filtro = id;
  }

  get equipos(): ArMarker[] {
    if (this.filtro === 'mlb') return this.equiposMlb;
    if (this.filtro === 'lmp') return this.equiposLmp;
    return this.equiposLnm;
  }

  get tituloLista(): string {
    if (this.filtro === 'mlb') return 'Franquicias icónicas MLB';
    if (this.filtro === 'lmp') {
      return 'Equipos de la Liga ARCO Mexicana del Pacífico';
    }
    return 'Equipos Liga Norte de México · 2026';
  }

  get lede(): string {
    if (this.filtro === 'mlb') return 'Seis equipos de referencia de Grandes Ligas.';
    if (this.filtro === 'lmp') {
      return 'Los 10 equipos de la Liga ARCO Mexicana del Pacífico, con Mayos de Navojoa.';
    }
    return 'Equipos de la Liga Norte 2026, incluyendo a Sultanes de Monterrey.';
  }
}
