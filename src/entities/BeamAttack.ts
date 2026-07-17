import Phaser from 'phaser';
import { BEAM_TUNING, DEPTH } from '../config/gameConfig';
import type { BaseEnemy } from './enemies/BaseEnemy';

export class BeamAttack extends Phaser.GameObjects.Rectangle {
  readonly damage: number;

  private readonly bornAt: number;
  private readonly damagedAt = new WeakMap<BaseEnemy, number>();
  private core?: Phaser.GameObjects.Rectangle;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    direction: { x: number; y: number },
    range: number,
    damage: number,
  ) {
    const horizontal = direction.x !== 0;
    const width = horizontal ? range : BEAM_TUNING.width;
    const height = horizontal ? BEAM_TUNING.width : range;
    const centerX = x + direction.x * (range / 2 + 12);
    const centerY = y + direction.y * (range / 2 + 12);

    super(scene, centerX, centerY, width, height, 0xff7af2, 0.42);
    this.damage = damage;
    this.bornAt = scene.time.now;

    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setDepth(DEPTH.effect);
    this.setStrokeStyle(2, 0xf7f3e8, 0.72);

    this.core = scene.add
      .rectangle(centerX, centerY, horizontal ? range : 4, horizontal ? 4 : range, 0xfff4ff, 0.68)
      .setDepth(DEPTH.effect + 1);

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    body.setImmovable(true);
  }

  update(time: number): void {
    if (time - this.bornAt > BEAM_TUNING.durationMs) {
      this.destroy();
    }
  }

  canDamage(enemy: BaseEnemy, time: number): boolean {
    const lastHitAt = this.damagedAt.get(enemy) ?? -Infinity;

    if (time - lastHitAt < BEAM_TUNING.tickMs) {
      return false;
    }

    this.damagedAt.set(enemy, time);
    return true;
  }

  override destroy(fromScene?: boolean): void {
    this.core?.destroy(fromScene);
    this.core = undefined;
    super.destroy(fromScene);
  }
}
