import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ArModelViewerComponent } from '../ar-3d/ar-model-viewer.component';
import { ArModelLoaderService } from '../ar-3d/ar-model-loader.service';

interface ModeloCard {
  key: string;
  label: string;
  color: string;
}

const MODEL_COLORS: Record<string, string> = {
  bate: '#8D6E63',
  pelota: '#F5F5F5',
  gorra: '#1565C0',
  guante: '#795548',
  trofeo: '#FFC107',
};

@Component({
  selector: 'app-modelos-3d',
  standalone: true,
  imports: [CommonModule, RouterLink, ArModelViewerComponent],
  templateUrl: './modelos-3d.component.html',
  styleUrl: './modelos-3d.component.scss',
})
export class Modelos3dComponent implements OnInit {
  modelos: ModeloCard[] = [];

  private readonly loader = inject(ArModelLoaderService);

  ngOnInit(): void {
    this.loader.loadManifest().subscribe((manifest) => {
      this.modelos = Object.entries(manifest.models).map(([key, entry]) => ({
        key,
        label: entry.label,
        color: MODEL_COLORS[key] ?? '#00E5FF',
      }));
    });
  }
}
