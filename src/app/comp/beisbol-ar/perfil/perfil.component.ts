import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { ActivatedRoute, Router } from '@angular/router';
import { CartaColeccion, CartaUnlockSource } from '../content.types';
import { ProfileService } from '../profile.service';
import { RewardsService } from '../rewards.service';
import {
  SectionPill,
  SectionShellComponent,
} from '../../shared/section-shell/section-shell.component';
import { PillSwitchComponent } from '../../shared/pill-switch/pill-switch.component';
import { UiSoundService } from '../../shared/ui-sound.service';

type MainTab = 'perfil' | 'coleccion';
type FiltroCartas = 'mlb' | 'mex';

@Component({
  selector: 'app-perfil',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    SectionShellComponent,
    PillSwitchComponent,
  ],
  templateUrl: './perfil.component.html',
  styleUrl: './perfil.component.scss',
})
export class PerfilComponent implements OnInit {
  private readonly profile = inject(ProfileService);
  private readonly rewards = inject(RewardsService);
  private readonly sounds = inject(UiSoundService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly perfil = this.profile.state;
  readonly displayName = this.profile.displayName;
  readonly avatarUrl = this.profile.avatarUrl;
  readonly totalCartas = this.rewards.totalCartas;
  readonly coleccionResumen = this.rewards.coleccionResumen;

  readonly tab = signal<MainTab>('perfil');
  readonly filtro = signal<FiltroCartas>('mex');
  readonly draftName = signal('');
  readonly saving = signal(false);
  readonly feedback = signal<string | null>(null);
  readonly avatarError = signal<string | null>(null);

  cartas: CartaColeccion[] = [];

  readonly mainPills: SectionPill[] = [
    { id: 'perfil', label: 'Mi perfil' },
    { id: 'coleccion', label: 'Colección' },
  ];

  readonly leaguePills: SectionPill[] = [
    { id: 'mex', label: 'México' },
    { id: 'mlb', label: 'MLB' },
  ];

  private feedbackTimer: ReturnType<typeof setTimeout> | null = null;

  ngOnInit(): void {
    this.profile.load().subscribe(() => {
      this.draftName.set(this.displayName());
    });
    this.rewards.loadCartas().subscribe((file) => {
      this.cartas = file.cartas ?? [];
    });

    const q = this.route.snapshot.queryParamMap.get('tab');
    if (q === 'coleccion' || q === 'recompensas') {
      this.tab.set('coleccion');
    }
  }

  setTab(id: string): void {
    if (id !== 'perfil' && id !== 'coleccion') return;
    this.tab.set(id);
    this.sounds.play('click');
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: id === 'coleccion' ? { tab: 'coleccion' } : {},
      replaceUrl: true,
    });
  }

  setFiltro(id: string): void {
    if (id === 'mlb' || id === 'mex') {
      this.filtro.set(id);
      this.sounds.play('click');
    }
  }

  get lede(): string {
    if (this.tab() === 'perfil') {
      return `Llevas ${this.coleccionResumen()} en tu álbum coleccionable.`;
    }
    return this.filtro() === 'mex'
      ? 'Coleccionables de México. Completa todo y gana el emblema legendario.'
      : 'Coleccionables MLB. Completa todo y gana el emblema legendario.';
  }

  get cartasFiltradas(): CartaColeccion[] {
    return this.cartas
      .filter((c) => c.origen === this.filtro())
      .sort((a, b) => a.numero - b.numero);
  }

  onDraft(ev: Event): void {
    const value = (ev.target as HTMLInputElement).value;
    this.draftName.set(value);
    this.profile.setNombreUsuario(value);
  }

  async onAvatarPick(ev: Event): Promise<void> {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    this.avatarError.set(null);
    this.saving.set(true);
    try {
      await this.profile.importAvatarFile(file);
      this.sounds.play('success');
      this.ping('Foto de perfil lista');
    } catch {
      this.avatarError.set(
        'No se pudo cargar la foto. Prueba con otra imagen (JPG o PNG).',
      );
      this.sounds.play('click');
    } finally {
      this.saving.set(false);
    }
  }

  removeAvatar(): void {
    this.profile.clearAvatar();
    this.avatarError.set(null);
    this.sounds.play('click');
    this.ping('Foto eliminada');
  }

  tieneCarta(id: string): boolean {
    return this.rewards.hasCarta(id);
  }

  sourceOf(id: string): CartaUnlockSource | null {
    return this.rewards.cartaSource(id);
  }

  sourceLabel(c: CartaColeccion): string {
    return this.rewards.originBadge(c);
  }

  unlockHint(c: CartaColeccion): string {
    return this.rewards.unlockHint(c);
  }

  countOwned(origen: 'mlb' | 'mex'): number {
    const ids = this.rewards.state().cartas;
    return this.cartas.filter((c) => c.origen === origen && ids.includes(c.id))
      .length;
  }

  countTotal(origen: 'mlb' | 'mex'): number {
    return this.cartas.filter((c) => c.origen === origen).length;
  }

  private ping(msg: string): void {
    this.feedback.set(msg);
    if (this.feedbackTimer) clearTimeout(this.feedbackTimer);
    this.feedbackTimer = setTimeout(() => this.feedback.set(null), 1600);
  }
}
