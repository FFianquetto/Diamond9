import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface SectionPill {
  id: string;
  label: string;
}

@Component({
  selector: 'app-pill-switch',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="pill-switch" role="tablist" [attr.aria-label]="ariaLabel">
      @for (p of pills; track p.id) {
        <button
          type="button"
          role="tab"
          class="pill"
          [class.active]="active === p.id"
          [attr.aria-selected]="active === p.id"
          (click)="select(p.id)"
        >
          {{ p.label }}
        </button>
      }
    </div>
  `,
  styleUrl: './pill-switch.component.scss',
})
export class PillSwitchComponent {
  @Input({ required: true }) pills: SectionPill[] = [];
  @Input() active = '';
  @Input() ariaLabel = 'Filtro';
  @Output() readonly activeChange = new EventEmitter<string>();

  select(id: string): void {
    if (id === this.active) return;
    this.activeChange.emit(id);
  }
}
