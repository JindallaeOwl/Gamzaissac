import { describe, expect, it } from 'vitest';
import { beamSections } from '../src/systems/BeamVisualRules';

describe('prism beam animation', () => {
  it('opens into a thick beam and collapses before expiry', () => {
    const birth = beamSections(280, 0, 260, 20);
    const full = beamSections(280, 60, 260, 20);
    const end = beamSections(280, 250, 260, 20);
    const maxRadius = (parts: typeof birth) => Math.max(...parts.map((p) => p.radius));
    expect(maxRadius(full)).toBeGreaterThan(maxRadius(birth));
    expect(maxRadius(full)).toBeGreaterThan(maxRadius(end));
    expect(beamSections(280, 260, 260, 20)).toEqual([]);
  });

  it('animates flow along the beam while keeping coverage and a readable core', () => {
    const first = beamSections(280, 70, 260, 20);
    const next = beamSections(280, 100, 260, 20);
    expect(first).not.toEqual(next);
    expect(first.map((p) => p.x)).toEqual(next.map((p) => p.x));
    expect(first[0].x).toBe(0);
    expect(first.at(-1)!.x).toBeLessThan(280);
    expect(first.every((p) => p.core > 0 && p.core <= p.radius && Math.abs(p.offset) <= 2)).toBe(
      true,
    );
  });

  it('handles empty ranges and invalid animation intervals', () => {
    expect(beamSections(0, 20, 260, 20)).toEqual([]);
    expect(beamSections(280, -1, 260, 20)).toEqual([]);
    expect(beamSections(280, 20, 0, 20)).toEqual([]);
  });
});
