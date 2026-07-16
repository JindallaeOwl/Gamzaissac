import Phaser from 'phaser';
import { AnimationKeys, TextureKeys } from '../config/assets';
import {
  BEAM_TUNING,
  COMBAT_TUNING,
  DEPTH,
  FEEDBACK_TUNING,
  ROOM_RECT,
  PLAYER_BASE_ATTACK_PROFILE,
  type PlayerAttackProfile,
  type PlayerStats,
} from '../config/gameConfig';
import { Bullet } from './Bullet';
import { clamp, normalizeVector } from '../utils/math';
import {
  getEffectiveBeamChargeMs,
  getEffectiveDamage,
  getEffectiveFireRate,
  getEffectiveProjectileSpeed,
} from '../systems/PlayerStatSystem';

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
  private attackProfile: PlayerAttackProfile;
  private readonly extraEyes: Phaser.GameObjects.Image;
  private readonly toothpick: Phaser.GameObjects.Image;

  private nextShotAt = 0;
  private invulnerableUntil = 0;
  private beamCooldownUntil = 0;
  private beamChargeStartedAt: number | null = null;
  private beamChargeDirection: { x: number; y: number } | null = null;
  private nextBeamChargePulseAt = 0;
  private lastFacingX = 1;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    stats: PlayerStats,
    attackProfile: PlayerAttackProfile = PLAYER_BASE_ATTACK_PROFILE,
  ) {
    super(scene, x, y, TextureKeys.playerIdle);
    this.stats = stats;
    this.attackProfile = { ...attackProfile };
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setDepth(DEPTH.actor);

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    body.setCircle(15);
    body.setCollideWorldBounds(false);
    body.setMaxVelocity(420, 420);

    this.extraEyes = scene.add
      .image(x, y - 11, TextureKeys.playerExtraEyes)
      .setDepth(DEPTH.actor + 1);
    this.toothpick = scene.add
      .image(x + 8, y - 25, TextureKeys.playerToothpick)
      .setDepth(DEPTH.actor + 1);
    this.syncCosmetics();
  }

  setStats(stats: PlayerStats): void {
    this.stats = stats;
  }

  setAttackProfile(profile: PlayerAttackProfile): void {
    this.attackProfile = { ...profile };
    this.syncCosmetics();
  }

  setCombatVisible(visible: boolean): void {
    this.setVisible(visible);
    this.syncCosmetics();
  }

  update(time: number, controls: PlayerControls, bulletGroup: Phaser.Physics.Arcade.Group): void {
    if (!this.active) {
      return;
    }

    this.updateMovement(controls);
    this.updateAttack(time, controls, bulletGroup);
    this.constrainToRoom();
    this.syncCosmetics();
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
    this.updateMovementVisual(inputX, inputY);
  }

  private updateMovementVisual(inputX: number, inputY: number): void {
    const moving = inputX !== 0 || inputY !== 0;

    if (inputX !== 0) {
      this.lastFacingX = inputX;
    }

    this.setFlipX(this.lastFacingX < 0);

    if (moving) {
      this.play(AnimationKeys.playerWalk, true);
      return;
    }

    this.anims.stop();

    if (this.texture.key !== TextureKeys.playerIdle) {
      this.setTexture(TextureKeys.playerIdle);
    }
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

    const fireRate = getEffectiveFireRate(this.stats);
    const projectileSpeed = getEffectiveProjectileSpeed(this.stats);
    const damage = getEffectiveDamage(this.stats);
    const seedCount = this.attackProfile.seedCount;
    const centerIndex = (seedCount - 1) / 2;
    this.nextShotAt = time + 1000 / fireRate;

    for (let index = 0; index < seedCount; index += 1) {
      const angleOffset = Phaser.Math.DegToRad(
        (index - centerIndex) * this.attackProfile.spreadStepDegrees,
      );
      const angle = Math.atan2(direction.y, direction.x) + angleOffset;
      const seedDirection = { x: Math.cos(angle), y: Math.sin(angle) };
      const lateralOffset = (index - centerIndex) * 4;
      const seedX = this.x + seedDirection.x * 22 - direction.y * lateralOffset;
      const seedY = this.y + seedDirection.y * 22 + direction.x * lateralOffset;

      Bullet.spawn(this.scene, bulletGroup, {
        x: seedX,
        y: seedY,
        direction: seedDirection,
        owner: 'player',
        speed: projectileSpeed,
        damage,
        lifeMs: (this.stats.range / projectileSpeed) * 1000,
        overflowPenetration: this.attackProfile.overflowPenetration,
        scale: this.attackProfile.seedScale,
        tint: this.attackProfile.forceRedSeeds ? 0xff4d4d : undefined,
      });
    }

    const muzzleX = this.x + direction.x * 22;
    const muzzleY = this.y + direction.y * 22;
    this.emit('player-shot', { x: muzzleX, y: muzzleY, direction });
  }

  private updateBeamCharge(time: number, controls: PlayerControls): void {
    const direction = this.getFireDirection(controls);

    if (direction) {
      if (this.beamChargeStartedAt === null) {
        this.beamChargeStartedAt = time;
        this.beamChargeDirection = direction;
        this.nextBeamChargePulseAt = 0;
        this.emit('beam-charge-started');
      } else {
        this.beamChargeDirection = direction;
      }

      const requiredChargeMs = getEffectiveBeamChargeMs(this.stats);
      const chargeProgress = Math.min(1, (time - this.beamChargeStartedAt) / requiredChargeMs);
      this.setTint(chargeProgress >= 1 ? 0xff7af2 : 0x8beeff);

      if (time >= this.nextBeamChargePulseAt) {
        this.nextBeamChargePulseAt = time + FEEDBACK_TUNING.effects.beamChargePulseMs;
        this.emit('beam-charge-pulse', { ready: chargeProgress >= 1 });
      }

      return;
    }

    if (this.beamChargeStartedAt === null || !this.beamChargeDirection) {
      this.clearTint();
      return;
    }

    const chargeMs = time - this.beamChargeStartedAt;
    const canFire =
      chargeMs >= getEffectiveBeamChargeMs(this.stats) && time >= this.beamCooldownUntil;

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

  private syncCosmetics(): void {
    const visible = this.visible && this.active;
    this.extraEyes
      .setPosition(this.x, this.y - 11)
      .setFlipX(this.flipX)
      .setAlpha(this.alpha)
      .setVisible(visible && this.attackProfile.extraForeheadEyeCount > 0);
    this.toothpick
      .setPosition(this.x + (this.flipX ? -8 : 8), this.y - 25)
      .setFlipX(this.flipX)
      .setAlpha(this.alpha)
      .setVisible(visible && this.attackProfile.hasToothpickCosmetic);
  }

  override destroy(fromScene?: boolean): void {
    this.extraEyes.destroy();
    this.toothpick.destroy();
    super.destroy(fromScene);
  }

  playHitFeedback(): void {
    if (!this.active) {
      return;
    }

    this.scene.tweens.killTweensOf(this);
    this.scene.tweens.add({
      targets: this,
      alpha: 0.36,
      duration: 70,
      yoyo: true,
      repeat: 5,
      onComplete: () => {
        this.alpha = 1;
      },
    });
  }
}
