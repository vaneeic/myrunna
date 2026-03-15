import {
  Component, Input, AfterViewInit, ViewChild, ElementRef,
  Output, EventEmitter, signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { StravaActivity } from '../../shared/services/strava.service';

type BgMode  = 'dark' | 'light' | 'map' | 'custom';
type Layout  = 'full' | 'padded';

const W = 1080, H = 1080;

@Component({
  selector: 'app-share-card',
  standalone: true,
  imports: [CommonModule, FormsModule, MatButtonModule, MatIconModule, MatProgressSpinnerModule],
  template: `
    <div class="fixed inset-0 z-50 overflow-y-auto bg-black/80"
         (click)="onOverlayClick($event)">
      <div class="min-h-full flex items-center justify-center p-3">
      <div class="flex flex-col lg:flex-row gap-5 items-start"
           (click)="$event.stopPropagation()">

        <!-- Canvas preview -->
        <div class="flex-shrink-0 relative">
          <canvas #card width="1080" height="1080"
            style="width:min(460px,88vw);height:min(460px,88vw);border-radius:14px;display:block;box-shadow:0 8px 40px rgba(0,0,0,.6)">
          </canvas>
          @if (mapLoading()) {
            <div class="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/50">
              <mat-spinner diameter="36" style="--mdc-circular-progress-active-indicator-color:#e91e8c"></mat-spinner>
            </div>
          }
        </div>

        <!-- Controls -->
        <div class="flex flex-col gap-3 lg:w-64 w-full text-white">

          <!-- Background -->
          <section class="bg-white/10 rounded-2xl p-4">
            <p class="text-white/60 text-xs font-semibold uppercase tracking-wide mb-2.5">Background</p>
            <div class="grid grid-cols-2 gap-1.5">
              @for (bg of bgDefs; track bg.mode) {
                <button class="py-2 rounded-xl text-xs font-semibold border transition-all"
                  [style.background]="bgMode()===bg.mode ? 'rgba(233,30,140,.18)' : 'transparent'"
                  [style.color]="bgMode()===bg.mode ? '#e91e8c' : 'rgba(255,255,255,.45)'"
                  [style.border-color]="bgMode()===bg.mode ? '#e91e8c' : 'rgba(255,255,255,.12)'"
                  (click)="bg.mode === 'custom' ? pickFile() : setBg(bg.mode)">
                  {{ bg.label }}
                </button>
              }
            </div>
            <input #fileInput type="file" accept="image/*" class="hidden" (change)="onFileChange($event)" />

            <!-- Photo layout sub-option — only shown when photo is selected -->
            @if (bgMode() === 'custom') {
              <div class="mt-3 pt-3 border-t border-white/10">
                <p class="text-white/50 text-xs mb-2">Photo layout</p>
                <div class="flex gap-1.5">
                  <button class="flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-all"
                    [style.background]="layout()==='full' ? 'rgba(233,30,140,.18)' : 'transparent'"
                    [style.color]="layout()==='full' ? '#e91e8c' : 'rgba(255,255,255,.4)'"
                    [style.border-color]="layout()==='full' ? '#e91e8c' : 'rgba(255,255,255,.1)'"
                    (click)="setLayout('full')">⛶ Full</button>
                  <button class="flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-all"
                    [style.background]="layout()==='padded' ? 'rgba(233,30,140,.18)' : 'transparent'"
                    [style.color]="layout()==='padded' ? '#e91e8c' : 'rgba(255,255,255,.4)'"
                    [style.border-color]="layout()==='padded' ? '#e91e8c' : 'rgba(255,255,255,.1)'"
                    (click)="setLayout('padded')">▣ Padded</button>
                </div>
              </div>
            }
          </section>

          <!-- Stats -->
          <section class="bg-white/10 rounded-2xl p-4">
            <p class="text-white/60 text-xs font-semibold uppercase tracking-wide mb-2.5">Stats to show</p>
            <div class="grid grid-cols-2 gap-1.5">
              @for (s of statDefs; track s.key) {
                <button class="py-2 px-3 rounded-xl text-xs font-semibold border transition-all text-left"
                  [style.background]="stats()[s.key] ? 'rgba(233,30,140,.18)' : 'transparent'"
                  [style.color]="stats()[s.key] ? '#e91e8c' : 'rgba(255,255,255,.4)'"
                  [style.border-color]="stats()[s.key] ? '#e91e8c' : 'rgba(255,255,255,.12)'"
                  (click)="toggleStat(s.key)">
                  {{ s.label }}
                  @if (stats()[s.key]) { <span class="float-right">✓</span> }
                </button>
              }
            </div>
          </section>

          <!-- Tag -->
          <section class="bg-white/10 rounded-2xl p-4">
            <p class="text-white/60 text-xs font-semibold uppercase tracking-wide mb-2">Your tag</p>
            <input type="text"
              class="w-full bg-white/10 text-white text-sm rounded-xl px-3 py-2 border border-white/20 focus:outline-none focus:border-pink-400 transition-colors"
              placeholder="@icvanee"
              [ngModel]="tag()" (ngModelChange)="tag.set($event); redraw()" />
          </section>

          <!-- Actions -->
          <div class="flex gap-2">
            <button class="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
              style="background:#e91e8c" (click)="download()">
              <mat-icon class="!w-4 !h-4 text-base">download</mat-icon> Download
            </button>
            <button class="py-2.5 px-4 rounded-xl text-sm font-semibold text-white/70 border border-white/20 hover:bg-white/10 transition-colors"
              (click)="close.emit()">Close</button>
          </div>
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

  bgMode   = signal<BgMode>('dark');
  layout   = signal<Layout>('padded');
  tag      = signal('@icvanee');
  mapLoading = signal(false);

  private customImg  = signal<HTMLImageElement | null>(null);
  private tileCache  = new Map<string, HTMLImageElement>();

  stats = signal<Record<string, boolean>>({ distance:true, pace:true, time:true, hr:true });

  statDefs = [
    { key:'distance', label:'Distance' },
    { key:'pace',     label:'Pace'     },
    { key:'time',     label:'Time'     },
    { key:'hr',       label:'Avg HR'   },
  ];

  bgDefs: { mode: BgMode; label: string }[] = [
    { mode:'dark',   label:'🌙 Dark'   },
    { mode:'light',  label:'☀️ Light'  },
    { mode:'map',    label:'🗺 Map'    },
    { mode:'custom', label:'🖼 Photo'  },
  ];

  toggleStat(k: string) { this.stats.update(m => ({ ...m, [k]: !m[k] })); this.redraw(); }
  setBg(m: BgMode)      { this.bgMode.set(m); this.redraw(); }
  setLayout(l: Layout)  { this.layout.set(l); this.redraw(); }
  pickFile()            { this.fileInputRef.nativeElement.click(); }

  onFileChange(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const img = new Image();
      img.onload = () => { this.customImg.set(img); this.bgMode.set('custom'); this.redraw(); };
      img.src = ev.target?.result as string;
    };
    reader.readAsDataURL(file);
  }

  ngAfterViewInit() { Promise.resolve().then(() => this.draw()); }
  redraw()          { Promise.resolve().then(() => this.draw()); }

  onOverlayClick(e: MouseEvent) { if (e.target === e.currentTarget) this.close.emit(); }

  download() {
    const canvas = this.canvasRef.nativeElement;
    try {
      canvas.toBlob(blob => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${(this.activity.name ?? 'run').replace(/[^a-z0-9]/gi,'_').toLowerCase()}.png`;
        document.body.appendChild(a); a.click();
        document.body.removeChild(a); URL.revokeObjectURL(url);
      }, 'image/png');
    } catch {
      alert('Could not export — map tiles may be blocking canvas export. Try Dark or Light background.');
    }
  }

  // ── Draw ─────────────────────────────────────────────────────────────────────

  private async draw() {
    const canvas = this.canvasRef?.nativeElement;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const mode   = this.bgMode();
    const layout = this.layout();
    const coords = this.activity.summaryPolyline ? decodePolyline(this.activity.summaryPolyline) : [];

    ctx.clearRect(0, 0, W, H);

    // ── Background ────────────────────────────────────────────────────────────
    if (mode === 'map' && coords.length > 1) {
      const drawn = await this.drawMapBg(ctx, coords);
      if (!drawn) this.drawDarkBg(ctx); // fallback
    } else if (mode === 'light') {
      this.drawLightBg(ctx);
    } else if (mode === 'custom') {
      const img = this.customImg();
      img ? this.drawCustomBg(ctx, img) : this.drawDarkBg(ctx);
    } else {
      this.drawDarkBg(ctx);
    }

    // ── Route ─────────────────────────────────────────────────────────────────
    if (coords.length > 1) {
      this.drawRoute(ctx, coords, mode, layout);
    }

    // ── Stats panel ───────────────────────────────────────────────────────────
    const activeStats = this.statDefs
      .filter(s => this.stats()[s.key])
      .map(s => ({ ...s, value: this.statValue(s.key) }))
      .filter(s => s.value !== null) as { key:string; label:string; value:string }[];

    if (activeStats.length > 0) {
      this.drawStats(ctx, activeStats, mode);
    }

    // ── Header text ───────────────────────────────────────────────────────────
    const textColor = mode === 'light' ? '#1a0a2e' : '#ffffff';
    const mutedColor = mode === 'light' ? 'rgba(26,10,46,.5)' : 'rgba(255,255,255,.5)';

    ctx.font = 'bold 44px system-ui,sans-serif';
    ctx.fillStyle = textColor; ctx.textAlign = 'left';
    ctx.fillText(truncate(this.activity.name, 26), 52, 80);

    const dateStr = new Date(this.activity.startDate).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' });
    ctx.font = '26px system-ui,sans-serif';
    ctx.fillStyle = mutedColor; ctx.textAlign = 'right';
    ctx.fillText(dateStr, W - 52, 80);

    // ── Tag — sits below stats panel ─────────────────────────────────────────
    ctx.font = 'bold 26px system-ui,sans-serif';
    ctx.fillStyle = '#e91e8c'; ctx.textAlign = 'right';
    ctx.fillText(this.tag(), W - 52, H - 14);
  }

  // ── Background helpers ────────────────────────────────────────────────────────

  private drawDarkBg(ctx: CanvasRenderingContext2D) {
    const g = ctx.createLinearGradient(0,0,W,H);
    g.addColorStop(0,'#0d0a1a'); g.addColorStop(.5,'#1a0a2e'); g.addColorStop(1,'#0d0a1a');
    ctx.fillStyle = g; ctx.fillRect(0,0,W,H);
    ctx.strokeStyle = 'rgba(255,255,255,.025)'; ctx.lineWidth = 1;
    for (let x=0;x<=W;x+=60) { ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke(); }
    for (let y=0;y<=H;y+=60) { ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke(); }
    const v = ctx.createRadialGradient(W/2,H/2,W*.3,W/2,H/2,W*.8);
    v.addColorStop(0,'rgba(0,0,0,0)'); v.addColorStop(1,'rgba(0,0,0,.4)');
    ctx.fillStyle=v; ctx.fillRect(0,0,W,H);
  }

  private drawLightBg(ctx: CanvasRenderingContext2D) {
    const g = ctx.createLinearGradient(0,0,W,H);
    g.addColorStop(0,'#f8f0ff'); g.addColorStop(1,'#fff0f8');
    ctx.fillStyle=g; ctx.fillRect(0,0,W,H);
    ctx.fillStyle='rgba(26,10,46,.04)';
    for (let x=30;x<W;x+=40) for (let y=30;y<H;y+=40) {
      ctx.beginPath(); ctx.arc(x,y,1.5,0,Math.PI*2); ctx.fill();
    }
  }

  private drawCustomBg(ctx: CanvasRenderingContext2D, img: HTMLImageElement) {
    if (this.layout() === 'padded') {
      // Dark background with photo in a framed inset
      this.drawDarkBg(ctx);
      // inset must end 12px above the stats panel (pTop = H - 150 - 62 = 868)
      const statsTop = H - 150 - 62;
      const insetX = 44, insetY = 108, insetW = W - 88, insetH = statsTop - insetY - 12, r = 20;
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(insetX+r, insetY);
      ctx.lineTo(insetX+insetW-r, insetY);
      ctx.arcTo(insetX+insetW, insetY, insetX+insetW, insetY+r, r);
      ctx.lineTo(insetX+insetW, insetY+insetH-r);
      ctx.arcTo(insetX+insetW, insetY+insetH, insetX+insetW-r, insetY+insetH, r);
      ctx.lineTo(insetX+r, insetY+insetH);
      ctx.arcTo(insetX, insetY+insetH, insetX, insetY+insetH-r, r);
      ctx.lineTo(insetX, insetY+r);
      ctx.arcTo(insetX, insetY, insetX+r, insetY, r);
      ctx.closePath();
      ctx.clip();
      const s = Math.max(insetW/img.width, insetH/img.height);
      ctx.drawImage(img, insetX+(insetW-img.width*s)/2, insetY+(insetH-img.height*s)/2, img.width*s, img.height*s);
      // subtle darkening inside the inset
      const ov = ctx.createLinearGradient(0,insetY,0,insetY+insetH);
      ov.addColorStop(0,'rgba(0,0,0,.35)'); ov.addColorStop(.4,'rgba(0,0,0,.1)'); ov.addColorStop(1,'rgba(0,0,0,.5)');
      ctx.fillStyle=ov; ctx.fillRect(insetX,insetY,insetW,insetH);
      ctx.restore();
      // thin pink border around inset
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(insetX+r,insetY); ctx.lineTo(insetX+insetW-r,insetY);
      ctx.arcTo(insetX+insetW,insetY,insetX+insetW,insetY+r,r); ctx.lineTo(insetX+insetW,insetY+insetH-r);
      ctx.arcTo(insetX+insetW,insetY+insetH,insetX+insetW-r,insetY+insetH,r); ctx.lineTo(insetX+r,insetY+insetH);
      ctx.arcTo(insetX,insetY+insetH,insetX,insetY+insetH-r,r); ctx.lineTo(insetX,insetY+r);
      ctx.arcTo(insetX,insetY,insetX+r,insetY,r); ctx.closePath();
      ctx.strokeStyle='rgba(233,30,140,.4)'; ctx.lineWidth=1.5; ctx.stroke();
      ctx.restore();
    } else {
      // Full bleed — photo fills the entire card
      const s = Math.max(W/img.width, H/img.height);
      ctx.drawImage(img,(W-img.width*s)/2,(H-img.height*s)/2,img.width*s,img.height*s);
      const ov = ctx.createLinearGradient(0,0,0,H);
      ov.addColorStop(0,'rgba(0,0,0,.45)'); ov.addColorStop(.5,'rgba(0,0,0,.2)'); ov.addColorStop(1,'rgba(0,0,0,.65)');
      ctx.fillStyle=ov; ctx.fillRect(0,0,W,H);
    }
  }

  private async drawMapBg(ctx: CanvasRenderingContext2D, coords: [number,number][]): Promise<boolean> {
    let minLat=Infinity, maxLat=-Infinity, minLng=Infinity, maxLng=-Infinity;
    for (const [la,ln] of coords) {
      if(la<minLat)minLat=la; if(la>maxLat)maxLat=la;
      if(ln<minLng)minLng=ln; if(ln>maxLng)maxLng=ln;
    }

    const zoom = calcZoom(minLat, maxLat, minLng, maxLng);
    const tl   = latLngToTileF(maxLat, minLng, zoom);
    const br   = latLngToTileF(minLat, maxLng, zoom);

    // add padding in tile-space
    const pad  = 0.6;
    const txMin = Math.floor(tl.x - pad), txMax = Math.ceil(br.x + pad);
    const tyMin = Math.floor(tl.y - pad), tyMax = Math.ceil(br.y + pad);

    // pixel-per-tile scale so route fills canvas
    const tileSpanX = txMax - txMin, tileSpanY = tyMax - tyMin;
    const tileSize  = Math.min(W / tileSpanX, H / tileSpanY);

    this.mapLoading.set(true);

    const promises: Promise<void>[] = [];
    const tiles: { img:HTMLImageElement; cx:number; cy:number }[] = [];

    for (let tx=txMin; tx<txMax; tx++) {
      for (let ty=tyMin; ty<tyMax; ty++) {
        const key = `${zoom}/${tx}/${ty}`;
        const cx  = (tx - txMin) * tileSize + (W - tileSpanX * tileSize) / 2;
        const cy  = (ty - tyMin) * tileSize + (H - tileSpanY * tileSize) / 2;

        if (this.tileCache.has(key)) {
          tiles.push({ img: this.tileCache.get(key)!, cx, cy });
        } else {
          promises.push(new Promise<void>(resolve => {
            const img = new Image();
            img.onload  = () => { this.tileCache.set(key, img); tiles.push({img, cx, cy}); resolve(); };
            img.onerror = () => resolve();
            // Backend tile proxy — avoids CORS issues entirely
            img.src = `/api/tiles/${zoom}/${tx}/${ty}`;
          }));
        }
      }
    }

    try {
      await Promise.all(promises);
    } catch { this.mapLoading.set(false); return false; }

    this.mapLoading.set(false);

    if (tiles.length === 0) return false;

    for (const t of tiles) ctx.drawImage(t.img, t.cx, t.cy, tileSize, tileSize);

    // slight darkening overlay so route + text pop
    const ov = ctx.createRadialGradient(W/2,H/2,W*.1,W/2,H/2,W*.72);
    ov.addColorStop(0,'rgba(0,0,0,.05)'); ov.addColorStop(1,'rgba(0,0,0,.45)');
    ctx.fillStyle=ov; ctx.fillRect(0,0,W,H);

    return true;
  }

  // ── Route drawing ─────────────────────────────────────────────────────────────

  private drawRoute(ctx: CanvasRenderingContext2D, coords: [number,number][], mode: BgMode, layout: Layout) {
    let minLat=Infinity,maxLat=-Infinity,minLng=Infinity,maxLng=-Infinity;
    for (const [la,ln] of coords) {
      if(la<minLat)minLat=la; if(la>maxLat)maxLat=la;
      if(ln<minLng)minLng=ln; if(ln>maxLng)maxLng=ln;
    }
    const latSpan = maxLat-minLat||.001, lngSpan = maxLng-minLng||.001;

    const statsH  = 158;
    const headerH = 100;

    // In padded-photo mode, route is constrained to the photo inset
    const isPhotoInset = mode === 'custom' && layout === 'padded';
    let boxX: number, boxY: number, boxW: number, boxH: number;
    if (isPhotoInset) {
      const statsTop = H - 150 - 62;
      boxX = 60; boxY = 120; boxW = W - 120; boxH = statsTop - 120 - 12;
    } else {
      const pad = 44;
      boxX = pad; boxY = headerH;
      boxW = W - pad*2; boxH = H - headerH - statsH - 8;
    }

    const scale = Math.min(boxW/lngSpan, boxH/latSpan) * .88;
    const rW = lngSpan*scale, rH = latSpan*scale;
    const oX = boxX + (boxW-rW)/2, oY = boxY + (boxH-rH)/2;

    const toC = ([la,ln]: [number,number]): [number,number] => [
      oX + (ln-minLng)*scale,
      oY + rH - (la-minLat)*scale,
    ];

    const isMap    = mode === 'map';
    const isLight  = mode === 'light';
    const lineColor = isLight ? '#1a0a2e' : '#e91e8c';
    const glowColor = isLight ? 'rgba(26,10,46,.12)' : isMap ? 'rgba(255,255,255,.2)' : 'rgba(233,30,140,.22)';
    const mainColor = isMap ? '#ffffff' : lineColor;

    // glow pass
    ctx.beginPath(); ctx.moveTo(...toC(coords[0]));
    for (let i=1;i<coords.length;i++) ctx.lineTo(...toC(coords[i]));
    ctx.strokeStyle=glowColor; ctx.lineWidth=16; ctx.lineJoin='round'; ctx.lineCap='round'; ctx.stroke();

    // main line
    ctx.beginPath(); ctx.moveTo(...toC(coords[0]));
    for (let i=1;i<coords.length;i++) ctx.lineTo(...toC(coords[i]));
    ctx.strokeStyle=mainColor; ctx.lineWidth=isLight?5:4; ctx.lineJoin='round'; ctx.lineCap='round'; ctx.stroke();

    // on map mode: pink accent over white line
    if (isMap) {
      ctx.beginPath(); ctx.moveTo(...toC(coords[0]));
      for (let i=1;i<coords.length;i++) ctx.lineTo(...toC(coords[i]));
      ctx.strokeStyle='rgba(233,30,140,.55)'; ctx.lineWidth=2; ctx.stroke();
    }

    // start dot
    const [sx,sy]=toC(coords[0]);
    ctx.beginPath(); ctx.arc(sx,sy,9,0,Math.PI*2); ctx.fillStyle='#fff'; ctx.fill();
    ctx.beginPath(); ctx.arc(sx,sy,5,0,Math.PI*2); ctx.fillStyle=isMap?'#e91e8c':mainColor; ctx.fill();

    // end dot
    const [ex,ey]=toC(coords[coords.length-1]);
    ctx.beginPath(); ctx.arc(ex,ey,11,0,Math.PI*2); ctx.fillStyle='#fff'; ctx.fill();
    ctx.beginPath(); ctx.arc(ex,ey,7,0,Math.PI*2); ctx.fillStyle='#e91e8c'; ctx.fill();
  }

  // ── Stats panel ───────────────────────────────────────────────────────────────

  private drawStats(ctx: CanvasRenderingContext2D, items: {label:string;value:string}[], mode: BgMode) {
    const pH=150, pTop=H-pH-62, pX=44, pW=W-88, r=18;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(pX+r,pTop); ctx.lineTo(pX+pW-r,pTop);
    ctx.arcTo(pX+pW,pTop,pX+pW,pTop+r,r); ctx.lineTo(pX+pW,pTop+pH-r);
    ctx.arcTo(pX+pW,pTop+pH,pX+pW-r,pTop+pH,r); ctx.lineTo(pX+r,pTop+pH);
    ctx.arcTo(pX,pTop+pH,pX,pTop+pH-r,r); ctx.lineTo(pX,pTop+r);
    ctx.arcTo(pX,pTop,pX+r,pTop,r); ctx.closePath();
    ctx.fillStyle = mode==='light' ? 'rgba(26,10,46,.88)' : 'rgba(8,4,22,.78)';
    ctx.fill();
    ctx.strokeStyle='rgba(233,30,140,.3)'; ctx.lineWidth=1.5; ctx.stroke();
    ctx.restore();

    const cW=pW/items.length;
    ctx.textAlign='center';
    for (let i=0;i<items.length;i++) {
      const cx=pX+cW*i+cW/2;
      ctx.fillStyle='rgba(255,255,255,.45)';
      ctx.font='21px system-ui,sans-serif';
      ctx.fillText(items[i].label, cx, pTop+44);
      ctx.fillStyle='#ffffff';
      ctx.font=`bold ${items.length>3?38:44}px system-ui,sans-serif`;
      ctx.fillText(items[i].value, cx, pTop+108);
    }
  }

  private statValue(key: string): string | null {
    const a = this.activity;
    if (key==='distance') return `${(a.distance/1000).toFixed(2)} km`;
    if (key==='pace')     return `${formatPace(a.distance,a.movingTime)} /km`;
    if (key==='time')     return formatTime(a.movingTime);
    if (key==='hr')       return a.averageHeartrate ? `${Math.round(a.averageHeartrate)} bpm` : null;
    return null;
  }
}

// ── Pure helpers ──────────────────────────────────────────────────────────────

function decodePolyline(enc: string): [number,number][] {
  const out:[number,number][]=[];
  let i=0,lat=0,lng=0;
  while(i<enc.length){
    let r=0,s=0,b:number;
    do{b=enc.charCodeAt(i++)-63;r|=(b&0x1f)<<s;s+=5;}while(b>=0x20);
    lat+=(r&1)?~(r>>1):r>>1;
    r=0;s=0;
    do{b=enc.charCodeAt(i++)-63;r|=(b&0x1f)<<s;s+=5;}while(b>=0x20);
    lng+=(r&1)?~(r>>1):r>>1;
    out.push([lat*1e-5,lng*1e-5]);
  }
  return out;
}

function latLngToTileF(lat: number, lng: number, z: number): {x:number;y:number} {
  const n=Math.pow(2,z), lr=lat*Math.PI/180;
  return { x:(lng+180)/360*n, y:(1-Math.log(Math.tan(lr)+1/Math.cos(lr))/Math.PI)/2*n };
}

function calcZoom(minLat:number,maxLat:number,minLng:number,maxLng:number): number {
  for (let z=16;z>=8;z--) {
    const tl=latLngToTileF(maxLat,minLng,z), br=latLngToTileF(minLat,maxLng,z);
    if((br.x-tl.x)*256<=W*.72 && (br.y-tl.y)*256<=H*.72) return z;
  }
  return 8;
}

function formatTime(s:number):string {
  const h=Math.floor(s/3600),m=Math.floor((s%3600)/60),sec=s%60;
  return h>0?`${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`:`${m}:${String(sec).padStart(2,'0')}`;
}

function formatPace(dist:number,time:number):string {
  if(!dist||!time)return'—';
  const p=time/60/(dist/1000);
  return`${Math.floor(p)}:${String(Math.round((p%1)*60)).padStart(2,'0')}`;
}

function truncate(s:string,max:number):string{return s.length<=max?s:s.slice(0,max-1)+'…';}
