import Phaser from 'phaser';
import { AUTUMN_TITLE_TUNING, DEPTH, GAME_HEIGHT, GAME_WIDTH } from '../config/gameConfig';
import { buildAutumnForest, getAutumnLeafPose } from '../systems/AutumnTitleArt';
import type { TitleMenuMode } from './TitleMenuRules';

const FOREST_TEXTURE = 'title-autumn-forest';
const LEAF_COLORS = [0xe2a64e, 0xba582d, 0xd58134];
const LEAF_PIXELS = ['0001000', '0101010', '0111110', '1111111', '0111110', '0001000', '0001000'];

export class AutumnTitleBackground {
  private readonly leaves: Phaser.GameObjects.Image[] = [];
  private readonly menuShade: Phaser.GameObjects.Graphics;
  private elapsedMs = 0;

  constructor(scene: Phaser.Scene) {
    if (!scene.textures.exists(FOREST_TEXTURE)) {
      const art = scene.add.graphics();
      for (const pixel of buildAutumnForest()) {
        art.fillStyle(pixel.color, 1);
        art.fillRect(pixel.x, pixel.y, pixel.width, pixel.height);
      }
      // 숲은 한 번만 텍스처로 구워 매 프레임 수천 개의 잎 조각을 다시 그리지 않는다.
      art.generateTexture(FOREST_TEXTURE, GAME_WIDTH, GAME_HEIGHT);
      art.destroy();
    }
    scene.add.image(0, 0, FOREST_TEXTURE).setOrigin(0).setDepth(DEPTH.floor);

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
    this.menuShade = scene.add.graphics().setDepth(DEPTH.ui - 1);
    this.update(0);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      // 씬 재사용 때 이전 그림 객체를 붙잡지 않도록 참조도 함께 비운다.
      this.leaves.length = 0;
    });
  }

  setMenuMode(mode: TitleMenuMode): void {
    this.menuShade.clear();
    const main = mode === 'main';
    const x = main ? 162 : 101;
    const y = main ? 130 : 65;
    const width = main ? 156 : 278;
    const height = main ? 101 : 177;
    // 딱딱한 전체 화면 테두리 대신 글자 뒤에만 작은 그늘을 둔다.
    this.menuShade.fillStyle(0x241c17, main ? 0.78 : 0.91);
    this.menuShade.fillRect(x + 3, y, width - 6, height);
    this.menuShade.fillRect(x, y + 3, width, height - 6);
    this.menuShade.fillStyle(0xd6a15b, 0.5);
    this.menuShade.fillRect(x + 24, y, width - 48, 1);
    this.menuShade.fillRect(x + 24, y + height - 1, width - 48, 1);
  }

  update(deltaMs: number): void {
    this.elapsedMs += Math.max(0, deltaMs);
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
