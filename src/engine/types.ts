export type AnimalType = 'chick' | 'frog' | 'hippo' | 'fox' | 'owl' | 'bear';

export const ALL_ANIMALS: readonly AnimalType[] = [
  'chick',
  'frog',
  'hippo',
  'fox',
  'owl',
  'bear',
] as const;

export type SpecialType = 'none' | 'line_h' | 'line_v' | 'bomb' | 'magic_bird';

export type PowerUpType = 'hammer' | 'force_swap' | 'shuffle' | 'extra_moves';

export const POWERUP_COSTS: Record<PowerUpType, number> = {
  hammer: 80,
  force_swap: 100,
  shuffle: 60,
  extra_moves: 120,
};

export interface Pos {
  row: number;
  col: number;
}

export interface Tile {
  id: number;
  kind: 'animal' | 'pod';
  animal: AnimalType | null; // null for magic_bird or golden pod
  special: SpecialType;
}

export interface Cell {
  row: number;
  col: number;
  active: boolean;
  ice: 0 | 1 | 2;
  crate: 0 | 1 | 2;
  vine: boolean;
  podExit: boolean;
  tile: Tile | null;
}

export type GoalType = 'collect' | 'ice' | 'score' | 'crate' | 'pod' | 'vine';

export type LevelGoal =
  | { type: 'collect'; animal: AnimalType; target: number }
  | { type: 'ice'; target: number }
  | { type: 'crate'; target: number }
  | { type: 'pod'; target: number }
  | { type: 'vine'; target: number }
  | { type: 'score'; target: number };

export type BiomeType = 'forest' | 'glacier' | 'vine' | 'starry';

export interface LevelConfig {
  id: number;
  name: string;
  subtitle: string;
  biome: BiomeType;
  rows: number;
  cols: number;
  moves: number;
  animalsCount: number; // 4, 5, or 6
  starScores: [number, number, number];
  goals: LevelGoal[];
  layoutMask?: number[][]; // 1 = active, 0 = hole
  iceMap?: number[][]; // 0, 1, or 2
  crateMap?: number[][]; // 0, 1, or 2
  vineMap?: number[][]; // 0 or 1
  podSpawns?: Pos[]; // initial golden pod positions
  maxConcurrentPods?: number;
  isEndless?: boolean;
}

export type BoardState =
  | 'IDLE'
  | 'SWAPPING'
  | 'REVERTING'
  | 'RESOLVING'
  | 'FALLING'
  | 'REFILLING'
  | 'SHUFFLING'
  | 'BONUS_TIME'
  | 'GAME_OVER';

export type MatchShape = 'match3' | 'line' | 'bomb' | 'magic_bird';

export interface MatchGroup {
  positions: Pos[];
  animal: AnimalType;
  specialToCreate: SpecialType;
  spawnPos: Pos;
  shape: MatchShape;
}

export interface SwapContext {
  from: Pos;
  to: Pos;
  direction: 'horizontal' | 'vertical';
}

export interface ValidMove {
  from: Pos;
  to: Pos;
  priority: number;
  previewPositions: Pos[];
}

export type SpecialComboKind =
  | 'line_line'
  | 'line_bomb'
  | 'bomb_bomb'
  | 'bird_normal'
  | 'bird_line'
  | 'bird_bomb'
  | 'bird_bird';

export interface TileMoveAnim {
  tileId: number;
  fromRow: number;
  fromCol: number;
  toRow: number;
  toCol: number;
  isNewSpawn?: boolean;
}

export type BoardEvent =
  | { type: 'swap_start'; from: Pos; to: Pos; valid: boolean; forced?: boolean }
  | { type: 'swap_revert'; from: Pos; to: Pos }
  | {
      type: 'tiles_cleared';
      positions: Pos[];
      tiles: Array<{ pos: Pos; tile: Tile }>;
      cascade: number;
      points: number;
      comboText?: string;
    }
  | { type: 'special_created'; pos: Pos; special: SpecialType; animal: AnimalType | null }
  | {
      type: 'special_triggered';
      kind: 'line_h' | 'line_v' | 'bomb' | 'magic_bird';
      origin: Pos;
      affected: Pos[];
      targetColor?: AnimalType;
    }
  | {
      type: 'special_combo';
      combo: SpecialComboKind;
      origin: Pos;
      affected: Pos[];
      targetColor?: AnimalType;
      transformedPositions?: Pos[];
    }
  | { type: 'ice_damaged'; pos: Pos; remaining: 0 | 1 }
  | { type: 'crate_damaged'; pos: Pos; remaining: 0 | 1 }
  | { type: 'vine_broken'; pos: Pos }
  | { type: 'pod_collected'; pos: Pos; tile: Tile }
  | { type: 'tiles_moved'; moves: TileMoveAnim[] }
  | { type: 'board_shuffled'; moves: TileMoveAnim[] }
  | { type: 'powerup_hammer'; pos: Pos }
  | { type: 'powerup_extra_moves'; added: number }
  | { type: 'bonus_step'; pos: Pos; special: SpecialType; remainingMoves: number; bonusPoints: number }
  | { type: 'endless_wave_up'; wave: number; bonusMoves: number }
  | { type: 'game_over'; won: boolean; score: number; stars: 0 | 1 | 2 | 3 };

export interface GoalProgress {
  goal: LevelGoal;
  current: number;
  target: number;
  completed: boolean;
}

export interface BoardSnapshot {
  state: BoardState;
  rows: number;
  cols: number;
  grid: Cell[][];
  score: number;
  movesLeft: number;
  cascadeCount: number;
  stars: 0 | 1 | 2 | 3;
  goals: GoalProgress[];
  allGoalsCompleted: boolean;
  won: boolean;
  endlessWave: number;
  endlessTargetScore: number;
  hintMove: ValidMove | null;
}

export interface LevelProgressRecord {
  unlocked: boolean;
  bestScore: number;
  stars: 0 | 1 | 2 | 3;
}

export interface SaveData {
  levels: Record<number, LevelProgressRecord>;
  coins: number;
  powerUps: Record<PowerUpType, number>;
  endlessBestScore: number;
  endlessBestWave: number;
  muted: boolean;
}
