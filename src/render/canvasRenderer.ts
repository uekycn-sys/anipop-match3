import { SoundEngine } from '../audio/soundEngine';
import { BoardController } from '../engine/board';
import { AnimalType, BoardEvent, Pos } from '../engine/types';
import { ParticleSystem } from './particles';
import {
  ANIMAL_META,
  SpriteCache,
  drawGoldenPod,
  drawMagicBird,
  drawSpecialOverlay,
} from './sprites';

export type ArmedTool = 'none' | 'hammer' | 'force_swap';

export interface FlyCollectPayload {
  clientX: number;
  clientY: number;
  kind: 'animal' | 'ice' | 'crate' | 'vine' | 'pod';
  animal?: AnimalType;
}

interface VisualTileState {
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  startX: number;
  startY: number;
  animTime: number;
  animDuration: number;
  animKind: 'none' | 'swap' | 'fall' | 'shuffle';
  scaleX: number;
  scaleY: number;
  squashTimer: number;
  blinkTimer: number;
  nextBlinkAt: number;
}

export class CanvasRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private board: BoardController;
  private sound: SoundEngine;
  private particles = new ParticleSystem();
  private sprites = new SpriteCache();
  private tileVisuals = new Map<number, VisualTileState>();

  private cssWidth = 400;
  private cssHeight = 400;
  private dpr = 1;
  private cellSize = 48;
  private originX = 0;
  private originY = 0;
  private extraBottomPad = 0;

  private elapsed = 0;
  private idleTimer = 0;
  private hitstopTimer = 0;
  private selectedCell: Pos | null = null;
  private dragStartCell: Pos | null = null;
  private dragStartX = 0;
  private dragStartY = 0;
  private shuffleBannerTimer = 0;
  private armedTool: ArmedTool = 'none';

  public onToolAction?: (tool: 'hammer' | 'force_swap', pos: Pos, to?: Pos) => void;
  public onFlyCollect?: (payload: FlyCollectPayload) => void;

  constructor(canvas: HTMLCanvasElement, board: BoardController, sound: SoundEngine) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2D Canvas context unavailable');
    this.ctx = ctx;
    this.board = board;
    this.sound = sound;
    this.syncAllTilesImmediate();
    this.resize();
  }

  public setArmedTool(tool: ArmedTool): void {
    this.armedTool = tool;
    this.selectedCell = null;
    this.dragStartCell = null;
  }

  public setBoard(board: BoardController): void {
    this.board = board;
    this.tileVisuals.clear();
    this.selectedCell = null;
    this.dragStartCell = null;
    this.idleTimer = 0;
    this.hitstopTimer = 0;
    this.shuffleBannerTimer = 0;
    this.armedTool = 'none';
    this.syncAllTilesImmediate();
    this.resize();
  }

  public resize(): void {
    const rect = this.canvas.parentElement?.getBoundingClientRect();
    const availW = rect ? rect.width : 480;
    const availH = rect ? rect.height : 480;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2.5);

    const hasPodGoal = this.board.config.goals.some((g) => g.type === 'pod');
    this.extraBottomPad = hasPodGoal ? 14 : 0;

    const padX = 22;
    const padY = 22;
    const maxCellW = Math.floor((availW - padX * 2) / this.board.cols);
    const maxCellH = Math.floor((availH - padY * 2 - this.extraBottomPad) / this.board.rows);
    this.cellSize = Math.max(30, Math.min(68, maxCellW, maxCellH));

    this.cssWidth = this.cellSize * this.board.cols + padX * 2;
    this.cssHeight = this.cellSize * this.board.rows + padY * 2 + this.extraBottomPad;
    this.originX = padX;
    this.originY = padY;

    this.canvas.style.width = `${this.cssWidth}px`;
    this.canvas.style.height = `${this.cssHeight}px`;
    this.canvas.width = Math.round(this.cssWidth * this.dpr);
    this.canvas.height = Math.round(this.cssHeight * this.dpr);

    this.sprites.ensureSize(this.cellSize, this.dpr);
  }

  private syncAllTilesImmediate(): void {
    for (let r = 0; r < this.board.rows; r++) {
      for (let c = 0; c < this.board.cols; c++) {
        const tile = this.board.grid[r][c].tile;
        if (!tile) continue;
        this.tileVisuals.set(tile.id, {
          x: c,
          y: r,
          targetX: c,
          targetY: r,
          startX: c,
          startY: r,
          animTime: 0,
          animDuration: 0,
          animKind: 'none',
          scaleX: 1,
          scaleY: 1,
          squashTimer: 0,
          blinkTimer: 0,
          nextBlinkAt: 1 + Math.random() * 4,
        });
      }
    }
  }

  private cellCenter(row: number, col: number): { x: number; y: number } {
    return {
      x: this.originX + (col + 0.5) * this.cellSize,
      y: this.originY + (row + 0.5) * this.cellSize,
    };
  }

  private toClientCoords(canvasX: number, canvasY: number): { clientX: number; clientY: number } {
    const rect = this.canvas.getBoundingClientRect();
    return {
      clientX: rect.left + canvasX,
      clientY: rect.top + canvasY,
    };
  }

  private screenToCell(clientX: number, clientY: number): Pos | null {
    const rect = this.canvas.getBoundingClientRect();
    const x = clientX - rect.left - this.originX;
    const y = clientY - rect.top - this.originY;
    const col = Math.floor(x / this.cellSize);
    const row = Math.floor(y / this.cellSize);
    if (row < 0 || row >= this.board.rows || col < 0 || col >= this.board.cols) return null;
    if (!this.board.grid[row][col].active) return null;
    return { row, col };
  }

  public handlePointerDown(clientX: number, clientY: number): void {
    this.sound.unlock();
    this.idleTimer = 0;
    if (this.board.state !== 'IDLE') return;

    const cellPos = this.screenToCell(clientX, clientY);
    if (!cellPos) {
      this.selectedCell = null;
      return;
    }

    // Hammer tool click
    if (this.armedTool === 'hammer') {
      this.onToolAction?.('hammer', cellPos);
      return;
    }

    const cell = this.board.grid[cellPos.row][cellPos.col];
    if (cell.crate > 0 || cell.vine || !cell.tile) {
      this.selectedCell = null;
      return;
    }

    this.dragStartCell = cellPos;
    this.dragStartX = clientX;
    this.dragStartY = clientY;

    if (this.selectedCell) {
      const dr = Math.abs(this.selectedCell.row - cellPos.row);
      const dc = Math.abs(this.selectedCell.col - cellPos.col);
      if (dr + dc === 1) {
        const from = this.selectedCell;
        this.selectedCell = null;
        this.dragStartCell = null;
        if (this.armedTool === 'force_swap') {
          this.onToolAction?.('force_swap', from, cellPos);
        } else {
          this.board.trySwap(from, cellPos);
        }
        return;
      }
      if (dr === 0 && dc === 0) {
        this.selectedCell = null;
        return;
      }
    }

    this.selectedCell = cellPos;
    this.sound.playSelect();
  }

  public handlePointerMove(clientX: number, clientY: number): void {
    if (!this.dragStartCell || this.board.state !== 'IDLE' || this.armedTool === 'hammer') return;
    const dx = clientX - this.dragStartX;
    const dy = clientY - this.dragStartY;
    const threshold = Math.max(14, this.cellSize * 0.34);
    if (Math.hypot(dx, dy) < threshold) return;

    let targetRow = this.dragStartCell.row;
    let targetCol = this.dragStartCell.col;
    if (Math.abs(dx) > Math.abs(dy)) {
      targetCol += dx > 0 ? 1 : -1;
    } else {
      targetRow += dy > 0 ? 1 : -1;
    }

    const from = this.dragStartCell;
    const to = { row: targetRow, col: targetCol };
    this.dragStartCell = null;
    this.selectedCell = null;

    if (this.armedTool === 'force_swap') {
      this.onToolAction?.('force_swap', from, to);
    } else {
      this.board.trySwap(from, to);
    }
  }

  public handlePointerUp(): void {
    this.dragStartCell = null;
  }

  private emitFly(row: number, col: number, kind: FlyCollectPayload['kind'], animal?: AnimalType): void {
    if (!this.onFlyCollect) return;
    const pt = this.cellCenter(row, col);
    const client = this.toClientCoords(pt.x, pt.y);
    this.onFlyCollect({ clientX: client.clientX, clientY: client.clientY, kind, animal });
  }

  public processEvents(events: BoardEvent[]): void {
    const goals = this.board.config.goals;
    const neededAnimals = new Set(
      goals.filter((g) => g.type === 'collect').map((g) => (g as { animal: AnimalType }).animal),
    );
    const hasIceGoal = goals.some((g) => g.type === 'ice');
    const hasCrateGoal = goals.some((g) => g.type === 'crate');
    const hasVineGoal = goals.some((g) => g.type === 'vine');

    for (const ev of events) {
      switch (ev.type) {
        case 'swap_start': {
          this.idleTimer = 0;
          this.sound.playSwap();
          this.animateSwapVisuals(ev.from, ev.to, 0.16);
          break;
        }
        case 'swap_revert': {
          this.sound.playRevert();
          this.animateSwapVisuals(ev.from, ev.to, 0.18);
          break;
        }
        case 'powerup_hammer': {
          this.sound.playHammer();
          this.particles.addShake(8);
          const pt = this.cellCenter(ev.pos.row, ev.pos.col);
          this.particles.spawnShockwave(pt.x, pt.y, this.cellSize * 1.15, '#fde047');
          break;
        }
        case 'tiles_cleared': {
          this.sound.playMatch(ev.cascade);
          if (ev.cascade >= 3) {
            this.hitstopTimer = 0.04;
            this.particles.addBorderGlow(0.95);
          }
          for (const item of ev.tiles) {
            const pt = this.cellCenter(item.pos.row, item.pos.col);
            const color = item.tile.animal
              ? ANIMAL_META[item.tile.animal].primary
              : '#c084fc';
            this.particles.spawnJellyBurst(pt.x, pt.y, color, 8);
            this.tileVisuals.delete(item.tile.id);

            if (item.tile.animal && neededAnimals.has(item.tile.animal)) {
              this.emitFly(item.pos.row, item.pos.col, 'animal', item.tile.animal);
            }
          }
          if (ev.tiles.length > 0) {
            let sx = 0;
            let sy = 0;
            for (const t of ev.tiles) {
              const p = this.cellCenter(t.pos.row, t.pos.col);
              sx += p.x;
              sy += p.y;
            }
            const cx = sx / ev.tiles.length;
            const cy = sy / ev.tiles.length;
            this.particles.spawnFloatingText(cx, cy - 8, `+${ev.points}`, false, '#fff9db');
          }
          if (ev.comboText) {
            const center = this.cellCenter(
              (this.board.rows - 1) / 2,
              (this.board.cols - 1) / 2,
            );
            const bannerColor =
              ev.cascade >= 5
                ? '#ff85a1'
                : ev.cascade === 4
                  ? '#ffd166'
                  : ev.cascade === 3
                    ? '#80ffdb'
                    : '#ffffff';
            this.particles.spawnFloatingText(center.x, center.y - 16, ev.comboText, true, bannerColor);
            this.particles.addShake(Math.min(11, ev.cascade * 2.4));
          }
          break;
        }
        case 'special_created': {
          this.sound.playSpecialCreate();
          const pt = this.cellCenter(ev.pos.row, ev.pos.col);
          this.particles.spawnShockwave(pt.x, pt.y, this.cellSize * 0.95, '#fff3b0');
          const tile = this.board.grid[ev.pos.row][ev.pos.col].tile;
          if (tile) {
            this.tileVisuals.set(tile.id, {
              x: ev.pos.col,
              y: ev.pos.row,
              targetX: ev.pos.col,
              targetY: ev.pos.row,
              startX: ev.pos.col,
              startY: ev.pos.row,
              animTime: 0,
              animDuration: 0,
              animKind: 'none',
              scaleX: 1.32,
              scaleY: 0.72,
              squashTimer: 0.25,
              blinkTimer: 0,
              nextBlinkAt: 2,
            });
          }
          break;
        }
        case 'special_triggered': {
          const originPt = this.cellCenter(ev.origin.row, ev.origin.col);
          if (ev.kind === 'line_h' || ev.kind === 'line_v') {
            this.sound.playLineLaser();
            this.particles.addShake(5.5);
            this.particles.spawnLaser(
              originPt.x,
              originPt.y,
              Math.max(this.cssWidth, this.cssHeight) * 1.15,
              this.cellSize * 0.44,
              ev.kind === 'line_h',
              '#00f5d4',
            );
          } else if (ev.kind === 'bomb') {
            this.sound.playBombBlast();
            this.particles.addShake(11);
            this.particles.addFlash(0.22, '#fff3b0');
            this.particles.spawnShockwave(originPt.x, originPt.y, this.cellSize * 2.3, '#ff9f1c');
          } else if (ev.kind === 'magic_bird') {
            this.sound.playMagicBirdLightning();
            this.particles.addShake(10);
            this.particles.addFlash(0.32, '#f3e8ff');
            this.particles.addBorderGlow(1.0);
            const boltColor = ev.targetColor ? ANIMAL_META[ev.targetColor].primary : '#e0aaff';
            for (const p of ev.affected) {
              const targetPt = this.cellCenter(p.row, p.col);
              this.particles.spawnLightning(originPt.x, originPt.y, targetPt.x, targetPt.y, boltColor);
            }
          }
          break;
        }
        case 'special_combo': {
          const originPt = this.cellCenter(ev.origin.row, ev.origin.col);
          this.hitstopTimer = 0.04;
          this.particles.addBorderGlow(1.0);
          if (ev.combo === 'line_line') {
            this.sound.playLineLaser();
            this.particles.addShake(9);
            this.particles.spawnLaser(originPt.x, originPt.y, this.cssWidth * 1.2, this.cellSize * 0.5, true, '#00f5d4');
            this.particles.spawnLaser(originPt.x, originPt.y, this.cssHeight * 1.2, this.cellSize * 0.5, false, '#00f5d4');
          } else if (ev.combo === 'line_bomb') {
            this.sound.playLineLaser();
            this.sound.playBombBlast();
            this.particles.addShake(14);
            this.particles.addFlash(0.35, '#fef08a');
            for (let d = -1; d <= 1; d++) {
              this.particles.spawnLaser(
                originPt.x,
                originPt.y + d * this.cellSize,
                this.cssWidth * 1.2,
                this.cellSize * 0.46,
                true,
                '#ffd166',
              );
              this.particles.spawnLaser(
                originPt.x + d * this.cellSize,
                originPt.y,
                this.cssHeight * 1.2,
                this.cellSize * 0.46,
                false,
                '#ffd166',
              );
            }
          } else if (ev.combo === 'bomb_bomb') {
            this.sound.playBombBlast();
            this.particles.addShake(16);
            this.particles.addFlash(0.4, '#ffccd5');
            this.particles.spawnShockwave(originPt.x, originPt.y, this.cellSize * 3.5, '#ff4d6d');
          } else if (ev.combo === 'bird_normal' || ev.combo === 'bird_line' || ev.combo === 'bird_bomb') {
            this.sound.playMagicBirdLightning();
            this.particles.addShake(12);
            this.particles.addFlash(0.38, '#f3e8ff');
            const boltColor = ev.targetColor ? ANIMAL_META[ev.targetColor].primary : '#e0aaff';
            for (const p of ev.affected) {
              const targetPt = this.cellCenter(p.row, p.col);
              this.particles.spawnLightning(originPt.x, originPt.y, targetPt.x, targetPt.y, boltColor);
            }
          } else if (ev.combo === 'bird_bird') {
            this.sound.playMagicBirdLightning();
            this.sound.playBombBlast();
            this.particles.addShake(18);
            this.particles.addFlash(0.55, '#ffffff');
            this.particles.spawnShockwave(originPt.x, originPt.y, Math.max(this.cssWidth, this.cssHeight) * 0.95, '#c084fc');
          }
          break;
        }
        case 'ice_damaged': {
          this.sound.playIceBreak();
          const pt = this.cellCenter(ev.pos.row, ev.pos.col);
          this.particles.spawnIceShards(pt.x, pt.y);
          if (hasIceGoal) this.emitFly(ev.pos.row, ev.pos.col, 'ice');
          break;
        }
        case 'crate_damaged': {
          this.sound.playCrateBreak();
          const pt = this.cellCenter(ev.pos.row, ev.pos.col);
          this.particles.spawnWoodSplinters(pt.x, pt.y);
          if (hasCrateGoal) this.emitFly(ev.pos.row, ev.pos.col, 'crate');
          break;
        }
        case 'vine_broken': {
          this.sound.playVineBreak();
          const pt = this.cellCenter(ev.pos.row, ev.pos.col);
          this.particles.spawnVineBurst(pt.x, pt.y);
          if (hasVineGoal) this.emitFly(ev.pos.row, ev.pos.col, 'vine');
          break;
        }
        case 'pod_collected': {
          this.sound.playPodCollect();
          const pt = this.cellCenter(ev.pos.row, ev.pos.col);
          this.particles.spawnShockwave(pt.x, pt.y, this.cellSize * 1.1, '#ffe066');
          this.particles.spawnFloatingText(pt.x, pt.y - 10, '+500', false, '#fde047');
          this.tileVisuals.delete(ev.tile.id);
          this.emitFly(ev.pos.row, ev.pos.col, 'pod');
          break;
        }
        case 'tiles_moved': {
          for (const mv of ev.moves) {
            const existing = this.tileVisuals.get(mv.tileId);
            const dur = mv.isNewSpawn ? 0.18 : 0.22;
            if (existing) {
              existing.startX = existing.x;
              existing.startY = existing.y;
              existing.targetX = mv.toCol;
              existing.targetY = mv.toRow;
              existing.animTime = 0;
              existing.animDuration = dur;
              existing.animKind = 'fall';
            } else {
              this.tileVisuals.set(mv.tileId, {
                x: mv.fromCol,
                y: mv.fromRow,
                startX: mv.fromCol,
                startY: mv.fromRow,
                targetX: mv.toCol,
                targetY: mv.toRow,
                animTime: 0,
                animDuration: dur,
                animKind: 'fall',
                scaleX: 1,
                scaleY: 1,
                squashTimer: 0,
                blinkTimer: 0,
                nextBlinkAt: 1.5 + Math.random() * 4,
              });
            }
          }
          break;
        }
        case 'board_shuffled': {
          this.sound.playShuffle();
          this.shuffleBannerTimer = 1.1;
          for (const mv of ev.moves) {
            const v = this.tileVisuals.get(mv.tileId);
            if (v) {
              v.startX = v.x;
              v.startY = v.y;
              v.targetX = mv.toCol;
              v.targetY = mv.toRow;
              v.animTime = 0;
              v.animDuration = 0.42;
              v.animKind = 'shuffle';
            }
          }
          break;
        }
        case 'bonus_step': {
          this.sound.playBonusTick();
          const pt = this.cellCenter(ev.pos.row, ev.pos.col);
          this.particles.spawnFloatingText(pt.x, pt.y - 12, `BONUS +${ev.bonusPoints}`, false, '#ffe066');
          break;
        }
        case 'endless_wave_up': {
          this.sound.playSpecialCreate();
          const center = this.cellCenter((this.board.rows - 1) / 2, (this.board.cols - 1) / 2);
          this.particles.spawnFloatingText(
            center.x,
            center.y,
            `第 ${ev.wave} 波 +${ev.bonusMoves}步`,
            true,
            '#80ffdb',
          );
          break;
        }
        case 'game_over': {
          if (ev.won) this.sound.playWin();
          else this.sound.playLose();
          break;
        }
      }
    }
  }

  private animateSwapVisuals(from: Pos, to: Pos, duration: number): void {
    const tileA = this.board.grid[from.row][from.col].tile;
    const tileB = this.board.grid[to.row][to.col].tile;

    if (tileA) {
      const vA = this.tileVisuals.get(tileA.id);
      if (vA) {
        vA.startX = vA.x;
        vA.startY = vA.y;
        vA.targetX = from.col;
        vA.targetY = from.row;
        vA.animTime = 0;
        vA.animDuration = duration;
        vA.animKind = 'swap';
      }
    }
    if (tileB) {
      const vB = this.tileVisuals.get(tileB.id);
      if (vB) {
        vB.startX = vB.x;
        vB.startY = vB.y;
        vB.targetX = to.col;
        vB.targetY = to.row;
        vB.animTime = 0;
        vB.animDuration = duration;
        vB.animKind = 'swap';
      }
    }
  }

  public update(dt: number): void {
    this.elapsed += dt;
    if (this.hitstopTimer > 0) {
      this.hitstopTimer = Math.max(0, this.hitstopTimer - dt);
      this.particles.update(dt * 0.25);
      return;
    }

    if (this.shuffleBannerTimer > 0) {
      this.shuffleBannerTimer = Math.max(0, this.shuffleBannerTimer - dt);
    }

    if (this.board.state === 'IDLE') {
      this.idleTimer += dt;
    } else {
      this.idleTimer = 0;
    }

    for (let r = 0; r < this.board.rows; r++) {
      for (let c = 0; c < this.board.cols; c++) {
        const tile = this.board.grid[r][c].tile;
        if (!tile) continue;

        let v = this.tileVisuals.get(tile.id);
        if (!v) {
          v = {
            x: c,
            y: r,
            startX: c,
            startY: r,
            targetX: c,
            targetY: r,
            animTime: 0,
            animDuration: 0,
            animKind: 'none',
            scaleX: 1,
            scaleY: 1,
            squashTimer: 0,
            blinkTimer: 0,
            nextBlinkAt: 1 + Math.random() * 4,
          };
          this.tileVisuals.set(tile.id, v);
        }

        if (v.animKind !== 'none' && v.animDuration > 0) {
          v.animTime += dt;
          const t = Math.min(1, v.animTime / v.animDuration);

          if (v.animKind === 'fall') {
            const ease = t * t * (2.2 - 1.2 * t);
            v.x = v.startX + (v.targetX - v.startX) * ease;
            v.y = v.startY + (v.targetY - v.startY) * ease;
            const speedFactor = t < 0.85 ? 0.08 * t : 0;
            v.scaleX = 1 - speedFactor;
            v.scaleY = 1 + speedFactor;
          } else {
            const ease = 1 - Math.pow(1 - t, 3);
            v.x = v.startX + (v.targetX - v.startX) * ease;
            v.y = v.startY + (v.targetY - v.startY) * ease;
          }

          if (t >= 1) {
            v.x = v.targetX;
            v.y = v.targetY;
            if (v.animKind === 'fall') {
              v.squashTimer = 0.22;
            }
            v.animKind = 'none';
          }
        } else {
          v.x = c;
          v.y = r;
          v.targetX = c;
          v.targetY = r;
        }

        if (v.squashTimer > 0) {
          v.squashTimer = Math.max(0, v.squashTimer - dt);
          const p = 1 - v.squashTimer / 0.22;
          const damp = Math.exp(-6 * p) * Math.sin(p * Math.PI * 2.5);
          v.scaleX = 1 + 0.16 * damp;
          v.scaleY = 1 - 0.16 * damp;
        } else if (v.animKind !== 'fall') {
          v.scaleX = 1;
          v.scaleY = 1;
        }

        if (v.blinkTimer > 0) {
          v.blinkTimer = Math.max(0, v.blinkTimer - dt);
        } else {
          v.nextBlinkAt -= dt;
          if (v.nextBlinkAt <= 0) {
            v.blinkTimer = 0.14;
            v.nextBlinkAt = 2.6 + Math.random() * 5.2;
          }
        }

        if (tile.special === 'magic_bird' && Math.random() < dt * 11) {
          const px = this.originX + (v.x + 0.5) * this.cellSize;
          const py = this.originY + (v.y + 0.5) * this.cellSize;
          this.particles.spawnStardust(px, py);
        }
      }
    }

    this.particles.update(dt);
  }

  public render(): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.scale(this.dpr, this.dpr);
    ctx.clearRect(0, 0, this.cssWidth, this.cssHeight);

    const shake = this.particles.getShakeOffset();
    ctx.translate(shake.x, shake.y);

    // 1. Carved wood + vine board frame
    this.drawBoardBackdrop(ctx);

    // 2. Cells (recessed warm grid slots + crystalline ice + pod exit arrows)
    for (let r = 0; r < this.board.rows; r++) {
      for (let c = 0; c < this.board.cols; c++) {
        const cell = this.board.grid[r][c];
        if (!cell.active) continue;
        this.drawCellSlot(ctx, r, c, cell.ice);
        if (cell.podExit) {
          this.drawPodExitArrow(ctx, r, c);
        }
      }
    }

    // 3. Hint highlight
    const showHint =
      this.board.state === 'IDLE' && this.idleTimer >= 4.0 && this.armedTool === 'none';
    const hintMove = showHint ? this.board.getHint() : null;
    const hintKeys = new Set<string>();
    if (hintMove) {
      hintKeys.add(`${hintMove.from.row},${hintMove.from.col}`);
      hintKeys.add(`${hintMove.to.row},${hintMove.to.col}`);
    }

    // 4. Tiles, Crates, Vine Cages
    for (let r = 0; r < this.board.rows; r++) {
      for (let c = 0; c < this.board.cols; c++) {
        const cell = this.board.grid[r][c];
        if (!cell.active) continue;

        if (cell.crate > 0) {
          this.drawCrate(ctx, r, c, cell.crate as 1 | 2);
          continue;
        }

        const tile = cell.tile;
        if (!tile) continue;

        const v = this.tileVisuals.get(tile.id);
        const vx = v ? v.x : c;
        const vy = v ? v.y : r;
        const centerX = this.originX + (vx + 0.5) * this.cellSize;
        const centerY = this.originY + (vy + 0.5) * this.cellSize;

        const isSelected = this.selectedCell?.row === r && this.selectedCell?.col === c;
        const isHinted = hintKeys.has(`${r},${c}`);

        let sx = v ? v.scaleX : 1;
        let sy = v ? v.scaleY : 1;
        let rot = 0;

        if (isSelected) {
          const breathe = 1.1 + 0.045 * Math.sin(this.elapsed * 7.5);
          sx *= breathe;
          sy *= breathe;
        } else if (isHinted) {
          const pulse = 1.07 + 0.05 * Math.sin(this.elapsed * 8);
          sx *= pulse;
          sy *= pulse;
          rot = Math.sin(this.elapsed * 14) * 0.08;
        }

        if (isSelected || isHinted) {
          ctx.save();
          ctx.beginPath();
          ctx.arc(centerX, centerY, this.cellSize * 0.46, 0, Math.PI * 2);
          ctx.strokeStyle = isSelected ? '#fde047' : 'rgba(255, 255, 255, 0.9)';
          ctx.lineWidth = 3.2;
          ctx.stroke();
          ctx.restore();
        }

        ctx.save();
        ctx.translate(centerX, centerY);
        if (rot !== 0) ctx.rotate(rot);
        ctx.scale(sx, sy);

        if (tile.kind === 'pod') {
          drawGoldenPod(ctx, this.cellSize * 0.42, this.elapsed);
        } else if (tile.special === 'magic_bird') {
          drawMagicBird(ctx, this.cellSize * 0.44, this.elapsed);
        } else if (tile.animal) {
          const blink = v ? v.blinkTimer > 0 : false;
          const sprite = this.sprites.getAnimalSprite(tile.animal, blink);
          const half = this.cellSize * 0.5;
          ctx.drawImage(sprite, -half, -half, this.cellSize, this.cellSize);
          if (tile.special !== 'none') {
            drawSpecialOverlay(ctx, tile.special, this.cellSize * 0.43, this.elapsed);
          }
        }
        ctx.restore();

        // Vine cage wraps locked tiles
        if (cell.vine) {
          this.drawVineCage(ctx, r, c);
        }
      }
    }

    // 5. Particles, Lasers, Shockwaves, Lightning, Floating text
    this.particles.render(ctx, this.cssWidth, this.cssHeight);

    // 6. Shuffle overlay banner (no emoji)
    if (this.shuffleBannerTimer > 0) {
      ctx.save();
      const alpha = Math.min(1, this.shuffleBannerTimer * 2);
      ctx.globalAlpha = alpha;
      const bw = Math.min(250, this.cssWidth * 0.78);
      const bh = 44;
      const bx = (this.cssWidth - bw) / 2;
      const by = (this.cssHeight - bh) / 2;
      this.roundRect(ctx, bx, by, bw, bh, 22);
      ctx.fillStyle = 'rgba(78, 36, 12, 0.9)';
      ctx.fill();
      ctx.strokeStyle = '#fde047';
      ctx.lineWidth = 2.4;
      ctx.stroke();

      ctx.fillStyle = '#fff9db';
      ctx.font = 'bold 15px "Nunito", "PingFang SC", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('魔力旋风 · 棋盘重排中', this.cssWidth / 2, this.cssHeight / 2);
      ctx.restore();
    }

    ctx.restore();
  }

  private drawBoardBackdrop(ctx: CanvasRenderingContext2D): void {
    const pad = 11;
    const x = this.originX - pad;
    const y = this.originY - pad;
    const w = this.cellSize * this.board.cols + pad * 2;
    const h = this.cellSize * this.board.rows + pad * 2;

    // Outer wooden carved board bezel
    ctx.save();
    ctx.shadowColor = 'rgba(65, 28, 8, 0.35)';
    ctx.shadowBlur = 24;
    ctx.shadowOffsetY = 10;
    this.roundRect(ctx, x - 4, y - 4, w + 8, h + 8, 26);
    const woodGrad = ctx.createLinearGradient(x, y, x, y + h);
    woodGrad.addColorStop(0, '#c87d43');
    woodGrad.addColorStop(0.5, '#a45b28');
    woodGrad.addColorStop(1, '#7c3f16');
    ctx.fillStyle = woodGrad;
    ctx.fill();
    ctx.restore();

    // Specular rim on wooden frame
    ctx.save();
    this.roundRect(ctx, x - 4, y - 4, w + 8, h + 8, 26);
    ctx.strokeStyle = 'rgba(255, 232, 198, 0.72)';
    ctx.lineWidth = 2.2;
    ctx.stroke();

    // Inner recessed frosted tray
    this.roundRect(ctx, x + 2, y + 2, w - 4, h - 4, 21);
    const trayGrad = ctx.createLinearGradient(x, y, x, y + h);
    trayGrad.addColorStop(0, 'rgba(255, 246, 230, 0.94)');
    trayGrad.addColorStop(1, 'rgba(248, 224, 192, 0.92)');
    ctx.fillStyle = trayGrad;
    ctx.fill();
    ctx.strokeStyle = 'rgba(110, 52, 18, 0.32)';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Cascade border aura glow
    const glowAlpha = this.particles.getBorderGlowAlpha();
    if (glowAlpha > 0.02) {
      this.roundRect(ctx, x - 5, y - 5, w + 10, h + 10, 27);
      ctx.strokeStyle = `rgba(253, 224, 71, ${glowAlpha})`;
      ctx.lineWidth = 5;
      ctx.stroke();
    }

    // Corner decorative vine leaves on wooden bezel
    this.drawFrameCornerVine(ctx, x + 6, y + 6, 1, 1);
    this.drawFrameCornerVine(ctx, x + w - 6, y + 6, -1, 1);
    ctx.restore();
  }

  private drawFrameCornerVine(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    sx: number,
    sy: number,
  ): void {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(sx, sy);
    ctx.strokeStyle = '#2d6a4f';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-2, 22);
    ctx.quadraticCurveTo(0, 0, 24, -2);
    ctx.stroke();

    const leaves = [
      { x: 6, y: 12, a: -0.6 },
      { x: 14, y: 4, a: 0.4 },
      { x: 22, y: -1, a: -0.3 },
    ];
    for (const lf of leaves) {
      ctx.save();
      ctx.translate(lf.x, lf.y);
      ctx.rotate(lf.a);
      ctx.fillStyle = '#52b788';
      ctx.strokeStyle = '#1b4332';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.ellipse(0, 0, 7, 3.6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  }

  private drawCellSlot(
    ctx: CanvasRenderingContext2D,
    row: number,
    col: number,
    ice: 0 | 1 | 2,
  ): void {
    const x = this.originX + col * this.cellSize + 2;
    const y = this.originY + row * this.cellSize + 2;
    const size = this.cellSize - 4;
    const even = (row + col) % 2 === 0;
    const radius = Math.max(8, size * 0.2);

    ctx.save();
    this.roundRect(ctx, x, y, size, size, radius);
    ctx.fillStyle = even ? 'rgba(176, 122, 78, 0.22)' : 'rgba(176, 122, 78, 0.13)';
    ctx.fill();

    // Subtle inset groove shadow
    ctx.strokeStyle = 'rgba(120, 68, 30, 0.14)';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    if (ice > 0) {
      this.roundRect(ctx, x + 0.5, y + 0.5, size - 1, size - 1, radius);
      const iceGrad = ctx.createLinearGradient(x, y, x + size, y + size);
      if (ice === 2) {
        iceGrad.addColorStop(0, 'rgba(235, 251, 255, 0.94)');
        iceGrad.addColorStop(0.45, 'rgba(125, 224, 255, 0.88)');
        iceGrad.addColorStop(1, 'rgba(14, 165, 233, 0.92)');
      } else {
        iceGrad.addColorStop(0, 'rgba(224, 247, 255, 0.78)');
        iceGrad.addColorStop(0.55, 'rgba(165, 235, 255, 0.68)');
        iceGrad.addColorStop(1, 'rgba(56, 189, 248, 0.74)');
      }
      ctx.fillStyle = iceGrad;
      ctx.fill();

      // Frosted crystalline border
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = ice === 2 ? 2.6 : 1.7;
      ctx.stroke();

      // Diagonal glass specular reflection strips
      ctx.save();
      ctx.clip();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.52)';
      ctx.beginPath();
      ctx.moveTo(x + size * 0.08, y - 4);
      ctx.lineTo(x + size * 0.34, y - 4);
      ctx.lineTo(x - 4, y + size * 0.38);
      ctx.lineTo(x - 4, y + size * 0.12);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = 'rgba(255, 255, 255, 0.34)';
      ctx.beginPath();
      ctx.moveTo(x + size * 0.48, y - 4);
      ctx.lineTo(x + size * 0.6, y - 4);
      ctx.lineTo(x - 4, y + size * 0.64);
      ctx.lineTo(x - 4, y + size * 0.52);
      ctx.closePath();
      ctx.fill();

      if (ice === 2) {
        // Raised crystal facets / icicle ridges along edges
        ctx.fillStyle = 'rgba(255, 255, 255, 0.78)';
        ctx.beginPath();
        ctx.moveTo(x + 2, y + 2);
        ctx.lineTo(x + size * 0.28, y + 2);
        ctx.lineTo(x + size * 0.14, y + size * 0.22);
        ctx.closePath();
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(x + size - 2, y + size - 2);
        ctx.lineTo(x + size * 0.7, y + size - 2);
        ctx.lineTo(x + size * 0.85, y + size * 0.75);
        ctx.closePath();
        ctx.fill();

        // Inner double-bevel ice frame
        this.roundRect(ctx, x + 4, y + 4, size - 8, size - 8, Math.max(5, radius - 3));
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.lineWidth = 1.4;
        ctx.stroke();
      } else {
        // Sharp jagged fracture cracks on 1-layer ice
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.92)';
        ctx.lineWidth = 1.6;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(x + size * 0.2, y + size * 0.2);
        ctx.lineTo(x + size * 0.48, y + size * 0.46);
        ctx.lineTo(x + size * 0.36, y + size * 0.76);
        ctx.moveTo(x + size * 0.48, y + size * 0.46);
        ctx.lineTo(x + size * 0.82, y + size * 0.6);
        ctx.moveTo(x + size * 0.64, y + size * 0.24);
        ctx.lineTo(x + size * 0.48, y + size * 0.46);
        ctx.stroke();
      }
      ctx.restore();
    }

    ctx.restore();
  }

  private drawPodExitArrow(ctx: CanvasRenderingContext2D, row: number, col: number): void {
    const cx = this.originX + (col + 0.5) * this.cellSize;
    const cy = this.originY + (row + 1) * this.cellSize + 7 + Math.sin(this.elapsed * 5) * 2.2;
    const w = this.cellSize * 0.24;

    ctx.save();
    ctx.fillStyle = '#40c057';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(cx - w, cy - 5);
    ctx.lineTo(cx + w, cy - 5);
    ctx.lineTo(cx, cy + 6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  private drawVineCage(ctx: CanvasRenderingContext2D, row: number, col: number): void {
    const x = this.originX + col * this.cellSize + 3;
    const y = this.originY + row * this.cellSize + 3;
    const s = this.cellSize - 6;

    ctx.save();
    ctx.lineCap = 'round';

    // Diagonal curling green vine strands across tile
    const drawStrand = (x1: number, y1: number, cx: number, cy: number, x2: number, y2: number) => {
      ctx.strokeStyle = '#1b4332';
      ctx.lineWidth = Math.max(4.5, s * 0.11);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.quadraticCurveTo(cx, cy, x2, y2);
      ctx.stroke();

      ctx.strokeStyle = '#52b788';
      ctx.lineWidth = Math.max(2.4, s * 0.06);
      ctx.stroke();
    };

    drawStrand(x + s * 0.08, y + s * 0.2, x + s * 0.5, y + s * 0.38, x + s * 0.92, y + s * 0.78);
    drawStrand(x + s * 0.9, y + s * 0.16, x + s * 0.48, y + s * 0.56, x + s * 0.1, y + s * 0.86);

    // Small leaves on vine intersections
    const leafPts = [
      { lx: x + s * 0.24, ly: y + s * 0.24, a: -0.5 },
      { lx: x + s * 0.76, ly: y + s * 0.26, a: 0.6 },
      { lx: x + s * 0.28, ly: y + s * 0.78, a: 0.5 },
      { lx: x + s * 0.74, ly: y + s * 0.76, a: -0.4 },
    ];
    for (const lp of leafPts) {
      ctx.save();
      ctx.translate(lp.lx, lp.ly);
      ctx.rotate(lp.a);
      ctx.fillStyle = '#74c69d';
      ctx.strokeStyle = '#1b4332';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.ellipse(0, 0, s * 0.11, s * 0.055, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    ctx.restore();
  }

  private drawCrate(
    ctx: CanvasRenderingContext2D,
    row: number,
    col: number,
    crate: 1 | 2,
  ): void {
    const x = this.originX + col * this.cellSize + 3.5;
    const y = this.originY + row * this.cellSize + 3.5;
    const size = this.cellSize - 7;

    ctx.save();
    ctx.shadowColor = 'rgba(60, 25, 5, 0.28)';
    ctx.shadowBlur = 6;
    ctx.shadowOffsetY = 3;

    this.roundRect(ctx, x, y, size, size, Math.max(8, size * 0.18));
    const grad = ctx.createLinearGradient(x, y, x, y + size);
    if (crate === 2) {
      grad.addColorStop(0, '#f59e0b');
      grad.addColorStop(1, '#b45309');
    } else {
      grad.addColorStop(0, '#fbbf24');
      grad.addColorStop(1, '#d97706');
    }
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.restore();

    ctx.save();
    this.roundRect(ctx, x, y, size, size, Math.max(8, size * 0.18));
    ctx.strokeStyle = '#78350f';
    ctx.lineWidth = 2;
    ctx.stroke();

    const inset = size * 0.16;
    this.roundRect(ctx, x + inset, y + inset, size - inset * 2, size - inset * 2, 5);
    ctx.fillStyle = crate === 2 ? '#d97706' : '#fcd34d';
    ctx.fill();
    ctx.strokeStyle = '#92400e';
    ctx.lineWidth = 1.4;
    ctx.stroke();

    if (crate === 2) {
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(x + size * 0.43, y + 2, size * 0.14, size - 4);
      ctx.fillRect(x + 2, y + size * 0.43, size - 4, size * 0.14);
      ctx.beginPath();
      ctx.arc(x + size * 0.5, y + size * 0.5, size * 0.14, 0, Math.PI * 2);
      ctx.fillStyle = '#fca5a5';
      ctx.fill();
    } else {
      ctx.strokeStyle = '#78350f';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(x + size * 0.2, y + size * 0.25);
      ctx.lineTo(x + size * 0.52, y + size * 0.52);
      ctx.lineTo(x + size * 0.78, y + size * 0.38);
      ctx.moveTo(x + size * 0.52, y + size * 0.52);
      ctx.lineTo(x + size * 0.65, y + size * 0.8);
      ctx.stroke();
    }
    ctx.restore();
  }

  private roundRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number,
  ): void {
    const radius = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();
  }
}
