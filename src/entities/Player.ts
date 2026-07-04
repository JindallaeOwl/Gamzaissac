import Phaser from 'phaser';
import { TextureKeys } from '../config/assets';
import {
  BEAM_TUNING,
  COMBAT_TUNING,
  DEPTH,
  FEEDBACK_TUNING,
  ROOM_RECT,
  type PlayerStats,
} from '../config/gameConfig';
import { Bullet } from './Bullet';
import { clamp, normalizeVector } from '../utils/math';

export interface PlayerControls {
  up: Phaser.Input.Keyboard.Key;
  down: Phaser.Input.Keyboard.Key;
  left: Phaser.Input.Keyboard.Key;
  right: Phaser.Input.Keyboard.Key;
  fireUp: Phaser.Input.Keyboard.Key;
  fireDown: Phaser.Input.Keyboard.Key;
  fireLeft: Phaser.Input.Keyboard.Key;
  fireRight: Phaser.Input.Keyboard.Key;
}

export class Player extends Phaser.Physics.Arcade.Sprite {
  stats: PlayerStats;
  hasChargeBeam = false;

  private nextShotAt = 0;
  private invulnerableUntil = 0;
  private beamCooldownUntil = 0;
  private beamChargeStartedAt: number | null = null;
  private beamChargeDirection: { x: number; y: number } | null = null;
  private nextBeamChargePulseAt = 0;

  constructor(scene: Phaser.Scene, x: number, y: number, stats: PlayerStats) {
    super(scene, x, y, TextureKeys.player);
    this.stats = stats;
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setDepth(DEPTH.actor);

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    body.setCircle(15);
    body.setCollideWorldBounds(false);
    body.setMaxVelocity(420, 420);
  }

  setStats(stats: PlayerStats): void {
    this.stats = stats;
  }

  update(time: number, controls: PlayerControls, bulletGroup: Phaser.Physics.Arcade.Group): void {
    if (!this.active) {
      return;
    }

    this.updateMovement(controls);
    this.updateAttack(time, controls, bulletGroup);
    this.constrainToRoom();
  }

  damage(amount: number, sourceX: number, sourceY: number): boolean {
    if (!this.active || !this.body) {
      return false;
    }

    const now = this.scene.time.now;

    if (now < this.invulnerableUntil) {
      return false;
    }

    this.invulnerableUntil = now + COMBAT_TUNING.playerIFrameMs;
    this.stats.health = clamp(this.stats.health - amount, 0, this.stats.maxHealth);

    const hitVector = normalizeVector(this.x - sourceX, this.y - sourceY);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(
      hitVector.x * COMBAT_TUNING.playerKnockback,
      hitVector.y * COMBAT_TUNING.playerKnockback,
    );

    this.emit('health-changed', this.stats);

    if (this.stats.health <= 0) {
      this.emit('player-died');
    }

    return true;
  }

  private updateMovement(controls: PlayerControls): void {
    const inputX = Number(controls.right.isDown) - Number(controls.left.isDown);
    const inputY = Number(controls.down.isDown) - Number(controls.up.isDown);
    const direction = normalizeVector(inputX, inputY);
    const body = this.body as Phaser.Physics.Arcade.Body;

    body.setVelocity(direction.x * this.stats.moveSpeed, direction.y * this.stats.moveSpeed);
  }

  private updateAttack(
    time: number,
    controls: PlayerControls,
    bulletGroup: Phaser.Physics.Arcade.Group,
  ): void {
    if (this.hasChargeBeam) {
      this.updateBeamCharge(time, controls);
      return;
    }

    this.tryShoot(time, controls, bulletGroup);
  }

  private tryShoot(
    time: number,
    controls: PlayerControls,
    bulletGroup: Phaser.Physics.Arcade.Group,
  ): void {
    const direction = this.getFireDirection(controls);

    if (!direction || time < this.nextShotAt) {
      return;
    }

    this.nextShotAt = time + 1000 / this.stats.fireRate;

    const bulletX = this.x + direction.x * 22;
    const bulletY = this.y + direction.y * 22;

    Bullet.spawn(this.scene, bulletGroup, {
      x: bulletX,
      y: bulletY,
      direction,
      owner: 'player',
      speed: this.stats.projectileSpeed,
      damage: this.stats.damage,
      lifeMs: (this.stats.range / this.stats.projectileSpeed) * 1000,
    });
    this.emit('player-shot', { x: bulletX, y: bulletY, direction });
  }

  private updateBeamCharge(time: number, controls: PlayerControls): void {
    const direction = this.getFireDirection(controls);

    if (direction) {
      if (!this.beamChargeStartedAt) {
        this.beamChargeStartedAt = time;
        this.beamChargeDirection = direction;
        this.nextBeamChargePulseAt = 0;
        this.emit('beam-charge-started');
      } else {
        this.beamChargeDirection = direction;
      }

      const chargeProgress = Math.min(1, (time - this.beamChargeStartedAt) / BEAM_TUNING.chargeMs);
      this.setTint(chargeProgress >= 1 ? 0xff7af2 : 0x8beeff);

      if (time >= this.nextBeamChargePulseAt) {
        this.nextBeamChargePulseAt = time + FEEDBACK_TUNING.effects.beamChargePulseMs;
        this.emit('beam-charge-pulse', { ready: chargeProgress >= 1 });
      }

      return;
    }

    if (!this.beamChargeStartedAt || !this.beamChargeDirection) {
      this.clearTint();
      return;
    }

    const chargeMs = time - this.beamChargeStartedAt;
    const canFire = chargeMs >= BEAM_TUNING.chargeMs && time >= this.beamCooldownUntil;

    if (canFire) {
      this.beamCooldownUntil = time + BEAM_TUNING.cooldownMs;
      this.emit('beam-fired', this.beamChargeDirection);
    }

    this.beamChargeStartedAt = null;
    this.beamChargeDirection = null;
    this.clearTint();
  }

  private getFireDirection(controls: PlayerControls): { x: number; y: number } | null {
    if (controls.fireUp.isDown) {
      return { x: 0, y: -1 };
    }

    if (controls.fireDown.isDown) {
      return { x: 0, y: 1 };
    }

    if (controls.fireLeft.isDown) {
      return { x: -1, y: 0 };
    }

    if (controls.fireRight.isDown) {
      return { x: 1, y: 0 };
    }

    return null;
  }

  private constrainToRoom(): void {
    this.x = clamp(this.x, ROOM_RECT.left + 18, ROOM_RECT.right - 18);
    this.y = clamp(this.y, ROOM_RECT.top + 18, ROOM_RECT.bottom - 18);
  }

  playHitFeedback(): void {
    if (!this.active) {
      return;
    }

    this.setTexture(TextureKeys.playerHit);

    this.scene.tweens.killTweensOf(this);
    this.scene.tweens.add({
      targets: this,
      alpha: 0.36,
      duration: 70,
      yoyo: true,
      repeat: 5,
      onComplete: () => {
        this.alpha = 1;
        this.setTexture(TextureKeys.player);
      },
    });
  }
}
