import Phaser from 'phaser';
import { TextureKeys } from '../config/assets';
import { DEPTH } from '../config/gameConfig';
import { DoorEntryGate } from '../systems/DoorEntryGate';
import {
  DOORWAY_SPAN,
  getDoorTriggerRect,
  hasCrossedDoorThreshold,
} from '../systems/DoorwayGeometry';
import type { Direction } from '../utils/directions';

export const DOOR_SLAM_DURATION_MS = 260;

export class Door extends Phaser.Physics.Arcade.Sprite {
  readonly direction: Direction;
  isOpen = false;
  private readonly entryGate = new DoorEntryGate();
  private readonly panel: Phaser.GameObjects.Sprite;
  private readonly panelY: number;
  private readonly panelScaleX: number;
  private readonly panelScaleY: number;
  private present = false;

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
    // 이 Sprite는 고정된 전환 판정만 담당한다. 실제 문 그림은 별도 panel로 두어
    // 내려오고 올라가는 연출 중에도 판정 위치가 움직이지 않게 한다.
    this.setVisible(false).setDepth(DEPTH.item);
    this.panelY = y;
    const horizontal = direction === 'north' || direction === 'south';
    this.panelScaleX = horizontal ? DOORWAY_SPAN / this.width : 1;
    this.panelScaleY = horizontal ? 1 : DOORWAY_SPAN / this.height;
    this.panel = scene.add
      .sprite(x, y, this.texture.key)
      .setScale(this.panelScaleX, this.panelScaleY)
      .setDepth(DEPTH.item)
      .setVisible(false);

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    body.setImmovable(true);

    // 문 전체가 아니라 벽 바깥쪽 끝에 닿았을 때만 전환한다. 플레이어는 벽 띠 안을
    // 실제로 지나 문간 끝까지 가야 한다.
    const trigger = getDoorTriggerRect(direction);
    body.setSize(trigger.width, trigger.height);
    body.setOffset(
      trigger.x - trigger.width / 2 - (x - this.width / 2),
      trigger.y - trigger.height / 2 - (y - this.height / 2),
    );
  }

  setPresent(present: boolean): void {
    this.present = present;

    if (!present) {
      this.scene.tweens.killTweensOf(this.panel);
      this.panel.setVisible(false);
    }
  }

  setOpen(open: boolean, requireFreshEntry = false, slamClosed = false): void {
    const justOpened = open && !this.isOpen;
    this.isOpen = open;
    this.entryGate.setOpen(open, requireFreshEntry);

    if (!this.present) {
      return;
    }

    if (open) {
      if (justOpened && this.panel.visible) {
        this.raisePanel();
      }
      return;
    }

    this.scene.tweens.killTweensOf(this.panel);
    this.panel.setVisible(true).setAlpha(1).setScale(this.panelScaleX, this.panelScaleY);

    if (!slamClosed) {
      this.panel.setY(this.panelY);
      return;
    }

    this.panel.setY(this.panelY - 24);
    this.scene.tweens.add({
      targets: this.panel,
      y: this.panelY,
      duration: DOOR_SLAM_DURATION_MS,
      // 처음에는 묵직하게 움직이다가 충돌 직전에 급격히 빨라지는 낙하 곡선.
      ease: 'Cubic.easeIn',
      onComplete: () => {
        this.panel.setScale(this.panelScaleX * 1.05, this.panelScaleY * 0.88);
        this.scene.tweens.add({
          targets: this.panel,
          scaleX: this.panelScaleX,
          scaleY: this.panelScaleY,
          duration: 70,
          ease: 'Quad.easeOut',
        });
      },
    });
  }

  setDoorTint(color?: number): void {
    if (color === undefined) {
      this.panel.clearTint();
    } else {
      this.panel.setTint(color);
    }
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

  canEnter(playerBody: Phaser.Physics.Arcade.Body): boolean {
    return (
      this.entryGate.canEnter() &&
      hasCrossedDoorThreshold(this.direction, {
        x: playerBody.center.x,
        y: playerBody.center.y,
      })
    );
  }

  private raisePanel(): void {
    this.scene.tweens.killTweensOf(this.panel);
    this.panel.setScale(this.panelScaleX, this.panelScaleY);
    this.scene.tweens.add({
      targets: this.panel,
      y: this.panelY - 20,
      alpha: 0,
      duration: 220,
      ease: 'Cubic.easeIn',
      onComplete: () => {
        this.panel.setVisible(false).setY(this.panelY).setAlpha(1);
      },
    });
  }
}
