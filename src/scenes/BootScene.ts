import Phaser from 'phaser';
import { createPlaceholderTextures } from '../systems/AssetFactory';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  create(): void {
    createPlaceholderTextures(this);
    this.scene.start('TitleScene');
  }
}
