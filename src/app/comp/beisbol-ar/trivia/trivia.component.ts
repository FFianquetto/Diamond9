import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ParticleFxService } from '../../shared/particle-fx/particle-fx.service';

interface TriviaQ {
  id: number;
  question: string;
  options: string[];
  correct: number;
  explain: string;
}

@Component({
  selector: 'app-trivia',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './trivia.component.html',
  styleUrl: './trivia.component.scss',
})
export class TriviaComponent {
  private readonly fx = inject(ParticleFxService);
  readonly questions: TriviaQ[] = [
    {
      id: 1,
      question: '¿En qué año se fundó la Liga Mexicana de Beisbol?',
      options: ['1919', '1925', '1948', '1962'],
      correct: 1,
      explain: 'La LMB nació en 1925 como circuito profesional en México.',
    },
    {
      id: 2,
      question: '¿Cuántas bases hay en un diamante de beisbol oficial?',
      options: ['2', '3', '4', '5'],
      correct: 2,
      explain: 'Home + 1ª + 2ª + 3ª = cuatro bases que forman el diamante.',
    },
    {
      id: 3,
      question: '¿Qué significa un “jonrón”?',
      options: [
        'Un out en el outfield',
        'Un hit que permite anotar en la misma jugada (home run)',
        'Un error del pitcher',
        'Un toque de sacrificio',
      ],
      correct: 1,
      explain: 'El jonrón (home run) permite al bateador recorrer todas las bases.',
    },
    {
      id: 4,
      question: '¿Cuántos outs se necesitan para terminar una entrada para un equipo?',
      options: ['1', '2', '3', '9'],
      correct: 2,
      explain: 'Tres outs cierran el turno al bat de un equipo en esa entrada.',
    },
  ];

  index = signal(0);
  score = signal(0);
  selected = signal<number | null>(null);
  answered = signal(false);
  finished = signal(false);
  feedback = signal<string | null>(null);

  current = computed(() => this.questions[this.index()]);

  pick(optionIndex: number, event?: Event): void {
    if (this.answered() || this.finished()) return;
    this.selected.set(optionIndex);
    this.answered.set(true);
    const q = this.current();
    if (optionIndex === q.correct) {
      this.score.update((s) => s + 1);
      this.feedback.set('¡Correcto! ' + q.explain);
      this.fx.burst('homer', event);
    } else {
      this.feedback.set('Incorrecto. ' + q.explain);
      this.fx.burst('strike', event);
    }
  }

  next(event?: Event): void {
    if (this.index() >= this.questions.length - 1) {
      this.finished.set(true);
      this.feedback.set(
        `Trivia terminada: ${this.score()} / ${this.questions.length} aciertos.`,
      );
      this.fx.burstCenter(this.score() >= 3 ? 'homer' : 'confetti');
      return;
    }
    this.index.update((i) => i + 1);
    this.selected.set(null);
    this.answered.set(false);
    this.feedback.set(null);
    this.fx.burst('spark', event);
  }

  restart(event?: Event): void {
    this.index.set(0);
    this.score.set(0);
    this.selected.set(null);
    this.answered.set(false);
    this.finished.set(false);
    this.feedback.set(null);
    this.fx.burst('spark', event);
  }
}
