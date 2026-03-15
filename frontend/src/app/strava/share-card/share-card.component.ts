import {
  Component,
  Input,
  AfterViewInit,
  ViewChild,
  ElementRef,
  Output,
  EventEmitter,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { StravaActivity } from '../../shared/services/strava.service';

type BgMode = 'dark' | 'light' | 'custom';

@Component({
  selector: 'app-share-card',
  standalone: true,
  imports: [CommonModule, FormsModule, MatButtonModule, MatIconModule, MatTooltipModule],
  template: `
    <!-- Modal overlay -->
    <div
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
      (click)="onOverlayClick($event)"
    >
      <div class="flex flex-col lg:flex-row gap-5 items-start max-h-[95vh] overflow-y-auto" (click)="$event.stopPropagation()">

        <!-- Canvas preview -->
        <div class="flex-shrink-0">
          <canvas
            #card
            width="1080"
            height="1080"
            style="width: min(480px, 90vw); height: min(480px, 90vw); border-radius: 14px; display: block; box-shadow: 0 8px 40px rgba(0,0,0,0.6);"
          ></canvas>
        </div>

        <!-- Controls panel -->
        <div class="flex flex-col gap-4 lg:w-64 w-full">

          <!-- Background -->
          <div class="bg-white/10 rounded-2xl p-4">
            <p class="text-white/70 text-xs font-semibold uppercase tracking-wide mb-3">Background</p>
            <div class="flex gap-2">
              <button
                class="flex-1 py-2 rounded-xl text-xs font-semibold transition-all border"
                [style.background]="bgMode() === 'dark' ? 'linear-gradient(135deg,#0d0a1a,#1a0a2e)' : 'transparent'"
                [style.color]="bgMode() === 'dark' ? '#fff' : 'rgba(255,255,255,0.5)'"
                [style.border-color]="bgMode() === 'dark' ? '#e91e8c' : 'rgba(255,255,255,0.15)'"
                (click)="setBg('dark')"
              >🌙 Dark</button>
              <button
                class="flex-1 py-2 rounded-xl text-xs font-semibold transition-all border"
                [style.background]="bgMode() === 'light' ? '#f8f0ff' : 'transparent'"
                [style.color]="bgMode() === 'light' ? '#1a0a2e' : 'rgba(255,255,255,0.5)'"
                [style.border-color]="bgMode() === 'light' ? '#e91e8c' : 'rgba(255,255,255,0.15)'"
                (click)="setBg('light')"
              >☀️ Light</button>
              <button
                class="flex-1 py-2 rounded-xl text-xs font-semibold transition-all border"
                [style.background]="bgMode() === 'custom' ? 'rgba(233,30,140,0.15)' : 'transparent'"
                [style.color]="bgMode() === 'custom' ? '#e91e8c' : 'rgba(255,255,255,0.5)'"
                [style.border-color]="bgMode() === 'custom' ? '#e91e8c' : 'rgba(255,255,255,0.15)'"
                (click)="pickFile()"
              >🖼 Photo</button>
            </div>
            <input #fileInput type="file" accept="image/*" class="hidden" (change)="onFileChange($event)" />
          </div>

          <!-- Stats toggles -->
          <div class="bg-white/10 rounded-2xl p-4">
            <p class="text-white/70 text-xs font-semibold uppercase tracking-wide mb-3">Stats to show</p>
            <div class="grid grid-cols-2 gap-2">
              @for (stat of statDefs; track stat.key) {
                <button
                  class="py-2 px-3 rounded-xl text-xs font-semibold transition-all border text-left"
                  [style.background]="statEnabled(stat.key) ? 'rgba(233,30,140,0.15)' : 'transparent'"
                  [style.color]="statEnabled(stat.key) ? '#e91e8c' : 'rgba(255,255,255,0.4)'"
                  [style.border-color]="statEnabled(stat.key) ? '#e91e8c' : 'rgba(255,255,255,0.12)'"
                  (click)="toggleStat(stat.key)"
                >
                  {{ stat.label }}
                  @if (statEnabled(stat.key)) { <span class="float-right">✓</span> }
                </button>
              }
            </div>
          </div>

          <!-- Branding -->
          <div class="bg-white/10 rounded-2xl p-4">
            <p class="text-white/70 text-xs font-semibold uppercase tracking-wide mb-2">Your tag</p>
            <input
              type="text"
              class="w-full bg-white/10 text-white text-sm rounded-xl px-3 py-2 border border-white/20 focus:outline-none focus:border-pink-400 transition-colors"
              placeholder="e.g. @icvanee"
              [ngModel]="brandingText()"
              (ngModelChange)="brandingText.set($event); redraw()"
            />
            <p class="text-white/30 text-xs mt-1.5">Shown bottom-right on the card</p>
          </div>

          <!-- Actions -->
          <div class="flex gap-2">
            <button
              class="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 transition-opacity hover:opacity-90"
              style="background-color: #e91e8c"
              (click)="download()"
            >
              <mat-icon class="!w-4 !h-4 text-base">download</mat-icon>
              Download
            </button>
            <button
              class="py-2.5 px-4 rounded-xl text-sm font-semibold text-white/70 border border-white/20 hover:bg-white/10 transition-colors"
              (click)="close.emit()"
            >
              Close
            </button>
          </div>

        </div>
      </div>
    </div>
  `,
})
export class ShareCardComponent implements AfterViewInit {
  @Input() activity!: StravaActivity;
  @Output() close = new EventEmitter<void>();

  @ViewChild('card') canvasRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('fileInput') fileInputRef!: ElementRef<HTMLInputElement>;

  bgMode = signal<BgMode>('dark');
  customBgImg = signal<HTMLImageElement | null>(null);
  brandingText = signal('@icvanee');

  private statsMap = signal<Record<string, boolean>>({
    distance: true,
    pace: true,
    time: true,
    hr: true,
  });

  statDefs = [
    { key: 'distance', label: 'Distance' },
    { key: 'pace',     label: 'Pace'     },
    { key: 'time',     label: 'Time'     },
    { key: 'hr',       label: 'Avg HR'   },
  ];

  statEnabled(key: string): boolean {
    return this.statsMap()[key] ?? false;
  }

  toggleStat(key: string): void {
    this.statsMap.update(m => ({ ...m, [key]: !m[key] }));
    this.redraw();
  }

  setBg(mode: BgMode): void {
    this.bgMode.set(mode);
    this.redraw();
  }

  pickFile(): void {
    this.fileInputRef.nativeElement.click();
  }

  onFileChange(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        this.customBgImg.set(img);
        this.bgMode.set('custom');
        this.redraw();
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  }

  ngAfterViewInit(): void {
    Promise.resolve().then(() => this.draw());
  }

  redraw(): void {
    Promise.resolve().then(() => this.draw());
  }

  onOverlayClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) this.close.emit();
  }

  download(): void {
    const canvas = this.canvasRef.nativeElement;
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const safeName = (this.activity.name ?? 'run').replace(/[^a-z0-9]/gi, '_').toLowerCase();
      a.download = `${safeName}_${this.brandingText().replace(/[^a-z0-9]/gi, '')}.png`;
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

    const W = 1080, H = 1080;
    const mode = this.bgMode();

    ctx.clearRect(0, 0, W, H);

    // ── Background ────────────────────────────────────────────────────────────
    if (mode === 'dark') {
      this.drawDarkBg(ctx, W, H);
    } else if (mode === 'light') {
      this.drawLightBg(ctx, W, H);
    } else if (mode === 'custom') {
      const img = this.customBgImg();
      if (img) {
        this.drawCustomBg(ctx, img, W, H);
      } else {
        this.drawDarkBg(ctx, W, H);
      }
    }

    // ── Route ─────────────────────────────────────────────────────────────────
    const polyline = this.activity.summaryPolyline;
    if (polyline) {
      const coords = decodePolyline(polyline);
      if (coords.length > 1) {
        this.drawRoute(ctx, coords, W, H, mode);
      }
    }

    // ── Stats panel ───────────────────────────────────────────────────────────
    this.drawStats(ctx, W, H, mode);

    // ── Activity name ─────────────────────────────────────────────────────────
    const titleColor = mode === 'light' ? '#1a0a2e' : '#ffffff';
    ctx.fillStyle = titleColor;
    ctx.font = 'bold 44px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(truncate(this.activity.name, 26), 52, 80);

    // ── Date ──────────────────────────────────────────────────────────────────
    const dateStr = new Date(this.activity.startDate).toLocaleDateString('en-GB', {
      day: 'numeric', month: 'short', year: 'numeric',
    });
    ctx.fillStyle = mode === 'light' ? 'rgba(26,10,46,0.5)' : 'rgba(255,255,255,0.5)';
    ctx.font = '26px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(dateStr, W - 52, 80);

    // ── Branding ──────────────────────────────────────────────────────────────
    ctx.fillStyle = '#e91e8c';
    ctx.font = 'bold 28px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(this.brandingText(), W - 52, H - 32);
  }

  private drawDarkBg(ctx: CanvasRenderingContext2D, W: number, H: number): void {
    const bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, '#0d0a1a');
    bg.addColorStop(0.5, '#1a0a2e');
    bg.addColorStop(1, '#0d0a1a');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);
    // subtle grid
    ctx.strokeStyle = 'rgba(255,255,255,0.025)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= W; x += 60) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    for (let y = 0; y <= H; y += 60) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }
    // vignette
    const vignette = ctx.createRadialGradient(W / 2, H / 2, W * 0.3, W / 2, H / 2, W * 0.8);
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(1, 'rgba(0,0,0,0.4)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, W, H);
  }

  private drawLightBg(ctx: CanvasRenderingContext2D, W: number, H: number): void {
    const bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, '#f8f0ff');
    bg.addColorStop(1, '#fff0f8');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);
    // subtle dot pattern
    ctx.fillStyle = 'rgba(26,10,46,0.04)';
    for (let x = 30; x < W; x += 40) {
      for (let y = 30; y < H; y += 40) {
        ctx.beginPath(); ctx.arc(x, y, 1.5, 0, Math.PI * 2); ctx.fill();
      }
    }
  }

  private drawCustomBg(ctx: CanvasRenderingContext2D, img: HTMLImageElement, W: number, H: number): void {
    // Cover-fit the image
    const scale = Math.max(W / img.width, H / img.height);
    const sw = img.width * scale;
    const sh = img.height * scale;
    ctx.drawImage(img, (W - sw) / 2, (H - sh) / 2, sw, sh);
    // Dark overlay so text/route are readable
    const overlay = ctx.createLinearGradient(0, 0, 0, H);
    overlay.addColorStop(0, 'rgba(0,0,0,0.45)');
    overlay.addColorStop(0.5, 'rgba(0,0,0,0.2)');
    overlay.addColorStop(1, 'rgba(0,0,0,0.65)');
    ctx.fillStyle = overlay;
    ctx.fillRect(0, 0, W, H);
  }

  private drawRoute(
    ctx: CanvasRenderingContext2D,
    coords: [number, number][],
    W: number,
    H: number,
    mode: BgMode,
  ): void {
    let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
    for (const [lat, lng] of coords) {
      if (lat < minLat) minLat = lat; if (lat > maxLat) maxLat = lat;
      if (lng < minLng) minLng = lng; if (lng > maxLng) maxLng = lng;
    }
    const latSpan = maxLat - minLat || 0.001;
    const lngSpan = maxLng - minLng || 0.001;

    const statsH = 170; // height reserved for stats panel
    const pad = 80;
    const boxW = W - pad * 2;
    const boxH = H - pad * 2 - statsH - 60; // leave space top for header
    const boxX = pad;
    const boxY = pad + 50;

    const scale = Math.min(boxW / lngSpan, boxH / latSpan) * 0.88;

    const renderedW = lngSpan * scale;
    const renderedH = latSpan * scale;
    const shiftX = boxX + (boxW - renderedW) / 2;
    const shiftY = boxY + (boxH - renderedH) / 2;

    const toCanvas = ([lat, lng]: [number, number]): [number, number] => [
      shiftX + (lng - minLng) * scale,
      shiftY + renderedH - (lat - minLat) * scale,
    ];

    const routeColor = mode === 'light' ? '#1a0a2e' : '#e91e8c';
    const glowColor = mode === 'light' ? 'rgba(26,10,46,0.1)' : 'rgba(233,30,140,0.2)';

    // Glow
    ctx.beginPath();
    ctx.moveTo(...toCanvas(coords[0]));
    for (let i = 1; i < coords.length; i++) ctx.lineTo(...toCanvas(coords[i]));
    ctx.strokeStyle = glowColor;
    ctx.lineWidth = 14;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.stroke();

    // Main line
    ctx.beginPath();
    ctx.moveTo(...toCanvas(coords[0]));
    for (let i = 1; i < coords.length; i++) ctx.lineTo(...toCanvas(coords[i]));
    ctx.strokeStyle = routeColor;
    ctx.lineWidth = mode === 'light' ? 5 : 4;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.stroke();

    // Start dot (white)
    const [sx, sy] = toCanvas(coords[0]);
    ctx.beginPath(); ctx.arc(sx, sy, 9, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff'; ctx.fill();
    ctx.beginPath(); ctx.arc(sx, sy, 5, 0, Math.PI * 2);
    ctx.fillStyle = routeColor; ctx.fill();

    // End dot (filled)
    const [ex, ey] = toCanvas(coords[coords.length - 1]);
    ctx.beginPath(); ctx.arc(ex, ey, 11, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff'; ctx.fill();
    ctx.beginPath(); ctx.arc(ex, ey, 7, 0, Math.PI * 2);
    ctx.fillStyle = routeColor; ctx.fill();
  }

  private drawStats(ctx: CanvasRenderingContext2D, W: number, H: number, mode: BgMode): void {
    const a = this.activity;
    const enabled = this.statsMap();

    const allStats = [
      { key: 'distance', label: 'Distance', value: `${(a.distance / 1000).toFixed(2)} km` },
      { key: 'pace',     label: 'Pace',     value: `${formatPace(a.distance, a.movingTime)} /km` },
      { key: 'time',     label: 'Time',     value: formatTime(a.movingTime) },
      ...(a.averageHeartrate ? [{ key: 'hr', label: 'Avg HR', value: `${Math.round(a.averageHeartrate)} bpm` }] : []),
    ].filter(s => enabled[s.key]);

    if (allStats.length === 0) return;

    const panelH = 150;
    const panelTop = H - panelH - 52;
    const panelX = 44;
    const panelW = W - 88;
    const r = 18;

    // Panel background
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(panelX + r, panelTop);
    ctx.lineTo(panelX + panelW - r, panelTop);
    ctx.arcTo(panelX + panelW, panelTop, panelX + panelW, panelTop + r, r);
    ctx.lineTo(panelX + panelW, panelTop + panelH - r);
    ctx.arcTo(panelX + panelW, panelTop + panelH, panelX + panelW - r, panelTop + panelH, r);
    ctx.lineTo(panelX + r, panelTop + panelH);
    ctx.arcTo(panelX, panelTop + panelH, panelX, panelTop + panelH - r, r);
    ctx.lineTo(panelX, panelTop + r);
    ctx.arcTo(panelX, panelTop, panelX + r, panelTop, r);
    ctx.closePath();

    if (mode === 'light') {
      ctx.fillStyle = 'rgba(26,10,46,0.88)';
    } else {
      ctx.fillStyle = 'rgba(8,4,22,0.78)';
    }
    ctx.fill();
    ctx.strokeStyle = 'rgba(233,30,140,0.3)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();

    const colW = panelW / allStats.length;
    const labelY = panelTop + 44;
    const valueY = panelTop + 108;

    ctx.textAlign = 'center';
    for (let i = 0; i < allStats.length; i++) {
      const cx = panelX + colW * i + colW / 2;
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.font = '21px system-ui, -apple-system, sans-serif';
      ctx.fillText(allStats[i].label, cx, labelY);

      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${allStats.length > 3 ? 38 : 44}px system-ui, -apple-system, sans-serif`;
      ctx.fillText(allStats[i].value, cx, valueY);
    }
  }
}

// ── Pure helpers ──────────────────────────────────────────────────────────────

function decodePolyline(encoded: string): [number, number][] {
  const coords: [number, number][] = [];
  let index = 0, lat = 0, lng = 0;
  while (index < encoded.length) {
    let result = 0, shift = 0, b: number;
    do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lat += (result & 1) ? ~(result >> 1) : result >> 1;
    result = 0; shift = 0;
    do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lng += (result & 1) ? ~(result >> 1) : result >> 1;
    coords.push([lat * 1e-5, lng * 1e-5]);
  }
  return coords;
}

function formatTime(s: number): string {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
    : `${m}:${String(sec).padStart(2, '0')}`;
}

function formatPace(dist: number, time: number): string {
  if (!dist || !time) return '—';
  const p = time / 60 / (dist / 1000);
  return `${Math.floor(p)}:${String(Math.round((p % 1) * 60)).padStart(2, '0')}`;
}

function truncate(s: string, max: number): string {
  return s.length <= max ? s : s.slice(0, max - 1) + '…';
}
