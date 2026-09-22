import { describe, expect, it } from 'vitest';
import { AUTUMN_TITLE_TUNING } from '../src/config/gameConfig';
import {
  buildAutumnForest,
  getAutumnCanopyOffset,
  getAutumnLeafPose,
  splitAutumnForestLayers,
} from '../src/systems/AutumnTitleArt';

describe('autumn title canopy layers', () => {
  it('preserves original painting order and separates six nearby crowns', () => {
    const pixels = buildAutumnForest();
    const layers = splitAutumnForestLayers(pixels);
    expect(layers.flatMap((layer) => layer.pixels)).toEqual(pixels);
    expect(
      layers.filter((layer) => layer.canopyId !== undefined).map((layer) => layer.canopyId),
    ).toEqual([0, 1, 2, 3, 4, 5]);
    expect(layers[0].canopyId).toBeUndefined();
    expect(layers[layers.length - 1].canopyId).toBeUndefined();
    expect(buildAutumnForest()).toEqual(pixels);
  });
  it('leaves trunks and bark in static layers', () => {
    const wood = buildAutumnForest().filter((pixel) =>
      [0x432d23, 0x765035, 0xb9ac87, 0xe0c9a0, 0x35281f].includes(pixel.color),
    );
    expect(wood.length).toBeGreaterThan(20);
    expect(wood.every((pixel) => pixel.canopyId === undefined)).toBe(true);
  });
  it('keeps subsequent static objects above a canopy instead of flattening them below it', () => {
    const p = { x: 0, y: 0, width: 2, height: 2, color: 0 };
    const pixels = [p, { ...p, canopyId: 0 }, p, { ...p, canopyId: 1 }, p];
    const layers = splitAutumnForestLayers(pixels);
    expect(layers.map((layer) => layer.canopyId)).toEqual([undefined, 0, undefined, 1, undefined]);
    expect(splitAutumnForestLayers([])).toEqual([]);
  });
});

describe('gentle traveling canopy wave', () => {
  const offset = (id: number, y: number, time: number) =>
    getAutumnCanopyOffset(id, y, time, AUTUMN_TITLE_TUNING);
  it('moves with time and gives neighboring bands and trees different phases', () => {
    expect(offset(0, 96, 0)).not.toBeCloseTo(offset(0, 96, 1400));
    expect(offset(0, 96, 1400)).not.toBeCloseTo(offset(0, 108, 1400));
    expect(offset(0, 96, 1400)).not.toBeCloseTo(offset(1, 96, 1400));
  });
  it('limits movement to 1.4 pixels and reduces motion behind the logo', () => {
    for (let time = 0; time <= 11200; time += 100) {
      for (let id = 0; id < 6; id += 1) {
        expect(Math.abs(offset(id, 100, time))).toBeLessThanOrEqual(1.4);
        expect(Math.abs(offset(id, 30, time))).toBeLessThanOrEqual(0.84);
      }
    }
  });
  it('loops smoothly and remains independent of the number of rendered frames', () => {
    expect(offset(2, 100, 5600)).toBeCloseTo(offset(2, 100, 0));
    expect(offset(2, 100, -100)).toBe(offset(2, 100, 0));
    expect(Math.abs(offset(2, 100, 5600) - offset(2, 100, 5599))).toBeLessThan(0.01);
    expect(getAutumnCanopyOffset(0, 100, 1400, { ...AUTUMN_TITLE_TUNING, canopySway: 0 })).toBe(0);
  });
  it('keeps falling leaves cycling inside their vertical margin over long sessions', () => {
    for (const time of [0, 1000, 60000, 3600000]) {
      for (let id = 0; id < AUTUMN_TITLE_TUNING.leafCount; id += 1) {
        const pose = getAutumnLeafPose(id, time, 480, 272, AUTUMN_TITLE_TUNING);
        expect(pose.y).toBeGreaterThanOrEqual(-16);
        expect(pose.y).toBeLessThan(288);
        expect(pose.scaleX).toBeGreaterThanOrEqual(0.5);
        expect(pose.scaleX).toBeLessThanOrEqual(1);
      }
    }
  });
});
