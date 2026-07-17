import Phaser from 'phaser';
import { TextureKeys } from '../config/assets';
import { GAME_HEIGHT, GAME_WIDTH, RENDER_SCALE } from '../config/gameConfig';
import { gameFontStack, t } from '../i18n';
import { applyRenderScale } from '../utils/render';

interface GameOverData {
  clearedRooms: number;
  itemCount: number;
  score: number;
}

export class GameOverScene extends Phaser.Scene {
  private restartKeys?: Phaser.Input.Keyboard.Key[];

  constructor() {
    super('GameOverScene');
  }

  create(data: GameOverData): void {
    applyRenderScale(this);
    this.add.tileSprite(
      GAME_WIDTH / 2,
      GAME_HEIGHT / 2,
      GAME_WIDTH,
      GAME_HEIGHT,
      TextureKeys.floorTile,
    );
    this.cameras.main.setBackgroundColor('#11151d');
    this.add
      .rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, 300, 150, 0x070a10, 0.84)
      .setStrokeStyle(2, 0x7a3342, 0.9)
      .setDepth(1);

    this.add
      .rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x16070b, 0.24)
      .setDepth(0);

    this.add
      .text(GAME_WIDTH / 2, 90, t('gameOver.title'), {
        fontFamily: gameFontStack(),
        fontSize: '25px',
        color: '#ff8b8b',
        stroke: '#0d1117',
        strokeThickness: 4,
        resolution: RENDER_SCALE,
      })
      .setOrigin(0.5)
      .setDepth(2);

    this.add
      .text(
        GAME_WIDTH / 2,
        140,
        t('gameOver.summary', {
          rooms: data.clearedRooms,
          items: data.itemCount,
          score: data.score,
        }),
        {
          fontFamily: gameFontStack(),
          fontSize: '10px',
          color: '#f7f3e8',
          stroke: '#0d1117',
          strokeThickness: 2,
          resolution: RENDER_SCALE,
        },
      )
      .setOrigin(0.5)
      .setDepth(2);

    this.add
      .text(GAME_WIDTH / 2, 184, t('title.pressEnter'), {
        fontFamily: gameFontStack(),
        fontSize: '9px',
        color: '#ffe39b',
        stroke: '#0d1117',
        strokeThickness: 2,
        resolution: RENDER_SCALE,
      })
      .setOrigin(0.5)
      .setDepth(2);

    if (this.input.keyboard) {
      this.restartKeys = [
        this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER),
        this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE),
      ];
    }

    this.input.once('pointerdown', () => this.restart());
  }

  update(): void {
    if (this.restartKeys?.some((key) => Phaser.Input.Keyboard.JustDown(key))) {
      this.restart();
    }
  }

  private restart(): void {
    this.scene.start('GameScene');
  }
}
