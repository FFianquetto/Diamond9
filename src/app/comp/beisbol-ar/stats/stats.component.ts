import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ParticleFxService } from '../../shared/particle-fx/particle-fx.service';

interface LiveGame {
  home: string;
  away: string;
  homeScore: number;
  awayScore: number;
  inning: number;
  half: 'alta' | 'baja';
  outs: number;
  pitcher: string;
  batter: string;
}

@Component({
  selector: 'app-stats',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './stats.component.html',
  styleUrl: './stats.component.scss',
})
export class StatsComponent implements OnInit, OnDestroy {
  private readonly fx = inject(ParticleFxService);
  game = signal<LiveGame>({
    home: 'Sultanes',
    away: 'Diablos Rojos',
    homeScore: 3,
    awayScore: 2,
    inning: 6,
    half: 'baja',
    outs: 1,
    pitcher: 'R. Mendoza',
    batter: 'A. Cruz',
  });

  leaders = [
    { name: 'A. Cruz', team: 'Sultanes', stat: 'AVG .341' },
    { name: 'L. Vargas', team: 'Diablos', stat: 'HR 11' },
    { name: 'R. Mendoza', team: 'Diablos', stat: 'ERA 2.18' },
  ];

  feedback = signal('Marcador simulado en vivo · prototipo');
  private timer: ReturnType<typeof setInterval> | null = null;

  ngOnInit(): void {
    this.timer = setInterval(() => this.tick(), 4500);
  }

  ngOnDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  private tick(): void {
    this.game.update((g) => {
      const next = { ...g };
      const roll = Math.random();
      if (roll > 0.72) {
        if (g.half === 'baja') next.homeScore += 1;
        else next.awayScore += 1;
        this.feedback.set('¡Carrera anotada!');
        this.fx.burstCenter('homer');
      } else if (roll > 0.4) {
        next.outs = Math.min(3, g.outs + 1);
        if (next.outs >= 3) {
          next.outs = 0;
          if (g.half === 'alta') next.half = 'baja';
          else {
            next.half = 'alta';
            next.inning = Math.min(9, g.inning + 1);
          }
          this.feedback.set('Cambio de media entrada');
        } else {
          this.feedback.set(`Outs: ${next.outs}`);
        }
      } else {
        this.feedback.set('Conteo en juego…');
      }
      return next;
    });
  }
}
