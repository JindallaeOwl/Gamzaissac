import { createSeededRandom, type RandomSource } from '../utils/random';
import type { DebrisBounds } from './PixelDebris';

export interface FireSource {
  x: number;
  y: number;
}
export interface FireParticle {
  x: number;
  y: number;
  previousX: number;
  previousY: number;
  vx: number;
  vy: number;
  age: number;
  lifetime: number;
  size: number;
  kind: 'flame' | 'ember' | 'smoke';
  phase: number;
}
export const MAX_FIRE_PARTICLES = 420;
export const MAX_GROUND_EMBERS = 96;
export interface GroundEmber {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  age: number;
  lifetime: number;
  phase: number;
  emission: number;
  size: number;
}
const STEP = 1 / 120;

export function groundEmberAppearance(p: GroundEmber): { color: number; alpha: number } {
  const heat = Math.max(0, 1 - p.age / p.lifetime);
  return {
    color: heat > 0.7 ? 0xffa43b : heat > 0.38 ? 0xe46123 : heat > 0.15 ? 0x9c341e : 0x54271e,
    alpha: Math.min(1, heat * 5) * (0.78 + Math.sin(p.age * 11 + p.phase) * 0.16),
  };
}

export function fireAppearance(p: FireParticle): { color: number; alpha: number; size: number } {
  const life = Math.min(1, p.age / p.lifetime);
  if (p.kind === 'smoke')
    return {
      color: 0x444044,
      alpha: Math.sin(life * Math.PI) * 0.18,
      size: p.size + Math.floor(life * 3),
    };
  const color =
    life < 0.16
      ? 0xfff9c9
      : life < 0.36
        ? 0xffdf64
        : life < 0.62
          ? 0xff922e
          : life < 0.83
            ? 0xed4a1d
            : 0x992b1d;
  return {
    color,
    alpha: Math.min(1, (1 - life) * 4),
    size: Math.max(1, Math.round(p.size * (1 - life * 0.6))),
  };
}

/** Buoyant hot gas, gravity-driven embers, cooling colors and drag; no collision damage. */
export class PixelFire {
  readonly particles: FireParticle[] = [];
  readonly groundEmbers: GroundEmber[] = [];
  private sources: readonly FireSource[] = [];
  private accumulator = 0;
  private emission = 0;
  private time = 0;
  private serial = 0;

  constructor(
    private readonly random: RandomSource = createSeededRandom(9327),
    private readonly bounds?: DebrisBounds,
  ) {}

  setSources(sources: readonly FireSource[]): void {
    this.clear();
    this.sources = sources;
    // Warm start gives a formed flame immediately on room entry.
    for (let i = 0; i < 75; i += 1) this.step();
  }

  update(deltaMs: number): void {
    if (!Number.isFinite(deltaMs) || deltaMs <= 0) return;
    this.accumulator += Math.min(deltaMs / 1000, 0.1);
    while (this.accumulator + 1e-9 >= STEP) {
      this.accumulator -= STEP;
      this.step();
    }
  }

  blast(x: number, y: number): void {
    for (const p of this.particles) {
      const dx = p.x - x,
        dy = p.y - y,
        length = Math.hypot(dx, dy);
      if (length > 0 && length < 100) {
        const force = 110 * (1 - length / 100);
        p.vx += (dx / length) * force;
        p.vy += (dy / length) * force;
      }
    }
    for (let i = 0; i < 105; i += 1) {
      const angle = this.random() * Math.PI * 2;
      const speed = 35 + this.random() * 125;
      this.add(
        x + (this.random() - 0.5) * 8,
        y + (this.random() - 0.5) * 8,
        Math.cos(angle) * speed,
        Math.sin(angle) * speed - 20,
        i < 70 ? 'ember' : i < 96 ? 'flame' : 'smoke',
        true,
      );
    }
    // Low, heavy coals settle around the blast rather than drifting down the screen.
    for (let i = 0; i < 18; i += 1) {
      const angle = this.random() * Math.PI * 2;
      const radius = this.random() * 12;
      const speed = 12 + this.random() * 28;
      if (this.groundEmbers.length >= MAX_GROUND_EMBERS) this.groundEmbers.shift();
      const ember: GroundEmber = {
        x: x + Math.cos(angle) * radius,
        y: y + Math.sin(angle) * radius * 0.65,
        z: 2 + this.random() * 4,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed * 0.65,
        vz: 18 + this.random() * 24,
        age: 0,
        lifetime: 4 + this.random() * 3,
        phase: this.random() * Math.PI * 2,
        emission: this.random(),
        size: this.random() < 0.7 ? 1 : 2,
      };
      this.clampEmber(ember);
      this.groundEmbers.push(ember);
    }
  }

  clear(): void {
    this.particles.length = 0;
    this.groundEmbers.length = 0;
    this.accumulator = 0;
    this.emission = 0;
    this.time = 0;
    this.sources = [];
  }

  private step(): void {
    this.time += STEP;
    this.stepGroundEmbers();
    this.emission += STEP * 82;
    while (this.emission >= 1) {
      this.emission -= 1;
      for (const source of this.sources) {
        this.serial += 1;
        const kind = this.serial % 17 === 0 ? 'smoke' : this.serial % 11 === 0 ? 'ember' : 'flame';
        this.add(
          source.x + (this.random() - 0.5) * 4,
          source.y + this.random() * 2,
          (this.random() - 0.5) * 9,
          -10 - this.random() * 19,
          kind,
        );
      }
    }
    for (let i = this.particles.length - 1; i >= 0; i -= 1) {
      const p = this.particles[i];
      p.age += STEP;
      if (p.age >= p.lifetime) {
        this.particles.splice(i, 1);
        continue;
      }
      p.previousX = p.x;
      p.previousY = p.y;
      const lift = p.kind === 'ember' ? 45 : p.kind === 'smoke' ? -9 : -26;
      const drag = Math.exp(-(p.kind === 'ember' ? 0.8 : 1.7) * STEP);
      const curl = p.kind === 'ember' ? 3 : 20;
      p.vx = (p.vx + Math.sin(this.time * 7 + p.phase + p.y * 0.17) * curl * STEP) * drag;
      p.vy = (p.vy + lift * STEP) * drag;
      p.x += p.vx * STEP;
      p.y += p.vy * STEP;
    }
  }

  private stepGroundEmbers(): void {
    for (let i = this.groundEmbers.length - 1; i >= 0; i--) {
      const p = this.groundEmbers[i];
      p.age += STEP;
      if (p.age >= p.lifetime) {
        this.groundEmbers.splice(i, 1);
        continue;
      }
      const airborne = p.z > 0 || p.vz > 0;
      if (airborne) {
        p.vz -= 180 * STEP;
        p.z = Math.max(0, p.z + p.vz * STEP);
        if (p.z === 0) p.vz = -p.vz > 20 ? -p.vz * 0.2 : 0;
      }
      const drag = Math.exp(-(airborne ? 1.5 : 12) * STEP);
      p.vx *= drag;
      p.vy *= drag;
      p.x += p.vx * STEP;
      p.y += p.vy * STEP;
      this.clampEmber(p);
      const heat = 1 - p.age / p.lifetime;
      if (p.z === 0 && heat > 0.2) {
        p.emission += STEP * 2.5 * heat;
        if (p.emission >= 1) {
          p.emission -= 1;
          this.add(
            p.x,
            p.y,
            (this.random() - 0.5) * 5,
            -5 - this.random() * 6,
            this.random() < 0.3 ? 'smoke' : 'flame',
          );
          const flame = this.particles[this.particles.length - 1];
          flame.size = 1;
          if (flame.kind === 'flame') {
            flame.lifetime = 0.35 + heat * 0.3;
            flame.age = flame.lifetime * 0.35; // Small orange flickers, not another white explosion.
          }
        }
      }
    }
  }

  private clampEmber(p: GroundEmber): void {
    if (!this.bounds) return;
    p.x = Math.max(this.bounds.left + 2, Math.min(this.bounds.right - 3, p.x));
    p.y = Math.max(this.bounds.top + 2, Math.min(this.bounds.bottom - 3, p.y));
  }

  private add(
    x: number,
    y: number,
    vx: number,
    vy: number,
    kind: FireParticle['kind'],
    blast = false,
  ): void {
    if (this.particles.length >= MAX_FIRE_PARTICLES) this.particles.shift();
    this.particles.push({
      x,
      y,
      previousX: x,
      previousY: y,
      vx,
      vy,
      kind,
      age: 0,
      lifetime:
        kind === 'smoke'
          ? 0.8 + this.random() * 0.7
          : kind === 'ember'
            ? 0.7 + this.random() * 0.65
            : 0.24 + this.random() * (blast ? 0.6 : 0.46),
      size: kind === 'ember' ? 1 : (blast ? 2 : 1) + this.random() * 2,
      phase: this.random() * Math.PI * 2,
    });
  }
}
