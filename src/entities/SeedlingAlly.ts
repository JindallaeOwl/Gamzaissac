import Phaser from 'phaser';
import { TextureKeys } from '../config/assets';
import { DEPTH } from '../config/gameConfig';
import { canDamageAlly, type AllyMode, type AllySide } from '../systems/AllyRules';
import type { BaseEnemy } from './enemies/BaseEnemy';

export class SeedlingAlly extends Phaser.Physics.Arcade.Sprite {
  health: number;
  mode: AllyMode = 'follow';
  target: BaseEnemy | null = null;
  nextFireAt = 0;
  invulnerableUntil = 0;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    readonly side: AllySide,
    maxHealth: number,
    displaySize: number,
    bodyRadius: number,
  ) {
    super(scene, x, y, TextureKeys.shopNpcIdleA);
    this.health = maxHealth;
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setDisplaySize(displaySize, displaySize);
    // 나중에 소환되어도 플레이어를 가리지 않도록 그림자와 몸 사이에 그린다.
    this.setDepth(DEPTH.actor - 0.5);
    const body = this.body as Phaser.Physics.Arcade.Body;
    // 그림을 축소해도 판정 반경은 전달받은 월드 좌표 크기를 유지한다.
    const radius = bodyRadius / this.scaleX;
    body.setCircle(radius, this.displayOriginX - radius, this.displayOriginY - radius);
    body.setAllowGravity(false);
  }

  takeDamage(amount: number, time: number, invulnMs: number): boolean {
    if (!this.active || !this.body || !canDamageAlly(time, this.invulnerableUntil, amount))
      return false;
    this.health = Math.max(0, this.health - amount);
    this.invulnerableUntil = time + invulnMs;
    if (this.health === 0) {
      this.target = null;
      this.destroy();
    }
    return true;
  }
}
