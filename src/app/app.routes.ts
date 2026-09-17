import { Routes } from '@angular/router';

/**
 * Rutas del proyecto integrador: app web AR de beisbol (LMB / temática Diamante 9).
 * Se omiten portales, tienda, pagos y CMS de la plataforma comercial anterior.
 */
export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./comp/home/home-page.component').then((m) => m.HomeComponent),
  },
  { path: 'home', redirectTo: '', pathMatch: 'full' },
  { path: 'landing', redirectTo: '', pathMatch: 'full' },
  {
    path: 'ar',
    loadComponent: () =>
      import('./comp/beisbol-ar/ar-scanner/ar-scanner.component').then(
        (m) => m.ArScannerComponent,
      ),
  },
  {
    path: 'galeria',
    redirectTo: 'videos',
    pathMatch: 'full',
  },
  {
    path: 'videos',
    loadComponent: () =>
      import('./comp/beisbol-ar/video-filters/video-filters.component').then(
        (m) => m.VideoFiltersComponent,
      ),
  },
  {
    path: 'trivia',
    loadComponent: () =>
      import('./comp/beisbol-ar/trivia/trivia.component').then(
        (m) => m.TriviaComponent,
      ),
  },
  {
    path: 'estadisticas',
    loadComponent: () =>
      import('./comp/beisbol-ar/stats/stats.component').then(
        (m) => m.StatsComponent,
      ),
  },
  {
    path: 'historia',
    loadComponent: () =>
      import('./comp/beisbol-ar/historia/historia.component').then(
        (m) => m.HistoriaComponent,
      ),
  },
  {
    path: 'recompensas',
    loadComponent: () =>
      import('./comp/beisbol-ar/recompensas/recompensas.component').then(
        (m) => m.RecompensasComponent,
      ),
  },
  {
    path: 'modelos',
    loadComponent: () =>
      import('./comp/beisbol-ar/modelos-3d/modelos-3d.component').then(
        (m) => m.Modelos3dComponent,
      ),
  },
  {
    path: 'equipos',
    loadComponent: () =>
      import('./comp/beisbol-ar/markers-guide/markers-guide.component').then(
        (m) => m.MarkersGuideComponent,
      ),
  },
  { path: 'marcadores', redirectTo: 'equipos', pathMatch: 'full' },
  {
    path: 'juego',
    loadComponent: () =>
      import('./comp/beisbol-ar/home-run-game/home-run-game.component').then(
        (m) => m.HomeRunGameComponent,
      ),
  },
  {
    path: 'rebote',
    loadComponent: () =>
      import('./comp/beisbol-ar/paddle-game/paddle-game.component').then(
        (m) => m.PaddleGameComponent,
      ),
  },
  { path: '**', redirectTo: '' },
];
