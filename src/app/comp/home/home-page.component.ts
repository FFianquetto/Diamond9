import { Component, HostListener, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { RevealOnScrollDirective } from '../shared/reveal-on-scroll.directive';
import { ParticleFxService } from '../shared/particle-fx/particle-fx.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatIconModule,
    RevealOnScrollDirective,
  ],
  templateUrl: './home-page.component.html',
  styleUrl: './home-page.component.scss',
})
export class HomeComponent {
  atTop = true;
  private readonly fx = inject(ParticleFxService);

  readonly modes = [
    {
      index: '01',
      title: 'Escáner AR',
      subtitle: 'Cámara, marcadores y acciones interactivas en el diamante.',
      link: '/ar',
    },
    {
      index: '02',
      title: 'Videos + filtros',
      subtitle: 'Acervo LMB / Mundial 2026 con edición por filtros permitidos.',
      link: '/videos',
    },
    {
      index: '03',
      title: 'Trivia',
      subtitle: 'Retos sobre historia y reglas del beisbol mexicano.',
      link: '/trivia',
    },
    {
      index: '04',
      title: 'Estadísticas',
      subtitle: 'Marcador y líderes en tiempo real (prototipo simulado).',
      link: '/estadisticas',
    },
    {
      index: '05',
      title: 'Jonrón al toque',
      subtitle: 'Mini juego para celular: batea en el momento justo.',
      link: '/juego',
    },
    {
      index: '06',
      title: 'Hockey de rebote',
      subtitle: 'Desliza la tabla y no dejes caer la pelota.',
      link: '/rebote',
    },
  ];

  constructor(private router: Router) {
    this.checkScrollPosition();
  }

  @HostListener('window:scroll')
  onWindowScroll(): void {
    this.checkScrollPosition();
  }

  private checkScrollPosition(): void {
    this.atTop = window.pageYOffset < 50;
  }

  navigateTo(path: string, event?: Event): void {
    this.fx.burst('spark', event);
    void this.router.navigateByUrl(path);
  }

  onModeClick(event: Event): void {
    this.fx.burst('spark', event);
  }

  scrollToModes(): void {
    document.getElementById('modos')?.scrollIntoView({ behavior: 'smooth' });
  }
}
