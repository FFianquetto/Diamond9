import {
  Component,
  HostListener,
  OnDestroy,
  OnInit,
} from '@angular/core';
import { Router, NavigationEnd, RouterLink } from '@angular/router';
import { filter } from 'rxjs/operators';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-menu-bar',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './menu-bar.component.html',
  styleUrl: './menu-bar.component.scss',
})
export class MenuBarComponent implements OnInit, OnDestroy {
  public isAtTop = true;
  public isMenuOpen = false;
  public isExtraMenuOpen = false;
  public isLandingPage = true;
  public activeRoute = '/';
  public logoLetters = ['D', '9', '·', 'A', 'R'];
  public logoClickCount = 0;

  constructor(private router: Router) {
    this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe((event: NavigationEnd) => {
        this.checkCurrentRoute(event.urlAfterRedirects || event.url);
      });
  }

  ngOnInit(): void {
    this.checkScroll();
    this.checkCurrentRoute(this.router.url);
  }

  ngOnDestroy(): void {
    document.body.style.overflow = '';
  }

  @HostListener('window:scroll', [])
  onWindowScroll(): void {
    this.checkScroll();
  }

  @HostListener('window:resize', [])
  onResize(): void {
    if (window.innerWidth > 900 && this.isMenuOpen) {
      this.isMenuOpen = false;
      document.body.style.overflow = '';
    }
    if (window.innerWidth <= 800) {
      this.isExtraMenuOpen = false;
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event): void {
    const targetElement = event.target as HTMLElement;
    if (
      !targetElement.closest('.menu-bar') &&
      this.isMenuOpen &&
      window.innerWidth <= 900
    ) {
      this.isMenuOpen = false;
      document.body.style.overflow = '';
    }
    if (!targetElement.closest('.menu-bar') && window.innerWidth > 800) {
      this.isExtraMenuOpen = false;
    }
  }

  toggleMenu(): void {
    this.isMenuOpen = !this.isMenuOpen;
    if (this.isMenuOpen) {
      this.isExtraMenuOpen = false;
    }
    document.body.style.overflow = this.isMenuOpen ? 'hidden' : '';
  }

  toggleExtraMenu(event: Event): void {
    event.stopPropagation();
    this.isExtraMenuOpen = !this.isExtraMenuOpen;
  }

  closeExpandedMenus(): void {
    this.isExtraMenuOpen = false;
    this.isMenuOpen = false;
    document.body.style.overflow = '';
  }

  navigateTo(route: string): void {
    const path = route ? '/' + route : '/';
    void this.router.navigateByUrl(path);
    this.closeExpandedMenus();
  }

  isActive(route: string): boolean {
    const path = route ? '/' + route : '/';
    return this.activeRoute === path;
  }

  isMoreActive(): boolean {
    return this.isActive('marcadores') || this.isActive('juego') || this.isActive('rebote');
  }

  private checkCurrentRoute(url: string): void {
    const clean = (url.split('?')[0].split('#')[0] || '/').replace(/\/$/, '');
    this.activeRoute = clean === '' || clean === '/home' ? '/' : clean;
    this.isLandingPage = this.activeRoute === '/';
  }

  private checkScroll(): void {
    this.isAtTop = window.pageYOffset < 10;
  }
}
