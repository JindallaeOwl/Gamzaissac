import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, TITLE_TRANSITION_MS } from '../config/gameConfig';
import { applyRenderScale } from '../utils/render';

export const TITLE_TRANSITION_SCENE_KEY = 'TitleTransitionScene';

export class TitleTransitionScene extends Phaser.Scene {
  private cover?: Phaser.GameObjects.Rectangle;
  private transitionCompleted = false;
  private titleStartTimer?: number;
  private fadeFallbackTimer?: number;

  constructor() {
    super(TITLE_TRANSITION_SCENE_KEY);
  }

  create(): void {
    this.transitionCompleted = false;
    this.titleStartTimer = undefined;
    this.fadeFallbackTimer = undefined;
    applyRenderScale(this);
    this.input.enabled = false;
    this.input.keyboard?.resetKeys();

    this.cover = this.add
      .rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x05090e, 1)
      .setAlpha(0)
      .setInteractive();

    this.tweens.add({
      targets: this.cover,
      alpha: 1,
      duration: TITLE_TRANSITION_MS,
      ease: 'Sine.easeIn',
      onComplete: () => this.openTitleScene(),
    });

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      if (this.titleStartTimer !== undefined) {
        window.clearTimeout(this.titleStartTimer);
        this.titleStartTimer = undefined;
      }

      if (this.fadeFallbackTimer !== undefined) {
        window.clearTimeout(this.fadeFallbackTimer);
        this.fadeFallbackTimer = undefined;
      }
    });
  }

  private openTitleScene(): void {
    if (this.transitionCompleted) {
      return;
    }

    this.hideGameOverOverlay();
    const sceneManager = this.scene.manager;
    if (!sceneManager.isActive('TitleScene')) {
      this.scene.launch('TitleScene', { inputLocked: true });
    }

    sceneManager.bringToTop(TITLE_TRANSITION_SCENE_KEY);
    this.titleStartTimer = window.setTimeout(() => {
      this.titleStartTimer = undefined;
      this.finishTransition();
    }, 80);
  }

  private finishTransition(): void {
    if (this.transitionCompleted || !this.scene.isActive()) {
      return;
    }

    const sceneManager = this.scene.manager;
    const titleScene = sceneManager.getScene('TitleScene');

    sceneManager.bringToTop('TitleScene');
    sceneManager.bringToTop(TITLE_TRANSITION_SCENE_KEY);
    titleScene.input.enabled = false;
    if (titleScene.input.keyboard) {
      titleScene.input.keyboard.enabled = false;
    }

    sceneManager.stop('PauseScene');
    sceneManager.stop('GameOverScene');
    this.fadeIntoTitle(titleScene);
  }

  private fadeIntoTitle(titleScene: Phaser.Scene): void {
    this.transitionCompleted = true;
    const complete = (): void => this.completeTitleTransition(titleScene);
    this.fadeFallbackTimer = window.setTimeout(complete, TITLE_TRANSITION_MS + 120);
    this.tweens.add({
      targets: this.cover,
      alpha: 0,
      duration: TITLE_TRANSITION_MS,
      ease: 'Sine.easeOut',
      onComplete: complete,
    });
  }

  private completeTitleTransition(titleScene: Phaser.Scene): void {
    if (!this.scene.isActive()) {
      return;
    }

    if (this.fadeFallbackTimer !== undefined) {
      window.clearTimeout(this.fadeFallbackTimer);
      this.fadeFallbackTimer = undefined;
    }

    titleScene.input.enabled = true;

    if (titleScene.input.keyboard) {
      titleScene.input.keyboard.enabled = true;
      titleScene.input.keyboard.resetKeys();
    }

    this.scene.stop();
  }

  private hideGameOverOverlay(): void {
    const overlay = document.querySelector<HTMLElement>('#game-over-overlay');
    const restartButton = document.querySelector<HTMLButtonElement>('#game-over-restart');

    if (overlay) {
      overlay.hidden = true;
      overlay.classList.remove('is-leaving');
    }

    if (restartButton) {
      restartButton.disabled = false;
    }
  }
}
