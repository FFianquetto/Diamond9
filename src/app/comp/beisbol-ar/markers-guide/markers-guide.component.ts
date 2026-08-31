import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { ArMarker } from '../ar-markers';
import { LnmDataService } from '../lnm-data.service';

@Component({
  selector: 'app-markers-guide',
  standalone: true,
  imports: [CommonModule, RouterLink, MatIconModule],
  templateUrl: './markers-guide.component.html',
  styleUrl: './markers-guide.component.scss',
})
export class MarkersGuideComponent implements OnInit {
  equipos: ArMarker[] = [];
  ligaItems: ArMarker[] = [];
  private readonly lnm = inject(LnmDataService);

  ngOnInit(): void {
    this.lnm.loadCatalog().subscribe((bundle) => {
      this.equipos = bundle.equipos;
      this.ligaItems = bundle.liga;
    });
  }
}
