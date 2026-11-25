import { describe, expect, it } from 'vitest';
import { BoardController } from '../board';
import { ENDLESS_LEVEL, LEVELS } from '../levels';
import { findMatches, findValidMoves, hasInitialMatch, shuffleBoardTiles } from '../matcher';
import { AnimalType, Cell, LevelConfig } from '../types';

function makeGrid(pattern: AnimalType[][], ice?: number[][], crate?: number[][]): Cell[][] {
  let id = 1;
  return pattern.map((row, r) =>
    row.map((animal, c) => {
      const cr = (crate?.[r]?.[c] ?? 0) as 0 | 1 | 2;
      const ic = (ice?.[r]?.[c] ?? 0) as 0 | 1 | 2;
      return {
        row: r,
        col: c,
        active: true,
        ice: ic,
        crate: cr,
        vine: false,
        podExit: false,
        tile: cr > 0 ? null : { id: id++, kind: 'animal', animal, special: 'none' },
      };
    }),
  );
}

function createSeededRng(seed = 42): () => number {
  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function makeTestBoard(rows = 6, cols = 6, overrides: Partial<LevelConfig> = {}): BoardController {
  const cfg: LevelConfig = {
    id: 1,
    name: 'Test',
    subtitle: 'Test',
    biome: 'forest',
    rows,
    cols,
    moves: 20,
    animalsCount: 6,
    starScores: [500, 1000, 2000],
    goals: [{ type: 'score', target: 999999 }],
    ...overrides,
  };
  return new BoardController(cfg, createSeededRng(12345), {
    swap: 0.05,
    revert: 0.05,
    resolve: 0.05,
    fall: 0.05,
    refill: 0.05,
    shuffle: 0.05,
    bonusStep: 0.05,
    staggerStep: 0.02,
  });
}

function fillBoardDeterministic(board: BoardController): void {
  const cycle: AnimalType[] = ['chick', 'frog', 'hippo', 'fox', 'owl', 'bear'];
  let id = 1000;
  for (let r = 0; r < board.rows; r++) {
    for (let c = 0; c < board.cols; c++) {
      const cell = board.grid[r][c];
      cell.active = true;
      cell.crate = 0;
      cell.ice = 0;
      cell.vine = false;
      const animal = cycle[(r * 2 + c) % cycle.length];
      cell.tile = { id: id++, kind: 'animal', animal, special: 'none' };
    }
  }
}

describe('Matcher shape recognition & priority', () => {
  it('detects 3-match as normal match without special', () => {
    const grid = makeGrid([
      ['chick', 'chick', 'chick', 'frog', 'hippo'],
      ['frog', 'hippo', 'fox', 'owl', 'bear'],
      ['hippo', 'fox', 'owl', 'bear', 'chick'],
    ]);
    const matches = findMatches(grid, 3, 5);
    expect(matches).toHaveLength(1);
    expect(matches[0].positions).toHaveLength(3);
    expect(matches[0].specialToCreate).toBe('none');
  });

  it('detects 4-match as line_h or line_v respecting swap direction', () => {
    const grid = makeGrid([
      ['fox', 'fox', 'fox', 'fox', 'owl'],
      ['frog', 'hippo', 'chick', 'bear', 'chick'],
      ['hippo', 'chick', 'bear', 'owl', 'frog'],
    ]);
    const hMatches = findMatches(grid, 3, 5, {
      from: { row: 1, col: 2 },
      to: { row: 0, col: 2 },
      direction: 'vertical',
    });
    expect(hMatches).toHaveLength(1);
    expect(hMatches[0].specialToCreate).toBe('line_v');

    const hMatchesHorizSwap = findMatches(grid, 3, 5, {
      from: { row: 0, col: 0 },
      to: { row: 0, col: 1 },
      direction: 'horizontal',
    });
    expect(hMatchesHorizSwap[0].specialToCreate).toBe('line_h');
  });

  it('detects L and T intersections as bomb', () => {
    const grid = makeGrid([
      ['owl', 'owl', 'owl', 'frog', 'hippo'],
      ['frog', 'owl', 'hippo', 'fox', 'bear'],
      ['hippo', 'owl', 'fox', 'bear', 'chick'],
      ['fox', 'bear', 'chick', 'frog', 'hippo'],
    ]);
    const matches = findMatches(grid, 4, 5);
    expect(matches).toHaveLength(1);
    expect(matches[0].shape).toBe('bomb');
    expect(matches[0].specialToCreate).toBe('bomb');
    expect(matches[0].positions).toHaveLength(5);
  });

  it('prioritizes 5-in-a-row magic_bird over L/T bomb when combined', () => {
    const grid = makeGrid([
      ['bear', 'bear', 'bear', 'bear', 'bear'],
      ['frog', 'hippo', 'bear', 'fox', 'owl'],
      ['hippo', 'fox', 'bear', 'owl', 'chick'],
    ]);
    const matches = findMatches(grid, 3, 5);
    expect(matches).toHaveLength(1);
    expect(matches[0].shape).toBe('magic_bird');
    expect(matches[0].specialToCreate).toBe('magic_bird');
    expect(matches[0].positions).toHaveLength(7);
  });
});

describe('All 6 Special Combo Swaps', () => {
  it('1. line + line clears entire row and column (cross clear)', () => {
    const board = makeTestBoard(6, 6);
    fillBoardDeterministic(board);
    board.grid[2][2].tile = { id: 901, kind: 'animal', animal: 'chick', special: 'line_h' };
    board.grid[2][3].tile = { id: 902, kind: 'animal', animal: 'frog', special: 'line_v' };

    expect(board.trySwap({ row: 2, col: 2 }, { row: 2, col: 3 })).toBe(true);
    board.fastForward();

    const events = board.drainEvents();
    const comboEv = events.find((e) => e.type === 'special_combo' && e.combo === 'line_line');
    expect(comboEv).toBeDefined();
    if (comboEv && comboEv.type === 'special_combo') {
      expect(comboEv.affected).toHaveLength(11);
    }
    expect(board.state).toBe('IDLE');
  });

  it('2. line + bomb clears 3 rows x 3 columns mega cross', () => {
    const board = makeTestBoard(6, 6);
    fillBoardDeterministic(board);
    board.grid[2][2].tile = { id: 903, kind: 'animal', animal: 'chick', special: 'line_h' };
    board.grid[2][3].tile = { id: 904, kind: 'animal', animal: 'hippo', special: 'bomb' };

    expect(board.trySwap({ row: 2, col: 2 }, { row: 2, col: 3 })).toBe(true);
    board.fastForward();

    const events = board.drainEvents();
    const comboEv = events.find((e) => e.type === 'special_combo' && e.combo === 'line_bomb');
    expect(comboEv).toBeDefined();
    if (comboEv && comboEv.type === 'special_combo') {
      expect(comboEv.affected).toHaveLength(27);
    }
  });

  it('3. bomb + bomb triggers 5x5 double blast shattering 2-layer ice', () => {
    const board = makeTestBoard(6, 6);
    fillBoardDeterministic(board);
    board.grid[2][2].tile = { id: 905, kind: 'animal', animal: 'fox', special: 'bomb' };
    board.grid[2][3].tile = { id: 906, kind: 'animal', animal: 'owl', special: 'bomb' };
    board.grid[1][2].ice = 2;
    board.grid[4][5].ice = 2;

    expect(board.trySwap({ row: 2, col: 2 }, { row: 2, col: 3 })).toBe(true);
    board.fastForward();

    const events = board.drainEvents();
    const comboEv = events.find((e) => e.type === 'special_combo' && e.combo === 'bomb_bomb');
    expect(comboEv).toBeDefined();
    expect(board.grid[1][2].ice).toBe(0);
    expect(board.grid[4][5].ice).toBe(0);
  });

  it('4. magic_bird + normal clears all tiles of that color', () => {
    const board = makeTestBoard(6, 6);
    fillBoardDeterministic(board);
    board.grid[2][2].tile = { id: 907, kind: 'animal', animal: null, special: 'magic_bird' };
    board.grid[2][3].tile = { id: 908, kind: 'animal', animal: 'chick', special: 'none' };

    let expectedChicks = 0;
    for (let r = 0; r < 6; r++) {
      for (let c = 0; c < 6; c++) {
        if (board.grid[r][c].tile?.animal === 'chick') expectedChicks++;
      }
    }

    expect(board.trySwap({ row: 2, col: 2 }, { row: 2, col: 3 })).toBe(true);
    board.fastForward();

    const events = board.drainEvents();
    const comboEv = events.find((e) => e.type === 'special_combo' && e.combo === 'bird_normal');
    expect(comboEv).toBeDefined();
    if (comboEv && comboEv.type === 'special_combo') {
      expect(comboEv.targetColor).toBe('chick');
      expect(comboEv.affected).toHaveLength(expectedChicks);
    }
  });

  it('5. magic_bird + line/bomb converts all matching color tiles and detonates them', () => {
    const board = makeTestBoard(6, 6);
    fillBoardDeterministic(board);
    board.grid[2][2].tile = { id: 909, kind: 'animal', animal: null, special: 'magic_bird' };
    board.grid[2][3].tile = { id: 910, kind: 'animal', animal: 'frog', special: 'bomb' };

    expect(board.trySwap({ row: 2, col: 2 }, { row: 2, col: 3 })).toBe(true);
    board.fastForward();

    const events = board.drainEvents();
    const comboEv = events.find((e) => e.type === 'special_combo' && e.combo === 'bird_bomb');
    expect(comboEv).toBeDefined();
    if (comboEv && comboEv.type === 'special_combo') {
      expect(comboEv.transformedPositions!.length).toBeGreaterThanOrEqual(4);
    }
    const detonations = events.filter(
      (e) => e.type === 'special_triggered' && e.kind === 'bomb',
    );
    expect(detonations.length).toBeGreaterThanOrEqual(1);
    expect(board.state).toBe('IDLE');
  });

  it('6. magic_bird + magic_bird clears entire board and damages all ice layers', () => {
    const board = makeTestBoard(5, 5);
    fillBoardDeterministic(board);
    board.grid[2][1].tile = { id: 911, kind: 'animal', animal: null, special: 'magic_bird' };
    board.grid[2][2].tile = { id: 912, kind: 'animal', animal: null, special: 'magic_bird' };
    board.grid[0][0].ice = 2;
    board.grid[4][4].ice = 1;

    expect(board.trySwap({ row: 2, col: 1 }, { row: 2, col: 2 })).toBe(true);
    board.fastForward();

    const events = board.drainEvents();
    const comboEv = events.find((e) => e.type === 'special_combo' && e.combo === 'bird_bird');
    expect(comboEv).toBeDefined();
    if (comboEv && comboEv.type === 'special_combo') {
      expect(comboEv.affected).toHaveLength(25);
    }
    expect(board.grid[0][0].ice).toBe(1);
    expect(board.grid[4][4].ice).toBe(0);
  });
});

describe('Diagonal Slide, Vine Cages, Golden Pods, Power-Ups, and Deadlocks', () => {
  it('initializes all 12 levels + Endless with no initial match and at least one valid move', () => {
    for (const lvl of [...LEVELS, ENDLESS_LEVEL]) {
      const b = new BoardController(lvl);
      expect(hasInitialMatch(b.grid, b.rows, b.cols)).toBe(false);
      expect(findValidMoves(b.grid, b.rows, b.cols).length).toBeGreaterThan(0);
    }
  });

  it('slides tiles diagonally underneath a crate or vine blocker to fill empty pockets', () => {
    const board = makeTestBoard(5, 5);
    fillBoardDeterministic(board);
    // Crate blocks straight-down fall into (2,2) and (3,2)
    board.grid[1][2].crate = 1;
    board.grid[1][2].tile = null;

    // Clear (2,2) and (3,2) via hammer on (2,2) and manually clearing (3,2)
    board.grid[3][2].tile = null;
    expect(board.useHammer({ row: 2, col: 2 })).toBe(true);
    board.fastForward();

    // After diagonal slide + refill, ALL active non-crate cells below the crate must be filled!
    expect(board.grid[2][2].tile).not.toBeNull();
    expect(board.grid[3][2].tile).not.toBeNull();
    expect(board.grid[4][2].tile).not.toBeNull();
  });

  it('prevents swapping vine-caged tiles, and breaks vine while keeping animal on match', () => {
    const board = makeTestBoard(5, 5, { goals: [{ type: 'vine', target: 1 }] });
    fillBoardDeterministic(board);

    // Put a vine at (0,3) on a 'chick' tile, and set up swap (0,1)<->(1,1) to match (0,1),(0,2),(0,3)
    board.grid[0][1].tile = { id: 4001, kind: 'animal', animal: 'frog', special: 'none' };
    board.grid[1][1].tile = { id: 4002, kind: 'animal', animal: 'chick', special: 'none' };
    board.grid[0][2].tile = { id: 4003, kind: 'animal', animal: 'chick', special: 'none' };
    board.grid[0][3].tile = { id: 4004, kind: 'animal', animal: 'chick', special: 'none' };
    board.grid[0][3].vine = true;

    // Direct swap on vine cell is forbidden
    expect(board.canSwap({ row: 0, col: 3 }, { row: 0, col: 4 })).toBe(false);
    expect(board.trySwap({ row: 0, col: 3 }, { row: 0, col: 4 })).toBe(false);

    // Matching 3 at row 0 breaks the vine at (0,3) and frees tile 4004!
    expect(board.trySwap({ row: 0, col: 1 }, { row: 1, col: 1 })).toBe(true);
    board.fastForward();

    expect(board.grid[0][3].vine).toBe(false);
    const events = board.drainEvents();
    expect(events.some((e) => e.type === 'vine_broken' && e.pos.row === 0 && e.pos.col === 3)).toBe(true);
  });

  it('collects golden pod when it drops onto a bottom podExit cell', () => {
    const board = makeTestBoard(5, 5, {
      goals: [{ type: 'pod', target: 1 }],
      podSpawns: [{ row: 3, col: 2 }],
    });
    // Ensure deterministic tiles below pod don't cause weirdness, and put pod at (3,2) above exit (4,2)
    fillBoardDeterministic(board);
    board.grid[4][2].podExit = true;
    board.grid[3][2].tile = { id: 5001, kind: 'pod', animal: null, special: 'none' };

    // Use hammer on (4,2) to clear the animal blocking the exit
    expect(board.useHammer({ row: 4, col: 2 })).toBe(true);
    board.fastForward(600);

    const events = board.drainEvents();
    expect(events.some((e) => e.type === 'pod_collected' && e.pos.row === 4 && e.pos.col === 2)).toBe(true);
    expect(board.state).toBe('GAME_OVER');
    expect(board.won).toBe(true);
  });

  it('executes all 4 power-ups: hammer, force_swap, shuffle, extra_moves', () => {
    const board = makeTestBoard(5, 5, { moves: 1 });
    fillBoardDeterministic(board);
    board.grid[2][2].crate = 1;
    board.grid[2][2].tile = null;

    // 1. Hammer breaks crate without costing a move
    expect(board.useHammer({ row: 2, col: 2 })).toBe(true);
    board.fastForward();
    expect(board.grid[2][2].crate).toBe(0);
    expect(board.movesLeft).toBe(1);

    // 2. Force swap swaps two non-matching tiles without costing a move
    const idBeforeA = board.grid[0][0].tile!.id;
    const idBeforeB = board.grid[0][1].tile!.id;
    expect(board.useForceSwap({ row: 0, col: 0 }, { row: 0, col: 1 })).toBe(true);
    board.fastForward();
    expect(board.movesLeft).toBe(1);
    expect(board.grid[0][0].tile!.id).toBe(idBeforeB);
    expect(board.grid[0][1].tile!.id).toBe(idBeforeA);

    // 3. Shuffle power-up
    expect(board.useShufflePowerUp()).toBe(true);
    board.fastForward();
    expect(board.state).toBe('IDLE');
    expect(findValidMoves(board.grid, 5, 5).length).toBeGreaterThan(0);

    // 4. Extra moves power-up (including revive from GAME_OVER)
    board.movesLeft = 0;
    // Simulate out-of-moves state via direct finish check on swap or check extra_moves in IDLE & GAME_OVER
    expect(board.useExtraMovesPowerUp(5)).toBe(true);
    expect(board.movesLeft).toBe(5);
  });

  it('resolves deadlock board via shuffleBoardTiles without initial matches', () => {
    const grid = makeGrid([
      ['chick', 'frog', 'hippo', 'fox'],
      ['owl', 'bear', 'chick', 'frog'],
      ['hippo', 'fox', 'owl', 'bear'],
      ['chick', 'frog', 'hippo', 'fox'],
    ]);
    expect(findValidMoves(grid, 4, 4)).toHaveLength(0);

    const moves = shuffleBoardTiles(grid, 4, 4);
    expect(moves.length).toBeGreaterThan(0);
    expect(hasInitialMatch(grid, 4, 4)).toBe(false);
    expect(findValidMoves(grid, 4, 4).length).toBeGreaterThan(0);
  });

  it('triggers BONUS_TIME when goals are met with moves left and reaches GAME_OVER won=true', () => {
    const board = makeTestBoard(5, 5, {
      moves: 5,
      goals: [{ type: 'ice', target: 1 }],
    });
    fillBoardDeterministic(board);
    board.grid[0][1].tile = { id: 3001, kind: 'animal', animal: 'frog', special: 'none' };
    board.grid[1][1].tile = { id: 3002, kind: 'animal', animal: 'chick', special: 'none' };
    board.grid[0][2].tile = { id: 3003, kind: 'animal', animal: 'chick', special: 'none' };
    board.grid[0][3].tile = { id: 3004, kind: 'animal', animal: 'chick', special: 'none' };
    board.grid[0][2].ice = 1;

    expect(board.trySwap({ row: 0, col: 1 }, { row: 1, col: 1 })).toBe(true);
    board.fastForward(800);

    const events = board.drainEvents();
    const bonusSteps = events.filter((e) => e.type === 'bonus_step');
    expect(bonusSteps.length).toBe(4);
    expect(board.movesLeft).toBe(0);
    expect(board.state).toBe('GAME_OVER');
    expect(board.won).toBe(true);
  });
});
