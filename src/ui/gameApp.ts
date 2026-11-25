import { SoundEngine } from '../audio/soundEngine';
import { BoardController } from '../engine/board';
import { ENDLESS_LEVEL, LEVELS, getLevelById } from '../engine/levels';
import { loadSaveData, persistSaveData, recordLevelResult } from '../engine/storage';
import { LevelConfig, POWERUP_COSTS, PowerUpType, SaveData } from '../engine/types';
import { ArmedTool, CanvasRenderer, FlyCollectPayload } from '../render/canvasRenderer';
import { ScenicBackground } from '../render/scenicBg';
import {
  UI_ICONS,
  getAnimalSvg,
  getCoinSvg,
  getGoalIconSvg,
  getPowerUpSvg,
  getStarSvg,
} from './icons';
import { renderVineMap } from './vineMap';

interface FlyOrb {
  el: HTMLElement;
  x0: number;
  y0: number;
  cx: number;
  cy: number;
  x1: number;
  y1: number;
  t: number;
  dur: number;
  goalKey: string;
}

export class GameApp {
  private root: HTMLElement;
  private saveData: SaveData;
  private sound: SoundEngine;
  private scenicBg!: ScenicBackground;
  private board: BoardController | null = null;
  private renderer: CanvasRenderer | null = null;
  private currentLevel: LevelConfig = LEVELS[0];

  private paused = false;
  private gameOverShown = false;
  private armedTool: ArmedTool = 'none';
  private lastMovesAlerted = -1;
  private flyOrbs: FlyOrb[] = [];
  private rafId = 0;
  private lastTime = 0;

  // DOM references
  private mapScreen!: HTMLElement;
  private gameScreen!: HTMLElement;
  private vineScrollEl!: HTMLElement;
  private totalStarsEl!: HTMLElement;
  private mapCoinsEl!: HTMLElement;
  private endlessMetaEl!: HTMLElement;
  private muteBtnMap!: HTMLButtonElement;
  private muteBtnGame!: HTMLButtonElement;

  private hudTitleEl!: HTMLElement;
  private hudSubEl!: HTMLElement;
  private movesBoxEl!: HTMLElement;
  private movesNumEl!: HTMLElement;
  private goalsListEl!: HTMLElement;
  private scoreValEl!: HTMLElement;
  private starFillEl!: HTMLElement;
  private starMarkersEl!: HTMLElement;
  private bonusPillEl!: HTMLElement;
  private boardDimmerEl!: HTMLElement;
  private toolGuidePillEl!: HTMLElement;
  private toolGuideTextEl!: HTMLElement;
  private canvasEl!: HTMLCanvasElement;
  private trayCoinsEl!: HTMLElement;
  private flyLayerEl!: HTMLElement;

  private pauseModal!: HTMLElement;
  private guideModal!: HTMLElement;
  private resultModal!: HTMLElement;
  private resultTitleEl!: HTMLElement;
  private resultSubEl!: HTMLElement;
  private resultStarsEl!: HTMLElement;
  private resultScoreEl!: HTMLElement;
  private resultRewardEl!: HTMLElement;
  private nextLevelBtn!: HTMLButtonElement;
  private reviveBtn!: HTMLButtonElement;

  constructor(root: HTMLElement) {
    this.root = root;
    this.saveData = loadSaveData();
    this.sound = new SoundEngine(this.saveData.muted);
    this.renderShell();
    this.scenicBg = new ScenicBackground(this.root.querySelector('#scenic-bg')!);
    this.bindEvents();
    this.renderMapScreen();
    this.startLoop();
  }

  private renderShell(): void {
    this.root.innerHTML = `
      <canvas id="scenic-bg"></canvas>
      <div id="fly-layer" aria-hidden="true"></div>

      <!-- WINDING VINE ADVENTURE MAP SCREEN -->
      <section id="map-screen" class="screen">
        <header class="wood-panel map-header">
          <div class="map-top-row">
            <div>
              <h1 class="brand-title">梦幻消消乐</h1>
              <div class="brand-sub">奇幻藤蔓冒险</div>
            </div>
            <div style="display:flex;align-items:center;gap:6px;">
              <button id="guide-btn" class="icon-btn" title="玩法图鉴" aria-label="玩法图鉴">${UI_ICONS.help}</button>
              <button id="mute-btn-map" class="icon-btn" title="音效开关" aria-label="音效开关">${UI_ICONS.soundOn}</button>
            </div>
          </div>

          <div class="map-stats-row">
            <div class="stat-pills">
              <div id="total-stars-pill" class="resource-pill"></div>
              <div id="map-coins-pill" class="resource-pill"></div>
            </div>
            <button id="endless-btn" class="endless-pill-btn" type="button">
              ${UI_ICONS.endless}
              <span id="endless-meta">无尽星域</span>
            </button>
          </div>
        </header>

        <div id="vine-scroll" class="vine-scroll"></div>
      </section>

      <!-- GAMEPLAY SCREEN -->
      <section id="game-screen" class="screen hidden">
        <header class="wood-panel hud-top">
          <div class="hud-row-1">
            <div class="hud-left-controls">
              <button id="back-map-btn" class="icon-btn" title="返回地图" aria-label="返回地图">${UI_ICONS.map}</button>
              <button id="mute-btn-game" class="icon-btn" title="音效开关" aria-label="音效开关">${UI_ICONS.soundOn}</button>
              <button id="pause-btn" class="icon-btn" title="暂停" aria-label="暂停">${UI_ICONS.pause}</button>
            </div>
            <div class="hud-level-badge">
              <div id="hud-level-title" class="hud-level-title">第 1 关</div>
              <div id="hud-level-sub" class="hud-level-sub">萌宠森林</div>
            </div>
            <div id="moves-box" class="moves-box">
              <span id="moves-num" class="moves-num">16</span>
              <span class="moves-label">步</span>
            </div>
          </div>

          <div class="hud-row-2">
            <div id="goals-list" class="goals-list"></div>
            <div class="score-bar-wrap">
              <div class="score-text-row">
                <span>得分</span>
                <span id="score-val">0</span>
              </div>
              <div class="star-track">
                <div id="star-fill" class="star-fill"></div>
                <div id="star-markers"></div>
              </div>
            </div>
          </div>
        </header>

        <main class="board-stage">
          <div id="board-dimmer" class="board-dimmer hidden"></div>
          <div id="tool-guide-pill" class="tool-guide-pill hidden">
            <span id="tool-guide-text"></span>
            <button id="tool-cancel-btn" class="tool-cancel-btn" type="button">取消</button>
          </div>
          <canvas id="game-canvas"></canvas>
          <div id="bonus-pill" class="bonus-pill hidden">狂欢时刻 · 剩余步数全屏爆破</div>
        </main>

        <!-- POWER-UP TRAY -->
        <footer class="wood-panel powerup-tray">
          <div id="tray-coins" class="tray-coins"></div>
          <div class="powerup-btns">
            <button class="powerup-btn" data-tool="hammer" type="button" title="小木锤：点击敲碎任意一格或一层障碍">
              ${getPowerUpSvg('hammer', 24)}
              <span class="powerup-name">小木锤</span>
              <span id="badge-hammer" class="powerup-badge">2</span>
            </button>
            <button class="powerup-btn" data-tool="force_swap" type="button" title="强制交换：无视三连规则互换相邻两格">
              ${getPowerUpSvg('force_swap', 24)}
              <span class="powerup-name">强换</span>
              <span id="badge-force_swap" class="powerup-badge">1</span>
            </button>
            <button class="powerup-btn" data-tool="shuffle" type="button" title="全盘重排：旋风重新洗牌">
              ${getPowerUpSvg('shuffle', 24)}
              <span class="powerup-name">重排</span>
              <span id="badge-shuffle" class="powerup-badge">2</span>
            </button>
            <button class="powerup-btn" data-tool="extra_moves" type="button" title="增加5步">
              ${getPowerUpSvg('extra_moves', 24)}
              <span class="powerup-name">+5步</span>
              <span id="badge-extra_moves" class="powerup-badge">1</span>
            </button>
          </div>
        </footer>
      </section>

      <!-- PAUSE MODAL -->
      <div id="pause-modal" class="modal-backdrop hidden">
        <div class="modal-card">
          <h2 class="modal-title">冒险暂停</h2>
          <p class="modal-sub">稍作休息，随时准备继续奇幻消除</p>
          <div class="modal-actions">
            <button id="resume-btn" class="btn btn-green" type="button">继续游戏</button>
            <button id="pause-restart-btn" class="btn btn-primary" type="button">${UI_ICONS.replay} 重新开始</button>
            <button id="pause-map-btn" class="btn btn-wood" type="button">返回冒险地图</button>
          </div>
        </div>
      </div>

      <!-- GUIDE MODAL -->
      <div id="guide-modal" class="modal-backdrop hidden">
        <div class="modal-card">
          <h2 class="modal-title">奇幻冒险图鉴</h2>
          <div class="guide-list">
            <p><strong>4连直线</strong>：按交换方向生成横向或纵向激光特效</p>
            <p><strong>L / T 型交叉</strong>：生成 3×3 范围爆炸糖果</p>
            <p><strong>5连直排</strong>：生成深空魔力鸟，闪电连锁消除同色</p>
            <p><strong>特效两两互换（无需三连直接引爆）</strong>：直线+直线十字清屏；直线+爆炸3行3列巨型爆破；爆炸+爆炸5×5连续双爆；魔力鸟+特效全屏变身连环引爆；双魔力鸟全屏清场</p>
            <p><strong>障碍与收集</strong>：冰块需在上方消除破冰；木箱需邻格消除或特效击碎；绿色藤蔓牢笼可被同色消除或特效解除；金豆荚落至底部绿色箭头出口即可收集</p>
            <p><strong>四款强力道具</strong>：小木锤定点敲碎、强换无视规则、重排旋风洗牌、+5步续航</p>
          </div>
          <button id="close-guide-btn" class="btn btn-primary" type="button">准备出发</button>
        </div>
      </div>

      <!-- RESULT MODAL -->
      <div id="result-modal" class="modal-backdrop hidden">
        <div class="modal-card">
          <h2 id="result-title" class="modal-title">过关成功</h2>
          <p id="result-sub" class="modal-sub">干得漂亮！</p>
          <div id="result-stars" class="modal-stars"></div>
          <div id="result-score" class="modal-score">0</div>
          <div id="result-reward" class="modal-reward hidden"></div>
          <div class="modal-actions">
            <button id="revive-btn" class="btn btn-purple hidden" type="button"></button>
            <button id="next-level-btn" class="btn btn-green" type="button">下一关</button>
            <button id="retry-btn" class="btn btn-primary" type="button">再玩一次</button>
            <button id="result-map-btn" class="btn btn-wood" type="button">返回冒险地图</button>
          </div>
        </div>
      </div>
    `;

    this.mapScreen = this.root.querySelector('#map-screen')!;
    this.gameScreen = this.root.querySelector('#game-screen')!;
    this.vineScrollEl = this.root.querySelector('#vine-scroll')!;
    this.totalStarsEl = this.root.querySelector('#total-stars-pill')!;
    this.mapCoinsEl = this.root.querySelector('#map-coins-pill')!;
    this.endlessMetaEl = this.root.querySelector('#endless-meta')!;
    this.muteBtnMap = this.root.querySelector('#mute-btn-map')!;
    this.muteBtnGame = this.root.querySelector('#mute-btn-game')!;

    this.hudTitleEl = this.root.querySelector('#hud-level-title')!;
    this.hudSubEl = this.root.querySelector('#hud-level-sub')!;
    this.movesBoxEl = this.root.querySelector('#moves-box')!;
    this.movesNumEl = this.root.querySelector('#moves-num')!;
    this.goalsListEl = this.root.querySelector('#goals-list')!;
    this.scoreValEl = this.root.querySelector('#score-val')!;
    this.starFillEl = this.root.querySelector('#star-fill')!;
    this.starMarkersEl = this.root.querySelector('#star-markers')!;
    this.bonusPillEl = this.root.querySelector('#bonus-pill')!;
    this.boardDimmerEl = this.root.querySelector('#board-dimmer')!;
    this.toolGuidePillEl = this.root.querySelector('#tool-guide-pill')!;
    this.toolGuideTextEl = this.root.querySelector('#tool-guide-text')!;
    this.canvasEl = this.root.querySelector('#game-canvas')!;
    this.trayCoinsEl = this.root.querySelector('#tray-coins')!;
    this.flyLayerEl = this.root.querySelector('#fly-layer')!;

    this.pauseModal = this.root.querySelector('#pause-modal')!;
    this.guideModal = this.root.querySelector('#guide-modal')!;
    this.resultModal = this.root.querySelector('#result-modal')!;
    this.resultTitleEl = this.root.querySelector('#result-title')!;
    this.resultSubEl = this.root.querySelector('#result-sub')!;
    this.resultStarsEl = this.root.querySelector('#result-stars')!;
    this.resultScoreEl = this.root.querySelector('#result-score')!;
    this.resultRewardEl = this.root.querySelector('#result-reward')!;
    this.nextLevelBtn = this.root.querySelector('#next-level-btn')!;
    this.reviveBtn = this.root.querySelector('#revive-btn')!;

    this.syncMuteIcons();
  }

  private bindEvents(): void {
    const toggleMute = () => {
      const nextMuted = !this.sound.isMuted();
      this.sound.setMuted(nextMuted);
      this.saveData.muted = nextMuted;
      persistSaveData(this.saveData);
      this.syncMuteIcons();
    };

    this.muteBtnMap.addEventListener('click', toggleMute);
    this.muteBtnGame.addEventListener('click', toggleMute);

    this.root.querySelector('#guide-btn')!.addEventListener('click', () => {
      this.guideModal.classList.remove('hidden');
    });
    this.root.querySelector('#close-guide-btn')!.addEventListener('click', () => {
      this.guideModal.classList.add('hidden');
    });

    this.root.querySelector('#endless-btn')!.addEventListener('click', () => {
      this.sound.unlock();
      this.startLevel(ENDLESS_LEVEL.id);
    });

    this.root.querySelector('#back-map-btn')!.addEventListener('click', () => {
      this.returnToMap();
    });
    this.root.querySelector('#pause-btn')!.addEventListener('click', () => {
      this.paused = true;
      this.pauseModal.classList.remove('hidden');
    });
    this.root.querySelector('#resume-btn')!.addEventListener('click', () => {
      this.paused = false;
      this.pauseModal.classList.add('hidden');
    });
    this.root.querySelector('#pause-restart-btn')!.addEventListener('click', () => {
      this.pauseModal.classList.add('hidden');
      this.startLevel(this.currentLevel.id);
    });
    this.root.querySelector('#pause-map-btn')!.addEventListener('click', () => {
      this.pauseModal.classList.add('hidden');
      this.returnToMap();
    });

    this.root.querySelector('#tool-cancel-btn')!.addEventListener('click', () => {
      this.setArmedTool('none');
    });

    this.root.querySelectorAll('.powerup-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const tool = (btn as HTMLElement).dataset.tool as PowerUpType;
        this.handlePowerUpClick(tool);
      });
    });

    this.reviveBtn.addEventListener('click', () => {
      this.handleReviveClick();
    });

    this.nextLevelBtn.addEventListener('click', () => {
      this.resultModal.classList.add('hidden');
      const nextId = this.currentLevel.id + 1;
      if (LEVELS.some((l) => l.id === nextId)) {
        this.startLevel(nextId);
      } else {
        this.startLevel(ENDLESS_LEVEL.id);
      }
    });
    this.root.querySelector('#retry-btn')!.addEventListener('click', () => {
      this.resultModal.classList.add('hidden');
      this.startLevel(this.currentLevel.id);
    });
    this.root.querySelector('#result-map-btn')!.addEventListener('click', () => {
      this.resultModal.classList.add('hidden');
      this.returnToMap();
    });

    this.canvasEl.addEventListener('pointerdown', (e: PointerEvent) => {
      if (this.paused || !this.renderer) return;
      this.canvasEl.setPointerCapture(e.pointerId);
      this.renderer.handlePointerDown(e.clientX, e.clientY);
    });
    this.canvasEl.addEventListener('pointermove', (e: PointerEvent) => {
      if (this.paused || !this.renderer) return;
      this.renderer.handlePointerMove(e.clientX, e.clientY);
    });
    this.canvasEl.addEventListener('pointerup', () => {
      this.renderer?.handlePointerUp();
    });
    this.canvasEl.addEventListener('pointercancel', () => {
      this.renderer?.handlePointerUp();
    });

    window.addEventListener('resize', () => {
      this.scenicBg.resize();
      this.renderer?.resize();
    });
  }

  private syncMuteIcons(): void {
    const icon = this.sound.isMuted() ? UI_ICONS.soundOff : UI_ICONS.soundOn;
    this.muteBtnMap.innerHTML = icon;
    this.muteBtnGame.innerHTML = icon;
  }

  private renderMapScreen(): void {
    this.scenicBg.setBiome('forest');
    let totalStars = 0;
    for (const lvl of LEVELS) {
      totalStars += this.saveData.levels[lvl.id]?.stars ?? 0;
    }

    this.totalStarsEl.innerHTML = `${getStarSvg(true, 18)}<span>${totalStars} / ${LEVELS.length * 3}</span>`;
    this.mapCoinsEl.innerHTML = `${getCoinSvg(18)}<span>${this.saveData.coins}</span>`;
    this.endlessMetaEl.textContent =
      this.saveData.endlessBestScore > 0
        ? `无尽纪录 ${this.saveData.endlessBestScore}`
        : '无尽星域';

    renderVineMap(this.vineScrollEl, this.saveData, (levelId) => {
      this.sound.unlock();
      this.sound.playSelect();
      this.startLevel(levelId);
    });
  }

  public startLevel(levelId: number): void {
    this.currentLevel = getLevelById(levelId);
    this.scenicBg.setBiome(this.currentLevel.biome);
    this.paused = false;
    this.gameOverShown = false;
    this.lastMovesAlerted = -1;
    this.setArmedTool('none');
    this.clearFlyOrbs();

    this.pauseModal.classList.add('hidden');
    this.resultModal.classList.add('hidden');
    this.bonusPillEl.classList.add('hidden');

    this.mapScreen.classList.add('hidden');
    this.gameScreen.classList.remove('hidden');

    this.board = new BoardController(this.currentLevel);
    if (!this.renderer) {
      this.renderer = new CanvasRenderer(this.canvasEl, this.board, this.sound);
      this.renderer.onToolAction = (tool, pos, to) => this.executeArmedBoardTool(tool, pos, to);
      this.renderer.onFlyCollect = (payload) => this.spawnFlyOrb(payload);
    } else {
      this.renderer.setBoard(this.board);
    }

    this.renderStarMarkers();
    this.syncHud();
    this.syncPowerUpTray();
  }

  private returnToMap(): void {
    this.paused = false;
    this.board = null;
    this.setArmedTool('none');
    this.clearFlyOrbs();
    this.gameScreen.classList.add('hidden');
    this.mapScreen.classList.remove('hidden');
    this.renderMapScreen();
  }

  private canAffordTool(tool: PowerUpType): boolean {
    return this.saveData.powerUps[tool] > 0 || this.saveData.coins >= POWERUP_COSTS[tool];
  }

  private consumeToolResource(tool: PowerUpType): boolean {
    if (this.saveData.powerUps[tool] > 0) {
      this.saveData.powerUps[tool]--;
      persistSaveData(this.saveData);
      this.syncPowerUpTray();
      return true;
    }
    const cost = POWERUP_COSTS[tool];
    if (this.saveData.coins >= cost) {
      this.saveData.coins -= cost;
      persistSaveData(this.saveData);
      this.syncPowerUpTray();
      return true;
    }
    return false;
  }

  private setArmedTool(tool: ArmedTool): void {
    this.armedTool = tool;
    this.renderer?.setArmedTool(tool);
    const active = tool !== 'none';
    this.boardDimmerEl.classList.toggle('hidden', !active);
    this.toolGuidePillEl.classList.toggle('hidden', !active);

    if (tool === 'hammer') {
      this.toolGuideTextEl.textContent = '小木锤已就绪：点击任意格子敲碎障碍';
    } else if (tool === 'force_swap') {
      this.toolGuideTextEl.textContent = '强制交换已就绪：拖动或点击相邻两格互换';
    }

    this.root.querySelectorAll('.powerup-btn').forEach((el) => {
      el.classList.toggle('armed', (el as HTMLElement).dataset.tool === tool);
    });
  }

  private handlePowerUpClick(tool: PowerUpType): void {
    if (!this.board || this.board.state !== 'IDLE' || this.paused) return;
    this.sound.unlock();

    if (tool === 'hammer' || tool === 'force_swap') {
      if (this.armedTool === tool) {
        this.setArmedTool('none');
        return;
      }
      if (!this.canAffordTool(tool)) {
        this.sound.playRevert();
        return;
      }
      this.sound.playSelect();
      this.setArmedTool(tool);
      return;
    }

    if (!this.canAffordTool(tool)) {
      this.sound.playRevert();
      return;
    }

    if (tool === 'shuffle') {
      if (this.board.useShufflePowerUp()) {
        this.consumeToolResource('shuffle');
        this.setArmedTool('none');
      }
    } else if (tool === 'extra_moves') {
      if (this.board.useExtraMovesPowerUp(5)) {
        this.consumeToolResource('extra_moves');
        this.sound.playSpecialCreate();
        this.setArmedTool('none');
        this.syncHud();
      }
    }
  }

  private executeArmedBoardTool(
    tool: 'hammer' | 'force_swap',
    pos: { row: number; col: number },
    to?: { row: number; col: number },
  ): void {
    if (!this.board || this.board.state !== 'IDLE') return;
    if (!this.canAffordTool(tool)) {
      this.setArmedTool('none');
      return;
    }

    let ok = false;
    if (tool === 'hammer') {
      ok = this.board.useHammer(pos);
    } else if (tool === 'force_swap' && to) {
      ok = this.board.useForceSwap(pos, to);
    }

    if (ok) {
      this.consumeToolResource(tool);
      this.setArmedTool('none');
    } else {
      this.sound.playRevert();
    }
  }

  private handleReviveClick(): void {
    if (!this.board || this.board.state !== 'GAME_OVER' || this.board.won) return;
    if (!this.canAffordTool('extra_moves')) {
      this.sound.playRevert();
      return;
    }
    if (this.board.useExtraMovesPowerUp(5)) {
      this.consumeToolResource('extra_moves');
      this.gameOverShown = false;
      this.lastMovesAlerted = -1;
      this.resultModal.classList.add('hidden');
      this.sound.playSpecialCreate();
      this.syncHud();
    }
  }

  private syncPowerUpTray(): void {
    this.trayCoinsEl.innerHTML = `${getCoinSvg(18)}<span>${this.saveData.coins}</span>`;
    (['hammer', 'force_swap', 'shuffle', 'extra_moves'] as PowerUpType[]).forEach((tool) => {
      const badge = this.root.querySelector(`#badge-${tool}`) as HTMLElement;
      const count = this.saveData.powerUps[tool];
      if (count > 0) {
        badge.className = 'powerup-badge';
        badge.innerHTML = String(count);
      } else {
        badge.className = 'powerup-badge coin-price';
        badge.innerHTML = `${POWERUP_COSTS[tool]}`;
      }
    });
  }

  private renderStarMarkers(): void {
    const [, , s3] = this.currentLevel.starScores;
    this.starMarkersEl.innerHTML = this.currentLevel.starScores
      .map((val) => {
        const pct = Math.min(96, Math.max(8, (val / s3) * 100));
        return `<span class="star-marker" data-score="${val}" style="left:${pct}%;">${getStarSvg(false, 16)}</span>`;
      })
      .join('');
  }

  private syncHud(): void {
    if (!this.board) return;
    const snap = this.board.getSnapshot();

    if (this.currentLevel.isEndless) {
      this.hudTitleEl.textContent = `无尽星域 · 第 ${snap.endlessWave} 波`;
      this.hudSubEl.textContent = `下波目标：${snap.endlessTargetScore.toLocaleString()} 分`;
    } else {
      this.hudTitleEl.textContent = `第 ${this.currentLevel.id} 关 · ${this.currentLevel.name}`;
      this.hudSubEl.textContent = this.currentLevel.subtitle;
    }

    this.movesNumEl.textContent = String(snap.movesLeft);
    const lowMoves = snap.movesLeft > 0 && snap.movesLeft <= 5;
    this.movesBoxEl.classList.toggle('low', lowMoves);
    if (lowMoves && snap.movesLeft !== this.lastMovesAlerted && snap.state === 'IDLE') {
      this.lastMovesAlerted = snap.movesLeft;
      this.sound.playHeartbeat();
    }

    this.bonusPillEl.classList.toggle('hidden', snap.state !== 'BONUS_TIME');

    this.scoreValEl.textContent = snap.score.toLocaleString();
    const maxStarScore = this.currentLevel.starScores[2];
    const fillPct = Math.min(100, (snap.score / maxStarScore) * 100);
    this.starFillEl.style.width = `${fillPct}%`;

    this.starMarkersEl.querySelectorAll('.star-marker').forEach((el) => {
      const threshold = Number((el as HTMLElement).dataset.score || 0);
      const reached = snap.score >= threshold;
      el.innerHTML = getStarSvg(reached, 16);
    });

    this.goalsListEl.innerHTML = snap.goals
      .map((gp) => {
        const key =
          gp.goal.type === 'collect' ? `animal_${gp.goal.animal}` : gp.goal.type;
        const icon = getGoalIconSvg(gp.goal, 21);
        const label = gp.completed ? UI_ICONS.check : `${gp.current}/${gp.target}`;
        return `<div class="goal-chip ${gp.completed ? 'done' : ''}" data-goal-key="${key}">${icon}<span>${label}</span></div>`;
      })
      .join('');
  }

  private spawnFlyOrb(payload: FlyCollectPayload): void {
    const goalKey =
      payload.kind === 'animal' && payload.animal ? `animal_${payload.animal}` : payload.kind;
    const targetChip = this.goalsListEl.querySelector(
      `[data-goal-key="${goalKey}"]`,
    ) as HTMLElement | null;
    if (!targetChip) return;

    const targetRect = targetChip.getBoundingClientRect();
    const x1 = targetRect.left + targetRect.width * 0.35;
    const y1 = targetRect.top + targetRect.height * 0.5;
    const x0 = payload.clientX;
    const y0 = payload.clientY;
    const cx = (x0 + x1) / 2 + (x0 < x1 ? -40 : 40);
    const cy = Math.min(y0, y1) - 65;

    const el = document.createElement('div');
    el.className = 'fly-orb';
    if (payload.kind === 'animal' && payload.animal) {
      el.innerHTML = getAnimalSvg(payload.animal, 26);
    } else if (payload.kind === 'ice') {
      el.innerHTML = getGoalIconSvg({ type: 'ice', target: 1 }, 24);
    } else if (payload.kind === 'crate') {
      el.innerHTML = getGoalIconSvg({ type: 'crate', target: 1 }, 24);
    } else if (payload.kind === 'vine') {
      el.innerHTML = getGoalIconSvg({ type: 'vine', target: 1 }, 24);
    } else {
      el.innerHTML = getGoalIconSvg({ type: 'pod', target: 1 }, 26);
    }
    el.style.left = `${x0}px`;
    el.style.top = `${y0}px`;
    this.flyLayerEl.appendChild(el);

    this.flyOrbs.push({
      el,
      x0,
      y0,
      cx,
      cy,
      x1,
      y1,
      t: 0,
      dur: 0.48,
      goalKey,
    });
  }

  private updateFlyOrbs(dt: number): void {
    for (let i = this.flyOrbs.length - 1; i >= 0; i--) {
      const orb = this.flyOrbs[i];
      orb.t += dt / orb.dur;
      if (orb.t >= 1) {
        orb.el.remove();
        this.flyOrbs.splice(i, 1);
        this.sound.playFlyHit();
        const chip = this.goalsListEl.querySelector(
          `[data-goal-key="${orb.goalKey}"]`,
        ) as HTMLElement | null;
        if (chip) {
          chip.classList.add('pop');
          setTimeout(() => chip.classList.remove('pop'), 160);
        }
        continue;
      }
      const u = 1 - orb.t;
      const x = u * u * orb.x0 + 2 * u * orb.t * orb.cx + orb.t * orb.t * orb.x1;
      const y = u * u * orb.y0 + 2 * u * orb.t * orb.cy + orb.t * orb.t * orb.y1;
      const scale = 1 - orb.t * 0.25;
      orb.el.style.left = `${x}px`;
      orb.el.style.top = `${y}px`;
      orb.el.style.transform = `translate(-50%, -50%) scale(${scale})`;
    }
  }

  private clearFlyOrbs(): void {
    for (const orb of this.flyOrbs) orb.el.remove();
    this.flyOrbs = [];
  }

  private showGameOverModal(): void {
    if (!this.board || this.gameOverShown) return;
    this.gameOverShown = true;
    const snap = this.board.getSnapshot();

    const { next, earnedCoins } = recordLevelResult(
      this.saveData,
      this.currentLevel.id,
      snap.won,
      snap.score,
      snap.stars,
      snap.endlessWave,
    );
    this.saveData = next;
    this.syncPowerUpTray();

    this.reviveBtn.classList.add('hidden');
    this.resultRewardEl.classList.add('hidden');

    if (this.currentLevel.isEndless) {
      this.resultTitleEl.textContent = '星域探险结束';
      this.resultSubEl.textContent = `坚持到了第 ${snap.endlessWave} 波！`;
      this.nextLevelBtn.classList.add('hidden');
    } else if (snap.won) {
      this.resultTitleEl.textContent = '奇幻过关';
      this.resultSubEl.textContent =
        snap.stars === 3 ? '完美三星！森林伙伴为你欢呼！' : '成功达成全部关卡目标！';
      this.nextLevelBtn.classList.remove('hidden');
      this.nextLevelBtn.textContent =
        this.currentLevel.id < LEVELS.length ? '下一关' : '挑战无尽星域';
    } else {
      this.resultTitleEl.textContent = '步数用完啦';
      this.resultSubEl.textContent = '差一点点就能过关，要再加 5 步吗？';
      this.nextLevelBtn.classList.add('hidden');
      if (this.canAffordTool('extra_moves')) {
        this.reviveBtn.classList.remove('hidden');
        const hasTicket = this.saveData.powerUps.extra_moves > 0;
        this.reviveBtn.innerHTML = hasTicket
          ? `${getPowerUpSvg('extra_moves', 20)}<span>使用 +5 步券继续挑战</span>`
          : `${getCoinSvg(18)}<span>${POWERUP_COSTS.extra_moves} 金币续命 +5 步</span>`;
      }
    }

    if (earnedCoins > 0) {
      this.resultRewardEl.classList.remove('hidden');
      this.resultRewardEl.innerHTML = `${getCoinSvg(18)}<span>奖励 +${earnedCoins} 金币</span>`;
    }

    this.resultStarsEl.innerHTML = [1, 2, 3]
      .map((s) => getStarSvg((snap.won ? snap.stars : 0) >= s, 38))
      .join('');
    this.resultScoreEl.textContent = `${snap.score.toLocaleString()} 分`;
    this.resultModal.classList.remove('hidden');
  }

  private startLoop(): void {
    this.lastTime = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.05, Math.max(0.001, (now - this.lastTime) / 1000));
      this.lastTime = now;

      this.scenicBg.update(dt);
      this.scenicBg.render();
      this.updateFlyOrbs(dt);

      if (this.board && this.renderer && !this.paused) {
        this.board.update(dt);
        const events = this.board.drainEvents();
        if (events.length > 0) {
          this.renderer.processEvents(events);
          this.syncHud();
        }
        this.renderer.update(dt);
        this.renderer.render();

        if (this.board.state === 'GAME_OVER' && !this.gameOverShown) {
          setTimeout(() => this.showGameOverModal(), 480);
        }
      }

      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }

  public destroy(): void {
    cancelAnimationFrame(this.rafId);
  }
}
