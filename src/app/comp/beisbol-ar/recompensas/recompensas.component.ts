import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { ArMarker } from '../ar-markers';
import { Premio } from '../content.types';
import { LnmDataService } from '../lnm-data.service';
import { RewardsService } from '../rewards.service';

@Component({
  selector: 'app-recompensas',
  standalone: true,
  imports: [CommonModule, RouterLink, MatIconModule],
  templateUrl: './recompensas.component.html',
  styleUrl: './recompensas.component.scss',
})
export class RecompensasComponent implements OnInit {
  premios: Premio[] = [];
  escaneados: ArMarker[] = [];

  private readonly rewards = inject(RewardsService);
  private readonly lnm = inject(LnmDataService);

  readonly totalPremios = this.rewards.totalPremios;
  readonly totalScans = this.rewards.totalScans;

  ngOnInit(): void {
    this.rewards.loadCatalog().subscribe((file) => {
      this.premios = file.premios;
    });
    this.lnm.loadCatalog().subscribe((bundle) => {
      const ids = this.rewards.state().scans;
      this.escaneados = bundle.all.filter((m) => ids.includes(m.id));
    });
  }

  tienePremio(id: string): boolean {
    return this.rewards.hasPremio(id);
  }
}
