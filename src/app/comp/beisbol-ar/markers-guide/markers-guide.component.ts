import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AR_MARKERS } from '../ar-markers';

@Component({
  selector: 'app-markers-guide',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './markers-guide.component.html',
  styleUrl: './markers-guide.component.scss',
})
export class MarkersGuideComponent {
  readonly markers = AR_MARKERS;
}
