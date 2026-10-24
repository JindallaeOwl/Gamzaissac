export interface DebrisBounds {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export interface DebrisPiece {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  size: number;
  color: number;
  age: number;
  lifetime: number;
  bounces: number;
  retain: boolean;
}

export interface GroundDebris {
  x: number;
  y: number;
  size: number;
  color: number;
}

export const MAX_GROUND_DEBRIS = 120;

export const MAX_DEBRIS = 180;
const STEP = 1 / 120;

/** Cosmetic only: x/y are floor coordinates, z is height above that floor. */
export class PixelDebris {
  readonly pieces: DebrisPiece[] = [];
  ground: GroundDebris[] = [];
  private accumulator = 0;
  private emissionIndex = 0;

  constructor(
    private readonly bounds: DebrisBounds,
    private readonly random: () => number = Math.random,
  ) {}

  emit(x: number, y: number, color: number, count: number, power = 1, retain = false): void {
    const amount = Math.min(MAX_DEBRIS, Math.max(0, Math.floor(count)));
    const removed = this.pieces.splice(0, Math.max(0, this.pieces.length + amount - MAX_DEBRIS));
    for (const piece of removed) this.deposit(piece);
    for (let i = 0; i < amount; i += 1) {
      const angle = this.random() * Math.PI * 2;
      const speed = (18 + this.random() * 48) * power;
      this.pieces.push({
        x,
        y,
        z: 2 + this.random() * 3,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed * 0.65,
        vz: (32 + this.random() * 46) * power,
        size: 1 + Math.floor(this.random() * 3),
        color,
        age: 0,
        lifetime: 1.4 + this.random(),
        bounces: 0,
        retain: retain && this.emissionIndex++ % 3 === 0,
      });
    }
  }

  update(deltaMs: number): void {
    // Fixed steps keep bounces consistent at 30/60/120 Hz. Do not simulate a
    // background tab's entire delay on return.
    if (!Number.isFinite(deltaMs) || deltaMs <= 0) return;
    this.accumulator += Math.min(deltaMs / 1000, 0.1);
    while (this.accumulator + 1e-9 >= STEP) {
      this.accumulator -= STEP;
      for (let i = this.pieces.length - 1; i >= 0; i -= 1) {
        const p = this.pieces[i];
        p.age += STEP;
        if (p.age >= p.lifetime) {
          this.deposit(p);
          this.pieces.splice(i, 1);
          continue;
        }
        const airborne = p.z > 0 || p.vz > 0;
        if (airborne) {
          p.vz -= 240 * STEP;
          p.z += p.vz * STEP;
          if (p.z <= 0) {
            p.z = 0;
            p.bounces += 1;
            p.vz = p.bounces < 2 && -p.vz > 18 ? -p.vz * 0.32 : 0;
            p.vx *= 0.62;
            p.vy *= 0.62;
          }
        }
        const drag = Math.exp(-(airborne ? 0.7 : 12) * STEP);
        p.vx *= drag;
        p.vy *= drag;
        if (!airborne && Math.hypot(p.vx, p.vy) < 1) {
          p.vx = 0;
          p.vy = 0;
          if (p.retain) {
            this.deposit(p);
            this.pieces.splice(i, 1);
            continue;
          }
        }
        p.x += p.vx * STEP;
        p.y += p.vy * STEP;
        const margin = p.size / 2;
        const left = this.bounds.left + margin;
        const right = this.bounds.right - margin;
        const top = this.bounds.top + margin;
        const bottom = this.bounds.bottom - margin;
        if (p.x < left || p.x > right) {
          p.x = Math.max(left, Math.min(right, p.x));
          p.vx *= -0.4;
        }
        if (p.y < top || p.y > bottom) {
          p.y = Math.max(top, Math.min(bottom, p.y));
          p.vy *= -0.4;
        }
      }
    }
  }

  emitBomb(x: number, y: number): void {
    // Charred shell, exposed iron and burnt fuse. Retained pieces use room persistence.
    for (const color of [0x2b313b, 0x596475, 0x62523b]) {
      for (let i = 0; i < 9; i++) {
        this.emit(x, y, color, 1, 1.2, true);
        const piece = this.pieces[this.pieces.length - 1];
        piece.size = Math.min(2, piece.size);
        piece.lifetime = 5 + this.random() * 3;
      }
    }
  }

  clear(): void {
    this.pieces.length = 0;
    this.accumulator = 0;
  }

  /** Arrays belong to RoomNode; returning to a room reuses its small settled fragments. */
  enterRoom(ground: GroundDebris[]): void {
    for (const piece of this.pieces) this.deposit(piece);
    this.clear();
    this.ground = ground;
  }

  private deposit(piece: DebrisPiece): void {
    if (!piece.retain) return;
    this.ground.push({
      x: Math.max(this.bounds.left + 2, Math.min(this.bounds.right - 2, Math.round(piece.x))),
      y: Math.max(this.bounds.top + 2, Math.min(this.bounds.bottom - 2, Math.round(piece.y))),
      size: Math.min(2, piece.size),
      color: piece.color,
    });
    this.ground.splice(0, Math.max(0, this.ground.length - MAX_GROUND_DEBRIS));
  }
}
