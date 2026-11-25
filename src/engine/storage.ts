import { LEVELS } from './levels';
import { PowerUpType, SaveData } from './types';

const STORAGE_KEY = 'anipop_match3_save_v2';

export function createDefaultSaveData(): SaveData {
  const levels: SaveData['levels'] = {};
  for (const lvl of LEVELS) {
    levels[lvl.id] = {
      unlocked: lvl.id === 1,
      bestScore: 0,
      stars: 0,
    };
  }
  return {
    levels,
    coins: 300,
    powerUps: {
      hammer: 2,
      force_swap: 1,
      shuffle: 2,
      extra_moves: 1,
    },
    endlessBestScore: 0,
    endlessBestWave: 1,
    muted: false,
  };
}

export function loadSaveData(): SaveData {
  const fallback = createDefaultSaveData();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<SaveData>;
    const merged = createDefaultSaveData();
    if (parsed.levels) {
      for (const lvl of LEVELS) {
        const rec = parsed.levels[lvl.id];
        if (rec) {
          merged.levels[lvl.id] = {
            unlocked: lvl.id === 1 ? true : Boolean(rec.unlocked),
            bestScore: typeof rec.bestScore === 'number' ? rec.bestScore : 0,
            stars: rec.stars === 1 || rec.stars === 2 || rec.stars === 3 ? rec.stars : 0,
          };
        }
      }
    }
    if (typeof parsed.coins === 'number' && parsed.coins >= 0) {
      merged.coins = parsed.coins;
    }
    if (parsed.powerUps) {
      (['hammer', 'force_swap', 'shuffle', 'extra_moves'] as PowerUpType[]).forEach((k) => {
        const val = parsed.powerUps?.[k];
        if (typeof val === 'number' && val >= 0) merged.powerUps[k] = val;
      });
    }
    if (typeof parsed.endlessBestScore === 'number') {
      merged.endlessBestScore = parsed.endlessBestScore;
    }
    if (typeof parsed.endlessBestWave === 'number') {
      merged.endlessBestWave = Math.max(1, parsed.endlessBestWave);
    }
    if (typeof parsed.muted === 'boolean') {
      merged.muted = parsed.muted;
    }
    return merged;
  } catch {
    return fallback;
  }
}

export function persistSaveData(data: SaveData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Ignore storage errors
  }
}

export function recordLevelResult(
  data: SaveData,
  levelId: number,
  won: boolean,
  score: number,
  stars: 0 | 1 | 2 | 3,
  endlessWave = 1,
): { next: SaveData; earnedCoins: number } {
  const next: SaveData = {
    ...data,
    levels: { ...data.levels },
    powerUps: { ...data.powerUps },
  };

  let earnedCoins = 0;

  if (levelId === 99) {
    earnedCoins = Math.min(200, Math.floor(score / 400));
    next.coins += earnedCoins;
    next.endlessBestScore = Math.max(next.endlessBestScore, score);
    next.endlessBestWave = Math.max(next.endlessBestWave, endlessWave);
    persistSaveData(next);
    return { next, earnedCoins };
  }

  const prev = next.levels[levelId] ?? { unlocked: true, bestScore: 0, stars: 0 };
  const newStars = Math.max(prev.stars, won ? stars : 0) as 0 | 1 | 2 | 3;

  if (won) {
    const firstWinBonus = prev.stars === 0 ? 60 : 25;
    const starDiffBonus = Math.max(0, newStars - prev.stars) * 40;
    earnedCoins = firstWinBonus + starDiffBonus + stars * 15;
    next.coins += earnedCoins;
  }

  next.levels[levelId] = {
    unlocked: true,
    bestScore: Math.max(prev.bestScore, score),
    stars: newStars,
  };

  if (won) {
    const nextLevelId = levelId + 1;
    if (LEVELS.some((l) => l.id === nextLevelId)) {
      const nextRec = next.levels[nextLevelId] ?? { unlocked: false, bestScore: 0, stars: 0 };
      next.levels[nextLevelId] = {
        ...nextRec,
        unlocked: true,
      };
    }
  }

  persistSaveData(next);
  return { next, earnedCoins };
}
