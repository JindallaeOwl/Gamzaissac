/** Fine, unfiltered prop pixels. Shared material colors keep props in the cave palette. */
export interface PropPixels {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

const MATERIAL = {
  outline: 0x181714,
  crack: 0x29221b,
  wood: [0x4a3827, 0x513d2a, 0x59432e, 0x624a32, 0x6a5138],
  grain: 0x796044,
  cut: 0x92734e,
  iron: [0x303532, 0x3e433e, 0x51564b],
  ironEdge: 0x767968,
  rust: 0x78503a,
  brass: [0x635337, 0x807047, 0x9a8857],
  brassEdge: 0xb3a173,
  moss: 0x454b2f,
};

// Coordinate noise stays fixed across frames and never consumes combat randomness.
function grain(x: number, y: number, salt = 0): number {
  let n = Math.imul(x + salt, 374761393) ^ Math.imul(y + 19, 668265263);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return (n ^ (n >>> 16)) >>> 0;
}

class PropCanvas implements PropPixels {
  readonly data: Uint8ClampedArray;

  constructor(
    readonly width: number,
    readonly height: number,
  ) {
    this.data = new Uint8ClampedArray(width * height * 4);
  }

  pixel(x: number, y: number, color: number, alpha = 255): void {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return;
    const i = (y * this.width + x) * 4;
    this.data.set([(color >>> 16) & 255, (color >>> 8) & 255, color & 255, alpha], i);
  }

  rect(x: number, y: number, width: number, height: number, color: number, alpha = 255): void {
    for (let dy = 0; dy < height; dy++) {
      for (let dx = 0; dx < width; dx++) this.pixel(x + dx, y + dy, color, alpha);
    }
  }

  line(x: number, y: number, endX: number, endY: number, color: number): void {
    const steps = Math.max(Math.abs(endX - x), Math.abs(endY - y));
    for (let i = 0; i <= steps; i++) {
      const t = steps ? i / steps : 0;
      this.pixel(Math.round(x + (endX - x) * t), Math.round(y + (endY - y) * t), color);
    }
  }

  wood(x: number, y: number, width: number, height: number, salt: number, shaded = false): void {
    for (let dy = 0; dy < height; dy++) {
      for (let dx = 0; dx < width; dx++) {
        // Long streaks, interrupted scratches and individual pores, rather than flat noise.
        const n = grain(dx, Math.floor(dy / 4), salt);
        let color = MATERIAL.wood[n % (shaded ? 3 : 5)];
        if (n % 11 === 0 && dy % 7 !== 0) color = MATERIAL.crack;
        else if (!shaded && n % 7 === 0 && grain(dx, dy, salt) % 3 !== 0) {
          color = MATERIAL.grain;
        }
        this.pixel(x + dx, y + dy, color);
      }
    }
  }

  metal(x: number, y: number, width: number, height: number, brass = false): void {
    const colors = brass ? MATERIAL.brass : MATERIAL.iron;
    this.rect(x, y, width, height, MATERIAL.outline);
    for (let dy = 1; dy < height - 1; dy++) {
      for (let dx = 1; dx < width - 1; dx++) {
        const n = grain(x + dx, y + dy, 73);
        this.pixel(x + dx, y + dy, n % 13 === 0 ? MATERIAL.rust : colors[n % 3]);
      }
    }
    for (let dx = 1; dx < width - 1; dx++) {
      if (grain(dx, y) % 4 !== 0) {
        this.pixel(x + dx, y, brass ? MATERIAL.brassEdge : MATERIAL.ironEdge);
      }
    }
  }

  rivet(x: number, y: number, brass = false): void {
    this.pixel(x, y, brass ? MATERIAL.brassEdge : MATERIAL.ironEdge);
    this.pixel(x, y + 1, MATERIAL.outline);
  }
}

/** Same 48×16 doorway footprint, now with one-pixel wood fibers and corroded iron. */
export function buildCaveDoor(vertical = false): PropPixels {
  const p = new PropCanvas(48, 16);
  p.rect(0, 0, 48, 16, MATERIAL.outline);
  for (let plank = 0; plank < 8; plank++) {
    const x = plank * 6 + 1;
    p.wood(x, 1, 5, 13, plank * 17 + 3);
    p.line(x, 1, x + 3, 1, MATERIAL.grain);
    p.line(x + 4, 4, x + 4, 13, MATERIAL.crack);
  }
  p.rect(23, 0, 2, 16, 0x101310);
  for (const x of [1, 26]) {
    p.metal(x, 3, 21, 3);
    p.metal(x, 11, 21, 3);
    for (const dx of [2, 17]) {
      p.rivet(x + dx, 4);
      p.rivet(x + dx, 12);
    }
  }
  // Recessed iron pulls. Only the worn upper edge catches the torchlight.
  for (const x of [19, 27]) {
    p.rect(x, 6, 3, 5, MATERIAL.outline);
    p.line(x, 7, x, 9, MATERIAL.ironEdge);
    p.pixel(x + 1, 10, MATERIAL.iron[1]);
  }
  p.line(9, 7, 10, 10, MATERIAL.crack);
  p.pixel(11, 9, MATERIAL.cut);
  for (const x of [0, 1, 7, 34, 45, 47]) p.pixel(x, 15, MATERIAL.moss);

  if (!vertical) return p;
  const rotated = new PropCanvas(16, 48);
  for (let y = 0; y < p.height; y++) {
    for (let x = 0; x < p.width; x++) {
      const i = (y * p.width + x) * 4;
      rotated.data.set(p.data.subarray(i, i + 4), (x * rotated.width + y) * 4);
    }
  }
  return rotated;
}

/** 40×40, preserving the old 36×34 wooden body and transparent contact shadow. */
export function buildCaveCrate(): PropPixels {
  const p = new PropCanvas(40, 40);
  p.rect(4, 35, 32, 3, 0x100f0b, 90);
  p.rect(7, 38, 25, 1, 0x100f0b, 40);
  p.rect(2, 2, 36, 34, MATERIAL.outline);
  p.wood(3, 3, 30, 5, 71);
  p.line(4, 3, 31, 3, MATERIAL.cut);
  for (let plank = 0; plank < 5; plank++) {
    p.wood(3 + plank * 6, 9, 5, 24, plank * 29);
    p.line(3 + plank * 6, 10, 3 + plank * 6, 31, MATERIAL.grain);
  }
  p.wood(34, 7, 3, 27, 42, true);
  p.line(33, 8, 33, 33, MATERIAL.crack);
  // Braces are thin, chipped timber with a shadow below each edge.
  for (const y of [8, 30]) {
    p.rect(3, y, 30, 4, MATERIAL.crack);
    p.wood(3, y, 30, 3, y + 100);
    p.line(4, y, 31, y, MATERIAL.grain);
  }
  for (let x = 5; x < 31; x++) {
    const y = 28 - Math.floor((x - 5) * 0.62);
    p.rect(x, y, 1, 4, MATERIAL.crack);
    p.pixel(x, y, MATERIAL.grain);
    p.pixel(x, y + 1, MATERIAL.wood[3]);
    p.pixel(x, y + 2, MATERIAL.wood[1]);
  }
  for (const x of [5, 30]) {
    p.rivet(x, 9);
    p.rivet(x, 31);
  }
  p.line(14, 12, 13, 17, MATERIAL.crack);
  p.line(13, 17, 15, 20, MATERIAL.crack);
  p.pixel(16, 19, MATERIAL.cut);
  p.rect(22, 24, 2, 1, MATERIAL.crack);
  p.pixel(23, 25, MATERIAL.grain);
  p.pixel(2, 2, 0, 0);
  p.pixel(37, 2, 0, 0);
  p.pixel(2, 35, 0, 0);
  return p;
}

/** Keep the 64×64 pickup canvas and original base position for opening/pushing. */
export function buildCaveChest(open: boolean): PropPixels {
  const p = new PropCanvas(64, 64);
  p.rect(16, 53, 33, 3, 0x0e100c, 85);
  p.rect(19, 56, 27, 1, 0x0e100c, 35);

  // Both states share the exact base. The raised lid exposes a dark, empty cavity.
  p.rect(16, 38, 32, 16, MATERIAL.outline);
  p.wood(18, 40, 27, 11, 133);
  p.wood(45, 40, 2, 12, 11, true);
  p.line(18, 46, 44, 46, MATERIAL.crack);
  p.line(18, 47, 43, 47, MATERIAL.grain);
  p.line(18, 52, 45, 52, MATERIAL.crack);

  const top = open ? 10 : 24;
  const bottom = open ? 30 : 39;
  p.rect(18, top, 28, 2, MATERIAL.outline);
  p.rect(16, top + 2, 32, bottom - top - 1, MATERIAL.outline);
  p.wood(18, top + 2, 28, bottom - top - 3, 24);
  p.line(20, top + 2, 43, top + 2, MATERIAL.cut);
  p.line(18, top + 6, 45, top + 6, MATERIAL.grain);
  p.line(18, top + 10, 45, top + 10, MATERIAL.crack);
  if (open) {
    p.rect(20, 15, 24, 11, 0x272820);
    p.line(21, 16, 42, 16, MATERIAL.wood[0]);
    p.line(21, 25, 42, 25, MATERIAL.crack);
    p.metal(17, 30, 30, 3, true);
    p.rect(18, 33, 28, 7, 0x121713);
    p.rect(20, 34, 24, 3, 0x20231b);
    p.line(18, 39, 45, 39, MATERIAL.grain);
  }
  for (const x of [19, 41]) {
    p.metal(x, top + 1, 4, bottom - top - 1, true);
    p.metal(x, 40, 4, 12, true);
    p.rivet(x + 1, top + 4, true);
    p.rivet(x + 1, bottom - 4, true);
    p.rivet(x + 1, 49, true);
  }
  p.metal(17, 40, 30, 3, true);
  // Tarnished latch and a readable keyhole, never a glowing yellow outline.
  p.metal(29, open ? 41 : 37, 6, 9, true);
  p.rect(31, open ? 44 : 40, 2, 2, MATERIAL.outline);
  p.pixel(31, open ? 46 : 42, MATERIAL.outline);
  p.line(25, 48, 26, 50, MATERIAL.crack);
  p.pixel(36, 44, MATERIAL.cut);
  p.rect(17, 53, 4, 2, MATERIAL.outline);
  p.rect(43, 53, 4, 2, MATERIAL.outline);
  return p;
}
