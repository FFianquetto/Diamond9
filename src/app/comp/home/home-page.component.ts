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
      title: 'Galería',
      subtitle: 'Imágenes LNM y videos de béisbol embebidos desde YouTube.',
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
      subtitle: 'Standing LNM 2026, líderes y récords de leyendas del béisbol.',
      link: '/estadisticas',
    },
    {
      index: '05',
      title: 'Historia del béisbol',
      subtitle: 'Línea de tiempo y perfiles de las figuras más importantes.',
      link: '/historia',
    },
    {
      index: '06',
      title: 'Recompensas',
      subtitle: 'Gana insignias al escanear, jugar o completar la trivia.',
      link: '/recompensas',
    },
    {
      index: '07',
      title: 'Modelos 3D',
      subtitle: 'Galería de props rotando: bate, pelota, gorra, guante y trofeo.',
      link: '/modelos',
    },
    {
      index: '08',
      title: 'Jonrón al toque',
      subtitle: 'Mini juego para celular: batea en el momento justo.',
      link: '/juego',
    },
    {
      index: '09',
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
