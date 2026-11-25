import {
  AnimalType,
  Cell,
  MatchGroup,
  Pos,
  SpecialType,
  SwapContext,
  Tile,
  ValidMove,
} from './types';

interface RunSegment {
  orientation: 'h' | 'v';
  animal: AnimalType;
  positions: Pos[];
}

function posKey(r: number, c: number): string {
  return `${r},${c}`;
}

/**
 * Vine-caged animals CAN participate in matching runs!
 * Golden pods and Magic Birds cannot match by color.
 */
function isMatchableCell(
  cell: Cell | undefined,
): cell is Cell & { tile: Tile & { animal: AnimalType } } {
  if (!cell || !cell.active || cell.crate > 0 || !cell.tile) return false;
  if (cell.tile.kind === 'pod' || cell.tile.special === 'magic_bird' || cell.tile.animal === null) {
    return false;
  }
  return true;
}

export function findMatches(
  grid: Cell[][],
  rows: number,
  cols: number,
  swapContext: SwapContext | null = null,
): MatchGroup[] {
  const runs: RunSegment[] = [];

  for (let r = 0; r < rows; r++) {
    let c = 0;
    while (c < cols) {
      const startCell = grid[r]?.[c];
      if (!isMatchableCell(startCell)) {
        c++;
        continue;
      }
      const animal = startCell.tile.animal;
      const positions: Pos[] = [{ row: r, col: c }];
      let nextC = c + 1;
      while (nextC < cols) {
        const nextCell = grid[r]?.[nextC];
        if (isMatchableCell(nextCell) && nextCell.tile.animal === animal) {
          positions.push({ row: r, col: nextC });
          nextC++;
        } else {
          break;
        }
      }
      if (positions.length >= 3) {
        runs.push({ orientation: 'h', animal, positions });
      }
      c = nextC;
    }
  }

  for (let c = 0; c < cols; c++) {
    let r = 0;
    while (r < rows) {
      const startCell = grid[r]?.[c];
      if (!isMatchableCell(startCell)) {
        r++;
        continue;
      }
      const animal = startCell.tile.animal;
      const positions: Pos[] = [{ row: r, col: c }];
      let nextR = r + 1;
      while (nextR < rows) {
        const nextCell = grid[nextR]?.[c];
        if (isMatchableCell(nextCell) && nextCell.tile.animal === animal) {
          positions.push({ row: nextR, col: c });
          nextR++;
        } else {
          break;
        }
      }
      if (positions.length >= 3) {
        runs.push({ orientation: 'v', animal, positions });
      }
      r = nextR;
    }
  }

  if (runs.length === 0) return [];

  const parent = runs.map((_, idx) => idx);
  const findRoot = (x: number): number => {
    while (parent[x] !== x) {
      parent[x] = parent[parent[x]];
      x = parent[x];
    }
    return x;
  };
  const union = (a: number, b: number) => {
    const ra = findRoot(a);
    const rb = findRoot(b);
    if (ra !== rb) parent[rb] = ra;
  };

  const cellToRunIndices = new Map<string, number[]>();
  runs.forEach((run, runIdx) => {
    for (const p of run.positions) {
      const key = posKey(p.row, p.col);
      const list = cellToRunIndices.get(key);
      if (list) {
        for (const otherIdx of list) {
          if (runs[otherIdx].animal === run.animal) {
            union(runIdx, otherIdx);
          }
        }
        list.push(runIdx);
      } else {
        cellToRunIndices.set(key, [runIdx]);
      }
    }
  });

  const componentRuns = new Map<number, RunSegment[]>();
  runs.forEach((run, idx) => {
    const root = findRoot(idx);
    const list = componentRuns.get(root);
    if (list) list.push(run);
    else componentRuns.set(root, [run]);
  });

  const groups: MatchGroup[] = [];
  for (const segs of componentRuns.values()) {
    const animal = segs[0].animal;
    const uniqueMap = new Map<string, Pos>();
    let maxH = 0;
    let maxV = 0;
    const hKeys = new Set<string>();
    const vKeys = new Set<string>();

    for (const seg of segs) {
      if (seg.orientation === 'h') {
        maxH = Math.max(maxH, seg.positions.length);
        for (const p of seg.positions) {
          const k = posKey(p.row, p.col);
          hKeys.add(k);
          uniqueMap.set(k, p);
        }
      } else {
        maxV = Math.max(maxV, seg.positions.length);
        for (const p of seg.positions) {
          const k = posKey(p.row, p.col);
          vKeys.add(k);
          uniqueMap.set(k, p);
        }
      }
    }

    const positions = Array.from(uniqueMap.values());
    let specialToCreate: SpecialType = 'none';
    let shape: MatchGroup['shape'] = 'match3';

    if (maxH >= 5 || maxV >= 5) {
      specialToCreate = 'magic_bird';
      shape = 'magic_bird';
    } else if (maxH >= 3 && maxV >= 3) {
      specialToCreate = 'bomb';
      shape = 'bomb';
    } else if (maxH === 4 || maxV === 4) {
      shape = 'line';
      if (
        swapContext &&
        (uniqueMap.has(posKey(swapContext.to.row, swapContext.to.col)) ||
          uniqueMap.has(posKey(swapContext.from.row, swapContext.from.col)))
      ) {
        specialToCreate = swapContext.direction === 'horizontal' ? 'line_h' : 'line_v';
      } else {
        specialToCreate = maxH === 4 ? 'line_v' : 'line_h';
      }
    }

    let spawnPos = positions[Math.floor(positions.length / 2)];
    if (swapContext) {
      const toK = posKey(swapContext.to.row, swapContext.to.col);
      const fromK = posKey(swapContext.from.row, swapContext.from.col);
      if (uniqueMap.has(toK)) {
        spawnPos = swapContext.to;
      } else if (uniqueMap.has(fromK)) {
        spawnPos = swapContext.from;
      }
    } else if (shape === 'bomb') {
      for (const k of hKeys) {
        if (vKeys.has(k)) {
          spawnPos = uniqueMap.get(k)!;
          break;
        }
      }
    }

    groups.push({
      positions,
      animal,
      specialToCreate,
      spawnPos,
      shape,
    });
  }

  return groups;
}

export function isDirectSpecialSwap(t1: Tile | null, t2: Tile | null): boolean {
  if (!t1 || !t2) return false;
  if (t1.kind === 'pod' || t2.kind === 'pod') return false;
  if (t1.special === 'magic_bird' || t2.special === 'magic_bird') return true;
  return t1.special !== 'none' && t2.special !== 'none';
}

export function hasInitialMatch(grid: Cell[][], rows: number, cols: number): boolean {
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cell = grid[r]?.[c];
      if (!isMatchableCell(cell)) continue;
      const a = cell.tile.animal;
      if (c + 2 < cols) {
        const c1 = grid[r][c + 1];
        const c2 = grid[r][c + 2];
        if (isMatchableCell(c1) && isMatchableCell(c2) && c1.tile.animal === a && c2.tile.animal === a) {
          return true;
        }
      }
      if (r + 2 < rows) {
        const r1 = grid[r + 1]?.[c];
        const r2 = grid[r + 2]?.[c];
        if (isMatchableCell(r1) && isMatchableCell(r2) && r1.tile.animal === a && r2.tile.animal === a) {
          return true;
        }
      }
    }
  }
  return false;
}

export function canSwapCells(a: Cell | undefined, b: Cell | undefined): boolean {
  if (!a || !b) return false;
  if (!a.active || !b.active) return false;
  if (a.crate > 0 || b.crate > 0) return false;
  if (a.vine || b.vine) return false;
  if (!a.tile || !b.tile) return false;
  return true;
}

function swapTilesInPlace(a: Cell, b: Cell): void {
  const tmp = a.tile;
  a.tile = b.tile;
  b.tile = tmp;
}

export function findValidMoves(grid: Cell[][], rows: number, cols: number): ValidMove[] {
  const moves: ValidMove[] = [];
  const dirs: Array<[number, number, 'horizontal' | 'vertical']> = [
    [0, 1, 'horizontal'],
    [1, 0, 'vertical'],
  ];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cellA = grid[r]?.[c];
      if (!cellA) continue;
      for (const [dr, dc, direction] of dirs) {
        const nr = r + dr;
        const nc = c + dc;
        const cellB = grid[nr]?.[nc];
        if (!canSwapCells(cellA, cellB)) continue;

        const from: Pos = { row: r, col: c };
        const to: Pos = { row: nr, col: nc };

        if (isDirectSpecialSwap(cellA.tile, cellB!.tile)) {
          const bothBird =
            cellA.tile!.special === 'magic_bird' && cellB!.tile!.special === 'magic_bird';
          const hasBird =
            cellA.tile!.special === 'magic_bird' || cellB!.tile!.special === 'magic_bird';
          const priority = bothBird ? 100 : hasBird ? 80 : 60;
          moves.push({
            from,
            to,
            priority,
            previewPositions: [from, to],
          });
          continue;
        }

        swapTilesInPlace(cellA, cellB!);
        const matches = findMatches(grid, rows, cols, { from, to, direction });
        swapTilesInPlace(cellA, cellB!);

        if (matches.length > 0) {
          let priority = 10;
          const previewSet = new Map<string, Pos>();
          for (const m of matches) {
            if (m.specialToCreate === 'magic_bird') priority = Math.max(priority, 50);
            else if (m.specialToCreate === 'bomb') priority = Math.max(priority, 40);
            else if (m.specialToCreate === 'line_h' || m.specialToCreate === 'line_v') {
              priority = Math.max(priority, 30);
            }
            for (const p of m.positions) {
              previewSet.set(posKey(p.row, p.col), p);
            }
          }
          moves.push({
            from,
            to,
            priority,
            previewPositions: Array.from(previewSet.values()),
          });
        }
      }
    }
  }

  moves.sort((a, b) => b.priority - a.priority);
  return moves;
}

export function shuffleBoardTiles(
  grid: Cell[][],
  rows: number,
  cols: number,
  rng: () => number = Math.random,
): Array<{ tile: Tile; from: Pos; to: Pos }> {
  const slots: Array<{ pos: Pos; tile: Tile }> = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cell = grid[r][c];
      if (cell.active && cell.crate === 0 && !cell.vine && cell.tile && cell.tile.kind === 'animal') {
        slots.push({ pos: { row: r, col: c }, tile: cell.tile });
      }
    }
  }

  if (slots.length < 3) return [];

  const original = slots.map((s) => ({ ...s }));
  const perm = slots.map((_, i) => i);

  for (let attempt = 0; attempt < 80; attempt++) {
    for (let i = perm.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const tmp = perm[i];
      perm[i] = perm[j];
      perm[j] = tmp;
    }

    for (let i = 0; i < slots.length; i++) {
      const targetPos = slots[i].pos;
      grid[targetPos.row][targetPos.col].tile = original[perm[i]].tile;
    }

    if (!hasInitialMatch(grid, rows, cols) && findValidMoves(grid, rows, cols).length > 0) {
      return slots.map((slot, i) => ({
        tile: original[perm[i]].tile,
        from: original[perm[i]].pos,
        to: slot.pos,
      }));
    }
  }

  const counts = new Map<AnimalType, number[]>();
  original.forEach((entry, idx) => {
    if (entry.tile.animal) {
      const arr = counts.get(entry.tile.animal);
      if (arr) arr.push(idx);
      else counts.set(entry.tile.animal, [idx]);
    }
  });

  for (let pass = 0; pass < 40; pass++) {
    const matches = findMatches(grid, rows, cols);
    if (matches.length > 0) {
      const mPos = matches[0].positions[1] ?? matches[0].positions[0];
      const cellA = grid[mPos.row][mPos.col];
      if (!cellA.vine) {
        const randSlot = slots[Math.floor(rng() * slots.length)].pos;
        const cellB = grid[randSlot.row][randSlot.col];
        swapTilesInPlace(cellA, cellB);
        continue;
      }
    }
    if (findValidMoves(grid, rows, cols).length > 0) break;

    for (const [, indices] of counts) {
      if (indices.length < 3) continue;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c + 3 < cols; c++) {
          const c0 = grid[r][c];
          const c1 = grid[r][c + 1];
          const c2 = grid[r][c + 2];
          const c3 = grid[r][c + 3];
          if (
            c0.active && c1.active && c2.active && c3.active &&
            c0.crate === 0 && c1.crate === 0 && c2.crate === 0 && c3.crate === 0 &&
            !c0.vine && !c1.vine && !c2.vine && !c3.vine &&
            c0.tile && c1.tile && c2.tile && c3.tile &&
            c0.tile.kind === 'animal'
          ) {
            const targetAnimal = c0.tile.animal;
            if (!targetAnimal) continue;
            const otherSlots = slots.filter(
              (s) =>
                !(s.pos.row === r && s.pos.col >= c && s.pos.col <= c + 3) &&
                grid[s.pos.row][s.pos.col].tile?.animal === targetAnimal,
            );
            if (otherSlots.length >= 2) {
              swapTilesInPlace(c1, grid[otherSlots[0].pos.row][otherSlots[0].pos.col]);
              swapTilesInPlace(c3, grid[otherSlots[1].pos.row][otherSlots[1].pos.col]);
              break;
            }
          }
        }
        if (findValidMoves(grid, rows, cols).length > 0) break;
      }
      if (findValidMoves(grid, rows, cols).length > 0) break;
    }
  }

  const currentPosByTileId = new Map<number, Pos>();
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const t = grid[r][c].tile;
      if (t) currentPosByTileId.set(t.id, { row: r, col: c });
    }
  }
  return original.map((entry) => ({
    tile: entry.tile,
    from: entry.pos,
    to: currentPosByTileId.get(entry.tile.id) ?? entry.pos,
  }));
}
