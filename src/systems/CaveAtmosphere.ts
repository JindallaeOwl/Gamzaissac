import Phaser from 'phaser';
import { DEPTH, ROOM_RECT, WORLD_HEIGHT, WORLD_WIDTH } from '../config/gameConfig';
import type { RoomNode } from './DungeonManager';
import { createSeededRandom } from '../utils/random';
import {
  CAVE_LIGHT_EVENT,
  CAVE_LIGHTS,
  createCavePixels,
  caveThemeForFloor,
  lightFalloff,
} from './CaveArt';
import { PixelFire, fireAppearance, groundEmberAppearance } from './PixelFire';
import { hashSeed } from './floorPixelSprites';
import { CaveArtCache, createCaveNormalMap, type SurfaceLight } from './CaveLighting';
import { CaveIllumination } from './CaveIllumination';
import { caveThemeSettings, type CaveThemeSettings } from './CaveThemes';

export interface LightProjectile {
  x: number;
  y: number;
  active: boolean;
  tintTopLeft: number;
}

interface LightPulse {
  x: number;
  y: number;
  color: number;
  radius: number;
  duration: number;
}

const GLOW_KEY = 'cave-soft-light';
const ROOM_KEY = 'cave-preview-room';
const MAX_PULSES = 12;

export class CaveAtmosphere {
  private readonly background: Phaser.GameObjects.Image;
  private readonly flames: Phaser.GameObjects.Graphics;
  private readonly air: Phaser.GameObjects.Graphics;
  private readonly fire = new PixelFire(undefined, ROOM_RECT);
  private readonly illumination: CaveIllumination;
  private readonly artCache = new CaveArtCache();
  private theme: CaveThemeSettings = caveThemeSettings('burrow');
  private readonly afterglows: { x: number; y: number; bornAt: number }[] = [];
  private readonly fog: Phaser.GameObjects.Image[] = [];
  private readonly lights: Phaser.GameObjects.Image[] = [];
  private readonly pulses: {
    image: Phaser.GameObjects.Image;
    bornAt: number;
    duration: number;
    config: LightPulse;
  }[] = [];
  private readonly dust: { x: number; y: number; speed: number; phase: number }[] = [];
  private time = 0;
  private enabled = false;

  constructor(private readonly scene: Phaser.Scene) {
    if (!scene.textures.exists(GLOW_KEY)) {
      const texture = scene.textures.createCanvas(GLOW_KEY, 64, 64)!;
      const data = texture.context.createImageData(64, 64);
      for (let y = 0; y < 64; y += 1) {
        for (let x = 0; x < 64; x += 1) {
          const i = (y * 64 + x) * 4;
          data.data[i] = data.data[i + 1] = data.data[i + 2] = 255;
          data.data[i + 3] = Math.round(lightFalloff(Math.hypot(x - 31.5, y - 31.5), 32) * 255);
        }
      }
      texture.context.putImageData(data, 0, 0);
      texture.refresh();
    }
    if (!scene.textures.exists(ROOM_KEY))
      scene.textures.createCanvas(ROOM_KEY, WORLD_WIDTH, WORLD_HEIGHT);
    this.background = scene.add
      .image(0, 0, ROOM_KEY)
      .setOrigin(0)
      .setDepth(DEPTH.floor + 0.85)
      .setVisible(false);
    this.illumination = new CaveIllumination(scene, this.background);
    this.flames = scene.add
      .graphics()
      .setDepth(DEPTH.floor + 1.1)
      .setVisible(false);
    // Air stays below pickups, bullets and attack warnings.
    this.air = scene.add
      .graphics()
      .setDepth(DEPTH.floor + 1.3)
      .setVisible(false);
    for (const light of CAVE_LIGHTS)
      this.lights.push(this.makeGlow(light.x, light.y, light.radius, light.color));
    for (let i = 0; i < 3; i += 1) {
      this.fog.push(
        this.makeGlow(110 + i * 120, 170 + i * 14, 80, 0x778da0)
          .setDisplaySize(210, 30)
          .setAlpha(0.045)
          .setDepth(DEPTH.floor + 1.2),
      );
    }
    const random = createSeededRandom(1892);
    for (let i = 0; i < 32; i += 1)
      this.dust.push({
        x: ROOM_RECT.left + random() * ROOM_RECT.width,
        y: ROOM_RECT.top + random() * ROOM_RECT.height,
        speed: 1.2 + random() * 3,
        phase: random() * Math.PI * 2,
      });
    scene.events.on(CAVE_LIGHT_EVENT, this.pulse, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      scene.events.off(CAVE_LIGHT_EVENT, this.pulse, this);
      this.pulses.length = 0;
      this.afterglows.length = 0;
      this.artCache.clear();
    });
  }

  enterRoom(room: RoomNode, floor: number): void {
    const theme = caveThemeForFloor(floor);
    this.enabled = theme !== null;
    if (theme) this.theme = caveThemeSettings(theme);
    this.background.setVisible(this.enabled);
    this.flames.setVisible(true);
    this.fire.setSources(this.enabled ? this.theme.lights.slice(0, 2) : []);
    this.air.setVisible(this.enabled);
    for (const image of [...this.lights, ...this.fog]) image.setVisible(this.enabled);
    for (const pulse of this.pulses) pulse.image.destroy();
    this.pulses.length = 0;
    this.afterglows.length = 0;
    this.illumination.reset();
    if (!this.enabled) return;
    const texture = this.scene.textures.get(ROOM_KEY) as Phaser.Textures.CanvasTexture;
    const data = texture.context.createImageData(WORLD_WIDTH, WORLD_HEIGHT);
    const key = `${floor}:${room.id}:${room.exits.slice().sort().join(',')}`;
    const art = this.artCache.get(key, () => {
      const pixels = createCavePixels(room.exits, hashSeed(`${floor}:${room.id}`), theme!);
      return { pixels, normals: createCaveNormalMap(pixels, WORLD_WIDTH, WORLD_HEIGHT) };
    });
    data.data.set(art.pixels);
    texture.context.putImageData(data, 0, 0);
    texture.refresh();
    this.illumination.setRoom(art.normals, this.theme.ambient);
    this.theme.lights.forEach((light, i) =>
      this.lights[i]
        .setTint(light.color)
        .setPosition(light.x, light.y)
        .setDisplaySize(light.radius * 2, light.radius * 2),
    );
    for (const fog of this.fog) fog.setTint(this.theme.fogColor).setAlpha(this.theme.fogAlpha);
    this.update(0);
  }

  pulse(config: LightPulse): void {
    if (!this.enabled) return;
    if (this.pulses.length === MAX_PULSES) this.pulses.shift()!.image.destroy();
    const image = this.makeGlow(config.x, config.y, config.radius, config.color)
      .setVisible(true)
      .setAlpha(0.6);
    this.pulses.push({ image, bornAt: this.time, duration: Math.max(1, config.duration), config });
  }

  update(deltaMs: number, projectiles: readonly LightProjectile[] = []): void {
    this.time += Math.max(0, Math.min(100, deltaMs));
    const seconds = this.time / 1000;
    this.flames.clear();
    this.fire.update(deltaMs);
    if (!this.enabled) {
      this.drawFire();
      return;
    }
    for (let i = 0; i < this.theme.lights.length; i += 1) {
      const light = this.theme.lights[i];
      const flicker = 0.94 + Math.sin(seconds * 7 + i * 4) * 0.04 + Math.sin(seconds * 17) * 0.025;
      this.lights[i].setAlpha(light.strength * flicker);
      if (i < 2) {
        // Only the charred handle is rigid; every visible flame pixel is simulated.
        this.flames.fillStyle(0x171411, 1).fillRect(light.x - 2, light.y + 2, 4, 9);
        this.flames.fillStyle(0x76513a, 1).fillRect(light.x - 1, light.y + 2, 2, 8);
        this.flames.fillStyle(0xa4865b, 1).fillRect(light.x - 2, light.y + 4, 4, 1);
      } else {
        // Jagged glowing mineral flecks, not a liquid or a damaging floor patch.
        for (let p = 0; p < 7; p += 1) {
          const x = light.x + (p % 3) * 3 - 3;
          const y = light.y + Math.floor(p / 3) * 3;
          this.flames.fillStyle(0x1d4e50, 1).fillRect(x, y, 2, 4);
          this.flames
            .fillStyle(light.color, 0.7 + Math.sin(seconds * 2 + p) * 0.15)
            .fillRect(x, y, 1, 2);
        }
      }
    }
    this.fog.forEach((image, i) => image.setX(110 + i * 120 + Math.sin(seconds * 0.16 + i) * 14));
    this.air.clear();
    for (const dust of this.dust) {
      const x = dust.x + Math.sin(seconds * 0.4 + dust.phase) * 4;
      const y =
        ROOM_RECT.top +
        ((((dust.y - ROOM_RECT.top - seconds * dust.speed) % ROOM_RECT.height) + ROOM_RECT.height) %
          ROOM_RECT.height);
      const illumination = this.theme.lights.reduce(
        (sum, light) => sum + lightFalloff(Math.hypot(x - light.x, y - light.y), light.radius),
        0,
      );
      this.air.fillStyle(
        illumination > 0.2 ? this.theme.dustColor : 0x707879,
        0.12 + Math.min(0.45, illumination * 0.65),
      );
      this.air.fillRect(Math.round(x), Math.round(y), 1, 1);
    }
    for (let i = this.pulses.length - 1; i >= 0; i -= 1) {
      const pulse = this.pulses[i];
      const remaining = 1 - (this.time - pulse.bornAt) / pulse.duration;
      if (remaining <= 0) {
        pulse.image.destroy();
        this.pulses.splice(i, 1);
      } else pulse.image.setAlpha(0.6 * remaining * remaining);
    }
    this.drawFire();
    this.updateLighting(deltaMs, projectiles);
  }

  blast(x: number, y: number): void {
    this.fire.blast(x, y);
    if (this.afterglows.length >= 6) this.afterglows.shift();
    this.afterglows.push({ x, y, bornAt: this.time });
  }

  private updateLighting(delta: number, projectiles: readonly LightProjectile[]): void {
    const candidates: SurfaceLight[] = this.theme.lights.map((light, i) => ({
      ...light,
      intensity: (i < 2 ? 1.8 : 1.25) * (0.95 + Math.sin(this.time * 0.007 + i) * 0.05),
      priority: 1,
    }));
    for (const pulse of this.pulses) {
      const fade = Math.max(0, 1 - (this.time - pulse.bornAt) / pulse.duration);
      candidates.push({ ...pulse.config, intensity: fade * fade * 3, priority: 3 });
    }
    for (let i = this.afterglows.length - 1; i >= 0; i--) {
      const glow = this.afterglows[i];
      const heat = 1 - (this.time - glow.bornAt) / 7000;
      if (heat <= 0) {
        this.afterglows.splice(i, 1);
        continue;
      }
      candidates.push({
        x: glow.x,
        y: glow.y,
        radius: 48,
        color: 0xff7628,
        intensity: heat * 0.9,
        priority: 2,
      });
    }
    // One representative per 48px cell prevents dense volleys multiplying light work.
    const cells = new Set<string>();
    for (const projectile of projectiles) {
      if (!projectile.active) continue;
      const key = `${Math.floor(projectile.x / 48)}:${Math.floor(projectile.y / 48)}`;
      if (cells.has(key)) continue;
      cells.add(key);
      candidates.push({
        x: projectile.x,
        y: projectile.y,
        radius: 38,
        color: projectile.tintTopLeft === 0xffffff ? 0xff963e : projectile.tintTopLeft,
        intensity: 0.8,
        priority: 0,
      });
      if (cells.size >= 4) break;
    }
    this.illumination.update(delta, candidates, (buffer) => {
      for (const p of this.fire.particles) {
        if (p.kind === 'smoke') continue;
        const a = fireAppearance(p);
        buffer.emit(p.x / 4, p.y / 4, a.color, a.alpha * 0.35);
      }
      for (const p of this.fire.groundEmbers) {
        const a = groundEmberAppearance(p);
        buffer.emit(p.x / 4, (p.y - p.z) / 4, a.color, a.alpha * 0.65);
      }
      for (const p of candidates) {
        buffer.emit(p.x / 4, p.y / 4, p.color, p.intensity * 0.8);
      }
    });
  }

  private drawFire(): void {
    for (const ember of this.fire.groundEmbers) {
      const { color, alpha } = groundEmberAppearance(ember);
      const x = Math.round(ember.x),
        y = Math.round(ember.y - ember.z);
      this.flames
        .fillStyle(0x181614, alpha * 0.65)
        .fillRect(x - 1, Math.round(ember.y), ember.size + 2, 2);
      this.flames.fillStyle(color, alpha * 0.045).fillRect(x - 4, y - 3, 9, 7);
      this.flames
        .fillStyle(color, alpha * 0.12)
        .fillRect(x - 1, y - 1, ember.size + 2, ember.size + 2);
      this.flames.fillStyle(color, alpha).fillRect(x, y, ember.size, 1);
    }
    for (const p of this.fire.particles) {
      const appearance = fireAppearance(p);
      const x = Math.round(p.x),
        y = Math.round(p.y);
      if (p.kind !== 'smoke') {
        this.flames.fillStyle(appearance.color, appearance.alpha * 0.07);
        this.flames.fillRect(x - 2, y - 2, appearance.size + 4, appearance.size + 4);
      }
      if (p.kind === 'ember' && Math.hypot(p.vx, p.vy) > 30) {
        this.flames.lineStyle(1, appearance.color, appearance.alpha * 0.4);
        this.flames.lineBetween(x - p.vx * 0.025, y - p.vy * 0.025, x, y);
      }
      this.flames.fillStyle(appearance.color, appearance.alpha);
      this.flames.fillRect(x, y, appearance.size, appearance.size);
    }
  }

  private makeGlow(x: number, y: number, radius: number, color: number): Phaser.GameObjects.Image {
    return this.scene.add
      .image(x, y, GLOW_KEY)
      .setTint(color)
      .setDisplaySize(radius * 2, radius * 2)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(DEPTH.floor + 0.9)
      .setVisible(false);
  }
}
