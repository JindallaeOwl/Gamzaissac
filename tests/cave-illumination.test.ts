import { describe, expect, it, vi } from 'vitest';
import type Phaser from 'phaser';
import { CaveIllumination } from '../src/systems/CaveIllumination';

vi.mock('phaser', () => ({
  default: {
    WEBGL: 2,
    Textures: { FilterMode: { LINEAR: 0, NEAREST: 1 } },
    BlendModes: { ADD: 1 },
    Scenes: { Events: { SHUTDOWN: 'shutdown' } },
  },
}));

describe('cave bloom texture uploads', () => {
  it('restores smooth sampling after resets and animated pixel-art canvas uploads', () => {
    let filter = 1;
    const texture = {
      context: {
        createImageData: (width: number, height: number) => ({
          data: new Uint8ClampedArray(width * height * 4),
        }),
        clearRect: vi.fn(),
        putImageData: vi.fn(),
      },
      // Phaser canvasToTexture uses the game's antialias:false on every upload,
      // even when this texture previously selected LINEAR filtering.
      refresh: vi.fn(() => {
        filter = 1;
      }),
      setFilter: vi.fn((next: number) => {
        filter = next;
      }),
    };
    const light = {
      setVisible: vi.fn().mockReturnThis(),
      setIntensity: vi.fn().mockReturnThis(),
    };
    const image = {
      setOrigin: vi.fn().mockReturnThis(),
      setDisplaySize: vi.fn().mockReturnThis(),
      setBlendMode: vi.fn().mockReturnThis(),
      setAlpha: vi.fn().mockReturnThis(),
      setDepth: vi.fn().mockReturnThis(),
      setVisible: vi.fn().mockReturnThis(),
    };
    const scene = {
      game: { renderer: { type: 2 } },
      lights: { enable: vi.fn(), addLight: () => light, setAmbientColor: vi.fn() },
      textures: { exists: () => false, createCanvas: () => texture },
      add: { image: () => image },
      events: { once: vi.fn() },
    };
    const background = { setPipeline: vi.fn() };
    const illumination = new CaveIllumination(
      scene as unknown as Phaser.Scene,
      background as unknown as Phaser.GameObjects.Image,
    );
    illumination.reset();
    expect(filter).toBe(0);
    for (let frame = 0; frame < 3; frame++) {
      illumination.update(100, [], (buffer) => buffer.emit(8, 8, 0xff8800, 1));
      expect(filter).toBe(0);
    }
    expect(texture.context.putImageData).toHaveBeenCalledTimes(3);
    illumination.reset();
    expect(filter).toBe(0);
    expect(image.setVisible).toHaveBeenLastCalledWith(false);
  });
});
