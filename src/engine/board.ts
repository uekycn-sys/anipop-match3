import {
  canSwapCells,
  findMatches,
  findValidMoves,
  hasInitialMatch,
  isDirectSpecialSwap,
  shuffleBoardTiles,
} from './matcher';
import {
  ALL_ANIMALS,
  AnimalType,
  BoardEvent,
  BoardSnapshot,
  BoardState,
  Cell,
  GoalProgress,
  LevelConfig,
  MatchGroup,
  Pos,
  SpecialComboKind,
  SpecialType,
  SwapContext,
  Tile,
  TileMoveAnim,
  ValidMove,
} from './types';

export interface BoardTimings {
  swap: number;
  revert: number;
  resolve: number;
  fall: number;
  refill: number;
  shuffle: number;
  bonusStep: number;
  staggerStep: number;
}

export const DEFAULT_TIMINGS: BoardTimings = {
  swap: 0.16,
  revert: 0.18,
  resolve: 0.23,
  fall: 0.22,
  refill: 0.18,
  shuffle: 0.45,
  bonusStep: 0.26,
  staggerStep: 0.075,
};

interface PendingSwap {
  from: Pos;
  to: Pos;
  direction: 'horizontal' | 'vertical';
  forced?: boolean;
}

interface StaggeredDetonation {
  pos: Pos;
  delay: number;
}

function posKey(r: number, c: number): string {
  return `${r},${c}`;
}

export class BoardController {
  public readonly config: LevelConfig;
  public readonly rows: number;
  public readonly cols: number;
  public grid: Cell[][] = [];
  public state: BoardState = 'IDLE';
  public score = 0;
  public movesLeft: number;
  public cascadeCount = 0;
  public won = false;
  public endlessWave = 1;
  public endlessTargetScore = 5000;

  private readonly rng: () => number;
  private readonly timings: BoardTimings;
  private readonly animals: AnimalType[];
  private nextTileId = 1;
  private phaseTimer = 0;
  private pendingSwap: PendingSwap | null = null;
  private lastSwapContext: SwapContext | null = null;
  private collectedCounts: Record<AnimalType, number> = {
    chick: 0,
    frog: 0,
    hippo: 0,
    fox: 0,
    owl: 0,
    bear: 0,
  };
  private initialIceTotal = 0;
  private initialCrateTotal = 0;
  private initialVineTotal = 0;
  private clearedVineCount = 0;
  private podGoalTarget = 0;
  private collectedPods = 0;

  private pendingSecondWaveBomb: Pos | null = null;
  private secondWaveTimer = 0;
  private staggeredDetonations: StaggeredDetonation[] = [];
  private bonusMoveActive = false;
  private cachedHint: ValidMove | null = null;
  private eventQueue: BoardEvent[] = [];

  constructor(
    config: LevelConfig,
    rng: () => number = Math.random,
    timings: Partial<BoardTimings> = {},
  ) {
    this.config = config;
    this.rows = config.rows;
    this.cols = config.cols;
    this.movesLeft = config.moves;
    this.rng = rng;
    this.timings = { ...DEFAULT_TIMINGS, ...timings };
    this.animals = ALL_ANIMALS.slice(0, Math.max(3, Math.min(6, config.animalsCount)));

    const podGoal = config.goals.find((g) => g.type === 'pod');
    this.podGoalTarget = podGoal ? podGoal.target : 0;

    if (config.isEndless) {
      this.endlessTargetScore = config.goals[0]?.type === 'score' ? config.goals[0].target : 5000;
    }
    this.initGrid();
  }

  public drainEvents(): BoardEvent[] {
    if (this.eventQueue.length === 0) return [];
    const out = this.eventQueue;
    this.eventQueue = [];
    return out;
  }

  private emit(ev: BoardEvent): void {
    this.eventQueue.push(ev);
  }

  private createTile(
    animal: AnimalType | null,
    special: SpecialType = 'none',
    kind: 'animal' | 'pod' = 'animal',
  ): Tile {
    if (kind === 'pod') {
      return { id: this.nextTileId++, kind: 'pod', animal: null, special: 'none' };
    }
    return {
      id: this.nextTileId++,
      kind: 'animal',
      animal: special === 'magic_bird' ? null : animal,
      special,
    };
  }

  private randomAnimal(): AnimalType {
    return this.animals[Math.floor(this.rng() * this.animals.length)];
  }

  private initGrid(): void {
    this.grid = [];
    this.initialIceTotal = 0;
    this.initialCrateTotal = 0;
    this.initialVineTotal = 0;

    for (let r = 0; r < this.rows; r++) {
      const rowCells: Cell[] = [];
      for (let c = 0; c < this.cols; c++) {
        const active = this.config.layoutMask ? this.config.layoutMask[r]?.[c] !== 0 : true;
        const rawIce = active ? (this.config.iceMap?.[r]?.[c] ?? 0) : 0;
        const rawCrate = active ? (this.config.crateMap?.[r]?.[c] ?? 0) : 0;
        const ice = (rawIce >= 2 ? 2 : rawIce === 1 ? 1 : 0) as 0 | 1 | 2;
        const crate = (rawCrate >= 2 ? 2 : rawCrate === 1 ? 1 : 0) as 0 | 1 | 2;
        const vine = active && crate === 0 ? Boolean(this.config.vineMap?.[r]?.[c]) : false;

        if (ice > 0) this.initialIceTotal += ice;
        if (crate > 0) this.initialCrateTotal += crate;
        if (vine) this.initialVineTotal++;

        rowCells.push({
          row: r,
          col: c,
          active,
          ice,
          crate,
          vine,
          podExit: false,
          tile: null,
        });
      }
      this.grid.push(rowCells);
    }

    // Mark bottom-most active cell of each column as podExit when level has pod goal
    if (this.podGoalTarget > 0) {
      for (let c = 0; c < this.cols; c++) {
        for (let r = this.rows - 1; r >= 0; r--) {
          if (this.grid[r][c].active) {
            this.grid[r][c].podExit = true;
            break;
          }
        }
      }
    }

    // Place initial golden pods if configured
    if (this.podGoalTarget > 0) {
      const spawns = this.config.podSpawns ?? [{ row: 0, col: Math.floor(this.cols / 2) }];
      for (const sp of spawns) {
        const cell = this.grid[sp.row]?.[sp.col];
        if (cell && cell.active && cell.crate === 0 && !cell.vine && !cell.podExit) {
          cell.tile = this.createTile(null, 'none', 'pod');
        }
      }
    }

    // Fill remaining active non-crate cells with non-matching animals
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const cell = this.grid[r][c];
        if (!cell.active || cell.crate > 0 || cell.tile !== null) continue;

        const forbidden = new Set<AnimalType>();
        if (
          c >= 2 &&
          this.grid[r][c - 1].tile?.animal &&
          this.grid[r][c - 2].tile?.animal === this.grid[r][c - 1].tile?.animal
        ) {
          forbidden.add(this.grid[r][c - 1].tile!.animal!);
        }
        if (
          r >= 2 &&
          this.grid[r - 1][c].tile?.animal &&
          this.grid[r - 2][c].tile?.animal === this.grid[r - 1][c].tile?.animal
        ) {
          forbidden.add(this.grid[r - 1][c].tile!.animal!);
        }

        const candidates = this.animals.filter((a) => !forbidden.has(a));
        const chosen =
          candidates.length > 0
            ? candidates[Math.floor(this.rng() * candidates.length)]
            : this.randomAnimal();
        cell.tile = this.createTile(chosen, 'none', 'animal');
      }
    }

    if (
      hasInitialMatch(this.grid, this.rows, this.cols) ||
      findValidMoves(this.grid, this.rows, this.cols).length === 0
    ) {
      shuffleBoardTiles(this.grid, this.rows, this.cols, this.rng);
    }

    this.refreshHint();
  }

  private refreshHint(): void {
    const moves = findValidMoves(this.grid, this.rows, this.cols);
    this.cachedHint = moves.length > 0 ? moves[0] : null;
  }

  public getHint(): ValidMove | null {
    return this.cachedHint;
  }

  public getStars(): 0 | 1 | 2 | 3 {
    const [s1, s2, s3] = this.config.starScores;
    if (this.score >= s3) return 3;
    if (this.score >= s2) return 2;
    if (this.score >= s1) return 1;
    return 0;
  }

  public getGoalsProgress(): GoalProgress[] {
    if (this.config.isEndless) {
      return [
        {
          goal: { type: 'score', target: this.endlessTargetScore },
          current: this.score,
          target: this.endlessTargetScore,
          completed: this.score >= this.endlessTargetScore,
        },
      ];
    }

    return this.config.goals.map((goal) => {
      if (goal.type === 'collect') {
        const cur = this.collectedCounts[goal.animal];
        return {
          goal,
          current: Math.min(cur, goal.target),
          target: goal.target,
          completed: cur >= goal.target,
        };
      }
      if (goal.type === 'ice') {
        const remaining = this.countRemainingIceLayers();
        const cleared = Math.max(0, this.initialIceTotal - remaining);
        const target = Math.min(goal.target, this.initialIceTotal);
        return {
          goal,
          current: Math.min(cleared, target),
          target,
          completed: remaining === 0 || cleared >= target,
        };
      }
      if (goal.type === 'crate') {
        const remaining = this.countRemainingCrateLayers();
        const cleared = Math.max(0, this.initialCrateTotal - remaining);
        const target = Math.min(goal.target, this.initialCrateTotal);
        return {
          goal,
          current: Math.min(cleared, target),
          target,
          completed: remaining === 0 || cleared >= target,
        };
      }
      if (goal.type === 'vine') {
        const remaining = this.countRemainingVines();
        const total = Math.max(this.initialVineTotal, this.clearedVineCount + remaining);
        const cleared = Math.max(0, total - remaining);
        const target = Math.min(goal.target, total);
        return {
          goal,
          current: Math.min(cleared, target),
          target,
          completed: remaining === 0 || cleared >= target,
        };
      }
      if (goal.type === 'pod') {
        return {
          goal,
          current: Math.min(this.collectedPods, goal.target),
          target: goal.target,
          completed: this.collectedPods >= goal.target,
        };
      }
      return {
        goal,
        current: Math.min(this.score, goal.target),
        target: goal.target,
        completed: this.score >= goal.target,
      };
    });
  }

  private countRemainingIceLayers(): number {
    let total = 0;
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) total += this.grid[r][c].ice;
    }
    return total;
  }

  private countRemainingCrateLayers(): number {
    let total = 0;
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) total += this.grid[r][c].crate;
    }
    return total;
  }

  private countRemainingVines(): number {
    let total = 0;
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) if (this.grid[r][c].vine) total++;
    }
    return total;
  }

  private countActivePodsOnBoard(): number {
    let total = 0;
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        if (this.grid[r][c].tile?.kind === 'pod') total++;
      }
    }
    return total;
  }

  public areAllGoalsCompleted(): boolean {
    if (this.config.isEndless) return false;
    return this.getGoalsProgress().every((g) => g.completed);
  }

  public getSnapshot(): BoardSnapshot {
    return {
      state: this.state,
      rows: this.rows,
      cols: this.cols,
      grid: this.grid,
      score: this.score,
      movesLeft: this.movesLeft,
      cascadeCount: this.cascadeCount,
      stars: this.getStars(),
      goals: this.getGoalsProgress(),
      allGoalsCompleted: this.areAllGoalsCompleted(),
      won: this.won,
      endlessWave: this.endlessWave,
      endlessTargetScore: this.endlessTargetScore,
      hintMove: this.cachedHint,
    };
  }

  public canSwap(from: Pos, to: Pos): boolean {
    if (this.state !== 'IDLE' || this.movesLeft <= 0) return false;
    const dr = Math.abs(from.row - to.row);
    const dc = Math.abs(from.col - to.col);
    if (dr + dc !== 1) return false;

    const a = this.grid[from.row]?.[from.col];
    const b = this.grid[to.row]?.[to.col];
    return canSwapCells(a, b);
  }

  public trySwap(from: Pos, to: Pos): boolean {
    if (!this.canSwap(from, to)) return false;

    const direction: 'horizontal' | 'vertical' =
      from.row === to.row ? 'horizontal' : 'vertical';
    const cellA = this.grid[from.row][from.col];
    const cellB = this.grid[to.row][to.col];

    const tmp = cellA.tile;
    cellA.tile = cellB.tile;
    cellB.tile = tmp;

    const specialPair = isDirectSpecialSwap(cellA.tile, cellB.tile);
    const matches = specialPair
      ? []
      : findMatches(this.grid, this.rows, this.cols, { from, to, direction });
    const valid = specialPair || matches.length > 0;

    this.pendingSwap = { from, to, direction, forced: false };
    this.lastSwapContext = { from, to, direction };
    this.cascadeCount = 0;
    this.state = 'SWAPPING';
    this.phaseTimer = this.timings.swap;
    this.emit({ type: 'swap_start', from, to, valid });
    return true;
  }

  // ==================== POWER-UPS ====================

  public useHammer(pos: Pos): boolean {
    if (this.state !== 'IDLE') return false;
    const cell = this.grid[pos.row]?.[pos.col];
    if (!cell || !cell.active) return false;
    if (cell.crate === 0 && !cell.vine && cell.ice === 0 && !cell.tile) return false;

    this.cascadeCount = 1;
    this.emit({ type: 'powerup_hammer', pos });

    if (cell.crate > 0) {
      this.damageCrateAt(pos);
      this.addScore(150, 1);
    } else if (cell.vine) {
      this.breakVineAt(pos);
      this.addScore(120, 1);
    } else if (cell.tile && cell.tile.kind === 'pod') {
      // Hammer on a golden pod protects it and breaks ice beneath if any, otherwise does nothing destructive
      if (cell.ice > 0) this.damageIceAt(pos);
      else return false;
    } else if (cell.tile) {
      const clearedMap = new Map<string, { pos: Pos; tile: Tile }>();
      const triggeredIds = new Set<number>();
      const cascadeQueue: Pos[] = [];
      this.clearCellTile(pos, clearedMap, triggeredIds, cascadeQueue);
      const clearedList = Array.from(clearedMap.values());
      const pts = this.addScore(clearedList.length * 40 + 80, 1);
      this.emit({
        type: 'tiles_cleared',
        positions: clearedList.map((x) => x.pos),
        tiles: clearedList,
        cascade: 1,
        points: pts,
      });
    } else if (cell.ice > 0) {
      this.damageIceAt(pos);
      this.addScore(100, 1);
    }

    this.state = 'RESOLVING';
    this.phaseTimer = this.timings.resolve;
    return true;
  }

  public useForceSwap(from: Pos, to: Pos): boolean {
    if (this.state !== 'IDLE') return false;
    const dr = Math.abs(from.row - to.row);
    const dc = Math.abs(from.col - to.col);
    if (dr + dc !== 1) return false;

    const cellA = this.grid[from.row]?.[from.col];
    const cellB = this.grid[to.row]?.[to.col];
    if (!canSwapCells(cellA, cellB)) return false;

    const tmp = cellA!.tile;
    cellA!.tile = cellB!.tile;
    cellB!.tile = tmp;

    const direction: 'horizontal' | 'vertical' =
      from.row === to.row ? 'horizontal' : 'vertical';
    this.pendingSwap = { from, to, direction, forced: true };
    this.lastSwapContext = { from, to, direction };
    this.cascadeCount = 0;
    this.state = 'SWAPPING';
    this.phaseTimer = this.timings.swap;
    this.emit({ type: 'swap_start', from, to, valid: true, forced: true });
    return true;
  }

  public useShufflePowerUp(): boolean {
    if (this.state !== 'IDLE') return false;
    const shuffleMoves = shuffleBoardTiles(this.grid, this.rows, this.cols, this.rng);
    this.emit({
      type: 'board_shuffled',
      moves: shuffleMoves.map((m) => ({
        tileId: m.tile.id,
        fromRow: m.from.row,
        fromCol: m.from.col,
        toRow: m.to.row,
        toCol: m.to.col,
      })),
    });
    this.state = 'SHUFFLING';
    this.phaseTimer = this.timings.shuffle;
    return true;
  }

  public useExtraMovesPowerUp(amount = 5): boolean {
    if (this.state !== 'IDLE' && !(this.state === 'GAME_OVER' && !this.won)) {
      return false;
    }
    this.movesLeft += amount;
    this.won = false;
    this.state = 'IDLE';
    this.refreshHint();
    this.emit({ type: 'powerup_extra_moves', added: amount });
    return true;
  }

  // ==================== STATE MACHINE ====================

  public update(dt: number): void {
    if (this.state === 'IDLE' || this.state === 'GAME_OVER') return;

    if (this.state === 'RESOLVING' && this.staggeredDetonations.length > 0) {
      let anyTriggered = false;
      const remaining: StaggeredDetonation[] = [];
      for (const item of this.staggeredDetonations) {
        item.delay -= dt;
        if (item.delay <= 0) {
          this.detonateCellSpecialOnly(item.pos);
          anyTriggered = true;
        } else {
          remaining.push(item);
        }
      }
      this.staggeredDetonations = remaining;
      if (anyTriggered && remaining.length === 0) {
        this.phaseTimer = Math.max(this.phaseTimer, 0.14);
      }
      if (remaining.length > 0) return;
    }

    if (this.state === 'RESOLVING' && this.pendingSecondWaveBomb) {
      this.secondWaveTimer -= dt;
      if (this.secondWaveTimer <= 0) {
        const origin = this.pendingSecondWaveBomb;
        this.pendingSecondWaveBomb = null;
        this.applyBombWave(origin, 2);
        this.phaseTimer = Math.max(this.phaseTimer, 0.16);
      } else {
        return;
      }
    }

    this.phaseTimer -= dt;
    if (this.phaseTimer > 0) return;

    switch (this.state) {
      case 'SWAPPING':
        this.onSwapComplete();
        break;
      case 'REVERTING':
        this.state = 'IDLE';
        this.pendingSwap = null;
        this.lastSwapContext = null;
        break;
      case 'RESOLVING':
        if (this.collectPodsAtExits()) {
          this.phaseTimer = 0.12;
        } else {
          this.beginFalling();
        }
        break;
      case 'FALLING':
        if (this.collectPodsAtExits()) {
          this.beginFalling();
        } else {
          this.beginRefilling();
        }
        break;
      case 'REFILLING':
        if (this.collectPodsAtExits()) {
          this.beginFalling();
        } else {
          this.checkCascadeOrSettle();
        }
        break;
      case 'SHUFFLING':
        this.state = 'IDLE';
        this.refreshHint();
        break;
      case 'BONUS_TIME':
        this.executeNextBonusStep();
        break;
    }
  }

  public fastForward(maxSteps = 400): void {
    let steps = 0;
    while (this.state !== 'IDLE' && this.state !== 'GAME_OVER' && steps < maxSteps) {
      this.update(0.1);
      steps++;
    }
  }

  private onSwapComplete(): void {
    const swap = this.pendingSwap;
    if (!swap) {
      this.state = 'IDLE';
      return;
    }

    const cellA = this.grid[swap.from.row][swap.from.col];
    const cellB = this.grid[swap.to.row][swap.to.col];
    const specialPair = isDirectSpecialSwap(cellA.tile, cellB.tile);

    if (specialPair) {
      if (!swap.forced) this.movesLeft = Math.max(0, this.movesLeft - 1);
      this.cascadeCount = 1;
      this.pendingSwap = null;
      this.resolveSpecialPair(swap.from, swap.to);
      return;
    }

    const matches = findMatches(this.grid, this.rows, this.cols, this.lastSwapContext);
    if (matches.length === 0) {
      if (swap.forced) {
        this.pendingSwap = null;
        this.lastSwapContext = null;
        if (this.collectPodsAtExits()) {
          this.beginFalling();
        } else {
          this.refreshHint();
          this.state = 'IDLE';
        }
        return;
      }

      const tmp = cellA.tile;
      cellA.tile = cellB.tile;
      cellB.tile = tmp;
      this.state = 'REVERTING';
      this.phaseTimer = this.timings.revert;
      this.emit({ type: 'swap_revert', from: swap.from, to: swap.to });
      return;
    }

    if (!swap.forced) this.movesLeft = Math.max(0, this.movesLeft - 1);
    this.pendingSwap = null;
    this.resolveMatches(matches);
  }

  private collectPodsAtExits(): boolean {
    if (this.podGoalTarget <= 0) return false;
    let collectedAny = false;
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const cell = this.grid[r][c];
        if (cell.active && cell.podExit && cell.tile?.kind === 'pod') {
          const tile = cell.tile;
          cell.tile = null;
          this.collectedPods++;
          this.addScore(500, Math.max(1, this.cascadeCount));
          this.emit({ type: 'pod_collected', pos: { row: r, col: c }, tile });
          collectedAny = true;
        }
      }
    }
    return collectedAny;
  }

  private inBounds(r: number, c: number): boolean {
    return r >= 0 && r < this.rows && c >= 0 && c < this.cols;
  }

  private addScore(basePoints: number, cascade: number): number {
    const mult = 1 + (Math.max(1, cascade) - 1) * 0.5;
    const pts = Math.round(basePoints * mult);
    this.score += pts;
    this.checkEndlessWaveProgress();
    return pts;
  }

  private checkEndlessWaveProgress(): void {
    if (!this.config.isEndless) return;
    while (this.score >= this.endlessTargetScore) {
      this.endlessWave++;
      const bonusMoves = 6;
      this.movesLeft += bonusMoves;
      this.endlessTargetScore += 4500 + this.endlessWave * 2200;
      this.emit({
        type: 'endless_wave_up',
        wave: this.endlessWave,
        bonusMoves,
      });
    }
  }

  private comboLabelForCascade(cascade: number): string | undefined {
    if (cascade === 2) return 'Good!';
    if (cascade === 3) return 'Great!';
    if (cascade === 4) return 'Amazing!';
    if (cascade >= 5) return 'Unbelievable!';
    return undefined;
  }

  private damageIceAt(pos: Pos): boolean {
    const cell = this.grid[pos.row]?.[pos.col];
    if (!cell || cell.ice <= 0) return false;
    cell.ice = (cell.ice - 1) as 0 | 1;
    this.emit({ type: 'ice_damaged', pos, remaining: cell.ice });
    return true;
  }

  private damageCrateAt(pos: Pos): boolean {
    const cell = this.grid[pos.row]?.[pos.col];
    if (!cell || cell.crate <= 0) return false;
    cell.crate = (cell.crate - 1) as 0 | 1;
    this.emit({ type: 'crate_damaged', pos, remaining: cell.crate });
    return true;
  }

  private breakVineAt(pos: Pos): boolean {
    const cell = this.grid[pos.row]?.[pos.col];
    if (!cell || !cell.vine) return false;
    cell.vine = false;
    this.clearedVineCount++;
    this.emit({ type: 'vine_broken', pos });
    return true;
  }

  private clearCellTile(
    pos: Pos,
    clearedMap: Map<string, { pos: Pos; tile: Tile }>,
    triggeredIds: Set<number>,
    cascadeQueue: Pos[],
    skipSpecialTriggerIds?: Set<number>,
  ): void {
    const cell = this.grid[pos.row]?.[pos.col];
    if (!cell || !cell.active || cell.crate > 0) return;

    // Vine cage absorbs one hit to free the animal underneath!
    if (cell.vine) {
      this.breakVineAt(pos);
      return;
    }

    const tile = cell.tile;
    if (tile && tile.kind === 'pod') {
      // Golden pods are indestructible by matches/specials
      return;
    }

    this.damageIceAt(pos);
    if (!tile) return;

    cell.tile = null;
    clearedMap.set(posKey(pos.row, pos.col), { pos, tile });
    if (tile.animal) {
      this.collectedCounts[tile.animal]++;
    }

    if (
      tile.special !== 'none' &&
      !triggeredIds.has(tile.id) &&
      !(skipSpecialTriggerIds && skipSpecialTriggerIds.has(tile.id))
    ) {
      triggeredIds.add(tile.id);
      cascadeQueue.push(pos);
      this.triggerDetachedSpecial(tile, pos, clearedMap, triggeredIds, cascadeQueue, skipSpecialTriggerIds);
    }
  }

  private triggerDetachedSpecial(
    tile: Tile,
    origin: Pos,
    clearedMap: Map<string, { pos: Pos; tile: Tile }>,
    triggeredIds: Set<number>,
    cascadeQueue: Pos[],
    skipSpecialTriggerIds?: Set<number>,
  ): void {
    const affected: Pos[] = [];

    if (tile.special === 'line_h') {
      for (let c = 0; c < this.cols; c++) {
        if (this.grid[origin.row][c].active) affected.push({ row: origin.row, col: c });
      }
      this.emit({ type: 'special_triggered', kind: 'line_h', origin, affected });
    } else if (tile.special === 'line_v') {
      for (let r = 0; r < this.rows; r++) {
        if (this.grid[r][origin.col].active) affected.push({ row: r, col: origin.col });
      }
      this.emit({ type: 'special_triggered', kind: 'line_v', origin, affected });
    } else if (tile.special === 'bomb') {
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const r = origin.row + dr;
          const c = origin.col + dc;
          if (this.inBounds(r, c) && this.grid[r][c].active) {
            affected.push({ row: r, col: c });
          }
        }
      }
      this.emit({ type: 'special_triggered', kind: 'bomb', origin, affected });
    } else if (tile.special === 'magic_bird') {
      const targetColor = this.pickMostCommonAnimal();
      if (targetColor) {
        for (let r = 0; r < this.rows; r++) {
          for (let c = 0; c < this.cols; c++) {
            const cell = this.grid[r][c];
            if (cell.active && cell.crate === 0 && cell.tile?.animal === targetColor) {
              affected.push({ row: r, col: c });
            }
          }
        }
      }
      this.emit({
        type: 'special_triggered',
        kind: 'magic_bird',
        origin,
        affected,
        targetColor: targetColor ?? undefined,
      });
    }

    for (const p of affected) {
      const targetCell = this.grid[p.row][p.col];
      if (targetCell.crate > 0) {
        this.damageCrateAt(p);
      } else {
        this.clearCellTile(p, clearedMap, triggeredIds, cascadeQueue, skipSpecialTriggerIds);
      }
    }
  }

  private pickMostCommonAnimal(): AnimalType | null {
    const counts = new Map<AnimalType, number>();
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const a = this.grid[r][c].tile?.animal;
        if (a) counts.set(a, (counts.get(a) ?? 0) + 1);
      }
    }
    let best: AnimalType | null = null;
    let bestCount = 0;
    for (const [a, count] of counts) {
      if (count > bestCount) {
        best = a;
        bestCount = count;
      }
    }
    return best;
  }

  private resolveMatches(groups: MatchGroup[]): void {
    this.cascadeCount++;
    const clearedMap = new Map<string, { pos: Pos; tile: Tile }>();
    const triggeredIds = new Set<number>();
    const cascadeQueue: Pos[] = [];

    const spawns: Array<{ pos: Pos; special: SpecialType; animal: AnimalType }> = [];
    const crateHitSet = new Set<string>();
    let specialCreationBonus = 0;

    for (const group of groups) {
      if (group.specialToCreate !== 'none') {
        spawns.push({
          pos: group.spawnPos,
          special: group.specialToCreate,
          animal: group.animal,
        });
        specialCreationBonus += group.specialToCreate === 'magic_bird' ? 250 : 100;
      }

      for (const pos of group.positions) {
        const neighbors = [
          [pos.row - 1, pos.col],
          [pos.row + 1, pos.col],
          [pos.row, pos.col - 1],
          [pos.row, pos.col + 1],
        ];
        for (const [nr, nc] of neighbors) {
          if (this.inBounds(nr, nc) && this.grid[nr][nc].crate > 0) {
            crateHitSet.add(posKey(nr, nc));
          }
        }
        this.clearCellTile(pos, clearedMap, triggeredIds, cascadeQueue);
      }
    }

    for (const k of crateHitSet) {
      const [r, c] = k.split(',').map(Number);
      this.damageCrateAt({ row: r, col: c });
    }

    for (const sp of spawns) {
      const cell = this.grid[sp.pos.row][sp.pos.col];
      if (cell.active && cell.crate === 0 && !cell.vine && cell.tile === null) {
        const newTile = this.createTile(sp.animal, sp.special, 'animal');
        cell.tile = newTile;
        this.emit({
          type: 'special_created',
          pos: sp.pos,
          special: sp.special,
          animal: newTile.animal,
        });
      }
    }

    const clearedList = Array.from(clearedMap.values());
    const basePoints = clearedList.length * 35 + specialCreationBonus;
    const points = this.addScore(basePoints, this.cascadeCount);

    this.emit({
      type: 'tiles_cleared',
      positions: clearedList.map((x) => x.pos),
      tiles: clearedList,
      cascade: this.cascadeCount,
      points,
      comboText: this.comboLabelForCascade(this.cascadeCount),
    });

    this.state = 'RESOLVING';
    this.phaseTimer = this.timings.resolve;
    this.lastSwapContext = null;
  }

  private resolveSpecialPair(from: Pos, to: Pos): void {
    const cellA = this.grid[from.row][from.col];
    const cellB = this.grid[to.row][to.col];
    const tileA = cellA.tile!;
    const tileB = cellB.tile!;
    const origin = to;

    const clearedMap = new Map<string, { pos: Pos; tile: Tile }>();
    const triggeredIds = new Set<number>([tileA.id, tileB.id]);
    const cascadeQueue: Pos[] = [];

    const sA = tileA.special;
    const sB = tileB.special;
    const isLine = (s: SpecialType) => s === 'line_h' || s === 'line_v';

    const consumeSwapped = () => {
      for (const p of [from, to]) {
        const cell = this.grid[p.row][p.col];
        const t = cell.tile;
        this.damageIceAt(p);
        if (t) {
          cell.tile = null;
          clearedMap.set(posKey(p.row, p.col), { pos: p, tile: t });
          if (t.animal) this.collectedCounts[t.animal]++;
        }
      }
    };

    // 6. Magic Bird + Magic Bird = Full Board Wipe
    if (sA === 'magic_bird' && sB === 'magic_bird') {
      consumeSwapped();
      const affected: Pos[] = [];
      for (let r = 0; r < this.rows; r++) {
        for (let c = 0; c < this.cols; c++) {
          const cell = this.grid[r][c];
          if (!cell.active) continue;
          const p = { row: r, col: c };
          affected.push(p);
          if (cell.crate > 0) {
            this.damageCrateAt(p);
          } else if (cell.vine) {
            this.breakVineAt(p);
          } else if (cell.tile?.kind !== 'pod') {
            this.damageIceAt(p);
            if (cell.tile) {
              const t = cell.tile;
              cell.tile = null;
              clearedMap.set(posKey(r, c), { pos: p, tile: t });
              if (t.animal) this.collectedCounts[t.animal]++;
            }
          }
        }
      }
      this.emit({ type: 'special_combo', combo: 'bird_bird', origin, affected });
      const pts = this.addScore(clearedMap.size * 55 + 800, 1);
      this.emit({
        type: 'tiles_cleared',
        positions: Array.from(clearedMap.values()).map((x) => x.pos),
        tiles: Array.from(clearedMap.values()),
        cascade: 1,
        points: pts,
        comboText: 'Unbelievable!',
      });
      this.state = 'RESOLVING';
      this.phaseTimer = this.timings.resolve + 0.15;
      return;
    }

    // 4 & 5. Magic Bird + (Normal | Line | Bomb)
    if (sA === 'magic_bird' || sB === 'magic_bird') {
      const birdPos = sA === 'magic_bird' ? from : to;
      const otherPos = sA === 'magic_bird' ? to : from;
      const otherTile = this.grid[otherPos.row][otherPos.col].tile!;
      const targetColor = otherTile.animal ?? this.pickMostCommonAnimal();

      // 5. Magic Bird + Line / Bomb
      if (otherTile.special !== 'none' && otherTile.special !== 'magic_bird' && targetColor) {
        const combo: SpecialComboKind = otherTile.special === 'bomb' ? 'bird_bomb' : 'bird_line';

        const birdCell = this.grid[birdPos.row][birdPos.col];
        const birdTile = birdCell.tile!;
        this.damageIceAt(birdPos);
        birdCell.tile = null;
        clearedMap.set(posKey(birdPos.row, birdPos.col), { pos: birdPos, tile: birdTile });

        const transformedPositions: Pos[] = [];
        let toggle = 0;
        for (let r = 0; r < this.rows; r++) {
          for (let c = 0; c < this.cols; c++) {
            const cell = this.grid[r][c];
            if (!cell.active || cell.crate > 0 || !cell.tile || cell.tile.kind === 'pod') continue;
            if (cell.tile.animal === targetColor || (r === otherPos.row && c === otherPos.col)) {
              const newSpec: SpecialType =
                otherTile.special === 'bomb' ? 'bomb' : toggle++ % 2 === 0 ? 'line_h' : 'line_v';
              cell.tile = {
                ...cell.tile,
                special: newSpec,
              };
              transformedPositions.push({ row: r, col: c });
            }
          }
        }

        this.emit({
          type: 'special_combo',
          combo,
          origin: birdPos,
          affected: transformedPositions,
          targetColor,
          transformedPositions,
        });

        this.staggeredDetonations = transformedPositions.map((p, idx) => ({
          pos: p,
          delay: 0.14 + idx * this.timings.staggerStep,
        }));

        const pts = this.addScore(400, 1);
        this.emit({
          type: 'tiles_cleared',
          positions: [birdPos],
          tiles: [{ pos: birdPos, tile: birdTile }],
          cascade: 1,
          points: pts,
          comboText: 'Amazing!',
        });

        this.state = 'RESOLVING';
        this.phaseTimer = this.timings.resolve;
        return;
      }

      // 4. Magic Bird + Normal Animal
      const affected: Pos[] = [];
      if (targetColor) {
        for (let r = 0; r < this.rows; r++) {
          for (let c = 0; c < this.cols; c++) {
            const cell = this.grid[r][c];
            if (cell.active && cell.crate === 0 && cell.tile?.animal === targetColor) {
              affected.push({ row: r, col: c });
            }
          }
        }
      }
      const birdCell = this.grid[birdPos.row][birdPos.col];
      const birdTile = birdCell.tile;
      this.damageIceAt(birdPos);
      if (birdTile) {
        birdCell.tile = null;
        clearedMap.set(posKey(birdPos.row, birdPos.col), { pos: birdPos, tile: birdTile });
      }
      this.emit({
        type: 'special_combo',
        combo: 'bird_normal',
        origin: birdPos,
        affected,
        targetColor: targetColor ?? undefined,
      });

      for (const p of affected) {
        this.clearCellTile(p, clearedMap, triggeredIds, cascadeQueue);
      }

      const clearedList = Array.from(clearedMap.values());
      const pts = this.addScore(clearedList.length * 45 + 300, 1);
      this.emit({
        type: 'tiles_cleared',
        positions: clearedList.map((x) => x.pos),
        tiles: clearedList,
        cascade: 1,
        points: pts,
        comboText: 'Great!',
      });
      this.state = 'RESOLVING';
      this.phaseTimer = this.timings.resolve + 0.08;
      return;
    }

    // 1. Line + Line
    if (isLine(sA) && isLine(sB)) {
      consumeSwapped();
      const affectedMap = new Map<string, Pos>();
      for (let c = 0; c < this.cols; c++) {
        if (this.grid[origin.row][c].active) affectedMap.set(posKey(origin.row, c), { row: origin.row, col: c });
      }
      for (let r = 0; r < this.rows; r++) {
        if (this.grid[r][origin.col].active) affectedMap.set(posKey(r, origin.col), { row: r, col: origin.col });
      }
      const affected = Array.from(affectedMap.values());
      this.emit({ type: 'special_combo', combo: 'line_line', origin, affected });
      for (const p of affected) {
        if (this.grid[p.row][p.col].crate > 0) this.damageCrateAt(p);
        else this.clearCellTile(p, clearedMap, triggeredIds, cascadeQueue);
      }
      const clearedList = Array.from(clearedMap.values());
      const pts = this.addScore(clearedList.length * 45 + 250, 1);
      this.emit({
        type: 'tiles_cleared',
        positions: clearedList.map((x) => x.pos),
        tiles: clearedList,
        cascade: 1,
        points: pts,
        comboText: 'Great!',
      });
      this.state = 'RESOLVING';
      this.phaseTimer = this.timings.resolve;
      return;
    }

    // 2. Line + Bomb
    if ((isLine(sA) && sB === 'bomb') || (sA === 'bomb' && isLine(sB))) {
      consumeSwapped();
      const affectedMap = new Map<string, Pos>();
      for (let dr = -1; dr <= 1; dr++) {
        const r = origin.row + dr;
        if (r < 0 || r >= this.rows) continue;
        for (let c = 0; c < this.cols; c++) {
          if (this.grid[r][c].active) affectedMap.set(posKey(r, c), { row: r, col: c });
        }
      }
      for (let dc = -1; dc <= 1; dc++) {
        const c = origin.col + dc;
        if (c < 0 || c >= this.cols) continue;
        for (let r = 0; r < this.rows; r++) {
          if (this.grid[r][c].active) affectedMap.set(posKey(r, c), { row: r, col: c });
        }
      }
      const affected = Array.from(affectedMap.values());
      this.emit({ type: 'special_combo', combo: 'line_bomb', origin, affected });
      for (const p of affected) {
        if (this.grid[p.row][p.col].crate > 0) this.damageCrateAt(p);
        else this.clearCellTile(p, clearedMap, triggeredIds, cascadeQueue);
      }
      const clearedList = Array.from(clearedMap.values());
      const pts = this.addScore(clearedList.length * 50 + 450, 1);
      this.emit({
        type: 'tiles_cleared',
        positions: clearedList.map((x) => x.pos),
        tiles: clearedList,
        cascade: 1,
        points: pts,
        comboText: 'Amazing!',
      });
      this.state = 'RESOLVING';
      this.phaseTimer = this.timings.resolve + 0.08;
      return;
    }

    // 3. Bomb + Bomb
    if (sA === 'bomb' && sB === 'bomb') {
      consumeSwapped();
      this.applyBombWave(origin, 1, clearedMap, triggeredIds, cascadeQueue);
      this.pendingSecondWaveBomb = origin;
      this.secondWaveTimer = 0.17;
      this.state = 'RESOLVING';
      this.phaseTimer = this.timings.resolve + 0.1;
      return;
    }
  }

  private applyBombWave(
    origin: Pos,
    wave: 1 | 2,
    existingCleared?: Map<string, { pos: Pos; tile: Tile }>,
    existingTriggered?: Set<number>,
    existingQueue?: Pos[],
  ): void {
    const clearedMap = existingCleared ?? new Map<string, { pos: Pos; tile: Tile }>();
    const triggeredIds = existingTriggered ?? new Set<number>();
    const cascadeQueue = existingQueue ?? [];

    const affected: Pos[] = [];
    for (let dr = -2; dr <= 2; dr++) {
      for (let dc = -2; dc <= 2; dc++) {
        const r = origin.row + dr;
        const c = origin.col + dc;
        if (this.inBounds(r, c) && this.grid[r][c].active) {
          affected.push({ row: r, col: c });
        }
      }
    }

    if (wave === 1) {
      this.emit({ type: 'special_combo', combo: 'bomb_bomb', origin, affected });
    } else {
      this.emit({ type: 'special_triggered', kind: 'bomb', origin, affected });
    }

    for (const p of affected) {
      if (this.grid[p.row][p.col].crate > 0) {
        this.damageCrateAt(p);
      } else {
        this.clearCellTile(p, clearedMap, triggeredIds, cascadeQueue);
      }
    }

    const clearedList = Array.from(clearedMap.values());
    const pts = this.addScore(clearedList.length * 45 + (wave === 1 ? 400 : 250), 1);
    this.emit({
      type: 'tiles_cleared',
      positions: clearedList.map((x) => x.pos),
      tiles: clearedList,
      cascade: wave === 1 ? 1 : 2,
      points: pts,
      comboText: wave === 1 ? 'Amazing!' : undefined,
    });
  }

  private detonateCellSpecialOnly(pos: Pos): void {
    const cell = this.grid[pos.row]?.[pos.col];
    if (!cell || !cell.active || cell.crate > 0 || !cell.tile) return;
    if (cell.tile.special === 'none') return;

    const clearedMap = new Map<string, { pos: Pos; tile: Tile }>();
    const triggeredIds = new Set<number>();
    const cascadeQueue: Pos[] = [];

    this.clearCellTile(pos, clearedMap, triggeredIds, cascadeQueue);
    const clearedList = Array.from(clearedMap.values());
    if (clearedList.length > 0) {
      const pts = this.addScore(clearedList.length * 40, 2);
      this.emit({
        type: 'tiles_cleared',
        positions: clearedList.map((x) => x.pos),
        tiles: clearedList,
        cascade: 2,
        points: pts,
      });
    }
  }

  /**
   * Straight-down gravity + diagonal slide around crates, inactive holes, and vine cages.
   */
  private applyGravityStep(): boolean {
    let anyMoved = false;

    // 1. Straight-down gravity within uninterrupted column segments
    for (let c = 0; c < this.cols; c++) {
      let writeRow = this.rows - 1;
      while (writeRow >= 0) {
        const dest = this.grid[writeRow][c];
        if (!dest.active || dest.crate > 0 || dest.vine || dest.tile !== null) {
          writeRow--;
          continue;
        }
        let readRow = writeRow - 1;
        let foundRow = -1;
        while (readRow >= 0) {
          const src = this.grid[readRow][c];
          if (!src.active || src.crate > 0 || src.vine) break;
          if (src.tile !== null) {
            foundRow = readRow;
            break;
          }
          readRow--;
        }
        if (foundRow !== -1) {
          dest.tile = this.grid[foundRow][c].tile;
          this.grid[foundRow][c].tile = null;
          anyMoved = true;
          writeRow--;
        } else {
          writeRow = readRow - 1;
        }
      }
    }

    // 2. Top-down diagonal slide into empty cells blocked directly above
    for (let r = 1; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const dest = this.grid[r][c];
        if (!dest.active || dest.crate > 0 || dest.vine || dest.tile !== null) continue;

        const above = this.grid[r - 1][c];
        const blockedAbove = !above.active || above.crate > 0 || above.vine;
        if (!blockedAbove) continue;

        const diagCols = (r + c) % 2 === 0 ? [c - 1, c + 1] : [c + 1, c - 1];
        for (const dc of diagCols) {
          if (dc < 0 || dc >= this.cols) continue;
          const src = this.grid[r - 1][dc];
          if (src.active && src.crate === 0 && !src.vine && src.tile !== null) {
            dest.tile = src.tile;
            src.tile = null;
            anyMoved = true;
            break;
          }
        }
      }
    }

    return anyMoved;
  }

  private beginFalling(): void {
    const moves: TileMoveAnim[] = [];
    const originMap = new Map<number, Pos>();
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const t = this.grid[r][c].tile;
        if (t) originMap.set(t.id, { row: r, col: c });
      }
    }

    let guard = 0;
    while (this.applyGravityStep() && guard < this.rows * 3) {
      guard++;
    }

    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const t = this.grid[r][c].tile;
        if (!t) continue;
        const orig = originMap.get(t.id);
        if (orig && (orig.row !== r || orig.col !== c)) {
          moves.push({
            tileId: t.id,
            fromRow: orig.row,
            fromCol: orig.col,
            toRow: r,
            toCol: c,
            isNewSpawn: false,
          });
        }
      }
    }

    if (moves.length > 0) {
      this.emit({ type: 'tiles_moved', moves });
      this.state = 'FALLING';
      this.phaseTimer = this.timings.fall;
    } else {
      this.beginRefilling();
    }
  }

  private beginRefilling(): void {
    const spawnMoves: TileMoveAnim[] = [];
    const maxPods = this.config.maxConcurrentPods ?? 2;

    let spawnedAny = true;
    let pass = 0;
    while (spawnedAny && pass < this.rows * 2) {
      spawnedAny = false;
      pass++;

      for (let c = 0; c < this.cols; c++) {
        const emptyRows: number[] = [];
        let topActiveRow = -1;
        for (let r = 0; r < this.rows; r++) {
          const cell = this.grid[r][c];
          if (!cell.active) {
            if (topActiveRow !== -1) break;
            continue;
          }
          if (topActiveRow === -1) topActiveRow = r;
          if (cell.crate > 0 || cell.vine || cell.tile !== null) break;
          emptyRows.push(r);
        }

        const count = emptyRows.length;
        for (let i = 0; i < count; i++) {
          const targetRow = emptyRows[i];
          const podsNeeded = this.podGoalTarget - (this.collectedPods + this.countActivePodsOnBoard());
          const spawnPod =
            podsNeeded > 0 &&
            this.countActivePodsOnBoard() < maxPods &&
            !this.grid[targetRow][c].podExit &&
            i === 0 &&
            this.rng() < 0.35;

          const tile = spawnPod
            ? this.createTile(null, 'none', 'pod')
            : this.createTile(this.randomAnimal(), 'none', 'animal');
          this.grid[targetRow][c].tile = tile;
          spawnMoves.push({
            tileId: tile.id,
            fromRow: topActiveRow - (count - i),
            fromCol: c,
            toRow: targetRow,
            toCol: c,
            isNewSpawn: true,
          });
          spawnedAny = true;
        }
      }

      // Apply gravity + diagonal slide so newly spawned tiles cascade into pockets below crates/vines
      const prevPos = new Map<number, Pos>();
      for (let r = 0; r < this.rows; r++) {
        for (let c = 0; c < this.cols; c++) {
          const t = this.grid[r][c].tile;
          if (t) prevPos.set(t.id, { row: r, col: c });
        }
      }

      let gravGuard = 0;
      while (this.applyGravityStep() && gravGuard < this.rows * 2) {
        gravGuard++;
      }

      for (let r = 0; r < this.rows; r++) {
        for (let c = 0; c < this.cols; c++) {
          const t = this.grid[r][c].tile;
          if (!t) continue;
          const existing = spawnMoves.find((m) => m.tileId === t.id);
          if (existing) {
            existing.toRow = r;
            existing.toCol = c;
          } else {
            const old = prevPos.get(t.id);
            if (old && (old.row !== r || old.col !== c)) {
              spawnMoves.push({
                tileId: t.id,
                fromRow: old.row,
                fromCol: old.col,
                toRow: r,
                toCol: c,
                isNewSpawn: false,
              });
            }
          }
        }
      }
    }

    if (spawnMoves.length > 0) {
      this.emit({ type: 'tiles_moved', moves: spawnMoves });
      this.state = 'REFILLING';
      this.phaseTimer = this.timings.refill;
    } else {
      this.checkCascadeOrSettle();
    }
  }

  private checkCascadeOrSettle(): void {
    const matches = findMatches(this.grid, this.rows, this.cols, null);
    if (matches.length > 0) {
      this.resolveMatches(matches);
      return;
    }

    if (this.bonusMoveActive) {
      this.bonusMoveActive = false;
      if (this.movesLeft > 0) {
        this.state = 'BONUS_TIME';
        this.phaseTimer = this.timings.bonusStep;
      } else {
        this.finishGame(true);
      }
      return;
    }

    if (!this.config.isEndless && this.areAllGoalsCompleted()) {
      if (this.movesLeft > 0) {
        this.state = 'BONUS_TIME';
        this.phaseTimer = 0.25;
      } else {
        this.finishGame(true);
      }
      return;
    }

    if (this.movesLeft <= 0) {
      this.finishGame(this.config.isEndless ? true : false);
      return;
    }

    const validMoves = findValidMoves(this.grid, this.rows, this.cols);
    if (validMoves.length === 0) {
      const shuffleMoves = shuffleBoardTiles(this.grid, this.rows, this.cols, this.rng);
      this.emit({
        type: 'board_shuffled',
        moves: shuffleMoves.map((m) => ({
          tileId: m.tile.id,
          fromRow: m.from.row,
          fromCol: m.from.col,
          toRow: m.to.row,
          toCol: m.to.col,
        })),
      });
      this.state = 'SHUFFLING';
      this.phaseTimer = this.timings.shuffle;
      return;
    }

    this.cachedHint = validMoves[0];
    this.cascadeCount = 0;
    this.state = 'IDLE';
  }

  private executeNextBonusStep(): void {
    if (this.movesLeft <= 0) {
      this.finishGame(true);
      return;
    }

    this.movesLeft--;
    const bonusPoints = 500;
    this.score += bonusPoints;

    const candidates: Pos[] = [];
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const cell = this.grid[r][c];
        if (
          cell.active &&
          cell.crate === 0 &&
          !cell.vine &&
          cell.tile &&
          cell.tile.kind === 'animal' &&
          cell.tile.special === 'none'
        ) {
          candidates.push({ row: r, col: c });
        }
      }
    }

    if (candidates.length === 0) {
      this.emit({
        type: 'bonus_step',
        pos: { row: Math.floor(this.rows / 2), col: Math.floor(this.cols / 2) },
        special: 'bomb',
        remainingMoves: this.movesLeft,
        bonusPoints,
      });
      this.phaseTimer = this.timings.bonusStep;
      return;
    }

    const chosen = candidates[Math.floor(this.rng() * candidates.length)];
    const specs: SpecialType[] = ['line_h', 'line_v', 'bomb'];
    const special = specs[Math.floor(this.rng() * specs.length)];
    const cell = this.grid[chosen.row][chosen.col];
    cell.tile = {
      ...cell.tile!,
      special,
    };

    this.emit({
      type: 'bonus_step',
      pos: chosen,
      special,
      remainingMoves: this.movesLeft,
      bonusPoints,
    });

    this.bonusMoveActive = true;
    this.detonateCellSpecialOnly(chosen);
    this.state = 'RESOLVING';
    this.phaseTimer = this.timings.resolve;
  }

  private finishGame(won: boolean): void {
    this.won = won;
    this.state = 'GAME_OVER';
    this.emit({
      type: 'game_over',
      won,
      score: this.score,
      stars: this.getStars(),
    });
  }
}
