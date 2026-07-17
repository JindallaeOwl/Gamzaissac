import Phaser from 'phaser';
import { HUD_ICON_ASSETS } from '../config/assets';
import { BOLD_PIXELS_FONT_FAMILY } from '../i18n';
import { createPlaceholderAnimations, createPlaceholderTextures } from '../systems/AssetFactory';
import { applyRenderScale } from '../utils/render';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  preload(): void {
    for (const asset of HUD_ICON_ASSETS) {
      this.load.image(asset.key, asset.path);
    }
  }

  create(): void {
    applyRenderScale(this);
    createPlaceholderTextures(this);
    createPlaceholderAnimations(this);
    void document.fonts
      .load(`16px "${BOLD_PIXELS_FONT_FAMILY}"`)
      .catch(() => [])
      .then(() => this.scene.start('TitleScene'));
  }
}
