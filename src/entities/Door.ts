import Phaser from 'phaser';
import { TextureKeys } from '../config/assets';
import { DEPTH } from '../config/gameConfig';
import { DoorEntryGate } from '../systems/DoorEntryGate';
import type { Direction } from '../utils/directions';

export class Door extends Phaser.Physics.Arcade.Sprite {
  readonly direction: Direction;
  isOpen = false;
  private readonly entryGate = new DoorEntryGate();

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

  setOpen(open: boolean, requireFreshEntry = false): void {
    this.isOpen = open;
    this.entryGate.setOpen(open, requireFreshEntry);
    this.setTint(open ? 0x92e6a7 : 0xd25f5f);
    this.setAlpha(open ? 1 : 0.72);
  }

  updateEntryGate(playerBody: Phaser.Physics.Arcade.Body): void {
    const doorBody = this.body as Phaser.Physics.Arcade.Body;
    const isOverlapping =
      doorBody.right > playerBody.left &&
      doorBody.left < playerBody.right &&
      doorBody.bottom > playerBody.top &&
      doorBody.top < playerBody.bottom;
    this.entryGate.updatePlayerOverlap(isOverlapping);
  }

  canEnter(): boolean {
    return this.entryGate.canEnter();
  }
}
