import { describe, expect, it, vi } from 'vitest';
import type Phaser from 'phaser';
import { EnemyDamageVisual } from '../src/systems/EnemyDamageVisual';
import type { DamageScar } from '../src/systems/EnemyDamagePixels';

// Small in-memory canvas for lifecycle checks; Phaser rendering stays outside unit tests.
function fixture() {
  const width = 16;
  const source = new Uint8ClampedArray(width * width * 4);
  for (let y = 2; y < 14; y += 1) {
    for (let x = 2; x < 14; x += 1) source.set([80, 160, 40, 255], (y * width + x) * 4);
  }
  const original = {
    texture: { key: 'original' },
    name: 0,
    realWidth: width,
    realHeight: width,
    cutX: 0,
    cutY: 0,
    cutWidth: width,
    cutHeight: width,
    x: 0,
    y: 0,
    source: { image: source },
  };
  const textures: { key: string; pixels: Uint8ClampedArray }[] = [];
  const remove = vi.fn();
  const events = { emit: vi.fn() };
  const scene = {
    events,
    textures: {
      remove,
      createCanvas: (key: string) => {
        const pixels = new Uint8ClampedArray(source.length);
        const texture = {
          key,
          width,
          height: width,
          pixels,
          refresh: vi.fn(),
          context: {
            imageSmoothingEnabled: false,
            drawImage: (image: Uint8ClampedArray) => pixels.set(image),
            clearRect: (x: number, y: number, w: number, h: number) => {
              for (let iy = y; iy < y + h; iy += 1) {
                for (let ix = x; ix < x + w; ix += 1) pixels[(iy * width + ix) * 4 + 3] = 0;
              }
            },
            getImageData: () => ({ data: pixels }),
          },
          get: () => ({ ...original, texture }),
        };
        textures.push(texture);
        return texture;
      },
    },
  };
  const makeSprite = () => ({
    scene,
    width,
    height: width,
    x: 100,
    y: 100,
    scaleX: 1,
    displayOriginX: 8,
    displayOriginY: 8,
    flipX: false,
    flipY: false,
    frame: original,
    setFrame(frame: typeof original) {
      this.frame = frame;
    },
    getWorldTransformMatrix: () => ({
      applyInverse: (x: number, y: number) => ({ x: x - 100, y: y - 100 }),
      transformPoint: (x: number, y: number) => ({ x: x + 100, y: y + 100 }),
    }),
  });
  return { source, original, textures, remove, events, makeSprite };
}

describe('per-sprite damage texture lifecycle', () => {
  it('restores crate scars after recreation without changing shared source art', () => {
    const f = fixture();
    const originalPixels = f.source.slice();
    const scars: DamageScar[] = [];
    const first = new EnemyDamageVisual(
      f.makeSprite() as unknown as Phaser.GameObjects.Sprite,
      scars,
    );
    first.hit(50, 100, 0xffffff, false);
    const wounded = f.textures[0].pixels.slice();
    expect(scars.length).toBeGreaterThan(0);
    expect(f.source).toEqual(originalPixels);
    first.destroy();
    expect(f.remove).toHaveBeenCalledWith(f.textures[0].key);
    const second = new EnemyDamageVisual(
      f.makeSprite() as unknown as Phaser.GameObjects.Sprite,
      scars,
    );
    expect(f.textures[1].pixels).toEqual(wounded);
    second.destroy();
  });

  it('keeps scars across animation changes and sends force with actual colored fragments', () => {
    const f = fixture();
    const sprite = f.makeSprite();
    const visual = new EnemyDamageVisual(sprite as unknown as Phaser.GameObjects.Sprite);
    visual.hit(50, 100, 0xffffff, false);
    const wounded = f.textures[0].pixels.slice();
    sprite.frame = { ...f.original, name: 1 };
    visual.sync();
    expect(f.textures[0].pixels).toEqual(wounded);
    expect(sprite.frame.texture.key).toBe(f.textures[0].key);
    const impact = { kind: 'explosion' as const, x: 1, y: 0 };
    visual.hit(50, 100, 0xffffff, true, impact);
    const fragments = f.events.emit.mock.lastCall![1];
    expect(fragments.length).toBeGreaterThan(0);
    expect(
      fragments.every(
        (p: { color: number; impact: unknown }) => p.color === 0x50a028 && p.impact === impact,
      ),
    ).toBe(true);
    visual.destroy();
    expect(sprite.frame.name).toBe(1);
  });
});
