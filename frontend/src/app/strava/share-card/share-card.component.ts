import {
  Component,
  Input,
  AfterViewInit,
  ViewChild,
  ElementRef,
  Output,
  EventEmitter,
  OnChanges,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { StravaActivity } from '../../shared/services/strava.service';

@Component({
  selector: 'app-share-card',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule],
  template: `
    <!-- Modal overlay -->
    <div
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
      (click)="onOverlayClick($event)"
    >
      <div class="relative flex flex-col items-center gap-4" (click)="$event.stopPropagation()">
        <!-- Canvas -->
        <canvas
          #card
          width="1080"
          height="1080"
          style="width: 540px; height: 540px; border-radius: 12px; display: block;"
        ></canvas>

        <!-- Action buttons -->
        <div class="flex gap-3">
          <button mat-raised-button (click)="download()" style="background-color:#e91e8c;color:#fff;">
            <mat-icon>download</mat-icon>
            Download
          </button>
          <button mat-stroked-button (click)="close.emit()" style="color:#fff;border-color:#fff;">
            <mat-icon>close</mat-icon>
            Close
          </button>
        </div>
      </div>
    </div>
  `,
})
export class ShareCardComponent implements AfterViewInit, OnChanges {
  @Input() activity!: StravaActivity;
  @Output() close = new EventEmitter<void>();

  @ViewChild('card') canvasRef!: ElementRef<HTMLCanvasElement>;

  ngAfterViewInit(): void {
    // Use a microtask tick to ensure the canvas element is fully in the DOM
    Promise.resolve().then(() => this.draw());
  }

  ngOnChanges(): void {
    if (this.canvasRef) {
      Promise.resolve().then(() => this.draw());
    }
  }

  onOverlayClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.close.emit();
    }
  }

  download(): void {
    const canvas = this.canvasRef.nativeElement;
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const safeName = (this.activity.name ?? 'run')
        .replace(/[^a-z0-9]/gi, '_')
        .toLowerCase();
      a.download = `myrunna_${safeName}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 'image/png');
  }

  private draw(): void {
    const canvas = this.canvasRef?.nativeElement;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = 1080;
    const H = 1080;

    // ── Background gradient ──────────────────────────────────────────────────
    const bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, '#0d0a1a');
    bg.addColorStop(1, '#1a0a2e');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // ── Subtle grid / texture overlay ────────────────────────────────────────
    ctx.strokeStyle = 'rgba(255,255,255,0.03)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= W; x += 60) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    for (let y = 0; y <= H; y += 60) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }

    // ── Route map ────────────────────────────────────────────────────────────
    const polyline = this.activity.summaryPolyline;
    if (polyline) {
      const coords = decodePolyline(polyline);
      if (coords.length > 1) {
        this.drawRoute(ctx, coords, W, H);
      }
    }

    // ── Stats panel ──────────────────────────────────────────────────────────
    this.drawStatsPanel(ctx, W, H);

    // ── Activity name (top) ──────────────────────────────────────────────────
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 42px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(this.truncate(this.activity.name, 28), 48, 76);

    // ── Date (top-right) ─────────────────────────────────────────────────────
    const dateStr = new Date(this.activity.startDate).toLocaleDateString('en-AU', {
      day: 'numeric', month: 'short', year: 'numeric',
    });
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.font = '28px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(dateStr, W - 48, 76);

    // ── MyRunna branding (bottom-right) ──────────────────────────────────────
    ctx.fillStyle = '#e91e8c';
    ctx.font = 'bold 26px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('MyRunna', W - 48, H - 28);
  }

  private drawRoute(
    ctx: CanvasRenderingContext2D,
    coords: [number, number][],
    W: number,
    H: number,
  ): void {
    // Determine bounding box of the route
    let minLat = Infinity, maxLat = -Infinity;
    let minLng = Infinity, maxLng = -Infinity;
    for (const [lat, lng] of coords) {
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
    }

    const latSpan = maxLat - minLat || 0.001;
    const lngSpan = maxLng - minLng || 0.001;

    // Route box: 600×600, centred in the card
    const BOX = 600;
    const offsetX = (W - BOX) / 2;
    const offsetY = (H - BOX) / 2 - 60; // shift slightly upward to leave room for stats

    // Maintain aspect ratio — scale uniformly
    const scale = BOX / Math.max(latSpan, lngSpan);

    const toCanvas = ([lat, lng]: [number, number]): [number, number] => {
      const x = offsetX + (lng - minLng) * scale;
      // Latitude increases northward (upward in map coords) — invert for canvas
      const y = offsetY + BOX - (lat - minLat) * scale;
      return [x, y];
    };

    // Centre within the box
    const [x0, y0] = toCanvas(coords[0]);
    const centreX = offsetX + BOX / 2;
    const centreY = offsetY + BOX / 2;

    // Calculate actual centre of the rendered path
    const renderedCentreX = offsetX + ((maxLng + minLng) / 2 - minLng) * scale;
    const renderedCentreY = offsetY + BOX - ((maxLat + minLat) / 2 - minLat) * scale;
    const shiftX = centreX - renderedCentreX;
    const shiftY = centreY - renderedCentreY;

    const toCanvasCentred = ([lat, lng]: [number, number]): [number, number] => {
      const [cx, cy] = toCanvas([lat, lng]);
      return [cx + shiftX, cy + shiftY];
    };

    // Glow pass — wider, semi-transparent
    ctx.beginPath();
    const [gx0, gy0] = toCanvasCentred(coords[0]);
    ctx.moveTo(gx0, gy0);
    for (let i = 1; i < coords.length; i++) {
      const [gx, gy] = toCanvasCentred(coords[i]);
      ctx.lineTo(gx, gy);
    }
    ctx.strokeStyle = 'rgba(233,30,140,0.18)';
    ctx.lineWidth = 10;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.stroke();

    // Main route line
    ctx.beginPath();
    const [rx0, ry0] = toCanvasCentred(coords[0]);
    ctx.moveTo(rx0, ry0);
    for (let i = 1; i < coords.length; i++) {
      const [rx, ry] = toCanvasCentred(coords[i]);
      ctx.lineTo(rx, ry);
    }
    ctx.strokeStyle = '#e91e8c';
    ctx.lineWidth = 4;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.stroke();

    // Start dot
    const [sx, sy] = toCanvasCentred(coords[0]);
    ctx.beginPath();
    ctx.arc(sx, sy, 8, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    // End dot
    const [ex, ey] = toCanvasCentred(coords[coords.length - 1]);
    ctx.beginPath();
    ctx.arc(ex, ey, 8, 0, Math.PI * 2);
    ctx.fillStyle = '#e91e8c';
    ctx.fill();
  }

  private drawStatsPanel(ctx: CanvasRenderingContext2D, W: number, H: number): void {
    const panelTop = 760;
    const panelHeight = H - panelTop - 20;
    const panelX = 40;
    const panelW = W - 80;
    const radius = 16;

    // Panel background
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(panelX + radius, panelTop);
    ctx.lineTo(panelX + panelW - radius, panelTop);
    ctx.quadraticCurveTo(panelX + panelW, panelTop, panelX + panelW, panelTop + radius);
    ctx.lineTo(panelX + panelW, panelTop + panelHeight - radius);
    ctx.quadraticCurveTo(panelX + panelW, panelTop + panelHeight, panelX + panelW - radius, panelTop + panelHeight);
    ctx.lineTo(panelX + radius, panelTop + panelHeight);
    ctx.quadraticCurveTo(panelX, panelTop + panelHeight, panelX, panelTop + panelHeight - radius);
    ctx.lineTo(panelX, panelTop + radius);
    ctx.quadraticCurveTo(panelX, panelTop, panelX + radius, panelTop);
    ctx.closePath();
    ctx.fillStyle = 'rgba(10,6,30,0.72)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(233,30,140,0.25)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();

    const a = this.activity;
    const distKm = (a.distance / 1000).toFixed(2);
    const paceStr = formatPace(a.distance, a.movingTime);
    const timeStr = formatTime(a.movingTime);
    const hrStr = a.averageHeartrate ? `${Math.round(a.averageHeartrate)} bpm` : null;

    // Stat items to render
    const stats: { label: string; value: string }[] = [
      { label: 'Distance', value: `${distKm} km` },
      { label: 'Pace', value: `${paceStr} /km` },
      { label: 'Time', value: timeStr },
    ];
    if (hrStr) stats.push({ label: 'Avg HR', value: hrStr });

    const colW = panelW / stats.length;
    const statY = panelTop + 38;

    ctx.textAlign = 'center';
    for (let i = 0; i < stats.length; i++) {
      const cx = panelX + colW * i + colW / 2;

      // Label
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.font = '22px sans-serif';
      ctx.fillText(stats[i].label, cx, statY);

      // Value
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 46px sans-serif';
      ctx.fillText(stats[i].value, cx, statY + 58);
    }
  }

  private truncate(str: string, max: number): string {
    return str.length <= max ? str : str.slice(0, max - 1) + '…';
  }
}

// ── Pure functions ─────────────────────────────────────────────────────────────

/**
 * Decodes a Google-encoded polyline string into [lat, lng] pairs.
 * Algorithm: https://developers.google.com/maps/documentation/utilities/polylinealgorithm
 */
function decodePolyline(encoded: string): [number, number][] {
  const coords: [number, number][] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    // Decode latitude delta
    let result = 0;
    let shift = 0;
    let b: number;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dLat = (result & 1) ? ~(result >> 1) : result >> 1;
    lat += dLat;

    // Decode longitude delta
    result = 0;
    shift = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dLng = (result & 1) ? ~(result >> 1) : result >> 1;
    lng += dLng;

    coords.push([lat * 1e-5, lng * 1e-5]);
  }

  return coords;
}

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${m}:${String(s).padStart(2, '0')}`;
}

function formatPace(distanceMeters: number, movingTimeSeconds: number): string {
  if (!distanceMeters || !movingTimeSeconds) return '—';
  const paceMinPerKm = movingTimeSeconds / 60 / (distanceMeters / 1000);
  const minutes = Math.floor(paceMinPerKm);
  const secs = Math.round((paceMinPerKm - minutes) * 60);
  return `${minutes}:${String(secs).padStart(2, '0')}`;
}
