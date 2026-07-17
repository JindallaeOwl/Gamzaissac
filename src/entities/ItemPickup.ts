import Phaser from 'phaser';
import { itemIconKey } from '../config/assets';
import { DEPTH } from '../config/gameConfig';
import type { PassiveItemDefinition } from '../data/items';

export type ItemPickupSource = 'room' | 'secret';

export class ItemPickup extends Phaser.Physics.Arcade.Sprite {
  readonly item: PassiveItemDefinition;
  readonly source: ItemPickupSource;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    item: PassiveItemDefinition,
    source: ItemPickupSource = 'room',
  ) {
    super(scene, x, y, itemIconKey(item.id));
    this.item = item;
    this.source = source;
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setDepth(DEPTH.item);

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    body.setCircle(13);

    scene.tweens.add({
      targets: this,
      y: y - 4,
      duration: 720,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }
}
