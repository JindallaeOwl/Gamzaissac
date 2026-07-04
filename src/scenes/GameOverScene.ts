import Phaser from 'phaser';
import { TextureKeys } from '../config/assets';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/gameConfig';
import { koreanFontStack, t } from '../i18n';

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
    this.add.tileSprite(
      GAME_WIDTH / 2,
      GAME_HEIGHT / 2,
      GAME_WIDTH,
      GAME_HEIGHT,
      TextureKeys.floorTile,
    );
    this.cameras.main.setBackgroundColor('#11151d');

    this.add
      .text(GAME_WIDTH / 2, 210, t('gameOver.title'), {
        fontFamily: koreanFontStack(),
        fontSize: '50px',
        color: '#ff8b8b',
        stroke: '#0d1117',
        strokeThickness: 8,
      })
      .setOrigin(0.5);

    this.add
      .text(
        GAME_WIDTH / 2,
        310,
        t('gameOver.summary', {
          rooms: data.clearedRooms,
          items: data.itemCount,
          score: data.score,
        }),
        {
          fontFamily: koreanFontStack(),
          fontSize: '20px',
          color: '#f7f3e8',
          stroke: '#0d1117',
          strokeThickness: 5,
        },
      )
      .setOrigin(0.5);

    this.add
      .text(GAME_WIDTH / 2, 390, t('title.pressEnter'), {
        fontFamily: koreanFontStack(),
        fontSize: '18px',
        color: '#ffe39b',
        stroke: '#0d1117',
        strokeThickness: 5,
      })
      .setOrigin(0.5);

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
