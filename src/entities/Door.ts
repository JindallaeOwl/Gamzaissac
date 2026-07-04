import Phaser from 'phaser';
import { TextureKeys } from '../config/assets';
import { DEPTH } from '../config/gameConfig';
import type { Direction } from '../utils/directions';

export class Door extends Phaser.Physics.Arcade.Sprite {
  readonly direction: Direction;
  isOpen = false;

  constructor(scene: Phaser.Scene, x: number, y: number, direction: Direction) {
    super(
      scene,
      x,
      y,
      direction === 'north' || direction === 'south'
        ? TextureKeys.doorHorizontal
        : TextureKeys.doorVertical,
    );

    this.direction = direction;
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setDepth(DEPTH.item);

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    body.setImmovable(true);
  }

  setOpen(open: boolean): void {
    this.isOpen = open;
    this.setTint(open ? 0x92e6a7 : 0xd25f5f);
    this.setAlpha(open ? 1 : 0.72);
  }
}
