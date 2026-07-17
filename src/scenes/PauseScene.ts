import Phaser from 'phaser';
import { DEPTH, GAME_HEIGHT, GAME_WIDTH, RENDER_SCALE } from '../config/gameConfig';
import { gameFontStack, t } from '../i18n';
import {
  activateSettingsMenuAction,
  buildSettingsMenuItems,
  type SettingsMenuAction,
} from '../ui/SettingsMenu';
import { applyRenderScale } from '../utils/render';

type PauseMode = 'main' | 'settings';
type PauseAction = 'continue' | 'settings' | 'title' | SettingsMenuAction;

interface PauseItem {
  label: string;
  action: PauseAction;
}

export class PauseScene extends Phaser.Scene {
  private mode: PauseMode = 'main';
  private selectedIndex = 0;
  private items: PauseItem[] = [];
  private itemTexts: Phaser.GameObjects.Text[] = [];
  private menuContainer?: Phaser.GameObjects.Container;
  private hintText?: Phaser.GameObjects.Text;
  private upKeys: Phaser.Input.Keyboard.Key[] = [];
  private downKeys: Phaser.Input.Keyboard.Key[] = [];
  private confirmKeys: Phaser.Input.Keyboard.Key[] = [];
  private escapeKey?: Phaser.Input.Keyboard.Key;

  constructor() {
    super('PauseScene');
  }

  create(): void {
    applyRenderScale(this);
    this.add
      .rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x04070b, 0.82)
      .setDepth(DEPTH.ui + 20);
    this.add
      .rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, 456, 250, 0x0a1119, 0.96)
      .setStrokeStyle(2, 0x56dce5, 0.75)
      .setDepth(DEPTH.ui + 21);
    this.add
      .text(GAME_WIDTH / 2, 44, t('pause.title'), {
        fontFamily: gameFontStack(),
        fontSize: '23px',
        fontStyle: 'bold',
        color: '#dfffff',
        stroke: '#071116',
        strokeThickness: 4,
        resolution: RENDER_SCALE,
      })
      .setOrigin(0.5)
      .setDepth(DEPTH.ui + 22);

    this.hintText = this.add
      .text(GAME_WIDTH / 2, 252, '', {
        fontFamily: gameFontStack(),
        fontSize: '7px',
        color: '#ffd783',
        stroke: '#071116',
        strokeThickness: 2,
        resolution: RENDER_SCALE,
      })
      .setOrigin(0.5)
      .setDepth(DEPTH.ui + 22);

    this.createControls();
    this.renderMenu('main');
  }

  update(): void {
    if (this.escapeKey && Phaser.Input.Keyboard.JustDown(this.escapeKey)) {
      if (this.mode === 'settings') {
        this.renderMenu('main');
      } else {
        this.resumeGame();
      }
      return;
    }

    if (this.upKeys.some((key) => Phaser.Input.Keyboard.JustDown(key))) {
      this.selectedIndex = Phaser.Math.Wrap(this.selectedIndex - 1, 0, this.items.length);
      this.refreshSelection();
    }

    if (this.downKeys.some((key) => Phaser.Input.Keyboard.JustDown(key))) {
      this.selectedIndex = Phaser.Math.Wrap(this.selectedIndex + 1, 0, this.items.length);
      this.refreshSelection();
    }

    if (this.confirmKeys.some((key) => Phaser.Input.Keyboard.JustDown(key))) {
      this.activateSelection();
    }
  }

  private createControls(): void {
    const keyboard = this.input.keyboard;

    if (!keyboard) {
      return;
    }

    this.upKeys = [
      keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.UP),
      keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
    ];
    this.downKeys = [
      keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN),
      keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
    ];
    this.confirmKeys = [
      keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER),
      keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE),
    ];
    this.escapeKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
  }

  private renderMenu(mode: PauseMode): void {
    this.mode = mode;
    this.selectedIndex = 0;
    this.menuContainer?.destroy(true);
    this.menuContainer = this.add.container(GAME_WIDTH / 2, mode === 'main' ? 92 : 70);
    this.menuContainer.setDepth(DEPTH.ui + 22);
    this.items = this.buildItems(mode);
    this.itemTexts = [];
    this.hintText?.setText('');

    this.items.forEach((item, index) => {
      const text = this.add
        .text(0, index * (mode === 'main' ? 32 : 27), item.label, {
          fontFamily: gameFontStack(),
          fontSize: mode === 'main' ? '13px' : '10px',
          fontStyle: 'bold',
          color: '#f5fbff',
          stroke: '#071116',
          strokeThickness: 3,
          resolution: RENDER_SCALE,
        })
        .setOrigin(0.5)
        .setPadding(11, 4, 11, 4)
        .setInteractive({ useHandCursor: true });

      text.on('pointerover', () => {
        this.selectedIndex = index;
        this.refreshSelection();
      });
      text.on('pointerdown', () => this.activateSelection());
      this.menuContainer?.add(text);
      this.itemTexts.push(text);
    });

    this.refreshSelection();
  }

  private buildItems(mode: PauseMode): PauseItem[] {
    if (mode === 'main') {
      return [
        { label: t('pause.continue'), action: 'continue' },
        { label: t('pause.settings'), action: 'settings' },
        { label: t('pause.fullscreen'), action: 'fullscreen' },
        { label: t('pause.titleScreen'), action: 'title' },
      ];
    }

    return buildSettingsMenuItems();
  }

  private activateSelection(): void {
    const action = this.items[this.selectedIndex]?.action;
    if (action === 'continue') {
      this.resumeGame();
      return;
    }

    if (action === 'settings') {
      this.renderMenu('settings');
      return;
    }

    if (action === 'title') {
      this.scene.stop('GameScene');
      this.scene.start('TitleScene');
      return;
    }

    if (!action) {
      return;
    }

    const result = activateSettingsMenuAction(action);

    if (result.command === 'fullscreen') {
      this.toggleFullscreen();
      return;
    }

    if (result.command === 'back') {
      this.renderMenu('main');
      return;
    }

    this.renderMenu('settings');

    if (result.showRestartHint) {
      this.hintText?.setText(t('settings.nextLaunch'));
    }
  }

  private refreshSelection(): void {
    this.items = this.buildItems(this.mode);
    this.itemTexts.forEach((text, index) => {
      const selected = index === this.selectedIndex;
      text.setText(this.items[index]?.label ?? '');
      text.setColor(selected ? '#ffe099' : '#f5fbff');
      text.setBackgroundColor(selected ? '#173743' : '#00000000');
      text.setScale(selected ? 1.05 : 1);
      text.setAlpha(selected ? 1 : 0.72);
    });
  }

  private toggleFullscreen(): void {
    if (this.scale.isFullscreen) {
      this.scale.stopFullscreen();
    } else {
      void this.scale.startFullscreen();
    }
  }

  private resumeGame(): void {
    this.scene.resume('GameScene');
    this.scene.stop();
  }
}
