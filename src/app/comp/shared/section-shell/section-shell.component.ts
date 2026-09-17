import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  PillSwitchComponent,
  SectionPill,
} from '../pill-switch/pill-switch.component';

export type { SectionPill };

/**
 * Contenedor + encabezado (mismo patrón / ancho que Galería).
 */
@Component({
  selector: 'app-section-shell',
  standalone: true,
  imports: [CommonModule, PillSwitchComponent],
  templateUrl: './section-shell.component.html',
  styleUrl: './section-shell.component.scss',
})
export class SectionShellComponent {
  @Input({ required: true }) eyebrow!: string;
  @Input({ required: true }) title!: string;
  @Input() lede = '';
  @Input() pills: SectionPill[] = [];
  @Input() activePill = '';
  @Input() pillsAriaLabel = 'Filtro';
  @Output() readonly pillChange = new EventEmitter<string>();
}
