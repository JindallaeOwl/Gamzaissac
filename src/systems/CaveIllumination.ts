import Phaser from 'phaser';
import { DEPTH, WORLD_HEIGHT, WORLD_WIDTH } from '../config/gameConfig';
import { getGameSettings } from './GameSettings';
import {
  CaveBloomBuffer,
  LIGHTING_BUDGETS,
  selectSurfaceLights,
  type SurfaceLight,
} from './CaveLighting';

const BLOOM_KEY = 'cave-emission-bloom';

/** Bounded light pool and a small emission buffer; actors and HUD keep their own pipelines. */
export class CaveIllumination {
  private readonly supported: boolean;
  private readonly pool: Phaser.GameObjects.Light[] = [];
  private readonly bloom = new CaveBloomBuffer(
    Math.ceil(WORLD_WIDTH / 4),
    Math.ceil(WORLD_HEIGHT / 4),
  );
  private readonly bloomTexture: Phaser.Textures.CanvasTexture;
  private readonly bloomImage: Phaser.GameObjects.Image;
  private readonly bloomData: ImageData;
  private elapsed = 1000;
  private ambient = 0xbcb8b0;
  private lit = false;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly background: Phaser.GameObjects.Image,
  ) {
    this.supported = scene.game.renderer.type === Phaser.WEBGL;
    if (this.supported) {
      scene.lights.enable();
      for (let i = 0; i < 10; i++)
        this.pool.push(scene.lights.addLight(0, 0, 1, 0xffffff, 0).setVisible(false));
    }
    this.bloomTexture = (
      scene.textures.exists(BLOOM_KEY)
        ? scene.textures.get(BLOOM_KEY)
        : scene.textures.createCanvas(BLOOM_KEY, this.bloom.width, this.bloom.height)
    ) as Phaser.Textures.CanvasTexture;
    this.bloomTexture.setFilter(Phaser.Textures.FilterMode.LINEAR);
    this.bloomData = this.bloomTexture.context.createImageData(this.bloom.width, this.bloom.height);
    this.bloomImage = scene.add
      .image(0, 0, BLOOM_KEY)
      .setOrigin(0)
      .setDisplaySize(WORLD_WIDTH, WORLD_HEIGHT)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(DEPTH.floor + 1.15)
      .setVisible(false);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      for (const light of this.pool) scene.lights.removeLight(light);
      this.pool.length = 0;
    });
  }

  setRoom(normals: Uint8ClampedArray, ambient: number): void {
    this.ambient = ambient;
    if (this.supported) {
      const texture = this.background.texture;
      if (!texture.dataSource.length) {
        const canvas = document.createElement('canvas');
        canvas.width = WORLD_WIDTH;
        canvas.height = WORLD_HEIGHT;
        texture.setDataSource(canvas);
      }
      const source = texture.dataSource[0];
      const canvas = source.image as HTMLCanvasElement;
      const context = canvas.getContext('2d')!;
      const data = context.createImageData(WORLD_WIDTH, WORLD_HEIGHT);
      data.data.set(normals);
      context.putImageData(data, 0, 0);
      source.update();
      texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
    }
    this.reset();
  }

  reset(): void {
    for (const light of this.pool) light.setIntensity(0).setVisible(false);
    this.bloom.clear();
    this.bloomTexture.context.clearRect(0, 0, this.bloom.width, this.bloom.height);
    this.bloomTexture.refresh();
    this.bloomImage.setVisible(false);
    this.elapsed = 1000;
  }

  update(
    delta: number,
    lights: readonly SurfaceLight[],
    emit: (buffer: CaveBloomBuffer) => void,
  ): void {
    const quality = getGameSettings().renderQuality;
    const budget = LIGHTING_BUDGETS[quality];
    const lit = this.supported && budget.lights > 0;
    if (this.supported && lit !== this.lit) {
      if (lit) this.background.setPipeline('Light2D');
      else this.background.resetPipeline();
      this.lit = lit;
    }
    if (lit) {
      this.scene.lights.setAmbientColor(this.ambient);
      const selected = selectSurfaceLights(lights, quality, WORLD_WIDTH, WORLD_HEIGHT);
      this.pool.forEach((light, i) => {
        const next = selected[i];
        if (next)
          light
            .setPosition(next.x, next.y)
            .setRadius(next.radius)
            .setColor(next.color)
            .setIntensity(next.intensity)
            .setVisible(true);
        else light.setIntensity(0).setVisible(false);
      });
    } else {
      for (const light of this.pool) light.setIntensity(0).setVisible(false);
    }
    this.bloomImage.setVisible(lit && budget.bloomHz > 0);
    if (!lit || budget.bloomHz === 0) return;
    this.elapsed += Math.max(0, Math.min(100, delta));
    if (this.elapsed < 1000 / budget.bloomHz) return;
    this.elapsed = 0;
    this.bloom.clear();
    emit(this.bloom);
    this.bloomData.data.set(this.bloom.blur());
    this.bloomTexture.context.putImageData(this.bloomData, 0, 0);
    this.bloomTexture.refresh();
  }
}
