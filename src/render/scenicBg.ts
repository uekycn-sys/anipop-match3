import { BiomeType } from '../engine/types';

interface Cloud {
  x: number;
  y: number;
  scale: number;
  speed: number;
  alpha: number;
}

interface Firefly {
  x: number;
  y: number;
  r: number;
  vx: number;
  vy: number;
  phase: number;
  kind: 'firefly' | 'petal';
  color: string;
}

const BIOME_PALETTES: Record<
  BiomeType,
  {
    skyTop: string;
    skyMid: string;
    skyBot: string;
    hillFar: string;
    hillMid: string;
    hillNear: string;
    petal: string;
  }
> = {
  forest: {
    skyTop: '#a8e6ff',
    skyMid: '#fde8cd',
    skyBot: '#d8f5c7',
    hillFar: '#a7dca4',
    hillMid: '#7bc47f',
    hillNear: '#4d9e57',
    petal: '#ffb5c2',
  },
  glacier: {
    skyTop: '#90d5ff',
    skyMid: '#e2f4ff',
    skyBot: '#d0e8ff',
    hillFar: '#b8dcf5',
    hillMid: '#8ecae6',
    hillNear: '#5fa8d3',
    petal: '#ffffff',
  },
  vine: {
    skyTop: '#9be7d8',
    skyMid: '#f7f1cb',
    skyBot: '#b9e4b5',
    hillFar: '#84c99b',
    hillMid: '#52a472',
    hillNear: '#2d7a4f',
    petal: '#ffe082',
  },
  starry: {
    skyTop: '#312e81',
    skyMid: '#6d28d9',
    skyBot: '#c084fc',
    hillFar: '#4c1d95',
    hillMid: '#3b0764',
    hillNear: '#240046',
    petal: '#fde68a',
  },
};

export class ScenicBackground {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private width = 800;
  private height = 600;
  private dpr = 1;
  private biome: BiomeType = 'forest';
  private time = 0;
  private clouds: Cloud[] = [];
  private motes: Firefly[] = [];

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('ScenicBackground 2D context unavailable');
    this.ctx = ctx;
    this.initEntities();
    this.resize();
  }

  public setBiome(biome: BiomeType): void {
    if (this.biome === biome) return;
    this.biome = biome;
    const pal = BIOME_PALETTES[biome];
    for (const m of this.motes) {
      if (m.kind === 'petal') m.color = pal.petal;
    }
  }

  private initEntities(): void {
    this.clouds = Array.from({ length: 6 }, (_, i) => ({
      x: (i / 6) * 1.2 - 0.1,
      y: 0.08 + (i % 3) * 0.11,
      scale: 0.75 + (i % 3) * 0.25,
      speed: 0.008 + (i % 4) * 0.004,
      alpha: 0.55 + (i % 2) * 0.2,
    }));

    this.motes = Array.from({ length: 26 }, (_, i) => ({
      x: Math.random(),
      y: Math.random(),
      r: 2 + Math.random() * 3.5,
      vx: (Math.random() - 0.5) * 0.025,
      vy: i % 2 === 0 ? -0.012 - Math.random() * 0.015 : 0.012 + Math.random() * 0.018,
      phase: Math.random() * Math.PI * 2,
      kind: i % 2 === 0 ? 'firefly' : 'petal',
      color: i % 2 === 0 ? '#fff3b0' : BIOME_PALETTES[this.biome].petal,
    }));
  }

  public resize(): void {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.canvas.width = Math.round(this.width * this.dpr);
    this.canvas.height = Math.round(this.height * this.dpr);
  }

  public update(dt: number): void {
    this.time += dt;
    for (const c of this.clouds) {
      c.x += c.speed * dt;
      if (c.x > 1.2) c.x = -0.22;
    }
    for (const m of this.motes) {
      m.x += (m.vx + Math.sin(this.time * 0.9 + m.phase) * 0.008) * dt;
      m.y += m.vy * dt;
      if (m.x < -0.05) m.x = 1.05;
      if (m.x > 1.05) m.x = -0.05;
      if (m.y < -0.05) m.y = 1.05;
      if (m.y > 1.05) m.y = -0.05;
    }
  }

  public render(): void {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;
    const pal = BIOME_PALETTES[this.biome];

    ctx.save();
    ctx.scale(this.dpr, this.dpr);

    // 1. Sky gradient
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, pal.skyTop);
    sky.addColorStop(0.55, pal.skyMid);
    sky.addColorStop(1, pal.skyBot);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);

    // Starry sky twinkling stars
    if (this.biome === 'starry') {
      for (let i = 0; i < 36; i++) {
        const sx = ((i * 193) % 100) / 100 * w;
        const sy = ((i * 71) % 65) / 100 * h;
        const tw = 0.35 + 0.65 * Math.abs(Math.sin(this.time * 1.8 + i));
        ctx.fillStyle = `rgba(255, 252, 224, ${tw})`;
        ctx.beginPath();
        ctx.arc(sx, sy, 1.4 + (i % 2), 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      // Warm sun halo
      const sunGrad = ctx.createRadialGradient(w * 0.82, h * 0.16, 12, w * 0.82, h * 0.16, Math.min(w, h) * 0.32);
      sunGrad.addColorStop(0, 'rgba(255, 252, 225, 0.85)');
      sunGrad.addColorStop(0.4, 'rgba(255, 236, 179, 0.32)');
      sunGrad.addColorStop(1, 'rgba(255, 236, 179, 0)');
      ctx.fillStyle = sunGrad;
      ctx.fillRect(0, 0, w, h);
    }

    // 2. Drifting fluffy clouds
    for (const c of this.clouds) {
      this.drawCloud(ctx, c.x * w, c.y * h, 68 * c.scale, c.alpha);
    }

    // 3. Layered distant & near hills
    this.drawHillLayer(ctx, w, h, h * 0.78, 42, 0.0032, 0.2, pal.hillFar);
    this.drawHillLayer(ctx, w, h, h * 0.85, 34, 0.0048, 1.8, pal.hillMid);
    this.drawHillLayer(ctx, w, h, h * 0.92, 26, 0.0062, 3.4, pal.hillNear);

    // 4. Foreground corner botanical silhouettes
    this.drawForegroundFoliage(ctx, w, h, pal.hillNear);

    // 5. Floating fireflies & petals
    for (const m of this.motes) {
      const mx = m.x * w;
      const my = m.y * h;
      if (m.kind === 'firefly') {
        const glow = 0.4 + 0.6 * Math.sin(this.time * 2.5 + m.phase);
        ctx.save();
        ctx.globalAlpha = Math.max(0.15, glow);
        const g = ctx.createRadialGradient(mx, my, 0, mx, my, m.r * 3.5);
        g.addColorStop(0, '#ffffff');
        g.addColorStop(0.35, '#fef08a');
        g.addColorStop(1, 'rgba(254, 240, 138, 0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(mx, my, m.r * 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else {
        ctx.save();
        ctx.translate(mx, my);
        ctx.rotate(this.time * 1.1 + m.phase);
        ctx.globalAlpha = 0.72;
        ctx.fillStyle = m.color;
        ctx.beginPath();
        ctx.ellipse(0, 0, m.r * 1.4, m.r * 0.75, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    ctx.restore();
  }

  private drawCloud(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    size: number,
    alpha: number,
  ): void {
    ctx.save();
    ctx.globalAlpha = this.biome === 'starry' ? alpha * 0.25 : alpha;
    ctx.fillStyle = this.biome === 'starry' ? '#ddd6fe' : '#ffffff';
    ctx.beginPath();
    const puffs: Array<[number, number, number]> = [
      [x, y, size * 0.46],
      [x - size * 0.42, y + size * 0.1, size * 0.34],
      [x + size * 0.44, y + size * 0.12, size * 0.36],
      [x + size * 0.16, y - size * 0.18, size * 0.34],
    ];
    for (const [px, py, pr] of puffs) {
      ctx.moveTo(px + pr, py);
      ctx.arc(px, py, pr, 0, Math.PI * 2);
    }
    ctx.fill();
    ctx.restore();
  }

  private drawHillLayer(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    baseY: number,
    amp: number,
    freq: number,
    phase: number,
    color: string,
  ): void {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(0, h);
    for (let x = 0; x <= w + 24; x += 24) {
      const y = baseY + Math.sin(x * freq + phase) * amp + Math.cos(x * freq * 0.5) * (amp * 0.4);
      ctx.lineTo(x, y);
    }
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.restore();
  }

  private drawForegroundFoliage(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    color: string,
  ): void {
    ctx.save();
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.85;
    // Left bush silhouette
    ctx.beginPath();
    ctx.arc(0, h, 85, 0, Math.PI * 2);
    ctx.arc(70, h + 15, 60, 0, Math.PI * 2);
    ctx.fill();
    // Right bush silhouette
    ctx.beginPath();
    ctx.arc(w, h, 90, 0, Math.PI * 2);
    ctx.arc(w - 75, h + 15, 62, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}
