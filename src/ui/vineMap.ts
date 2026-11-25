import { LEVELS } from '../engine/levels';
import { BiomeType, SaveData } from '../engine/types';
import { UI_ICONS, getAnimalSvg, getStarSvg } from './icons';

const BIOME_LABELS: Record<BiomeType, { title: string; color: string }> = {
  forest: { title: '晨曦森林', color: '#2d6a4f' },
  glacier: { title: '晶莹冰原', color: '#0369a1' },
  vine: { title: '藤蔓秘境', color: '#15803d' },
  starry: { title: '极光星空', color: '#6d28d9' },
};

/**
 * Renders an interactive vertical scrollable S-curve winding vine adventure map
 * with biome zones, leafy vine SVG spine, 12 island nodes, and frontier avatar badge.
 */
export function renderVineMap(
  container: HTMLElement,
  saveData: SaveData,
  onSelectLevel: (levelId: number) => void,
): void {
  const totalLevels = LEVELS.length;
  const rowHeight = 108;
  const topPad = 70;
  const bottomPad = 84;
  const totalHeight = topPad + (totalLevels - 1) * rowHeight + bottomPad;
  const svgWidth = 380;

  // Compute node positions from bottom (level 1) to top (level 12)
  const points = LEVELS.map((lvl, idx) => {
    const y = totalHeight - bottomPad - idx * rowHeight;
    // S-curve oscillation across center
    const wave = Math.sin(idx * 0.92) * 98;
    const x = svgWidth / 2 + wave;
    return { lvl, x, y };
  });

  // Build smooth cubic Bezier S-curve SVG path along all 12 level points
  let pathD = `M ${points[0].x} ${points[0].y + 42}`;
  pathD += ` L ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];
    const midY = (p1.y + p2.y) / 2;
    pathD += ` C ${p1.x} ${midY}, ${p2.x} ${midY}, ${p2.x} ${p2.y}`;
  }
  const topPt = points[points.length - 1];
  pathD += ` L ${topPt.x} ${topPt.y - 45}`;

  // Determine current frontier level (highest unlocked level)
  let frontierId = 1;
  for (const lvl of LEVELS) {
    if (saveData.levels[lvl.id]?.unlocked) frontierId = lvl.id;
  }

  // Build SVG leaf sprouts along path segments
  const leavesSvg = points
    .slice(0, -1)
    .map((pt, i) => {
      const next = points[i + 1];
      const lx = (pt.x + next.x) / 2 + (i % 2 === 0 ? -24 : 24);
      const ly = (pt.y + next.y) / 2;
      const rot = i % 2 === 0 ? -28 : 28;
      return `
        <g transform="translate(${lx}, ${ly}) rotate(${rot})">
          <ellipse cx="0" cy="0" rx="14" ry="7" fill="#52b788" stroke="#1b4332" stroke-width="2"/>
          <line x1="-10" y1="0" x2="10" y2="0" stroke="#95d5b2" stroke-width="1.4"/>
        </g>
      `;
    })
    .join('');

  // Biome divider ribbons (every 3 levels)
  const biomeTagsHtml = [0, 3, 6, 9]
    .map((startIdx) => {
      const pt = points[startIdx];
      const biome = pt.lvl.biome;
      const info = BIOME_LABELS[biome];
      return `
        <div class="biome-tag" style="top:${pt.y + 34}px;background:${info.color};">
          ${info.title}
        </div>
      `;
    })
    .join('');

  container.innerHTML = `
    <div class="vine-canvas" style="height:${totalHeight}px;">
      <svg class="vine-svg" viewBox="0 0 ${svgWidth} ${totalHeight}" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
        <defs>
          <linearGradient id="vineGrad" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stop-color="#2d6a4f"/>
            <stop offset="50%" stop-color="#40916c"/>
            <stop offset="100%" stop-color="#74c69d"/>
          </linearGradient>
        </defs>
        <path d="${pathD}" fill="none" stroke="#1b4332" stroke-width="22" stroke-linecap="round"/>
        <path d="${pathD}" fill="none" stroke="url(#vineGrad)" stroke-width="14" stroke-linecap="round"/>
        <path d="${pathD}" fill="none" stroke="rgba(216,243,220,0.65)" stroke-width="3.5" stroke-dasharray="10 14" stroke-linecap="round"/>
        ${leavesSvg}
      </svg>
      ${biomeTagsHtml}
      <div class="vine-nodes"></div>
    </div>
  `;

  const nodesLayer = container.querySelector('.vine-nodes') as HTMLElement;

  for (const pt of points) {
    const rec = saveData.levels[pt.lvl.id] ?? {
      unlocked: pt.lvl.id === 1,
      bestScore: 0,
      stars: 0,
    };
    const isFrontier = pt.lvl.id === frontierId;
    const pctX = (pt.x / svgWidth) * 100;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `vine-node ${rec.unlocked ? 'unlocked' : 'locked'} ${isFrontier ? 'frontier' : ''} biome-${pt.lvl.biome}`;
    btn.style.left = `${pctX}%`;
    btn.style.top = `${pt.y}px`;
    btn.disabled = !rec.unlocked;

    const starsHtml = rec.unlocked
      ? `<div class="node-stars">${[1, 2, 3].map((s) => getStarSvg(rec.stars >= s, 15)).join('')}</div>`
      : '';

    const avatarHtml = isFrontier
      ? `<div class="node-avatar">${getAnimalSvg('chick', 28)}</div>`
      : '';

    btn.innerHTML = `
      ${avatarHtml}
      <div class="node-disc">
        ${rec.unlocked ? `<span class="node-num">${pt.lvl.id}</span>` : UI_ICONS.lock}
      </div>
      <div class="node-plate">
        <span class="node-title">${pt.lvl.name}</span>
        ${starsHtml}
      </div>
    `;

    if (rec.unlocked) {
      btn.addEventListener('click', () => onSelectLevel(pt.lvl.id));
    }

    nodesLayer.appendChild(btn);
  }

  // Smoothly scroll so frontier node is visible
  requestAnimationFrame(() => {
    const frontierEl = nodesLayer.querySelector('.vine-node.frontier') as HTMLElement | null;
    if (frontierEl) {
      frontierEl.scrollIntoView({ block: 'center', behavior: 'instant' as ScrollBehavior });
    }
  });
}
