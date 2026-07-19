import Phaser from 'phaser';
import { MusicKeys, TextureKeys } from '../config/assets';
import { DEPTH, GAME_HEIGHT, GAME_WIDTH, TITLE_TRANSITION_MS } from '../config/gameConfig';
import { gameFontStack, t } from '../i18n';
import { AudioSystem } from '../systems/AudioSystem';
import { getGameSettings, getRenderScale } from '../systems/GameSettings';
import { MusicSystem } from '../systems/MusicSystem';
import {
  activateSettingsMenuAction,
  buildSettingsMenuItems,
  preserveMenuSelection,
  type SettingsMenuAction,
} from '../ui/SettingsMenu';
import {
  getTitleEscapeTarget,
  getTitleSubtitle,
  isEscapeCode,
  type TitleMenuMode,
} from '../ui/TitleMenuRules';
import { applyCurrentRenderScaleToGame, applyRenderScale } from '../utils/render';

type MenuAction = 'start' | 'settings' | 'quit' | SettingsMenuAction;

interface MenuItem {
  label: string;
  action: MenuAction;
}

interface TitleSceneData {
  inputLocked?: boolean;
}

export class TitleScene extends Phaser.Scene {
  private mode: TitleMenuMode = 'main';
  private selectedIndex = 0;
  private soundEnabled = true;
  private menuItems: MenuItem[] = [];
  private menuTexts: Phaser.GameObjects.Text[] = [];
  private subtitleText?: Phaser.GameObjects.Text;
  private hintText?: Phaser.GameObjects.Text;
  private menuContainer?: Phaser.GameObjects.Container;
  private audio?: AudioSystem;
  private music?: MusicSystem;
  private suppressNextFullscreenLeaveNavigation = false;

  private upKeys: Phaser.Input.Keyboard.Key[] = [];
  private downKeys: Phaser.Input.Keyboard.Key[] = [];
  private confirmKeys: Phaser.Input.Keyboard.Key[] = [];
  private readonly handleEscapeKeyDown = (event: KeyboardEvent): void => {
    if (!isEscapeCode(event.code)) {
      return;
    }

    const targetMode = getTitleEscapeTarget(this.mode);

    if (!targetMode) {
      return;
    }

    event.preventDefault();
    this.playCue('pickup');
    this.renderMenu(targetMode);
  };
  private readonly handleLeaveFullscreen = (): void => {
    if (this.suppressNextFullscreenLeaveNavigation) {
      this.suppressNextFullscreenLeaveNavigation = false;
      return;
    }

    const targetMode = getTitleEscapeTarget(this.mode);

    if (targetMode) {
      this.playCue('pickup');
      this.renderMenu(targetMode);
    }
  };

  constructor() {
    super('TitleScene');
  }

  create(data: TitleSceneData = {}): void {
    this.suppressNextFullscreenLeaveNavigation = false;
    this.input.enabled = !data.inputLocked;
    if (this.input.keyboard) {
      this.input.keyboard.enabled = !data.inputLocked;
    }
    applyRenderScale(this);
    this.audio = new AudioSystem();
    this.music = new MusicSystem(this);
    this.music.play(MusicKeys.title);
    this.soundEnabled = getGameSettings().soundEnabled;
    this.input.once('pointerdown', () => this.audio?.unlock());
    this.input.keyboard?.once('keydown', () => this.audio?.unlock());

    this.add.tileSprite(
      GAME_WIDTH / 2,
      GAME_HEIGHT / 2,
      GAME_WIDTH,
      GAME_HEIGHT,
      TextureKeys.floorTile,
    );
    this.add
      .rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH - 32, GAME_HEIGHT - 24, 0x060a10, 0.28)
      .setStrokeStyle(2, 0x33434f, 0.75)
      .setDepth(DEPTH.floor + 1);
    this.createOrbitDecoration();
    this.createTitle();
    this.createControls();
    document.addEventListener('keydown', this.handleEscapeKeyDown, true);
    this.scale.on(Phaser.Scale.Events.LEAVE_FULLSCREEN, this.handleLeaveFullscreen);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      document.removeEventListener('keydown', this.handleEscapeKeyDown, true);
      this.scale.off(Phaser.Scale.Events.LEAVE_FULLSCREEN, this.handleLeaveFullscreen);
    });
    this.renderMenu('main');
    this.input.keyboard?.resetKeys();
    this.cameras.main.fadeIn(TITLE_TRANSITION_MS, 5, 9, 14);
  }

  update(): void {
    if (this.upKeys.some((key) => Phaser.Input.Keyboard.JustDown(key))) {
      this.moveSelection(-1);
    }

    if (this.downKeys.some((key) => Phaser.Input.Keyboard.JustDown(key))) {
      this.moveSelection(1);
    }

    if (this.confirmKeys.some((key) => Phaser.Input.Keyboard.JustDown(key))) {
      this.activateSelection();
    }
  }

  private createOrbitDecoration(): void {
    const orbit = this.add.container(GAME_WIDTH / 2, 105);
    orbit.setDepth(DEPTH.actor);

    for (let i = 0; i < 11; i += 1) {
      const angle = (Math.PI * 2 * i) / 11;
      const mote = this.add.image(
        Math.cos(angle) * 82,
        Math.sin(angle) * 28,
        i % 2 === 0 ? TextureKeys.enemyBullet : TextureKeys.playerSeed,
      );
      mote.setAlpha(0.36);
      orbit.add(mote);
    }

    this.tweens.add({
      targets: orbit,
      angle: 360,
      duration: 11000,
      repeat: -1,
      ease: 'Linear',
    });
  }

  private createTitle(): void {
    const titleGroup = this.add.container(GAME_WIDTH / 2, 39).setDepth(DEPTH.ui);
    const title = this.add
      .text(0, 0, t('title.name'), {
        fontFamily: gameFontStack(),
        fontSize: '50px',
        color: '#f7f3e8',
        stroke: '#421f2e',
        strokeThickness: 4,
        resolution: getRenderScale(),
      })
      .setOrigin(0.5);

    const subtitle = this.add
      .text(0, 31, '404% roguelike action', {
        fontFamily: gameFontStack(),
        fontSize: '8px',
        color: '#ffcf75',
        stroke: '#0d1117',
        strokeThickness: 2,
        resolution: getRenderScale(),
      })
      .setOrigin(0.5);
    const betaLabel = this.add
      .text(title.width / 2 - 1, 24, 'BETA', {
        fontFamily: gameFontStack(),
        fontSize: '7px',
        color: '#ffcf75',
        stroke: '#0d1117',
        strokeThickness: 2,
        resolution: getRenderScale(),
      })
      .setOrigin(1, 0.5);
    this.subtitleText = subtitle;
    titleGroup.add([title, subtitle, betaLabel]);

    titleGroup.setAngle(-0.35);
    this.tweens.add({
      targets: titleGroup,
      y: 37,
      duration: 1650,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    this.tweens.add({
      targets: titleGroup,
      angle: 0.35,
      duration: 2350,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    this.hintText = this.add
      .text(GAME_WIDTH / 2, 258, '', {
        fontFamily: gameFontStack(),
        fontSize: '7px',
        color: '#ffe39b',
        stroke: '#0d1117',
        strokeThickness: 2,
        resolution: getRenderScale(),
      })
      .setOrigin(0.5)
      .setDepth(DEPTH.ui);
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

  private renderMenu(mode: TitleMenuMode): void {
    this.mode = mode;
    this.selectedIndex = 0;
    this.menuContainer?.destroy(true);
    this.menuContainer = this.add.container(GAME_WIDTH / 2, mode === 'main' ? 150 : 80);
    this.menuContainer.setDepth(DEPTH.ui);
    this.menuTexts = [];
    this.menuItems = this.buildMenuItems(mode);
    this.subtitleText?.setText(getTitleSubtitle(mode));
    this.hintText?.setText('');

    this.menuItems.forEach((item, index) => {
      const text = this.add
        .text(0, index * (mode === 'main' ? 30 : 24), item.label, {
          fontFamily: gameFontStack(),
          fontSize: mode === 'main' ? '15px' : '10px',
          fontStyle: 'bold',
          color: '#f7f3e8',
          stroke: '#0d1117',
          strokeThickness: 3,
          resolution: getRenderScale(),
        })
        .setOrigin(0.5)
        .setPadding(12, 4, 12, 4)
        .setInteractive({ useHandCursor: true });

      text.on('pointerover', () => this.selectIndex(index));
      text.on('pointerdown', () => {
        this.selectIndex(index);
        this.activateSelection();
      });
      this.menuContainer?.add(text);
      this.menuTexts.push(text);
    });

    this.refreshMenuText();
  }

  private buildMenuItems(mode: TitleMenuMode): MenuItem[] {
    if (mode === 'main') {
      return [
        { label: t('menu.start'), action: 'start' },
        { label: t('menu.settings'), action: 'settings' },
        { label: t('menu.quit'), action: 'quit' },
      ];
    }

    return buildSettingsMenuItems(true);
  }

  private moveSelection(direction: number): void {
    this.selectIndex(Phaser.Math.Wrap(this.selectedIndex + direction, 0, this.menuItems.length));
    this.playCue('pickup');
  }

  private selectIndex(index: number): void {
    if (index === this.selectedIndex) {
      return;
    }

    this.selectedIndex = index;
    this.refreshMenuText();
  }

  private activateSelection(): void {
    const selected = this.menuItems[this.selectedIndex];

    if (!selected) {
      return;
    }

    this.playCue('shoot');

    if (selected.action === 'start') {
      this.scene.start('GameScene');
      return;
    }

    if (selected.action === 'settings') {
      this.renderMenu('settings');
      return;
    }

    if (selected.action === 'quit') {
      this.hintText?.setText(t('messages.quitHint'));
      return;
    }

    const result = activateSettingsMenuAction(selected.action);

    if (result.command === 'fullscreen') {
      if (this.scale.isFullscreen) {
        this.suppressNextFullscreenLeaveNavigation = true;
        this.scale.stopFullscreen();
      } else {
        void this.scale.startFullscreen();
      }
      return;
    }

    if (result.command === 'back') {
      this.renderMenu('main');
      return;
    }

    this.soundEnabled = result.settings?.soundEnabled ?? getGameSettings().soundEnabled;
    this.music?.setEnabled(this.soundEnabled);
    this.hintText?.setText('');
    this.refreshMenuText();

    if (result.renderScaleChanged) {
      applyCurrentRenderScaleToGame(this);
    }
  }

  private refreshMenuText(): void {
    this.menuItems = this.buildMenuItems(this.mode);
    this.selectedIndex = preserveMenuSelection(this.selectedIndex, this.menuItems.length);

    this.menuTexts.forEach((text, index) => {
      const selected = index === this.selectedIndex;
      text.setText(
        `${selected ? '> ' : '  '}${this.menuItems[index].label}${selected ? ' <' : '  '}`,
      );
      text.setColor(selected ? '#ffe39b' : '#f7f3e8');
      text.setBackgroundColor(selected ? '#17313b' : '#00000000');
      text.setScale(selected ? 1.08 : 1);
      text.setAlpha(selected ? 1 : 0.72);
    });
  }

  private playCue(cue: 'pickup' | 'shoot'): void {
    if (this.soundEnabled) {
      this.audio?.play(cue);
    }
  }
}
