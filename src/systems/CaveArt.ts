import { ROOM_RECT, WALL_THICKNESS, WORLD_HEIGHT, WORLD_WIDTH } from '../config/gameConfig';
import type { Direction } from '../utils/directions';
import { createSeededRandom } from '../utils/random';
import { getDoorwayRect } from './DoorwayGeometry';
import { CAVE_THEMES, caveThemeSettings, type CaveTheme } from './CaveThemes';
export type { CaveTheme } from './CaveThemes';

export const CAVE_LIGHT_EVENT = 'cave-light-pulse';
export const CAVE_PALETTE = {
  fire: 0xff862c,
  fireCore: 0xffedaa,
  mineral: 0x34e8c7,
  blue: 0x46baff,
  prism: 0xbc56ff,
} as const;

export interface CaveLight {
  x: number;
  y: number;
  radius: number;
  color: number;
  strength: number;
}

export const CAVE_LIGHTS: readonly CaveLight[] = [
  { x: 91, y: 27, radius: 96, color: CAVE_PALETTE.fire, strength: 0.42 },
  { x: 389, y: 27, radius: 96, color: CAVE_PALETTE.fire, strength: 0.42 },
  { x: 54, y: 210, radius: 59, color: CAVE_PALETTE.mineral, strength: 0.26 },
  { x: 424, y: 206, radius: 60, color: CAVE_PALETTE.blue, strength: 0.26 },
];

export function lightFalloff(distance: number, radius: number): number {
  const factor = Math.max(0, 1 - distance / Math.max(1, radius));
  return factor * factor;
}

export function caveThemeForFloor(floor: number): CaveTheme | null {
  return Number.isInteger(floor) ? CAVE_THEMES[floor - 1]?.id ?? null : null;
}

/** Full-room, seeded art: grain is baked once, never animated screen noise. */
export function createCavePixels(
  exits: readonly Direction[],
  seed = 7041,
  theme: CaveTheme = 'burrow',
): Uint8ClampedArray {
  const pixels = theme === 'ruins' || theme === 'cellar' ? createRuinsPixels(exits, seed) : createBurrowPixels(exits, seed);
  if (theme === 'burrow') return pixels;
  decorateCaveTheme(pixels, exits, seed, theme);
  return pixels;
}

/** Distinct material silhouettes, not just a color filter. All decoration respects doorways. */
function decorateCaveTheme(pixels: Uint8ClampedArray, exits: readonly Direction[], seed: number, theme: CaveTheme): void {
  const settings = caveThemeSettings(theme);
  const random = createSeededRandom(seed ^ 0x76ab);
  const passages = exits.map(getDoorwayRect);
  const isPassage = (x: number, y: number): boolean => passages.some((p) => Math.abs(x - p.x) <= p.width / 2 + 1 && Math.abs(y - p.y) <= p.height / 2 + 1);
  for (let i = 0; i < pixels.length; i += 4) {
    if (pixels[i] === 7 && pixels[i + 1] === 9 && pixels[i + 2] === 12) continue;
    for (let c = 0; c < 3; c++) pixels[i + c] *= settings.tint[c];
  }
  const put = (x: number, y: number, color: number): void => {
    x = Math.floor(x); y = Math.floor(y);
    if (x < 16 || y < 16 || x >= WORLD_WIDTH - 16 || y >= WORLD_HEIGHT - 16 || isPassage(x, y)) return;
    const i = (y * WORLD_WIDTH + x) * 4;
    pixels[i] = (color >>> 16) & 255; pixels[i + 1] = (color >>> 8) & 255; pixels[i + 2] = color & 255;
  };
  const line = (x: number, y: number, ex: number, ey: number, color: number): void => {
    const length = Math.ceil(Math.max(Math.abs(ex - x), Math.abs(ey - y)));
    for (let t = 0; t <= length; t++) put(x + (ex - x) * t / Math.max(1, length), y + (ey - y) * t / Math.max(1, length), color);
  };
  const oval = (cx: number, cy: number, rx: number, ry: number, color: number, edge: number): void => {
    for (let dy = -ry; dy <= ry; dy++) for (let dx = -rx; dx <= rx; dx++) {
      const d = dx * dx / (rx * rx) + dy * dy / (ry * ry);
      if (d > 1 || (d > 0.85 && random() < 0.25)) continue;
      put(cx + dx, cy + dy, d > 0.65 && dy < 0 ? edge : color);
    }
  };
  const edgePoint = (n: number): [number, number] => {
    const side = n % 4;
    return [side === 0 ? 30 + random() * 18 : side === 1 ? 430 + random() * 18 : 45 + random() * 390,
      side === 2 ? 28 + random() * 18 : side === 3 ? 226 + random() * 18 : 45 + random() * 180];
  };

  if (theme === 'wetClay') {
    for (let i = 0; i < 32; i++) {
      const [x, y] = edgePoint(i);
      const rx = 4 + Math.floor(random() * 16), ry = 2 + Math.floor(random() * 4);
      oval(x, y, rx, ry, 0x16282a, 0x33494a);
      line(x - rx * 0.5, y + 1, x + rx * 0.4, y + 1, 0x294143);
      if (i % 4 === 0) put(x - 2, y - 1, 0x56807c);
    }
    for (let i = 0; i < 14; i++) {
      const x = 42 + random() * 390;
      for (let y = 18; y < 40 + random() * 9; y++) put(x + Math.sin(y * 0.25), y, 0x2a4240);
    }
  }
  if (theme === 'nest') {
    for (let i = 0; i < 30; i++) {
      const [x, y] = edgePoint(i);
      for (let t = 0; t < 32; t++) {
        const px = x + Math.sin(t * 0.09 + i) * 10, py = y + t * (i % 2 ? -0.5 : 0.5);
        line(px, py, px + 4, py, 0x271f29);
        put(px - 1, py, 0x4c354b);
        if (t % 5 === 0) line(px, py, px + 3, py, 0x382a37);
      }
      for (let j = 0; j < 3; j++) {
        oval(x + j * 4, y + j % 2 * 4, 3, 4, 0x3b2d42, 0x68516d);
        put(x + j * 4, y + j % 2 * 4 - 1, 0x8b628f);
      }
    }
  }
  if (theme === 'compost' || theme === 'scrap') {
    for (let i = 0; i < 90; i++) {
      const [x, y] = edgePoint(i);
      oval(x, y, 3 + Math.floor(random() * 5), 2 + Math.floor(random() * 3), 0x343420, 0x4b4930);
      line(x, y, x + 5, y - 3, 0x62603a);
      if (theme === 'compost' && i % 3 === 0) {
        line(x, y, x, y - 5, 0x72694d);
        oval(x, y - 6, 4, 2, 0x5c6034, 0x8a914b);
        put(x - 1, y - 7, 0xabb968);
        line(x - 3, y + 2, x + 5, y + 4, 0x4f5335);
      }
      if (theme === 'scrap' && i % 4 === 0) {
        for (let dy = 0; dy < 5; dy++) line(x, y + dy, x + 9, y + dy, dy === 0 ? 0x74503a : 0x453729);
        line(x + 2, y + 2, x + 7, y + 2, 0x302a22);
      }
    }
    if (theme === 'scrap') for (let i = 0; i < 12; i++) {
      const [x, y] = edgePoint(i);
      line(x, y, x + 12, y - 8, 0x56574a);
      line(x, y + 1, x + 12, y - 7, 0x32392e);
      for (let j = 0; j < 3; j++) line(x + 9 + j * 2, y - 5 - j, x + 6 + j * 2, y - 10 - j, 0x76604a);
    }
  }
  if (theme === 'ruins' || theme === 'vines') {
    for (let i = 0; i < (theme === 'vines' ? 36 : 16); i++) {
      const [x, y] = edgePoint(i);
      const green = theme === 'vines';
      const direction = y > 136 ? -1 : 1;
      for (let t = 0; t < 22 + i % 16; t++) {
        const px = x + Math.sin(t * 0.14 + i) * 8, py = y + t * direction * 0.65;
        line(px, py, px + 2, py, green ? 0x2b4029 : 0x32291d);
        put(px, py - 1, green ? 0x5b6e3c : 0x655235);
        if (green && t % 7 === 0) {
          oval(px + (t % 2 ? -3 : 4), py, 4, 2, 0x3b542e, 0x657b42);
          put(px + 1, py + 1, 0x82965b);
        }
      }
    }
  }
  if (theme === 'cellar') {
    // Buried timber supports and plank seams frame the arena, never fake obstacles.
    for (const x of [47, 120, 357, 430]) {
      for (let dx = 0; dx < 8; dx++) {
        line(x + dx, 18, x + dx, 52, dx === 0 ? 0x7b6241 : dx % 3 ? 0x4d3e2b : 0x322c21);
        line(x + dx, 223, x + dx, 253, dx === 0 ? 0x6b573b : 0x463a29);
      }
      for (const y of [24, 45, 231, 249]) {
        line(x, y, x + 7, y, 0x30352f);
        put(x + 1, y, 0x7b7961); put(x + 6, y, 0x666a59);
      }
    }
    for (const y of [20, 24, 248, 252]) line(20, y, 459, y, y % 8 ? 0x57472f : 0x756040);
    for (let i = 0; i < 22; i++) {
      const [x, y] = edgePoint(i);
      line(x, y, x + 12, y + 2, 0x554832);
      line(x + 1, y + 1, x + 9, y + 3, 0x332e24);
    }
  }
  if (theme === 'vines' || theme === 'cellar') {
    // Sparse shafts through overhead cracks. Grain remains visible through the light.
    for (const sourceX of [147, 327]) for (let y = 30; y < 100; y++) {
      const width = 2 + (y - 30) * 0.13;
      for (let x = Math.floor(sourceX + (y - 30) * 0.28 - width); x < sourceX + (y - 30) * 0.28 + width; x++) {
        if (isPassage(x, y)) continue;
        const i = (y * WORLD_WIDTH + x) * 4;
        const strength = (1 - (y - 30) / 70) * 0.1;
        pixels[i] += 130 * strength; pixels[i + 1] += 115 * strength; pixels[i + 2] += 70 * strength;
      }
    }
  }
}

function createRuinsPixels(exits: readonly Direction[], seed: number): Uint8ClampedArray {
  const pixels = new Uint8ClampedArray(WORLD_WIDTH * WORLD_HEIGHT * 4);
  const random = createSeededRandom(seed);
  const passages = exits.map(getDoorwayRect);
  const inPassage = (x: number, y: number): boolean =>
    passages.some((p) => Math.abs(x - p.x) < p.width / 2 && Math.abs(y - p.y) < p.height / 2);
  const inside = (x: number, y: number): boolean =>
    x >= ROOM_RECT.left && x < ROOM_RECT.right && y >= ROOM_RECT.top && y < ROOM_RECT.bottom;
  const set = (x: number, y: number, color: number): void => {
    x = Math.floor(x);
    y = Math.floor(y);
    if (x < 0 || x >= WORLD_WIDTH || y < 0 || y >= WORLD_HEIGHT) return;
    const i = (y * WORLD_WIDTH + x) * 4;
    pixels[i] = (color >> 16) & 255;
    pixels[i + 1] = (color >> 8) & 255;
    pixels[i + 2] = color & 255;
    pixels[i + 3] = 255;
  };
  const rgb = (r: number, g: number, b: number): number =>
    (Math.max(0, Math.min(255, Math.round(r))) << 16) |
    (Math.max(0, Math.min(255, Math.round(g))) << 8) |
    Math.max(0, Math.min(255, Math.round(b)));

  for (let y = 0; y < WORLD_HEIGHT; y += 1) {
    for (let x = 0; x < WORLD_WIDTH; x += 1) {
      const grain = random();
      const floor = inside(x, y) || inPassage(x, y);
      const wall =
        x >= ROOM_RECT.left - WALL_THICKNESS &&
        x < ROOM_RECT.right + WALL_THICKNESS &&
        y >= ROOM_RECT.top - WALL_THICKNESS &&
        y < ROOM_RECT.bottom + WALL_THICKNESS;
      if (floor) {
        const patch = Math.sin(x * 0.047 + Math.sin(y * 0.07)) * 2 + Math.cos(y * 0.06) * 2;
        const edge = Math.max(
          0,
          1 -
            Math.min(
              x - ROOM_RECT.left,
              ROOM_RECT.right - x,
              y - ROOM_RECT.top,
              ROOM_RECT.bottom - y,
            ) /
              16,
        );
        const grit = grain < 0.16 ? -5 : grain > 0.92 ? 6 : 0;
        set(
          x,
          y,
          rgb(
            30 + patch + grit - edge * 9,
            28 + patch + grit - edge * 9,
            27 + patch + grit - edge * 7,
          ),
        );
      } else if (wall) {
        // Staggered, chipped masonry with dark mortar and layered earth.
        const row = Math.floor((y - 16) / 9);
        const seamX = (x + (row % 2) * 13) % 29;
        const seamY = (y - 16) % 9;
        const mortar = seamX < 2 || seamY === 8;
        const chip = grain < 0.14 ? -7 : grain > 0.94 ? 7 : 0;
        const height = seamY === 0 ? 8 : seamY > 5 ? -6 : 0;
        const shade = mortar ? -17 : height + chip;
        set(x, y, rgb(48 + shade, 43 + shade, 37 + shade));
      } else {
        set(x, y, 0x07090c);
      }
    }
  }

  // Half-buried stone slabs. Uneven edges and sparse seams avoid a tile grid.
  for (let n = 0; n < 75; n += 1) {
    const x = 42 + Math.floor(random() * (ROOM_RECT.width - 30));
    const y = 43 + Math.floor(random() * (ROOM_RECT.height - 30));
    const w = 6 + Math.floor(random() * 24);
    const h = 3 + Math.floor(random() * 9);
    for (let py = 0; py < h; py += 1) {
      for (let px = 0; px < w; px += 1) {
        if (!inside(x + px, y + py) || (px + py) % 17 === 0 || (px < 2 && py < 2)) continue;
        if (random() < 0.08) continue;
        const v = py === 0 ? 7 : py === h - 1 ? -7 : Math.floor(random() * 4);
        set(x + px, y + py, rgb(36 + v, 35 + v, 32 + v));
      }
    }
  }

  // Hairline cracks and roots stay mostly near the walls, leaving the arena calm.
  for (let n = 0; n < 55; n += 1) {
    let x = 35 + Math.floor(random() * (ROOM_RECT.width - 6));
    let y = random() < 0.5 ? 34 + random() * 20 : ROOM_RECT.bottom - 22 + random() * 18;
    const length = 5 + Math.floor(random() * 20);
    for (let step = 0; step < length; step += 1) {
      if (inside(x, y)) {
        set(x, y, 0x151515);
        if (n % 3 === 0) set(x, y - 1, 0x494134);
      }
      x += random() < 0.7 ? 1 : -1;
      y += random() < 0.5 ? 1 : 0;
    }
  }

  // Broken, unlit engravings in the corner stones; no gameplay warning symbols.
  for (const cx of [57, WORLD_WIDTH - 58]) {
    for (const cy of [53, WORLD_HEIGHT - 54]) {
      for (let p = 0; p < 13; p += 1) {
        if (p === 4 || p === 9) continue;
        set(cx + p, cy, 0x504a3f);
        set(cx, cy + p, 0x504a3f);
        set(cx + 5, cy + p / 2 + 4, 0x39372f);
      }
    }
  }
  return pixels;
}

function createBurrowPixels(exits: readonly Direction[], seed: number): Uint8ClampedArray {
  const random = createSeededRandom(seed);
  const pixels = new Uint8ClampedArray(WORLD_WIDTH * WORLD_HEIGHT * 4);
  const passages = exits.map(getDoorwayRect);
  const inPassage = (x: number, y: number): boolean =>
    passages.some((p) => Math.abs(x - p.x) < p.width / 2 && Math.abs(y - p.y) < p.height / 2);
  const inside = (x: number, y: number): boolean =>
    x >= ROOM_RECT.left && x < ROOM_RECT.right && y >= ROOM_RECT.top && y < ROOM_RECT.bottom;
  const put = (x: number, y: number, r: number, g: number, b: number): void => {
    x = Math.floor(x);
    y = Math.floor(y);
    if (x < 0 || x >= WORLD_WIDTH || y < 0 || y >= WORLD_HEIGHT) return;
    const i = (y * WORLD_WIDTH + x) * 4;
    pixels[i] = r;
    pixels[i + 1] = g;
    pixels[i + 2] = b;
    pixels[i + 3] = 255;
  };
  const lumps = Array.from({ length: 100 }, () => ({
    x: random() * WORLD_WIDTH,
    y: random() * WORLD_HEIGHT,
    radius: 5 + random() * 14,
    shade: random() * 10,
  }));
  for (let y = 0; y < WORLD_HEIGHT; y += 1) {
    for (let x = 0; x < WORLD_WIDTH; x += 1) {
      const grain = random();
      const edge = Math.min(
        x - ROOM_RECT.left,
        ROOM_RECT.right - x - 1,
        y - ROOM_RECT.top,
        ROOM_RECT.bottom - y - 1,
      );
      const depth = -edge;
      const roughness = Math.sin(x * 0.19 + y * 0.14) * 2 + Math.sin(x * 0.52 - y * 0.31) * 1.5;
      if (inside(x, y) || inPassage(x, y)) {
        const patch =
          Math.sin(x * 0.04 + Math.cos(y * 0.06)) * 3 + Math.sin(y * 0.09 + x * 0.02) * 2;
        const shadow = Math.max(0, 1 - Math.max(0, edge) / 12) * 8;
        const grit = grain < 0.17 ? -5 : grain > 0.94 ? 6 : 0;
        put(
          x,
          y,
          34 + patch + grit - shadow,
          28 + patch + grit - shadow,
          20 + patch + grit - shadow * 0.6,
        );
      } else if (depth < WALL_THICKNESS + 3 + roughness) {
        // Uneven compacted soil and embedded rounded rocks, without masonry joints.
        let clump = 0;
        for (const lump of lumps) {
          const distance = Math.hypot((x - lump.x) * 0.85, y - lump.y);
          if (distance < lump.radius) clump += (1 - distance / lump.radius) * (10 + lump.shade);
        }
        const strata = Math.sin(y * 0.4 + Math.sin(x * 0.09) * 3) * 4;
        const ledge = depth < 3 + roughness * 0.3 ? 13 : depth > 12 + roughness ? -12 : 0;
        const grit = grain < 0.17 ? -8 : grain > 0.89 ? 7 : 0;
        put(
          x,
          y,
          51 + strata + clump + ledge + grit,
          41 + strata + clump * 0.75 + ledge + grit,
          26 + clump * 0.4 + ledge * 0.5 + grit,
        );
      } else put(x, y, 7, 9, 12);
    }
  }
  // Natural gravel, rather than rectangular paving slabs.
  for (let n = 0; n < 150; n += 1) {
    const x = 36 + random() * (ROOM_RECT.width - 8),
      y = 36 + random() * (ROOM_RECT.height - 8);
    const r = 1 + random() * 3;
    for (let dy = -3; dy <= 3; dy += 1)
      for (let dx = -4; dx <= 4; dx += 1) {
        if (!inside(x + dx, y + dy) || dx * dx * 0.6 + dy * dy > r * r || random() < 0.1) continue;
        const highlight = dy < 0 ? 6 : -3;
        put(x + dx, y + dy, 42 + highlight, 37 + highlight, 28 + highlight);
      }
  }
  // Branched exposed roots on all four sides, with a thin top-facing highlight.
  for (let n = 0; n < 24; n += 1) {
    const side = n % 4;
    let x =
      side === 0 ? 30 : side === 1 ? WORLD_WIDTH - 31 : 45 + random() * (ROOM_RECT.width - 30);
    let y =
      side === 2 ? 28 : side === 3 ? WORLD_HEIGHT - 29 : 45 + random() * (ROOM_RECT.height - 30);
    const directionX = side === 0 ? 1 : side === 1 ? -1 : 0;
    const directionY = side === 2 ? 1 : side === 3 ? -1 : 0;
    const length = 10 + random() * 20;
    for (let step = 0; step < length; step += 1) {
      if (!inPassage(x, y)) {
        put(x, y, 29, 22, 14);
        put(x + 1, y, 65, 49, 29);
        if (step < length * 0.65) put(x + 1, y - 1, 79, 61, 36);
        if (step > 5 && step % 7 === 0)
          for (let branch = 1; branch < 5; branch += 1)
            if (!inPassage(x + branch, y + branch)) put(x + branch, y + branch, 52, 40, 24);
      }
      x += directionX + (random() - 0.5) * 1.8;
      y += directionY + (random() - 0.5) * 1.8;
    }
  }
  return pixels;
}
