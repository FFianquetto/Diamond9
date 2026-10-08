import { HttpClient } from '@angular/common/http';
import { Component, DestroyRef, computed, inject, signal, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { ActivatedRoute, Router } from '@angular/router';
import { ParticleFxService } from '../../shared/particle-fx/particle-fx.service';
import { RewardsService } from '../rewards.service';

interface TriviaQ {
  pregunta: string;
  opciones: string[];
  correcta: number;
  explica: string;
}

interface TriviaTeam {
  id: string;
  nombre: string;
  ciudad: string;
  color: string;
  preguntas: TriviaQ[];
}

interface TriviaFile {
  liga: string;
  equipos: TriviaTeam[];
}

@Component({
  selector: 'app-trivia',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  templateUrl: './trivia.component.html',
  styleUrl: './trivia.component.scss',
})
export class TriviaComponent implements OnInit {
  private readonly fx = inject(ParticleFxService);
  private readonly rewards = inject(RewardsService);
  private readonly http = inject(HttpClient);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly teams = signal<TriviaTeam[]>([]);
  readonly teamId = signal<string | null>(null);
  readonly picking = signal(true);
  readonly loadError = signal(false);

  index = signal(0);
  score = signal(0);
  selected = signal<number | null>(null);
  answered = signal(false);
  finished = signal(false);
  feedback = signal<string | null>(null);
  rolling = signal(false);

  private loadedId: string | null = null;

  readonly team = computed(
    () => this.teams().find((item) => item.id === this.teamId()) ?? null,
  );
  readonly questions = computed(() => this.team()?.preguntas ?? []);
  readonly current = computed(() => this.questions()[this.index()] ?? null);

  ngOnInit(): void {
    this.rewards.loadCatalog().subscribe();
    this.http
      .get<TriviaFile>('assets/data/trivias-lmp.json')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (file) => {
          this.teams.set(file.equipos ?? []);
          this.syncFromRoute();
        },
        error: () => this.loadError.set(true),
      });
    this.route.queryParamMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.syncFromRoute());
  }

  choose(id: string, event?: Event): void {
    this.fx.burst('spark', event);
    void this.router.navigate(['/trivia'], { queryParams: { equipo: id } });
  }

  pick(optionIndex: number, event?: Event): void {
    const q = this.current();
    if (!q || this.answered() || this.finished()) return;
    this.selected.set(optionIndex);
    this.answered.set(true);
    if (optionIndex === q.correcta) {
      this.score.update((s) => s + 1);
      this.feedback.set('¡Correcto! ' + q.explica);
      this.fx.burst('homer', event);
    } else {
      this.feedback.set('Incorrecto. ' + q.explica);
      this.fx.burst('strike', event);
    }
  }

  next(event?: Event): void {
    const total = this.questions().length;
    if (this.index() >= total - 1) {
      this.finished.set(true);
      const score = this.score();
      this.rewards.recordTriviaDone();
      this.feedback.set(`Trivia terminada: ${score} / ${total} aciertos.`);
      this.fx.burstCenter(score >= 4 ? 'homer' : 'confetti');
      return;
    }
    this.index.update((i) => i + 1);
    this.selected.set(null);
    this.answered.set(false);
    this.feedback.set(null);
    this.fx.burst('spark', event);
  }

  restart(event?: Event): void {
    const id = this.teamId();
    if (!id) return;
    this.startTeam(id);
    this.fx.burst('spark', event);
  }

  rollRandom(event?: Event): void {
    const teams = this.teams();
    if (!teams.length) return;
    const current = this.teamId();
    const pool = teams.filter((item) => item.id !== current);
    const next = pool[Math.floor(Math.random() * pool.length)] ?? teams[0];
    this.rolling.set(true);
    this.fx.burst('spark', event);
    window.setTimeout(() => this.rolling.set(false), 480);
    void this.router.navigate(['/trivia'], { queryParams: { equipo: next.id } });
  }

  showPicker(event?: Event): void {
    this.fx.burst('spark', event);
    void this.router.navigate(['/trivia'], { queryParams: {} });
  }

  private syncFromRoute(): void {
    const teams = this.teams();
    if (!teams.length) return;
    const id = this.route.snapshot.queryParamMap.get('equipo');
    if (!id || !teams.some((item) => item.id === id)) {
      this.picking.set(true);
      this.teamId.set(null);
      this.loadedId = null;
      this.finished.set(false);
      return;
    }
    if (this.loadedId === id && !this.picking()) return;
    this.startTeam(id);
  }

  private startTeam(id: string): void {
    this.loadedId = id;
    this.teamId.set(id);
    this.picking.set(false);
    this.index.set(0);
    this.score.set(0);
    this.selected.set(null);
    this.answered.set(false);
    this.finished.set(false);
    this.feedback.set(null);
  }
}
