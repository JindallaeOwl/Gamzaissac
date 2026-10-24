import { describe, expect, it } from 'vitest';
import {
  PixelFire,
  fireAppearance,
  groundEmberAppearance,
  MAX_FIRE_PARTICLES,
  MAX_GROUND_EMBERS,
} from '../src/systems/PixelFire';

describe('physical pixel fire', () => {
  it('forms irregular rising flames with cooling colors instead of moving one rectangle', () => {
    const fire = new PixelFire();
    fire.setSources([{ x: 100, y: 100 }]);
    const flames = fire.particles.filter((p) => p.kind === 'flame');
    expect(flames.length).toBeGreaterThan(15);
    expect(flames.some((p) => p.y < 95)).toBe(true);
    expect(new Set(flames.map((p) => Math.round(p.x))).size).toBeGreaterThan(3);
    expect(new Set(flames.map((p) => fireAppearance(p).color)).size).toBeGreaterThan(3);
    expect(flames.every((p) => p.vy < 0)).toBe(true);
  });

  it('uses gravity and drag for blast embers while hot smoke rises', () => {
    const fire = new PixelFire(() => 0.5);
    fire.blast(100, 100);
    const ember = fire.particles.find((p) => p.kind === 'ember')!;
    const smoke = fire.particles.find((p) => p.kind === 'smoke')!;
    const initialSpeed = Math.abs(ember.vx);
    for (let i = 0; i < 90; i += 1) fire.update(1000 / 120);
    expect(ember.vy).toBeGreaterThan(0);
    expect(Math.abs(ember.vx)).toBeLessThan(initialSpeed);
    expect(smoke.y).toBeLessThan(100);
  });

  it('simulates consistently across frame rates and freezes on zero delta', () => {
    const slow = new PixelFire(),
      fast = new PixelFire();
    slow.setSources([{ x: 100, y: 100 }]);
    fast.setSources([{ x: 100, y: 100 }]);
    slow.blast(100, 100);
    fast.blast(100, 100);
    for (let i = 0; i < 30; i += 1) slow.update(1000 / 30);
    for (let i = 0; i < 120; i += 1) fast.update(1000 / 120);
    expect(slow.particles).toEqual(fast.particles);
    expect(slow.groundEmbers).toEqual(fast.groundEmbers);
    const snapshot = structuredClone(slow.particles);
    slow.update(0);
    slow.update(Number.NaN);
    expect(slow.particles).toEqual(snapshot);
  });

  it('caps repeated explosions and clears all emitters on room exit', () => {
    const fire = new PixelFire();
    for (let i = 0; i < 30; i += 1) fire.blast(100, 100);
    expect(fire.particles.length).toBeLessThanOrEqual(MAX_FIRE_PARTICLES);
    expect(fire.groundEmbers.length).toBeLessThanOrEqual(MAX_GROUND_EMBERS);
    for (let i = 0; i < 600; i += 1) fire.update(1000 / 60);
    expect(fire.particles).toHaveLength(0);
    expect(fire.groundEmbers).toHaveLength(0);
    fire.blast(100, 100);
    fire.setSources([{ x: 100, y: 100 }]);
    expect(fire.groundEmbers).toHaveLength(0);
    fire.clear();
    fire.update(100);
    expect(fire.particles).toHaveLength(0);
  });

  it('settles hot coals near the blast and keeps flickering after airborne sparks expire', () => {
    const fire = new PixelFire();
    fire.blast(100, 100);
    const ember = fire.groundEmbers[0];
    const hotColor = groundEmberAppearance(ember).color;
    for (let i = 0; i < 180; i++) fire.update(1000 / 60);
    expect(fire.groundEmbers).toHaveLength(18);
    expect(fire.groundEmbers.every((p) => p.z === 0 && p.vz === 0)).toBe(true);
    expect(fire.groundEmbers.every((p) => Math.hypot(p.x - 100, p.y - 100) < 35)).toBe(true);
    expect(fire.particles.some((p) => p.kind === 'flame' || p.kind === 'smoke')).toBe(true);
    expect(fire.particles.some((p) => p.kind === 'ember')).toBe(false);
    expect(groundEmberAppearance(ember).color).not.toBe(hotColor);
    const position = { x: ember.x, y: ember.y };
    for (let i = 0; i < 30; i++) fire.update(1000 / 60);
    expect(ember.x).toBeCloseTo(position.x, 4);
    expect(ember.y).toBeCloseTo(position.y, 4);
  });

  it('keeps smoldering coals inside the room near walls', () => {
    const fire = new PixelFire(undefined, { left: 0, top: 0, right: 200, bottom: 100 });
    fire.blast(1, 1);
    for (let i = 0; i < 180; i++) fire.update(1000 / 60);
    expect(fire.groundEmbers.every((p) => p.x >= 2 && p.x <= 197 && p.y >= 2 && p.y <= 97)).toBe(
      true,
    );
  });
});
