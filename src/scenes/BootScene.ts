import Phaser from 'phaser';
import {
  HUD_ICON_ASSETS,
  ITEM_IMAGE_ASSETS,
  MUSIC_ASSETS,
  PICKUP_SPRITESHEET_ASSETS,
  PLAYER_IMAGE_ASSETS,
  PLAYER_SPRITESHEET_ASSETS,
  SHOP_NPC_IMAGE_ASSETS,
} from '../config/assets';
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

    for (const asset of ITEM_IMAGE_ASSETS) {
      this.load.image(asset.key, asset.path);
    }

    for (const asset of MUSIC_ASSETS) {
      this.load.audio(asset.key, asset.path);
    }

    for (const asset of PLAYER_SPRITESHEET_ASSETS) {
      this.load.spritesheet(asset.key, asset.path, {
        frameWidth: asset.frameWidth,
        frameHeight: asset.frameHeight,
      });
    }

    for (const asset of PICKUP_SPRITESHEET_ASSETS) {
      this.load.spritesheet(asset.key, asset.path, {
        frameWidth: asset.frameWidth,
        frameHeight: asset.frameHeight,
      });
    }

    for (const asset of PLAYER_IMAGE_ASSETS) {
      this.load.image(asset.key, asset.path);
    }

    for (const asset of SHOP_NPC_IMAGE_ASSETS) {
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
