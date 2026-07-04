import Phaser from 'phaser';
import { TextureKeys } from '../config/assets';
import { DEPTH } from '../config/gameConfig';
import type { PassiveItemDefinition } from '../data/items';

export class ItemPickup extends Phaser.Physics.Arcade.Sprite {
  readonly item: PassiveItemDefinition;

  constructor(scene: Phaser.Scene, x: number, y: number, item: PassiveItemDefinition) {
    super(scene, x, y, TextureKeys.item);
    this.item = item;
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setTint(item.tint);
    this.setDepth(DEPTH.item);

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    body.setCircle(13);

    scene.tweens.add({
      targets: this,
      y: y - 8,
      duration: 720,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }
}
