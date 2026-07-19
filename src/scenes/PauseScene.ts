import Phaser from 'phaser';
import { DEPTH, GAME_HEIGHT, GAME_WIDTH } from '../config/gameConfig';
import { gameFontStack, t } from '../i18n';
import { MusicSystem } from '../systems/MusicSystem';
import { getRenderScale } from '../systems/GameSettings';
import {
  activateSettingsMenuAction,
  buildSettingsMenuItems,
  preserveMenuSelection,
  type SettingsMenuAction,
} from '../ui/SettingsMenu';
import {
  getPauseEscapeAction,
  getPauseMainActions,
  isPauseCode,
  type PauseMainAction,
  type PauseMode,
} from '../ui/PauseMenuRules';
import { applyCurrentRenderScaleToGame, applyRenderScale } from '../utils/render';
import { TITLE_TRANSITION_SCENE_KEY } from './TitleTransitionScene';

type PauseAction = PauseMainAction | SettingsMenuAction;

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
  private music?: MusicSystem;
  private upKeys: Phaser.Input.Keyboard.Key[] = [];
  private downKeys: Phaser.Input.Keyboard.Key[] = [];
  private confirmKeys: Phaser.Input.Keyboard.Key[] = [];
  private transitionStarted = false;
  private readonly handleEscapeKeyDown = (event: KeyboardEvent): void => {
    if (!isPauseCode(event.code) || event.repeat || !this.scene.isActive()) {
      return;
    }

    event.preventDefault();

    if (getPauseEscapeAction(this.mode) === 'back') {
      this.renderMenu('main');
    } else {
      this.resumeGame();
    }
  };

  constructor() {
    super('PauseScene');
  }

  create(): void {
    this.transitionStarted = false;
    applyRenderScale(this);
    this.music = new MusicSystem(this);
    this.add
      .rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x04070b, 0.32)
      .setDepth(DEPTH.ui + 20);
    this.add
      .rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, 456, 250, 0x0a1119, 0.18)
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
        resolution: getRenderScale(),
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
        resolution: getRenderScale(),
      })
      .setOrigin(0.5)
      .setDepth(DEPTH.ui + 22);

    this.createControls();
    document.addEventListener('keydown', this.handleEscapeKeyDown, true);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      document.removeEventListener('keydown', this.handleEscapeKeyDown, true);
    });
    this.renderMenu('main');
  }

  update(): void {
    if (this.transitionStarted) {
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
          resolution: getRenderScale(),
        })
        .setOrigin(0.5)
        .setPadding(11, 4, 11, 4)
        .setInteractive({ useHandCursor: true });

      text.on('pointerover', () => {
        this.selectedIndex = index;
        this.refreshSelection();
      });
      text.on('pointerdown', () => {
        this.selectedIndex = index;
        this.activateSelection();
      });
      this.menuContainer?.add(text);
      this.itemTexts.push(text);
    });

    this.refreshSelection();
  }

  private buildItems(mode: PauseMode): PauseItem[] {
    if (mode === 'main') {
      return getPauseMainActions().map((action) => ({
        action,
        label: t(`pause.${action}`),
      }));
    }

    return buildSettingsMenuItems();
  }

  private activateSelection(): void {
    if (this.transitionStarted) {
      return;
    }

    const action = this.items[this.selectedIndex]?.action;
    if (action === 'continue') {
      this.resumeGame();
      return;
    }

    if (action === 'settings') {
      this.renderMenu('settings');
      return;
    }

    if (action === 'exit') {
      this.exitToTitle();
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

    if (result.settings) {
      this.music?.setEnabled(result.settings.soundEnabled);
    }

    this.hintText?.setText('');
    this.refreshSelection();

    if (result.renderScaleChanged) {
      applyCurrentRenderScaleToGame(this);
    }
  }

  private refreshSelection(): void {
    this.items = this.buildItems(this.mode);
    this.selectedIndex = preserveMenuSelection(this.selectedIndex, this.items.length);
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
    if (this.transitionStarted) {
      return;
    }

    this.scene.resume('GameScene');
    this.scene.stop();
  }

  private exitToTitle(): void {
    this.transitionStarted = true;
    this.input.enabled = false;
    this.input.keyboard?.resetKeys();
    this.scene.launch(TITLE_TRANSITION_SCENE_KEY);
  }
}
