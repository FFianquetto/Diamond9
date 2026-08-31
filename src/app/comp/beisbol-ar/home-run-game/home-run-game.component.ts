import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ParticleFxService } from '../../shared/particle-fx/particle-fx.service';
import { RewardsService } from '../rewards.service';

type PitchPhase = 'idle' | 'windup' | 'incoming' | 'result';
type Contact = 'whiff' | 'foul' | 'single' | 'double' | 'homer' | null;

interface PitchLog {
  n: number;
  result: string;
}

@Component({
  selector: 'app-home-run-game',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './home-run-game.component.html',
  styleUrl: './home-run-game.component.scss',
})
export class HomeRunGameComponent implements OnInit, OnDestroy {
  private readonly fx = inject(ParticleFxService);
  private readonly rewards = inject(RewardsService);

  readonly totalPitches = 9;
  phase = signal<PitchPhase>('idle');
  pitchIndex = signal(0);
  score = signal(0);
  homers = signal(0);
  streak = signal(0);
  bestStreak = signal(0);
  contact = signal<Contact>(null);
  ballProgress = signal(0);
  finished = signal(false);
  log = signal<PitchLog[]>([]);
  cue = signal('Toca BATEAR cuando la pelota entre a la zona.');
  pitchLabel = computed(() => {
    const n = this.finished()
      ? this.totalPitches
      : Math.min(this.pitchIndex() + 1, this.totalPitches);
    return `${n}/${this.totalPitches}`;
  });

  private travelTimer: ReturnType<typeof setInterval> | null = null;
  private windupTimer: ReturnType<typeof setTimeout> | null = null;
  private resultTimer: ReturnType<typeof setTimeout> | null = null;
  private startedAt = 0;
  private duration = 900;

  ngOnInit(): void {
    this.rewards.loadCatalog().subscribe();
  }

  ngOnDestroy(): void {
    this.clearTimers();
  }

  startInning(): void {
    this.clearTimers();
    this.phase.set('idle');
    this.pitchIndex.set(0);
    this.score.set(0);
    this.homers.set(0);
    this.streak.set(0);
    this.bestStreak.set(0);
    this.contact.set(null);
    this.ballProgress.set(0);
    this.finished.set(false);
    this.log.set([]);
    this.cue.set('El pitcher se prepara…');
    this.queuePitch();
  }

  swing(event: Event): void {
    event.preventDefault();
    if (this.finished()) {
      this.startInning();
      return;
    }
    if (this.phase() === 'idle') {
      this.startInning();
      return;
    }
    if (this.phase() !== 'incoming') {
      this.cue.set('Espera a que la pelota viaje hacia home.');
      this.fx.burst('strike', event);
      return;
    }

    const elapsed = performance.now() - this.startedAt;
    const t = elapsed / this.duration;
    this.resolveSwing(t, event);
  }

  private queuePitch(): void {
    if (this.pitchIndex() >= this.totalPitches) {
      this.finished.set(true);
      this.phase.set('idle');
      const premio = this.rewards.recordJonronPlayed();
      this.cue.set(
        premio
          ? `Entrada terminada · ${this.score()} pts · ¡Premio: ${premio}!`
          : `Entrada terminada · ${this.score()} pts · ${this.homers()} jonrones`,
      );
      this.fx.burstCenter(this.homers() > 0 ? 'homer' : 'confetti');
      return;
    }

    this.phase.set('windup');
    this.contact.set(null);
    this.ballProgress.set(0);
    this.cue.set(`Pitcheo ${this.pitchIndex() + 1} de ${this.totalPitches}`);
    const delay = 380 + Math.random() * 520;
    this.windupTimer = setTimeout(() => this.releasePitch(), delay);
  }

  private releasePitch(): void {
    this.duration = 780 + Math.random() * 280;
    this.startedAt = performance.now();
    this.phase.set('incoming');
    this.cue.set('¡Ahora!');

    this.travelTimer = setInterval(() => {
      const t = (performance.now() - this.startedAt) / this.duration;
      this.ballProgress.set(Math.min(1, t));
      if (t >= 1.08) {
        this.resolveSwing(1.12);
      }
    }, 16);
  }

  private resolveSwing(t: number, event?: Event): void {
    if (this.phase() !== 'incoming') return;
    this.clearTimers();
    this.ballProgress.set(Math.min(1, t));

    let result: Exclude<Contact, null>;
    let pts = 0;
    let label = '';

    if (t < 0.42) {
      result = 'whiff';
      label = 'Swing temprano';
    } else if (t < 0.58) {
      result = 'foul';
      pts = 1;
      label = 'Foul atrás';
    } else if (t < 0.72) {
      result = 'double';
      pts = 4;
      label = '¡Doble a las jardines!';
    } else if (t <= 0.88) {
      result = 'homer';
      pts = 8;
      label = '¡JONRÓN!';
    } else if (t <= 1.02) {
      result = 'single';
      pts = 2;
      label = 'Hit sencillo';
    } else {
      result = 'whiff';
      label = 'Strike mirando';
    }

    this.contact.set(result);
    this.score.update((s) => s + pts);
    this.phase.set('result');
    this.cue.set(label);

    if (result === 'whiff') {
      this.streak.set(0);
      this.fx.burst('strike', event);
    } else {
      this.streak.update((s) => s + 1);
      this.bestStreak.update((best) => Math.max(best, this.streak()));
      if (result === 'homer') {
        this.homers.update((h) => h + 1);
        this.fx.burst('homer', event);
        this.vibrate(40);
      } else {
        this.fx.burst('confetti', event);
        this.vibrate(18);
      }
    }

    this.log.update((rows) => [
      ...rows,
      { n: this.pitchIndex() + 1, result: label },
    ]);
    this.pitchIndex.update((i) => i + 1);

    this.resultTimer = setTimeout(() => this.queuePitch(), 920);
  }

  private vibrate(ms: number): void {
    try {
      navigator.vibrate?.(ms);
    } catch {
      /* opcional en desktop */
    }
  }

  private clearTimers(): void {
    if (this.travelTimer) clearInterval(this.travelTimer);
    if (this.windupTimer) clearTimeout(this.windupTimer);
    if (this.resultTimer) clearTimeout(this.resultTimer);
    this.travelTimer = null;
    this.windupTimer = null;
    this.resultTimer = null;
  }
}
