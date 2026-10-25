import type Phaser from 'phaser';
import { describe, expect, it } from 'vitest';
import {
  SEED_FRAMES,
  SEED_FRAME_HEIGHT,
  SEED_FRAME_WIDTH,
  SEED_FRAME_MS,
  SEED_PALETTE,
  SEED_DROP_BOUNCE_MS,
  SEED_DROP_FADE_MS,
  seedDropFallMs,
  seedDropPose,
  seedFlightFrame,
} from '../src/systems/seedPixelSprites';
import { MAX_SEED_FLASHES, SeedShotEffects } from '../src/systems/SeedShotEffects';

function fixture() {
  const pixels: { x: number; y: number; width: number; height: number; color: number }[] = [];
  let color = 0;
  const graphics = {
    setDepth() {
      return this;
    },
    clear() {
      pixels.length = 0;
      return this;
    },
    fillStyle(value: number) {
      color = value;
      return this;
    },
    fillRect(x: number, y: number, width: number, height: number) {
      pixels.push({ x, y, width, height, color });
      return this;
    },
  };
  const scene = { add: { graphics: () => graphics } } as unknown as Phaser.Scene;
  return { effects: new SeedShotEffects(scene), pixels };
}

describe('seed visuals', () => {
  it('carries the flight velocity into a downward arc in every firing direction', () => {
    for (const velocity of [
      { x: 260, y: 0 },
      { x: -260, y: 0 },
      { x: 0, y: 260 },
      { x: 0, y: -260 },
    ]) {
      const fallMs = seedDropFallMs(260);
      const start = seedDropPose(0, velocity, fallMs);
      const next = seedDropPose(0.001, velocity, fallMs);
      expect(start.x).toBeCloseTo(0);
      expect(start.y).toBeCloseTo(0);
      expect((next.x - start.x) / 0.000001).toBeCloseTo(velocity.x, 1);
      expect((next.y - start.y) / 0.000001).toBeCloseTo(velocity.y, 1);
      const landing = seedDropPose(fallMs, velocity, fallMs);
      expect(landing.y).toBe(landing.groundY);
      const beforeLanding = seedDropPose(fallMs - 1, velocity, fallMs);
      expect(landing.y).toBeGreaterThan(beforeLanding.y);
    }
  });

  it('makes a tiny landing hop, fades promptly and bounds fast seeds extra travel', () => {
    const velocity = { x: 260, y: 0 };
    const fallMs = seedDropFallMs(260);
    const landing = seedDropPose(fallMs, velocity, fallMs);
    const hop = seedDropPose(fallMs + SEED_DROP_BOUNCE_MS / 2, velocity, fallMs);
    expect(landing.y - hop.y).toBeCloseTo(1.5);
    const settled = seedDropPose(fallMs + SEED_DROP_BOUNCE_MS, velocity, fallMs);
    expect(settled.y).toBe(landing.y);
    expect(settled.x).toBe(landing.x);
    expect(settled.squash).toBe(1);
    expect(settled.alpha).toBe(1);
    const vanished = seedDropPose(
      fallMs + SEED_DROP_BOUNCE_MS + SEED_DROP_FADE_MS,
      velocity,
      fallMs,
    );
    expect(vanished.alpha).toBe(0);
    const fastFall = seedDropFallMs(1000);
    expect(seedDropPose(fastFall, { x: 1000, y: 0 }, fastFall).x).toBeLessThanOrEqual(28);
  });

  it('keeps atlas frames aligned and the same silhouette throughout the roll', () => {
    const silhouette = SEED_FRAMES[0].map((row) => row.replace(/[^.]/g, '#'));
    for (const rows of SEED_FRAMES) {
      expect(rows).toHaveLength(SEED_FRAME_HEIGHT);
      expect(rows.map((row) => row.replace(/[^.]/g, '#'))).toEqual(silhouette);
      for (const row of rows) {
        expect(row).toHaveLength(SEED_FRAME_WIDTH);
        for (const pixel of row) {
          if (pixel !== '.') expect(SEED_PALETTE[pixel]).toBeDefined();
        }
      }
    }
    expect(seedFlightFrame(0)).toBe(0);
    expect(seedFlightFrame(SEED_FRAME_MS * 3)).toBe(3);
    expect(seedFlightFrame(SEED_FRAME_MS * 4)).toBe(0);
  });

  it('bounds rapid fire and removes the whole effect on expiry or room changes', () => {
    const { effects, pixels } = fixture();
    const direction = { x: 1, y: 0 };
    for (let i = 0; i < MAX_SEED_FLASHES; i++) effects.emit(100, 100, direction);
    effects.update(40);
    const boundedCount = pixels.length;
    effects.clear();
    for (let i = 0; i < MAX_SEED_FLASHES * 10; i++) effects.emit(100, 100, direction);
    effects.update(40);
    expect(pixels).toHaveLength(boundedCount);
    effects.update(1000);
    expect(pixels).toHaveLength(0);
    effects.emit(100, 100, direction);
    effects.clear();
    effects.update(16);
    expect(pixels).toHaveLength(0);
  });

  it('keeps pixels on the grid and carries red tint into the directional fan', () => {
    const { effects, pixels } = fixture();
    effects.emit(100, 100, { x: 0, y: -1 }, 0xff4d4d, 3);
    effects.update(90);
    for (const pixel of pixels) {
      expect([pixel.x, pixel.y, pixel.width, pixel.height].every(Number.isInteger)).toBe(true);
      expect((pixel.color >> 16) & 255).toBeGreaterThan((pixel.color >> 8) & 255);
    }
    expect(pixels.filter((p) => p.y < 100).length).toBeGreaterThan(
      pixels.filter((p) => p.y > 100).length,
    );
  });
});
