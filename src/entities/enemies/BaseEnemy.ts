import Phaser from 'phaser';
import { COMBAT_TUNING, DEPTH, FEEDBACK_TUNING, ROOM_RECT } from '../../config/gameConfig';
import type { EnemyDefinition } from '../../data/enemies';
import { Bullet } from '../Bullet';
import type { Player } from '../Player';
import { normalizeVector } from '../../utils/math';
import { getCenteredCircleBodyOffset } from '../../utils/collisionBody';
import { t } from '../../i18n';

export abstract class BaseEnemy extends Phaser.Physics.Arcade.Sprite {
  readonly definition: EnemyDefinition;
  readonly scoreValue: number;
  contactDamage: number;
  readonly isBoss: boolean;

  protected hp: number;
  protected floorScale: number;
  private nextContactAt = 0;
  private defeated = false;
  private persistentTint?: number;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    definition: EnemyDefinition,
    floor: number,
  ) {
    super(scene, x, y, definition.textureKey);
    this.definition = definition;
    this.floorScale = 1 + Math.max(0, floor - 1) * 0.16;
    this.hp = definition.maxHealth * this.floorScale;
    this.contactDamage = definition.contactDamage;
    this.scoreValue = Math.round(definition.score * this.floorScale);
    this.isBoss = definition.kind === 'boss';

    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setDepth(DEPTH.actor);

    // Enemy textures are authored at their intended on-screen size, so they are
    // drawn at scale 1. (Normal enemies previously used 40-42px textures scaled
    // to 0.8; the pixel-art sprites are 32px and need no down-scaling.)

    const body = this.body as Phaser.Physics.Arcade.Body;
    const bodyOffset = getCenteredCircleBodyOffset(this.width, this.height, definition.bodyRadius);
    body.setAllowGravity(false);
    body.setCircle(definition.bodyRadius, bodyOffset.x, bodyOffset.y);
    body.setCollideWorldBounds(false);
  }

  abstract updateAI(time: number, player: Player, enemyBullets: Phaser.Physics.Arcade.Group): void;

  takeDamage(amount: number, sourceX: number, sourceY: number): boolean {
    if (!this.active || this.defeated || !this.body) {
      return false;
    }

    this.hp -= amount;

    const body = this.body as Phaser.Physics.Arcade.Body;
    const push = normalizeVector(this.x - sourceX, this.y - sourceY);
    body.setVelocity(push.x * COMBAT_TUNING.enemyKnockback, push.y * COMBAT_TUNING.enemyKnockback);

    this.setTint(FEEDBACK_TUNING.effects.enemyHitTint);
    this.scene.time.delayedCall(FEEDBACK_TUNING.effects.enemyHitFlashMs, () => {
      if (this.active) {
        this.restorePersistentTint();
      }
    });

    if (this.hp <= 0) {
      this.defeated = true;
      const body = this.body as Phaser.Physics.Arcade.Body | undefined;

      if (body) {
        body.enable = false;
        body.stop();
      }

      this.emit('enemy-defeated', this.scoreValue);
      this.destroy();
      return true;
    }

    return false;
  }

  takeProjectileDamage(
    amount: number,
    sourceX: number,
    sourceY: number,
  ): { defeated: boolean; overflowDamage: number } {
    const healthBeforeHit = Math.max(0, this.hp);
    const defeated = this.takeDamage(amount, sourceX, sourceY);

    return {
      defeated,
      overflowDamage: defeated ? Math.max(0, amount - healthBeforeHit) : 0,
    };
  }

  getHealthRatio(): number {
    return Phaser.Math.Clamp(this.hp / (this.definition.maxHealth * this.floorScale), 0, 1);
  }

  getDisplayName(): string {
    return this.definition.displayNameKey
      ? t(this.definition.displayNameKey)
      : this.definition.displayName;
  }

  getBossBarColor(isPhaseTwo = false): number {
    if (isPhaseTwo) {
      return this.definition.bossPhaseTwoBarColor ?? this.definition.bossBarColor ?? 0xd84f66;
    }

    return this.definition.bossBarColor ?? 0xd84f66;
  }

  getPhaseTwoMessageKey(): string {
    return this.definition.phaseTwoMessageKey ?? 'messages.bossPhaseTwo';
  }

  canDealContactDamage(time: number): boolean {
    if (time < this.nextContactAt) {
      return false;
    }

    this.nextContactAt = time + COMBAT_TUNING.enemyContactCooldownMs;
    return true;
  }

  stopForAiDelay(): void {
    const body = this.body as Phaser.Physics.Arcade.Body | undefined;
    body?.stop();
  }

  protected setPersistentTint(tint: number): void {
    this.persistentTint = tint;
    this.setTint(tint);
  }

  private restorePersistentTint(): void {
    if (this.persistentTint === undefined) {
      this.clearTint();
      return;
    }

    this.setTint(this.persistentTint);
  }

  protected moveToward(x: number, y: number, speed: number): void {
    const direction = normalizeVector(x - this.x, y - this.y);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(direction.x * speed, direction.y * speed);
    this.constrainToRoom();
  }

  protected fireAtPlayer(
    player: Player,
    enemyBullets: Phaser.Physics.Arcade.Group,
    speed: number,
    damage: number,
  ): void {
    const direction = normalizeVector(player.x - this.x, player.y - this.y);

    this.fireBullet(
      this.x + direction.x * (this.definition.bodyRadius + 4),
      this.y + direction.y * (this.definition.bodyRadius + 4),
      direction,
      enemyBullets,
      speed,
      damage,
    );
  }

  protected fireBullet(
    x: number,
    y: number,
    direction: { x: number; y: number },
    enemyBullets: Phaser.Physics.Arcade.Group,
    speed: number,
    damage: number,
  ): void {
    Bullet.spawn(this.scene, enemyBullets, {
      x,
      y,
      direction,
      owner: 'enemy',
      speed,
      damage,
      lifeMs: COMBAT_TUNING.enemyBulletLifeMs,
    });
  }

  protected constrainToRoom(): void {
    const margin = this.definition.bodyRadius + 2;
    this.x = Phaser.Math.Clamp(this.x, ROOM_RECT.left + margin, ROOM_RECT.right - margin);
    this.y = Phaser.Math.Clamp(this.y, ROOM_RECT.top + margin, ROOM_RECT.bottom - margin);
  }
}
