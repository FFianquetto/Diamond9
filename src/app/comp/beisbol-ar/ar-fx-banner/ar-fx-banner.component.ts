import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';

export type ArFxKind = 'detect' | 'anim' | 'video' | 'info' | 'stats' | 'homer';

@Component({
  selector: 'app-ar-fx-banner',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  template: `
    <div class="fx-banner" [attr.data-kind]="kind" role="status">
      <mat-icon class="fx-icon" aria-hidden="true">{{ icon }}</mat-icon>
      <div class="fx-copy">
        <strong>{{ title }}</strong>
        @if (subtitle) {
          <span>{{ subtitle }}</span>
        }
      </div>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        width: 100%;
        max-width: min(92%, 340px);
        margin-top: 0.45rem;
        pointer-events: none;
        animation: fx-banner-in 0.4s cubic-bezier(0.22, 1, 0.36, 1) both;
      }

      .fx-banner {
        display: flex;
        align-items: center;
        gap: 0.55rem;
        padding: 0.55rem 0.75rem;
        border-radius: 12px;
        border: 1.5px solid rgba(0, 194, 215, 0.45);
        background: linear-gradient(
          135deg,
          rgba(0, 12, 24, 0.88),
          rgba(0, 50, 64, 0.78)
        );
        box-shadow:
          0 0 0 1px rgba(0, 194, 215, 0.12),
          0 10px 28px rgba(0, 0, 0, 0.35);
      }

      .fx-banner[data-kind='homer'],
      .fx-banner[data-kind='anim'],
      .fx-banner[data-kind='video'] {
        border-color: rgba(245, 197, 66, 0.55);
        background: linear-gradient(
          135deg,
          rgba(24, 16, 0, 0.9),
          rgba(64, 40, 0, 0.75)
        );
      }

      .fx-banner[data-kind='info'] {
        border-color: rgba(139, 234, 242, 0.5);
      }

      .fx-banner[data-kind='stats'] {
        border-color: rgba(62, 104, 140, 0.65);
      }

      .fx-icon {
        flex: 0 0 auto;
        color: #00c2d7;
        font-size: 1.35rem;
        width: 1.35rem;
        height: 1.35rem;
      }

      .fx-banner[data-kind='homer'] .fx-icon,
      .fx-banner[data-kind='anim'] .fx-icon,
      .fx-banner[data-kind='video'] .fx-icon {
        color: #f5c542;
      }

      .fx-copy {
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 0.1rem;
      }

      .fx-copy strong {
        font-size: 0.78rem;
        font-weight: 800;
        letter-spacing: 0.05em;
        text-transform: uppercase;
        color: #fff;
        line-height: 1.2;
      }

      .fx-copy span {
        font-size: 0.7rem;
        color: #a8b3c2;
        line-height: 1.25;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      @keyframes fx-banner-in {
        from {
          opacity: 0;
          transform: translateY(8px) scale(0.96);
        }
        to {
          opacity: 1;
          transform: none;
        }
      }
    `,
  ],
})
export class ArFxBannerComponent {
  @Input({ required: true }) title = '';
  @Input() subtitle = '';
  @Input() kind: ArFxKind = 'anim';

  get icon(): string {
    switch (this.kind) {
      case 'detect':
        return 'sensors';
      case 'video':
        return 'videocam';
      case 'info':
        return 'record_voice_over';
      case 'stats':
        return 'bar_chart';
      case 'homer':
        return 'sports_baseball';
      default:
        return 'auto_awesome';
    }
  }
}
