import Phaser from 'phaser';
import { AUTUMN_TITLE_TUNING, DEPTH, GAME_HEIGHT, GAME_WIDTH } from '../config/gameConfig';
import {
  buildAutumnForest,
  getAutumnLeafPose,
  getAutumnCanopyOffset,
  splitAutumnForestLayers,
} from '../systems/AutumnTitleArt';

const FOREST_TEXTURE = 'title-autumn-layer';
const LEAF_COLORS = [0xe2a64e, 0xba582d, 0xd58134];
const LEAF_PIXELS = ['0001000', '0101010', '0111110', '1111111', '0111110', '0001000', '0001000'];

export class AutumnTitleBackground {
  private readonly leaves: Phaser.GameObjects.Image[] = [];
  private readonly canopyBands: {
    image: Phaser.GameObjects.Image;
    x: number;
    y: number;
    canopyId: number;
  }[] = [];
  private elapsedMs = 0;

  constructor(scene: Phaser.Scene) {
    this.createForestLayers(scene);

    for (let i = 0; i < AUTUMN_TITLE_TUNING.leafCount; i += 1) {
      const variant = i % LEAF_COLORS.length;
      const key = `title-autumn-leaf-${variant}`;
      if (!scene.textures.exists(key)) {
        const leaf = scene.add.graphics();
        leaf.fillStyle(LEAF_COLORS[variant]);
        LEAF_PIXELS.forEach((row, y) =>
          [...row].forEach((pixel, x) => {
            if (pixel === '1') leaf.fillRect(x, y, 1, 1);
          }),
        );
        leaf.fillStyle(0xf3c46a);
        leaf.fillRect(3, 2, 1, 3);
        leaf.generateTexture(key, 7, 7);
        leaf.destroy();
      }
      const leaf = scene.add
        .image(0, 0, key)
        .setDepth(DEPTH.floor + 1)
        .setAlpha(i % 3 === 0 ? 0.65 : 0.85);
      leaf.setScale(i % 3 === 0 ? 0.6 : 0.85);
      this.leaves.push(leaf);
    }

    const shade = scene.add.graphics().setDepth(DEPTH.floor + 2);
    // 로고 뒤의 명암을 고정해야 밝은 낙엽이 지나가도 글자 대비가 흔들리지 않는다.
    for (let y = 0; y < 104; y += 2) {
      shade.fillStyle(0x231916, 0.7 * Math.max(0, 1 - y / 104));
      shade.fillRect(0, y, GAME_WIDTH, 2);
    }
    shade.fillStyle(0x231916, 0.32);
    shade.fillRect(0, 247, GAME_WIDTH, 25);
    this.update(0);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      // 씬 재사용 때 이전 그림 객체를 붙잡지 않도록 참조도 함께 비운다.
      this.leaves.length = 0;
      this.canopyBands.length = 0;
    });
  }

  private createForestLayers(scene: Phaser.Scene): void {
    splitAutumnForestLayers(buildAutumnForest()).forEach((layer, index) => {
      const x = Math.min(...layer.pixels.map((pixel) => pixel.x));
      const y = Math.min(...layer.pixels.map((pixel) => pixel.y));
      const width = Math.max(...layer.pixels.map((pixel) => pixel.x + pixel.width)) - x;
      const height = Math.max(...layer.pixels.map((pixel) => pixel.y + pixel.height)) - y;
      const key = `${FOREST_TEXTURE}-${index}`;
      if (!scene.textures.exists(key)) {
        const art = scene.add.graphics();
        for (const pixel of layer.pixels) {
          art.fillStyle(pixel.color, 1);
          art.fillRect(pixel.x - x, pixel.y - y, pixel.width, pixel.height);
        }
        // 잎 무늬는 캐시하고 얇은 띠의 위치만 바꿔 매 프레임 다시 그리는 비용을 줄인다.
        art.generateTexture(key, width, height);
        art.destroy();
      }
      if (layer.canopyId === undefined) {
        scene.add.image(x, y, key).setOrigin(0).setDepth(DEPTH.floor);
        return;
      }
      const texture = scene.textures.get(key);
      const bandHeight = AUTUMN_TITLE_TUNING.canopyBandHeight;
      for (let row = 0; row < height; row += bandHeight) {
        const frame = `band-${bandHeight}-${row}`;
        if (!texture.has(frame)) {
          texture.add(frame, 0, 0, row, width, Math.min(bandHeight, height - row));
        }
        const image = scene.add
          .image(x, y + row, key, frame)
          .setOrigin(0)
          .setDepth(DEPTH.floor);
        this.canopyBands.push({ image, x, y: y + row, canopyId: layer.canopyId });
      }
    });
  }

  update(deltaMs: number): void {
    this.elapsedMs += Math.max(0, deltaMs);
    this.canopyBands.forEach((band) => {
      band.image.x =
        band.x + getAutumnCanopyOffset(band.canopyId, band.y, this.elapsedMs, AUTUMN_TITLE_TUNING);
    });
    this.leaves.forEach((leaf, index) => {
      const pose = getAutumnLeafPose(
        index,
        this.elapsedMs,
        GAME_WIDTH,
        GAME_HEIGHT,
        AUTUMN_TITLE_TUNING,
      );
      leaf.setPosition(pose.x, pose.y).setAngle(pose.angle);
      leaf.setScale((index % 3 === 0 ? 0.6 : 0.85) * pose.scaleX, index % 3 === 0 ? 0.6 : 0.85);
    });
  }
}
