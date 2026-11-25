import { AnimalType, SpecialType } from '../engine/types';

export const ANIMAL_META: Record<
  AnimalType,
  { label: string; primary: string; secondary: string; glow: string }
> = {
  chick: { label: '小黄鸡', primary: '#ffd13b', secondary: '#f59e0b', glow: '#fff3b0' },
  frog: { label: '小青蛙', primary: '#70e000', secondary: '#2d9300', glow: '#d8f3dc' },
  hippo: { label: '蓝河马', primary: '#4cc9f0', secondary: '#1d6fd6', glow: '#caf0f8' },
  fox: { label: '红狐狸', primary: '#ff5d6c', secondary: '#c9184a', glow: '#ffd6e0' },
  owl: { label: '紫猫头鹰', primary: '#c77dff', secondary: '#6920a8', glow: '#f3d5ff' },
  bear: { label: '棕小熊', primary: '#e09f67', secondary: '#8b4513', glow: '#fde4cf' },
};

function drawGlossHighlight(ctx: CanvasRenderingContext2D, r: number): void {
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(-r * 0.28, -r * 0.4, r * 0.36, r * 0.16, -0.42, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.68)';
  ctx.fill();

  ctx.beginPath();
  ctx.arc(r * 0.36, r * 0.36, r * 0.085, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
  ctx.fill();
  ctx.restore();
}

function drawEye(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  blink: boolean,
  whiteRing = false,
): void {
  if (blink) {
    ctx.save();
    ctx.strokeStyle = '#3c2415';
    ctx.lineWidth = Math.max(2, radius * 0.55);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(x, y + radius * 0.25, radius * 0.95, Math.PI * 1.15, Math.PI * 1.85);
    ctx.stroke();
    ctx.restore();
    return;
  }

  if (whiteRing) {
    ctx.beginPath();
    ctx.arc(x, y, radius * 1.48, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.14)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = '#2b1b12';
  ctx.fill();

  ctx.beginPath();
  ctx.arc(x - radius * 0.32, y - radius * 0.32, radius * 0.35, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();

  ctx.beginPath();
  ctx.arc(x + radius * 0.26, y + radius * 0.28, radius * 0.16, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.fill();
}

function drawCheeks(ctx: CanvasRenderingContext2D, r: number, yOffset = 0.12): void {
  ctx.fillStyle = 'rgba(255, 118, 138, 0.48)';
  ctx.beginPath();
  ctx.ellipse(-r * 0.45, r * yOffset, r * 0.16, r * 0.1, 0, 0, Math.PI * 2);
  ctx.ellipse(r * 0.45, r * yOffset, r * 0.16, r * 0.1, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawChick(ctx: CanvasRenderingContext2D, r: number, blink: boolean): void {
  ctx.save();
  ctx.fillStyle = '#ffb703';
  ctx.strokeStyle = '#c97a00';
  ctx.lineWidth = Math.max(1.5, r * 0.05);
  ctx.beginPath();
  ctx.moveTo(-r * 0.06, -r * 0.72);
  ctx.quadraticCurveTo(-r * 0.22, -r * 1.06, -r * 0.02, -r * 0.94);
  ctx.quadraticCurveTo(r * 0.12, -r * 1.12, r * 0.16, -r * 0.84);
  ctx.quadraticCurveTo(r * 0.28, -r * 0.94, r * 0.12, -r * 0.72);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  const grad = ctx.createRadialGradient(-r * 0.25, -r * 0.3, r * 0.1, 0, 0, r * 0.88);
  grad.addColorStop(0, '#fff9ae');
  grad.addColorStop(0.5, '#ffd43b');
  grad.addColorStop(1, '#e67700');

  ctx.beginPath();
  ctx.arc(0, r * 0.04, r * 0.78, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.strokeStyle = '#b86200';
  ctx.lineWidth = Math.max(2, r * 0.065);
  ctx.stroke();

  ctx.beginPath();
  ctx.ellipse(0, r * 0.34, r * 0.42, r * 0.28, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255, 251, 224, 0.58)';
  ctx.fill();

  drawCheeks(ctx, r, 0.14);
  drawEye(ctx, -r * 0.28, -r * 0.06, r * 0.12, blink);
  drawEye(ctx, r * 0.28, -r * 0.06, r * 0.12, blink);

  ctx.beginPath();
  ctx.moveTo(-r * 0.15, r * 0.06);
  ctx.quadraticCurveTo(0, r * 0.01, r * 0.15, r * 0.06);
  ctx.quadraticCurveTo(0, r * 0.29, -r * 0.15, r * 0.06);
  ctx.closePath();
  ctx.fillStyle = '#ff6b1a';
  ctx.fill();
  ctx.strokeStyle = '#b83c00';
  ctx.lineWidth = Math.max(1.2, r * 0.04);
  ctx.stroke();

  drawGlossHighlight(ctx, r * 0.85);
}

function drawFrog(ctx: CanvasRenderingContext2D, r: number, blink: boolean): void {
  const grad = ctx.createRadialGradient(-r * 0.2, -r * 0.25, r * 0.1, 0, r * 0.1, r * 0.88);
  grad.addColorStop(0, '#d8ff9c');
  grad.addColorStop(0.5, '#5cd624');
  grad.addColorStop(1, '#1e7800');

  ctx.beginPath();
  ctx.ellipse(0, r * 0.12, r * 0.84, r * 0.66, 0, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.strokeStyle = '#175900';
  ctx.lineWidth = Math.max(2, r * 0.065);
  ctx.stroke();

  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(side * r * 0.38, -r * 0.42, r * 0.27, 0, Math.PI * 2);
    ctx.fillStyle = '#7be638';
    ctx.fill();
    ctx.strokeStyle = '#175900';
    ctx.lineWidth = Math.max(1.6, r * 0.055);
    ctx.stroke();
  }

  ctx.beginPath();
  ctx.ellipse(0, r * 0.42, r * 0.56, r * 0.26, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(233, 255, 209, 0.75)';
  ctx.fill();

  drawCheeks(ctx, r, 0.2);
  drawEye(ctx, -r * 0.38, -r * 0.42, r * 0.13, blink, true);
  drawEye(ctx, r * 0.38, -r * 0.42, r * 0.13, blink, true);

  ctx.beginPath();
  ctx.arc(0, r * 0.08, r * 0.34, 0.15 * Math.PI, 0.85 * Math.PI);
  ctx.strokeStyle = '#185000';
  ctx.lineWidth = Math.max(2, r * 0.065);
  ctx.lineCap = 'round';
  ctx.stroke();

  drawGlossHighlight(ctx, r * 0.8);
}

function drawHippo(ctx: CanvasRenderingContext2D, r: number, blink: boolean): void {
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(side * r * 0.52, -r * 0.52, r * 0.2, 0, Math.PI * 2);
    ctx.fillStyle = '#48bfe3';
    ctx.fill();
    ctx.strokeStyle = '#13548f';
    ctx.lineWidth = Math.max(1.6, r * 0.05);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(side * r * 0.52, -r * 0.52, r * 0.1, 0, Math.PI * 2);
    ctx.fillStyle = '#bde0fe';
    ctx.fill();
  }

  const grad = ctx.createRadialGradient(-r * 0.22, -r * 0.3, r * 0.1, 0, 0, r * 0.86);
  grad.addColorStop(0, '#aaf2ff');
  grad.addColorStop(0.5, '#48bfe3');
  grad.addColorStop(1, '#1862b0');

  ctx.beginPath();
  ctx.arc(0, -r * 0.02, r * 0.74, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.strokeStyle = '#13548f';
  ctx.lineWidth = Math.max(2, r * 0.065);
  ctx.stroke();

  drawEye(ctx, -r * 0.28, -r * 0.22, r * 0.115, blink);
  drawEye(ctx, r * 0.28, -r * 0.22, r * 0.115, blink);

  const snoutGrad = ctx.createLinearGradient(0, -r * 0.02, 0, r * 0.72);
  snoutGrad.addColorStop(0, '#d6f7ff');
  snoutGrad.addColorStop(1, '#7cd8f5');
  ctx.beginPath();
  ctx.ellipse(0, r * 0.34, r * 0.64, r * 0.4, 0, 0, Math.PI * 2);
  ctx.fillStyle = snoutGrad;
  ctx.fill();
  ctx.strokeStyle = '#13548f';
  ctx.lineWidth = Math.max(1.5, r * 0.05);
  ctx.stroke();

  ctx.fillStyle = '#114d82';
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(side * r * 0.22, r * 0.24, r * 0.075, r * 0.1, side * 0.2, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.beginPath();
  ctx.arc(0, r * 0.42, r * 0.2, 0.15 * Math.PI, 0.85 * Math.PI);
  ctx.strokeStyle = '#114d82';
  ctx.lineWidth = Math.max(1.6, r * 0.05);
  ctx.lineCap = 'round';
  ctx.stroke();

  drawGlossHighlight(ctx, r * 0.78);
}

function drawFox(ctx: CanvasRenderingContext2D, r: number, blink: boolean): void {
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(side * r * 0.22, -r * 0.54);
    ctx.lineTo(side * r * 0.68, -r * 0.9);
    ctx.lineTo(side * r * 0.68, -r * 0.22);
    ctx.closePath();
    ctx.fillStyle = '#ff4d5e';
    ctx.fill();
    ctx.strokeStyle = '#991036';
    ctx.lineWidth = Math.max(1.6, r * 0.055);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(side * r * 0.32, -r * 0.5);
    ctx.lineTo(side * r * 0.6, -r * 0.74);
    ctx.lineTo(side * r * 0.6, -r * 0.3);
    ctx.closePath();
    ctx.fillStyle = '#ffe5ec';
    ctx.fill();
  }

  const grad = ctx.createRadialGradient(-r * 0.2, -r * 0.25, r * 0.1, 0, 0, r * 0.88);
  grad.addColorStop(0, '#ff9aa8');
  grad.addColorStop(0.52, '#ff4d5e');
  grad.addColorStop(1, '#ba1442');

  ctx.beginPath();
  ctx.moveTo(0, -r * 0.66);
  ctx.quadraticCurveTo(r * 0.74, -r * 0.56, r * 0.84, r * 0.08);
  ctx.quadraticCurveTo(r * 0.58, r * 0.72, 0, r * 0.76);
  ctx.quadraticCurveTo(-r * 0.58, r * 0.72, -r * 0.84, r * 0.08);
  ctx.quadraticCurveTo(-r * 0.74, -r * 0.56, 0, -r * 0.66);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.strokeStyle = '#991036';
  ctx.lineWidth = Math.max(2, r * 0.065);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(-r * 0.76, r * 0.14);
  ctx.quadraticCurveTo(-r * 0.3, r * 0.05, 0, r * 0.28);
  ctx.quadraticCurveTo(r * 0.3, r * 0.05, r * 0.76, r * 0.14);
  ctx.quadraticCurveTo(r * 0.45, r * 0.7, 0, r * 0.73);
  ctx.quadraticCurveTo(-r * 0.45, r * 0.7, -r * 0.76, r * 0.14);
  ctx.closePath();
  ctx.fillStyle = '#fff3f6';
  ctx.fill();

  drawEye(ctx, -r * 0.28, -r * 0.08, r * 0.115, blink);
  drawEye(ctx, r * 0.28, -r * 0.08, r * 0.115, blink);

  ctx.beginPath();
  ctx.arc(0, r * 0.28, r * 0.11, 0, Math.PI * 2);
  ctx.fillStyle = '#2b1b12';
  ctx.fill();

  ctx.beginPath();
  ctx.arc(-r * 0.08, r * 0.42, r * 0.09, 0.1 * Math.PI, 0.9 * Math.PI);
  ctx.strokeStyle = '#4a1c24';
  ctx.lineWidth = Math.max(1.4, r * 0.045);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(r * 0.08, r * 0.42, r * 0.09, 0.1 * Math.PI, 0.9 * Math.PI);
  ctx.stroke();

  drawGlossHighlight(ctx, r * 0.76);
}

function drawOwl(ctx: CanvasRenderingContext2D, r: number, blink: boolean): void {
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(side * r * 0.25, -r * 0.62);
    ctx.lineTo(side * r * 0.62, -r * 0.88);
    ctx.lineTo(side * r * 0.62, -r * 0.36);
    ctx.closePath();
    ctx.fillStyle = '#9d4edd';
    ctx.fill();
    ctx.strokeStyle = '#52148a';
    ctx.lineWidth = Math.max(1.5, r * 0.05);
    ctx.stroke();
  }

  const grad = ctx.createRadialGradient(-r * 0.2, -r * 0.28, r * 0.1, 0, 0, r * 0.86);
  grad.addColorStop(0, '#f0dbff');
  grad.addColorStop(0.52, '#b565f7');
  grad.addColorStop(1, '#5e148c');

  ctx.beginPath();
  ctx.ellipse(0, r * 0.04, r * 0.76, r * 0.76, 0, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.strokeStyle = '#4c117a';
  ctx.lineWidth = Math.max(2, r * 0.065);
  ctx.stroke();

  ctx.beginPath();
  ctx.ellipse(0, r * 0.42, r * 0.44, r * 0.3, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#f8edff';
  ctx.fill();

  drawEye(ctx, -r * 0.28, -r * 0.08, r * 0.135, blink, true);
  drawEye(ctx, r * 0.28, -r * 0.08, r * 0.135, blink, true);

  ctx.beginPath();
  ctx.moveTo(0, -r * 0.02);
  ctx.lineTo(r * 0.12, r * 0.14);
  ctx.lineTo(0, r * 0.28);
  ctx.lineTo(-r * 0.12, r * 0.14);
  ctx.closePath();
  ctx.fillStyle = '#ffb703';
  ctx.fill();
  ctx.strokeStyle = '#b86b00';
  ctx.lineWidth = Math.max(1.2, r * 0.04);
  ctx.stroke();

  drawGlossHighlight(ctx, r * 0.8);
}

function drawBear(ctx: CanvasRenderingContext2D, r: number, blink: boolean): void {
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(side * r * 0.52, -r * 0.52, r * 0.24, 0, Math.PI * 2);
    ctx.fillStyle = '#c97b42';
    ctx.fill();
    ctx.strokeStyle = '#66300e';
    ctx.lineWidth = Math.max(1.6, r * 0.055);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(side * r * 0.52, -r * 0.52, r * 0.12, 0, Math.PI * 2);
    ctx.fillStyle = '#ffe5cc';
    ctx.fill();
  }

  const grad = ctx.createRadialGradient(-r * 0.22, -r * 0.3, r * 0.1, 0, 0, r * 0.86);
  grad.addColorStop(0, '#fad4ae');
  grad.addColorStop(0.52, '#d4844a');
  grad.addColorStop(1, '#7a3c12');

  ctx.beginPath();
  ctx.arc(0, r * 0.04, r * 0.76, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.strokeStyle = '#66300e';
  ctx.lineWidth = Math.max(2, r * 0.065);
  ctx.stroke();

  drawCheeks(ctx, r, 0.14);
  drawEye(ctx, -r * 0.29, -r * 0.12, r * 0.115, blink);
  drawEye(ctx, r * 0.29, -r * 0.12, r * 0.115, blink);

  ctx.beginPath();
  ctx.ellipse(0, r * 0.26, r * 0.38, r * 0.28, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#fff0df';
  ctx.fill();

  ctx.beginPath();
  ctx.ellipse(0, r * 0.16, r * 0.15, r * 0.1, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#3b1e0a';
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(-r * 0.04, r * 0.13, r * 0.05, r * 0.03, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.fill();

  ctx.strokeStyle = '#3b1e0a';
  ctx.lineWidth = Math.max(1.4, r * 0.048);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, r * 0.26);
  ctx.lineTo(0, r * 0.34);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(-r * 0.09, r * 0.35, r * 0.09, 0.05 * Math.PI, 0.9 * Math.PI);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(r * 0.09, r * 0.35, r * 0.09, 0.1 * Math.PI, 0.95 * Math.PI);
  ctx.stroke();

  drawGlossHighlight(ctx, r * 0.8);
}

function drawAnimalVector(
  ctx: CanvasRenderingContext2D,
  animal: AnimalType,
  radius: number,
  blink: boolean,
): void {
  switch (animal) {
    case 'chick':
      drawChick(ctx, radius, blink);
      break;
    case 'frog':
      drawFrog(ctx, radius, blink);
      break;
    case 'hippo':
      drawHippo(ctx, radius, blink);
      break;
    case 'fox':
      drawFox(ctx, radius, blink);
      break;
    case 'owl':
      drawOwl(ctx, radius, blink);
      break;
    case 'bear':
      drawBear(ctx, radius, blink);
      break;
  }
}

export class SpriteCache {
  private cache = new Map<string, HTMLCanvasElement>();
  private cachedSize = 0;
  private cachedDpr = 0;

  public ensureSize(cellSize: number, dpr: number): void {
    const targetSize = Math.max(32, Math.round(cellSize));
    if (this.cachedSize === targetSize && this.cachedDpr === dpr) return;
    this.cache.clear();
    this.cachedSize = targetSize;
    this.cachedDpr = dpr;
  }

  public getAnimalSprite(animal: AnimalType, blink: boolean): HTMLCanvasElement {
    const key = `${animal}_${blink ? 'b' : 'o'}`;
    const existing = this.cache.get(key);
    if (existing) return existing;

    const size = this.cachedSize || 64;
    const dpr = this.cachedDpr || 1;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(size * dpr);
    canvas.height = Math.round(size * dpr);
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.scale(dpr, dpr);
      ctx.translate(size / 2, size / 2);
      ctx.shadowColor = 'rgba(42, 18, 6, 0.28)';
      ctx.shadowBlur = size * 0.09;
      ctx.shadowOffsetY = size * 0.045;
      drawAnimalVector(ctx, animal, size * 0.43, blink);
    }
    this.cache.set(key, canvas);
    return canvas;
  }
}

/**
 * Draws the Golden Pod collectible item at origin (0,0).
 */
export function drawGoldenPod(ctx: CanvasRenderingContext2D, radius: number, time: number): void {
  ctx.save();
  const bob = Math.sin(time * 4) * radius * 0.06;
  ctx.translate(0, bob);

  // Soft golden aura
  const aura = ctx.createRadialGradient(0, 0, radius * 0.2, 0, 0, radius * 1.05);
  aura.addColorStop(0, 'rgba(255, 238, 128, 0.55)');
  aura.addColorStop(1, 'rgba(255, 200, 0, 0)');
  ctx.fillStyle = aura;
  ctx.beginPath();
  ctx.arc(0, 0, radius * 1.05, 0, Math.PI * 2);
  ctx.fill();

  // Green sprout leaves on top
  ctx.fillStyle = '#52b788';
  ctx.strokeStyle = '#1b4332';
  ctx.lineWidth = Math.max(1.5, radius * 0.055);
  ctx.beginPath();
  ctx.ellipse(-radius * 0.18, -radius * 0.72, radius * 0.26, radius * 0.13, -0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(radius * 0.18, -radius * 0.72, radius * 0.26, radius * 0.13, 0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Golden bean/pod body
  const grad = ctx.createRadialGradient(-radius * 0.28, -radius * 0.28, radius * 0.1, 0, 0, radius * 0.9);
  grad.addColorStop(0, '#fff9db');
  grad.addColorStop(0.35, '#ffe066');
  grad.addColorStop(0.75, '#f59f00');
  grad.addColorStop(1, '#b85d00');

  ctx.beginPath();
  ctx.moveTo(0, -radius * 0.65);
  ctx.bezierCurveTo(radius * 0.85, -radius * 0.55, radius * 0.82, radius * 0.58, 0, radius * 0.78);
  ctx.bezierCurveTo(-radius * 0.82, radius * 0.58, -radius * 0.85, -radius * 0.55, 0, -radius * 0.65);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.strokeStyle = '#8a4400';
  ctx.lineWidth = Math.max(2, radius * 0.07);
  ctx.stroke();

  // Ridge highlight + gleam
  ctx.beginPath();
  ctx.ellipse(-radius * 0.24, -radius * 0.18, radius * 0.15, radius * 0.34, -0.25, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
  ctx.fill();

  ctx.restore();
}

/**
 * High-contrast Magic Bird: deep indigo/violet nebula core + rotating 6-hue spectrum ring + glowing eyes.
 */
export function drawMagicBird(ctx: CanvasRenderingContext2D, radius: number, time: number): void {
  ctx.save();

  // Rotating rainbow spectrum halo behind core
  const colors = ['#ff3b5c', '#ffb703', '#52e030', '#00bbf9', '#9b5de5', '#ff66b3'];
  for (let i = 0; i < 6; i++) {
    const angle = time * 2.2 + (i * Math.PI * 2) / 6;
    const px = Math.cos(angle) * radius * 0.36;
    const py = Math.sin(angle) * radius * 0.36;
    ctx.beginPath();
    ctx.arc(px, py, radius * 0.52, 0, Math.PI * 2);
    ctx.fillStyle = colors[i];
    ctx.globalAlpha = 0.88;
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Rotating dashed outer rainbow sparkle ring
  ctx.save();
  ctx.rotate(-time * 1.4);
  ctx.beginPath();
  ctx.arc(0, 0, radius * 0.94, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.92)';
  ctx.lineWidth = Math.max(2, radius * 0.08);
  ctx.setLineDash([radius * 0.22, radius * 0.18]);
  ctx.stroke();
  ctx.restore();

  // Deep high-contrast indigo nebula core
  const coreGrad = ctx.createRadialGradient(-radius * 0.15, -radius * 0.2, radius * 0.06, 0, 0, radius * 0.72);
  coreGrad.addColorStop(0, '#7c3aed');
  coreGrad.addColorStop(0.55, '#312e81');
  coreGrad.addColorStop(1, '#1e1b4b');

  ctx.beginPath();
  ctx.arc(0, 0, radius * 0.68, 0, Math.PI * 2);
  ctx.fillStyle = coreGrad;
  ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = Math.max(2, radius * 0.07);
  ctx.stroke();

  // Luminous golden-white eyes on dark nebula face
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(side * radius * 0.23, -radius * 0.04, radius * 0.14, 0, Math.PI * 2);
    ctx.fillStyle = '#fef08a';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(side * radius * 0.23, -radius * 0.04, radius * 0.06, 0, Math.PI * 2);
    ctx.fillStyle = '#1e1b4b';
    ctx.fill();
  }

  // Sparkling star crest
  ctx.save();
  ctx.translate(0, -radius * 0.44);
  ctx.rotate(Math.sin(time * 3.2) * 0.18);
  ctx.fillStyle = '#fde047';
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const r = i % 2 === 0 ? radius * 0.22 : radius * 0.085;
    const a = (i * Math.PI) / 4;
    if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // Golden beak
  ctx.beginPath();
  ctx.moveTo(0, radius * 0.04);
  ctx.lineTo(radius * 0.11, radius * 0.17);
  ctx.lineTo(0, radius * 0.29);
  ctx.lineTo(-radius * 0.11, radius * 0.17);
  ctx.closePath();
  ctx.fillStyle = '#fbbf24';
  ctx.fill();

  ctx.restore();
}

/**
 * High-contrast continuous animated overlays for Line and Bomb specials.
 */
export function drawSpecialOverlay(
  ctx: CanvasRenderingContext2D,
  special: SpecialType,
  radius: number,
  time: number,
): void {
  if (special === 'none' || special === 'magic_bird') return;
  ctx.save();

  if (special === 'line_h' || special === 'line_v') {
    if (special === 'line_v') ctx.rotate(Math.PI / 2);

    // Outer neon glowing ring
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.88, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.lineWidth = Math.max(2, radius * 0.08);
    ctx.stroke();

    // Flowing high-contrast neon energy band inside tile clip
    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.86, 0, Math.PI * 2);
    ctx.clip();

    const sweep = ((time * 2.4) % 2) - 1; // -1 to 1
    const bandGrad = ctx.createLinearGradient(-radius, 0, radius, 0);
    bandGrad.addColorStop(0, 'rgba(0, 245, 212, 0.2)');
    bandGrad.addColorStop(Math.max(0, Math.min(1, 0.5 + sweep * 0.4)), 'rgba(255, 255, 255, 0.92)');
    bandGrad.addColorStop(1, 'rgba(255, 230, 109, 0.25)');

    ctx.fillStyle = bandGrad;
    ctx.fillRect(-radius, -radius * 0.2, radius * 2, radius * 0.4);
    ctx.restore();

    // Expanding & contracting dual glowing arrows
    const arrowStretch = 0.72 + 0.16 * Math.sin(time * 9);
    for (const dir of [-1, 1]) {
      const tipX = dir * radius * (arrowStretch + 0.14);
      const baseX = dir * radius * (arrowStretch - 0.14);

      ctx.strokeStyle = '#ff6b00';
      ctx.lineWidth = Math.max(4, radius * 0.16);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(baseX, -radius * 0.28);
      ctx.lineTo(tipX, 0);
      ctx.lineTo(baseX, radius * 0.28);
      ctx.stroke();

      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = Math.max(2, radius * 0.08);
      ctx.stroke();
    }
  } else if (special === 'bomb') {
    // Micro-vibration charge feel
    const vibX = Math.sin(time * 38) * radius * 0.025;
    const vibY = Math.cos(time * 43) * radius * 0.025;
    ctx.translate(vibX, vibY);

    const pulse = 0.92 + 0.11 * Math.sin(time * 10);
    const aura = ctx.createRadialGradient(0, 0, radius * 0.45, 0, 0, radius * 1.12 * pulse);
    aura.addColorStop(0, 'rgba(255, 230, 0, 0)');
    aura.addColorStop(0.6, 'rgba(255, 162, 0, 0.48)');
    aura.addColorStop(1, 'rgba(255, 28, 104, 0.86)');

    ctx.beginPath();
    ctx.arc(0, 0, radius * 1.08 * pulse, 0, Math.PI * 2);
    ctx.fillStyle = aura;
    ctx.fill();

    // Rotating segmented energy ring
    ctx.save();
    ctx.rotate(time * 3.5);
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.95 * pulse, 0, Math.PI * 2);
    ctx.strokeStyle = '#fff9c4';
    ctx.lineWidth = Math.max(2.6, radius * 0.095);
    ctx.setLineDash([radius * 0.28, radius * 0.16]);
    ctx.stroke();
    ctx.restore();

    // Orbiting fire sparks
    for (let i = 0; i < 4; i++) {
      const a = time * 5.5 + (i * Math.PI) / 2;
      const sx = Math.cos(a) * radius * 0.96;
      const sy = Math.sin(a) * radius * 0.96;
      ctx.beginPath();
      ctx.arc(sx, sy, radius * 0.1, 0, Math.PI * 2);
      ctx.fillStyle = i % 2 === 0 ? '#ffe066' : '#ff4d6d';
      ctx.fill();
    }
  }

  ctx.restore();
}
