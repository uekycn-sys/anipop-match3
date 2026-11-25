interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  alpha: number;
  life: number;
  maxLife: number;
  gravity: number;
  shape: 'circle' | 'star' | 'shard' | 'chip' | 'leaf';
  rotation: number;
  vRot: number;
}

interface LaserBeam {
  x: number;
  y: number;
  length: number;
  thickness: number;
  horizontal: boolean;
  color: string;
  life: number;
  maxLife: number;
}

interface Shockwave {
  x: number;
  y: number;
  maxRadius: number;
  color: string;
  life: number;
  maxLife: number;
}

interface LightningBolt {
  points: Array<{ x: number; y: number }>;
  branches: Array<Array<{ x: number; y: number }>>;
  color: string;
  life: number;
  maxLife: number;
}

interface FloatingText {
  x: number;
  y: number;
  vy: number;
  text: string;
  color: string;
  stroke: string;
  fontSize: number;
  life: number;
  maxLife: number;
  isBanner: boolean;
}

export class ParticleSystem {
  private particles: Particle[] = [];
  private lasers: LaserBeam[] = [];
  private shockwaves: Shockwave[] = [];
  private lightnings: LightningBolt[] = [];
  private texts: FloatingText[] = [];
  private shakeIntensity = 0;
  private screenFlashAlpha = 0;
  private screenFlashColor = '#ffffff';
  private borderGlowAlpha = 0;

  public addShake(amount: number): void {
    this.shakeIntensity = Math.min(20, Math.max(this.shakeIntensity, amount));
  }

  public addFlash(alpha = 0.45, color = '#ffffff'): void {
    this.screenFlashAlpha = Math.max(this.screenFlashAlpha, alpha);
    this.screenFlashColor = color;
  }

  public addBorderGlow(alpha = 0.9): void {
    this.borderGlowAlpha = Math.max(this.borderGlowAlpha, alpha);
  }

  public getBorderGlowAlpha(): number {
    return this.borderGlowAlpha;
  }

  public getShakeOffset(): { x: number; y: number } {
    if (this.shakeIntensity <= 0.2) return { x: 0, y: 0 };
    const angle = Math.random() * Math.PI * 2;
    return {
      x: Math.cos(angle) * this.shakeIntensity,
      y: Math.sin(angle) * this.shakeIntensity,
    };
  }

  public spawnJellyBurst(x: number, y: number, color: string, count = 10): void {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const speed = 75 + Math.random() * 195;
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed - 60,
        size: 3.5 + Math.random() * 5,
        color,
        alpha: 1,
        life: 0,
        maxLife: 0.38 + Math.random() * 0.25,
        gravity: 340,
        shape: i % 3 === 0 ? 'star' : 'circle',
        rotation: Math.random() * Math.PI * 2,
        vRot: (Math.random() - 0.5) * 10,
      });
    }
  }

  public spawnStardust(x: number, y: number): void {
    const palette = ['#ff595e', '#ffca3a', '#8ac926', '#1982c4', '#c77dff', '#ffffff'];
    this.particles.push({
      x: x + (Math.random() - 0.5) * 20,
      y: y + (Math.random() - 0.5) * 20,
      vx: (Math.random() - 0.5) * 28,
      vy: -20 - Math.random() * 28,
      size: 2.5 + Math.random() * 3.2,
      color: palette[Math.floor(Math.random() * palette.length)],
      alpha: 0.95,
      life: 0,
      maxLife: 0.46 + Math.random() * 0.26,
      gravity: -15,
      shape: 'star',
      rotation: Math.random() * Math.PI,
      vRot: (Math.random() - 0.5) * 6,
    });
  }

  public spawnIceShards(x: number, y: number): void {
    for (let i = 0; i < 12; i++) {
      const a = Math.random() * Math.PI * 2;
      const speed = 70 + Math.random() * 170;
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed - 55,
        size: 4.5 + Math.random() * 5.5,
        color: i % 3 === 0 ? '#e0f7ff' : i % 2 === 0 ? '#7dd3fc' : '#ffffff',
        alpha: 0.95,
        life: 0,
        maxLife: 0.45 + Math.random() * 0.22,
        gravity: 380,
        shape: 'shard',
        rotation: Math.random() * Math.PI * 2,
        vRot: (Math.random() - 0.5) * 16,
      });
    }
  }

  public spawnWoodSplinters(x: number, y: number): void {
    for (let i = 0; i < 10; i++) {
      const a = Math.random() * Math.PI * 2;
      const speed = 70 + Math.random() * 160;
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed - 75,
        size: 4.5 + Math.random() * 5.5,
        color: i % 2 === 0 ? '#d97706' : '#f59e0b',
        alpha: 1,
        life: 0,
        maxLife: 0.45 + Math.random() * 0.22,
        gravity: 420,
        shape: 'chip',
        rotation: Math.random() * Math.PI * 2,
        vRot: (Math.random() - 0.5) * 14,
      });
    }
  }

  public spawnVineBurst(x: number, y: number): void {
    for (let i = 0; i < 10; i++) {
      const a = Math.random() * Math.PI * 2;
      const speed = 60 + Math.random() * 140;
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed - 65,
        size: 4 + Math.random() * 4.5,
        color: i % 2 === 0 ? '#40916c' : '#74c69d',
        alpha: 1,
        life: 0,
        maxLife: 0.48 + Math.random() * 0.2,
        gravity: 310,
        shape: 'leaf',
        rotation: Math.random() * Math.PI * 2,
        vRot: (Math.random() - 0.5) * 12,
      });
    }
  }

  public spawnLaser(
    x: number,
    y: number,
    length: number,
    thickness: number,
    horizontal: boolean,
    color = '#00f5d4',
  ): void {
    this.lasers.push({
      x,
      y,
      length,
      thickness,
      horizontal,
      color,
      life: 0,
      maxLife: 0.34,
    });
  }

  public spawnShockwave(x: number, y: number, maxRadius: number, color = '#ffd166'): void {
    this.shockwaves.push({
      x,
      y,
      maxRadius,
      color,
      life: 0,
      maxLife: 0.38,
    });
  }

  public spawnLightning(x1: number, y1: number, x2: number, y2: number, color = '#e0aaff'): void {
    const segments = 7;
    const points: Array<{ x: number; y: number }> = [{ x: x1, y: y1 }];
    const branches: Array<Array<{ x: number; y: number }>> = [];

    for (let i = 1; i < segments; i++) {
      const t = i / segments;
      const jitter = 22;
      const px = x1 + (x2 - x1) * t + (Math.random() - 0.5) * jitter;
      const py = y1 + (y2 - y1) * t + (Math.random() - 0.5) * jitter;
      points.push({ x: px, y: py });

      if (i === 2 || i === 4) {
        const bLen = 20 + Math.random() * 24;
        const ba = Math.atan2(y2 - y1, x2 - x1) + (Math.random() > 0.5 ? 0.7 : -0.7);
        branches.push([
          { x: px, y: py },
          { x: px + Math.cos(ba) * bLen * 0.5, y: py + Math.sin(ba) * bLen * 0.5 },
          { x: px + Math.cos(ba) * bLen, y: py + Math.sin(ba) * bLen },
        ]);
      }
    }
    points.push({ x: x2, y: y2 });
    this.lightnings.push({
      points,
      branches,
      color,
      life: 0,
      maxLife: 0.38,
    });
  }

  public spawnFloatingText(
    x: number,
    y: number,
    text: string,
    isBanner = false,
    color = '#ffffff',
  ): void {
    this.texts.push({
      x,
      y,
      vy: isBanner ? -36 : -52,
      text,
      color,
      stroke: isBanner ? '#6b2100' : '#4a1d06',
      fontSize: isBanner ? 36 : 18,
      life: 0,
      maxLife: isBanner ? 0.98 : 0.72,
      isBanner,
    });
  }

  public update(dt: number): void {
    this.shakeIntensity *= Math.pow(0.001, dt);
    if (this.shakeIntensity < 0.15) this.shakeIntensity = 0;

    if (this.screenFlashAlpha > 0) {
      this.screenFlashAlpha = Math.max(0, this.screenFlashAlpha - dt * 2.8);
    }
    if (this.borderGlowAlpha > 0) {
      this.borderGlowAlpha = Math.max(0, this.borderGlowAlpha - dt * 1.4);
    }

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life += dt;
      if (p.life >= p.maxLife) {
        this.particles.splice(i, 1);
        continue;
      }
      p.vy += p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rotation += p.vRot * dt;
      p.alpha = 1 - p.life / p.maxLife;
    }

    for (let i = this.lasers.length - 1; i >= 0; i--) {
      this.lasers[i].life += dt;
      if (this.lasers[i].life >= this.lasers[i].maxLife) this.lasers.splice(i, 1);
    }

    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      this.shockwaves[i].life += dt;
      if (this.shockwaves[i].life >= this.shockwaves[i].maxLife) this.shockwaves.splice(i, 1);
    }

    for (let i = this.lightnings.length - 1; i >= 0; i--) {
      this.lightnings[i].life += dt;
      if (this.lightnings[i].life >= this.lightnings[i].maxLife) this.lightnings.splice(i, 1);
    }

    for (let i = this.texts.length - 1; i >= 0; i--) {
      const t = this.texts[i];
      t.life += dt;
      if (t.life >= t.maxLife) {
        this.texts.splice(i, 1);
        continue;
      }
      t.y += t.vy * dt;
      t.vy *= 0.94;
    }
  }

  public render(ctx: CanvasRenderingContext2D, boardWidth: number, boardHeight: number): void {
    // Laser beams
    for (const l of this.lasers) {
      const p = l.life / l.maxLife;
      const alpha = Math.sin((1 - p) * Math.PI * 0.5);
      const thick = l.thickness * (1 - p * 0.45);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(l.x, l.y);
      if (!l.horizontal) ctx.rotate(Math.PI / 2);

      const grad = ctx.createLinearGradient(0, -thick, 0, thick);
      grad.addColorStop(0, 'rgba(255,255,255,0)');
      grad.addColorStop(0.22, l.color);
      grad.addColorStop(0.5, '#ffffff');
      grad.addColorStop(0.78, l.color);
      grad.addColorStop(1, 'rgba(255,255,255,0)');

      ctx.fillStyle = grad;
      ctx.fillRect(-l.length / 2, -thick, l.length, thick * 2);
      ctx.restore();
    }

    // Shockwaves
    for (const s of this.shockwaves) {
      const p = s.life / s.maxLife;
      const r = s.maxRadius * (0.2 + 0.8 * (1 - Math.pow(1 - p, 2)));
      ctx.save();
      ctx.globalAlpha = 1 - p;
      ctx.beginPath();
      ctx.arc(s.x, s.y, r, 0, Math.PI * 2);
      ctx.strokeStyle = s.color;
      ctx.lineWidth = Math.max(2, (1 - p) * 14);
      ctx.stroke();
      ctx.restore();
    }

    // Multi-branch jagged lightning arcs
    for (const b of this.lightnings) {
      const p = b.life / b.maxLife;
      ctx.save();
      ctx.globalAlpha = 1 - p;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      const drawPoly = (pts: Array<{ x: number; y: number }>, w: number, col: string) => {
        ctx.beginPath();
        pts.forEach((pt, idx) => {
          if (idx === 0) ctx.moveTo(pt.x, pt.y);
          else ctx.lineTo(pt.x, pt.y);
        });
        ctx.strokeStyle = col;
        ctx.lineWidth = w;
        ctx.stroke();
      };

      drawPoly(b.points, 9 * (1 - p * 0.45), b.color);
      drawPoly(b.points, 3.2 * (1 - p * 0.45), '#ffffff');
      for (const br of b.branches) {
        drawPoly(br, 4.5 * (1 - p * 0.5), b.color);
        drawPoly(br, 1.8 * (1 - p * 0.5), '#ffffff');
      }
      ctx.restore();
    }

    // Particles
    for (const pt of this.particles) {
      ctx.save();
      ctx.globalAlpha = pt.alpha;
      ctx.translate(pt.x, pt.y);
      ctx.rotate(pt.rotation);
      ctx.fillStyle = pt.color;

      if (pt.shape === 'circle') {
        ctx.beginPath();
        ctx.arc(0, 0, pt.size, 0, Math.PI * 2);
        ctx.fill();
      } else if (pt.shape === 'star') {
        ctx.beginPath();
        for (let i = 0; i < 8; i++) {
          const rad = i % 2 === 0 ? pt.size * 1.2 : pt.size * 0.45;
          const ang = (i * Math.PI) / 4;
          if (i === 0) ctx.moveTo(Math.cos(ang) * rad, Math.sin(ang) * rad);
          else ctx.lineTo(Math.cos(ang) * rad, Math.sin(ang) * rad);
        }
        ctx.closePath();
        ctx.fill();
      } else if (pt.shape === 'shard') {
        // Multi-polygon crystal ice shard
        ctx.beginPath();
        ctx.moveTo(0, -pt.size * 1.3);
        ctx.lineTo(pt.size * 0.75, -pt.size * 0.15);
        ctx.lineTo(pt.size * 0.35, pt.size * 1.2);
        ctx.lineTo(-pt.size * 0.7, pt.size * 0.25);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.85)';
        ctx.lineWidth = 1;
        ctx.stroke();
      } else if (pt.shape === 'leaf') {
        ctx.beginPath();
        ctx.ellipse(0, 0, pt.size * 1.1, pt.size * 0.55, 0, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillRect(-pt.size, -pt.size * 0.5, pt.size * 2, pt.size);
      }
      ctx.restore();
    }

    // Screen soft flash
    if (this.screenFlashAlpha > 0.01) {
      ctx.save();
      ctx.globalAlpha = this.screenFlashAlpha;
      ctx.fillStyle = this.screenFlashColor;
      ctx.fillRect(-20, -20, boardWidth + 40, boardHeight + 40);
      ctx.restore();
    }

    // Floating Texts
    for (const t of this.texts) {
      const p = t.life / t.maxLife;
      const popScale = t.isBanner
        ? p < 0.2
          ? 0.4 + (p / 0.2) * 0.85
          : p < 0.35
            ? 1.25 - ((p - 0.2) / 0.15) * 0.25
            : 1
        : 1;
      const alpha = p > 0.7 ? 1 - (p - 0.7) / 0.3 : 1;

      ctx.save();
      ctx.globalAlpha = Math.max(0, alpha);
      ctx.translate(t.x, t.y);
      ctx.scale(popScale, popScale);
      ctx.font = `900 ${t.fontSize}px "Nunito", "PingFang SC", "Microsoft YaHei", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = t.isBanner ? 7 : 4;
      ctx.strokeStyle = t.stroke;
      ctx.strokeText(t.text, 0, 0);
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, 0, 0);
      ctx.restore();
    }
  }
}
