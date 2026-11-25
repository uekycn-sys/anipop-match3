import { AnimalType, LevelGoal, PowerUpType } from '../engine/types';

export function getAnimalSvg(animal: AnimalType, size = 24): string {
  switch (animal) {
    case 'chick':
      return `<svg width="${size}" height="${size}" viewBox="0 0 32 32" aria-hidden="true">
        <circle cx="16" cy="17" r="11" fill="#ffd43b" stroke="#b86200" stroke-width="2"/>
        <path d="M14 6 Q12 1 16 4 Q19 0 19 6" fill="#ffb703" stroke="#b86200" stroke-width="1.5"/>
        <circle cx="12" cy="15" r="1.7" fill="#2b1b12"/><circle cx="20" cy="15" r="1.7" fill="#2b1b12"/>
        <polygon points="13.5,18 18.5,18 16,21.5" fill="#ff6b1a"/>
      </svg>`;
    case 'frog':
      return `<svg width="${size}" height="${size}" viewBox="0 0 32 32" aria-hidden="true">
        <ellipse cx="16" cy="18" rx="12" ry="9.5" fill="#5cd624" stroke="#175900" stroke-width="2"/>
        <circle cx="10.5" cy="10" r="4.2" fill="#7be638" stroke="#175900" stroke-width="1.8"/>
        <circle cx="21.5" cy="10" r="4.2" fill="#7be638" stroke="#175900" stroke-width="1.8"/>
        <circle cx="10.5" cy="10" r="2.2" fill="#fff"/><circle cx="21.5" cy="10" r="2.2" fill="#fff"/>
        <circle cx="10.5" cy="10" r="1.2" fill="#1b1b1b"/><circle cx="21.5" cy="10" r="1.2" fill="#1b1b1b"/>
        <path d="M11 19 Q16 23 21 19" fill="none" stroke="#185000" stroke-width="2" stroke-linecap="round"/>
      </svg>`;
    case 'hippo':
      return `<svg width="${size}" height="${size}" viewBox="0 0 32 32" aria-hidden="true">
        <circle cx="9" cy="8" r="3.2" fill="#48bfe3" stroke="#13548f" stroke-width="1.5"/>
        <circle cx="23" cy="8" r="3.2" fill="#48bfe3" stroke="#13548f" stroke-width="1.5"/>
        <circle cx="16" cy="16" r="10.5" fill="#48bfe3" stroke="#13548f" stroke-width="2"/>
        <ellipse cx="16" cy="21" rx="9" ry="5.5" fill="#c7f4ff" stroke="#13548f" stroke-width="1.5"/>
        <circle cx="12" cy="13.5" r="1.5" fill="#2b1b12"/><circle cx="20" cy="13.5" r="1.5" fill="#2b1b12"/>
        <circle cx="13" cy="20" r="1.3" fill="#114d82"/><circle cx="19" cy="20" r="1.3" fill="#114d82"/>
      </svg>`;
    case 'fox':
      return `<svg width="${size}" height="${size}" viewBox="0 0 32 32" aria-hidden="true">
        <polygon points="7,12 6,4 14,9" fill="#ff4d5e" stroke="#991036" stroke-width="1.6"/>
        <polygon points="25,12 26,4 18,9" fill="#ff4d5e" stroke="#991036" stroke-width="1.6"/>
        <ellipse cx="16" cy="18" rx="11" ry="9.5" fill="#ff4d5e" stroke="#991036" stroke-width="2"/>
        <path d="M6 19 Q16 15 26 19 Q21 27 16 27 Q11 27 6 19 Z" fill="#fff3f6"/>
        <circle cx="12" cy="15" r="1.6" fill="#2b1b12"/><circle cx="20" cy="15" r="1.6" fill="#2b1b12"/>
        <circle cx="16" cy="20.5" r="1.8" fill="#2b1b12"/>
      </svg>`;
    case 'owl':
      return `<svg width="${size}" height="${size}" viewBox="0 0 32 32" aria-hidden="true">
        <polygon points="8,11 6,5 13,8" fill="#9d4edd" stroke="#4c117a" stroke-width="1.5"/>
        <polygon points="24,11 26,5 19,8" fill="#9d4edd" stroke="#4c117a" stroke-width="1.5"/>
        <circle cx="16" cy="17" r="10.5" fill="#b565f7" stroke="#4c117a" stroke-width="2"/>
        <circle cx="12" cy="15" r="3.4" fill="#fff"/><circle cx="20" cy="15" r="3.4" fill="#fff"/>
        <circle cx="12" cy="15" r="1.6" fill="#2b1b12"/><circle cx="20" cy="15" r="1.6" fill="#2b1b12"/>
        <polygon points="16,16 18,19 16,21.5 14,19" fill="#ffb703"/>
      </svg>`;
    case 'bear':
      return `<svg width="${size}" height="${size}" viewBox="0 0 32 32" aria-hidden="true">
        <circle cx="8.5" cy="9" r="3.6" fill="#d4844a" stroke="#66300e" stroke-width="1.6"/>
        <circle cx="23.5" cy="9" r="3.6" fill="#d4844a" stroke="#66300e" stroke-width="1.6"/>
        <circle cx="16" cy="17" r="10.5" fill="#d4844a" stroke="#66300e" stroke-width="2"/>
        <ellipse cx="16" cy="20.5" rx="5.5" ry="4" fill="#fff0df"/>
        <circle cx="12" cy="14.5" r="1.6" fill="#2b1b12"/><circle cx="20" cy="14.5" r="1.6" fill="#2b1b12"/>
        <ellipse cx="16" cy="19" rx="2.2" ry="1.5" fill="#3b1e0a"/>
      </svg>`;
  }
}

export function getGoalIconSvg(goal: LevelGoal, size = 24): string {
  if (goal.type === 'collect') return getAnimalSvg(goal.animal, size);
  if (goal.type === 'ice') {
    return `<svg width="${size}" height="${size}" viewBox="0 0 32 32" aria-hidden="true">
      <rect x="4" y="4" width="24" height="24" rx="6" fill="#7dd3fc" stroke="#ffffff" stroke-width="2.4"/>
      <polygon points="7,6 17,6 7,17" fill="rgba(255,255,255,0.7)"/>
      <path d="M9 22 L16 15 L22 20" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round"/>
    </svg>`;
  }
  if (goal.type === 'crate') {
    return `<svg width="${size}" height="${size}" viewBox="0 0 32 32" aria-hidden="true">
      <rect x="4" y="4" width="24" height="24" rx="5" fill="#f59e0b" stroke="#78350f" stroke-width="2"/>
      <rect x="8" y="8" width="16" height="16" rx="2" fill="#fcd34d" stroke="#92400e" stroke-width="1.4"/>
      <rect x="14" y="5" width="4" height="22" fill="#ef4444"/>
      <rect x="5" y="14" width="22" height="4" fill="#ef4444"/>
    </svg>`;
  }
  if (goal.type === 'vine') {
    return `<svg width="${size}" height="${size}" viewBox="0 0 32 32" aria-hidden="true">
      <path d="M5 24 Q14 14 27 7" fill="none" stroke="#1b4332" stroke-width="4.5" stroke-linecap="round"/>
      <path d="M5 24 Q14 14 27 7" fill="none" stroke="#52b788" stroke-width="2.4" stroke-linecap="round"/>
      <ellipse cx="11" cy="14" rx="5" ry="2.8" transform="rotate(-35 11 14)" fill="#74c69d" stroke="#1b4332" stroke-width="1.3"/>
      <ellipse cx="21" cy="18" rx="5" ry="2.8" transform="rotate(25 21 18)" fill="#52b788" stroke="#1b4332" stroke-width="1.3"/>
    </svg>`;
  }
  if (goal.type === 'pod') {
    return `<svg width="${size}" height="${size}" viewBox="0 0 32 32" aria-hidden="true">
      <ellipse cx="12.5" cy="6.5" rx="4.2" ry="2.2" transform="rotate(-25 12.5 6.5)" fill="#52b788" stroke="#1b4332" stroke-width="1.2"/>
      <ellipse cx="19.5" cy="6.5" rx="4.2" ry="2.2" transform="rotate(25 19.5 6.5)" fill="#52b788" stroke="#1b4332" stroke-width="1.2"/>
      <path d="M16 7 C25 8 25 26 16 29 C7 26 7 8 16 7 Z" fill="#ffd43b" stroke="#8a4400" stroke-width="2"/>
      <ellipse cx="13" cy="15" rx="2.3" ry="5" transform="rotate(-15 13 15)" fill="rgba(255,255,255,0.65)"/>
    </svg>`;
  }
  return getStarSvg(true, size);
}

export function getStarSvg(filled: boolean, size = 20): string {
  const fill = filled ? '#ffb703' : '#d6ccc2';
  const stroke = filled ? '#b45309' : '#a89f96';
  const highlight = filled
    ? `<polygon points="16,5 18.8,11.2 16,13 13.2,11.2" fill="#fff3b0" opacity="0.75"/>`
    : '';
  return `<svg width="${size}" height="${size}" viewBox="0 0 32 32" aria-hidden="true">
    <polygon points="16,3 20.1,11.2 29.2,12.5 22.6,18.9 24.2,28 16,23.7 7.8,28 9.4,18.9 2.8,12.5 11.9,11.2"
      fill="${fill}" stroke="${stroke}" stroke-width="2" stroke-linejoin="round"/>
    ${highlight}
  </svg>`;
}

export function getCoinSvg(size = 20): string {
  return `<svg width="${size}" height="${size}" viewBox="0 0 32 32" aria-hidden="true">
    <circle cx="16" cy="16" r="13" fill="#ffb703" stroke="#92400e" stroke-width="2.2"/>
    <circle cx="16" cy="16" r="9.2" fill="#ffe066" stroke="#d97706" stroke-width="1.4"/>
    <polygon points="16,9 18.2,13.6 23,14.3 19.5,17.7 20.3,22.5 16,20.2 11.7,22.5 12.5,17.7 9,14.3 13.8,13.6" fill="#f59e0b"/>
  </svg>`;
}

export function getPowerUpSvg(kind: PowerUpType, size = 26): string {
  switch (kind) {
    case 'hammer':
      return `<svg width="${size}" height="${size}" viewBox="0 0 32 32" aria-hidden="true">
        <rect x="14" y="13" width="4.5" height="15" rx="2" transform="rotate(-35 16 20)" fill="#d97706" stroke="#78350f" stroke-width="1.6"/>
        <rect x="6" y="5" width="16" height="9" rx="3" transform="rotate(-35 14 9.5)" fill="#fbbf24" stroke="#78350f" stroke-width="2"/>
        <line x1="9" y1="8" x2="17" y2="5" stroke="#fffbeb" stroke-width="1.8" stroke-linecap="round"/>
      </svg>`;
    case 'force_swap':
      return `<svg width="${size}" height="${size}" viewBox="0 0 32 32" aria-hidden="true">
        <path d="M5 11 H22 L18 6 M27 21 H10 L14 26" fill="none" stroke="#ffffff" stroke-width="4.2" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M5 11 H22 L18 6 M27 21 H10 L14 26" fill="none" stroke="#06b6d4" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>`;
    case 'shuffle':
      return `<svg width="${size}" height="${size}" viewBox="0 0 32 32" aria-hidden="true">
        <path d="M25 14 A9 9 0 1 0 22 23" fill="none" stroke="#a855f7" stroke-width="3.6" stroke-linecap="round"/>
        <polygon points="27,16 21,13 26,9" fill="#a855f7" stroke="#581c87" stroke-width="1.2"/>
        <circle cx="16" cy="16" r="3" fill="#fde047"/>
      </svg>`;
    case 'extra_moves':
      return `<svg width="${size}" height="${size}" viewBox="0 0 32 32" aria-hidden="true">
        <circle cx="16" cy="16" r="13" fill="#ff5d6c" stroke="#9f1239" stroke-width="2"/>
        <text x="16" y="20.5" text-anchor="middle" fill="#ffffff" font-size="13" font-weight="900" font-family="sans-serif">+5</text>
      </svg>`;
  }
}

export const UI_ICONS = {
  map: `<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2V6z" fill="#8ce99a" stroke="#1b4332" stroke-width="2" stroke-linejoin="round"/><path d="M9 4v14M15 6v14" stroke="#1b4332" stroke-width="1.8"/></svg>`,
  soundOn: `<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><polygon points="4,9 9,9 14,4 14,20 9,15 4,15" fill="#fbbf24" stroke="#78350f" stroke-width="1.8" stroke-linejoin="round"/><path d="M17.5 8.5a5 5 0 010 7M20 6a8.5 8.5 0 010 12" fill="none" stroke="#78350f" stroke-width="2" stroke-linecap="round"/></svg>`,
  soundOff: `<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><polygon points="4,9 9,9 14,4 14,20 9,15 4,15" fill="#cbd5e1" stroke="#475569" stroke-width="1.8" stroke-linejoin="round"/><path d="M17 9l5 6M22 9l-5 6" stroke="#ef4444" stroke-width="2.2" stroke-linecap="round"/></svg>`,
  pause: `<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="5" width="4.5" height="14" rx="1.8" fill="#5c2d0c"/><rect x="13.5" y="5" width="4.5" height="14" rx="1.8" fill="#5c2d0c"/></svg>`,
  replay: `<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 12a8 8 0 10-2.5 5.8" fill="none" stroke="#5c2d0c" stroke-width="2.4" stroke-linecap="round"/><polygon points="21,6 21,13 14,12" fill="#5c2d0c"/></svg>`,
  help: `<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9.5" fill="#fef08a" stroke="#92400e" stroke-width="1.8"/><text x="12" y="16.5" text-anchor="middle" fill="#92400e" font-size="14" font-weight="900" font-family="sans-serif">?</text></svg>`,
  lock: `<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10" width="14" height="10" rx="3" fill="#94a3b8" stroke="#475569" stroke-width="1.8"/><path d="M8 10V7a4 4 0 018 0v3" fill="none" stroke="#475569" stroke-width="2.2" stroke-linecap="round"/></svg>`,
  endless: `<svg width="28" height="28" viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="13" fill="#4c1d95" stroke="#fde047" stroke-width="2"/><path d="M8 16c0-4 5-4 8 0s8 4 8 0-5-4-8 0-8 4-8 0z" fill="none" stroke="#f0abfc" stroke-width="2.5"/><circle cx="10" cy="9" r="1.4" fill="#fff"/><circle cx="22" cy="23" r="1.4" fill="#fde047"/></svg>`,
  check: `<svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12.5l5.5 5.5L20 6" fill="none" stroke="#15803d" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
};
