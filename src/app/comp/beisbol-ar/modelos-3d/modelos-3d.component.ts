import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ArModelViewerComponent } from '../ar-3d/ar-model-viewer.component';
import { ArModelLoaderService } from '../ar-3d/ar-model-loader.service';
import { SectionShellComponent } from '../../shared/section-shell/section-shell.component';

interface ModeloCard {
  key: string;
  label: string;
  color: string;
}

const MODEL_COLORS: Record<string, string> = {
  bate: '#8D6E63',
  'bate-2': '#A1887F',
  'bate-rojo': '#C62828',
  pelota: '#F5F5F5',
};

const GORRA_COLORS = [
  '#0C2340',
  '#005A9C',
  '#00C2D7',
  '#1565C0',
  '#0277BD',
  '#F9A825',
  '#FF8F00',
  '#C62828',
  '#B71C1C',
  '#2E7D32',
  '#6A1B9A',
  '#455A64',
];

function isGorraKey(key: string): boolean {
  return key === 'gorra' || key.startsWith('gorra-');
}

function isBateKey(key: string): boolean {
  return key === 'bate' || key.startsWith('bate-');
}

function colorFor(key: string, gorraIndex: number): string {
  if (isGorraKey(key)) {
    return GORRA_COLORS[gorraIndex % GORRA_COLORS.length];
  }
  return MODEL_COLORS[key] ?? '#00E5FF';
}

@Component({
  selector: 'app-modelos-3d',
  standalone: true,
  imports: [CommonModule, ArModelViewerComponent, SectionShellComponent],
  templateUrl: './modelos-3d.component.html',
  styleUrl: './modelos-3d.component.scss',
})
export class Modelos3dComponent implements OnInit {
  bates: ModeloCard[] = [];
  pelotas: ModeloCard[] = [];
  gorras: ModeloCard[] = [];

  private readonly loader = inject(ArModelLoaderService);

  ngOnInit(): void {
    this.loader.loadManifest().subscribe((manifest) => {
      const entries = Object.entries(manifest.models);
      let gorraIdx = 0;

      const cards = entries.map(([key, entry]) => {
        const card: ModeloCard = {
          key,
          label: entry.label,
          color: colorFor(key, gorraIdx),
        };
        if (isGorraKey(key)) gorraIdx += 1;
        return card;
      });

      this.bates = cards.filter((c) => isBateKey(c.key));
      this.pelotas = cards.filter((c) => c.key === 'pelota' || c.key.startsWith('pelota-'));
      this.gorras = cards.filter((c) => isGorraKey(c.key));
    });
  }
}
