import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RewardsService } from '../../beisbol-ar/rewards.service';

@Component({
  selector: 'app-carta-unlock-overlay',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './carta-unlock-overlay.component.html',
  styleUrl: './carta-unlock-overlay.component.scss',
})
export class CartaUnlockOverlayComponent {
  readonly rewards = inject(RewardsService);

  dismiss(): void {
    this.rewards.dismissCelebration();
  }
}
