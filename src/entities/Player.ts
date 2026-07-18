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
import { resolvePlayerFacing, type PlayerFacing } from '../utils/playerFacing';
import { createSpreadDirections, type AttackDirection } from '../utils/attackDirections';
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

export interface BeamFiredEvent {
  directions: AttackDirection[];
}

type PlayerAnimationState = 'idle' | 'walk' | 'hurt' | 'death';

const PLAYER_ANIMATIONS: Record<
  PlayerAnimationState,
  Record<PlayerFacing, (typeof AnimationKeys)[keyof typeof AnimationKeys]>
> = {
  idle: {
    down: AnimationKeys.playerIdleDown,
    up: AnimationKeys.playerIdleUp,
    side: AnimationKeys.playerIdleSide,
  },
  walk: {
    down: AnimationKeys.playerWalkDown,
    up: AnimationKeys.playerWalkUp,
    side: AnimationKeys.playerWalkSide,
  },
  hurt: {
    down: AnimationKeys.playerHurtDown,
    up: AnimationKeys.playerHurtUp,
    side: AnimationKeys.playerHurtSide,
  },
  death: {
    down: AnimationKeys.playerDeathDown,
    up: AnimationKeys.playerDeathUp,
    side: AnimationKeys.playerDeathSide,
  },
};

const PLAYER_SHADOW_DEATH_ANIMATIONS: Record<
  PlayerFacing,
  (typeof AnimationKeys)[keyof typeof AnimationKeys]
> = {
  down: AnimationKeys.playerShadowDeathDown,
  up: AnimationKeys.playerShadowDeathUp,
  side: AnimationKeys.playerShadowDeathSide,
};

const EXTERNAL_PLAYER_SCALE = 2;

export class Player extends Phaser.Physics.Arcade.Sprite {
  stats: PlayerStats;
  hasChargeBeam = false;
  private attackProfile: PlayerAttackProfile;
  private readonly usesExternalAssets: boolean;
  private readonly shadow: Phaser.GameObjects.Sprite;
  private readonly extraEyes: Phaser.GameObjects.Image;
  private readonly toothpick: Phaser.GameObjects.Image;

  private nextShotAt = 0;
  private invulnerableUntil = 0;
  private beamCooldownUntil = 0;
  private beamChargeStartedAt: number | null = null;
  private beamChargeDirection: { x: number; y: number } | null = null;
  private nextBeamChargePulseAt = 0;
  private hurtAnimationUntil = 0;
  private facing: PlayerFacing = 'down';
  private dead = false;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    stats: PlayerStats,
    attackProfile: PlayerAttackProfile = PLAYER_BASE_ATTACK_PROFILE,
  ) {
    super(
      scene,
      x,
      y,
      scene.textures.exists(TextureKeys.playerYellowIdle)
        ? TextureKeys.playerYellowIdle
        : TextureKeys.playerIdle,
    );
    this.stats = stats;
    this.attackProfile = { ...attackProfile };
    this.usesExternalAssets = scene.textures.exists(TextureKeys.playerYellowIdle);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setDepth(DEPTH.actor).setScale(this.usesExternalAssets ? EXTERNAL_PLAYER_SCALE : 0.6);

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    if (this.usesExternalAssets) {
      // The 2x visual scale makes the character readable while this smaller
      // source-pixel body keeps the gameplay collision radius unchanged.
      body.setCircle(4, 12, 17);
    } else {
      body.setCircle(10);
    }
    body.setCollideWorldBounds(false);
    body.setMaxVelocity(220, 220);

    this.shadow = scene.add
      .sprite(x, y, TextureKeys.playerYellowShadow)
      .setScale(this.usesExternalAssets ? EXTERNAL_PLAYER_SCALE : 1)
      .setDepth(DEPTH.actor - 1)
      .setVisible(this.usesExternalAssets);

    const cosmeticScale = this.usesExternalAssets ? 0.5 : 0.6;

    this.extraEyes = scene.add
      .image(x, y - (this.usesExternalAssets ? 8 : 7), TextureKeys.playerExtraEyes)
      .setScale(cosmeticScale)
      .setDepth(DEPTH.actor + 1);
    this.toothpick = scene.add
      .image(
        x + (this.usesExternalAssets ? 6 : 5),
        y - (this.usesExternalAssets ? 14 : 15),
        TextureKeys.playerToothpick,
      )
      .setScale(cosmeticScale)
      .setDepth(DEPTH.actor + 1);
    this.playDirectionalAnimation('idle');
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
    this.shadow.setVisible(visible && this.usesExternalAssets);
    this.syncCosmetics();
  }

  update(time: number, controls: PlayerControls, bulletGroup: Phaser.Physics.Arcade.Group): void {
    if (!this.active || this.dead) {
      return;
    }

    this.updateMovement(time, controls);
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
    this.hurtAnimationUntil = now + 250;
    this.stats.health = clamp(this.stats.health - amount, 0, this.stats.maxHealth);

    const hitVector = normalizeVector(this.x - sourceX, this.y - sourceY);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(
      hitVector.x * COMBAT_TUNING.playerKnockback,
      hitVector.y * COMBAT_TUNING.playerKnockback,
    );

    this.emit('health-changed', this.stats);
    this.playDirectionalAnimation('hurt');

    if (this.stats.health <= 0) {
      this.emit('player-died');
    }

    return true;
  }

  grantInvulnerability(durationMs: number): void {
    this.invulnerableUntil = Math.max(
      this.invulnerableUntil,
      this.scene.time.now + Math.max(0, durationMs),
    );
  }

  private updateMovement(time: number, controls: PlayerControls): void {
    const inputX = Number(controls.right.isDown) - Number(controls.left.isDown);
    const inputY = Number(controls.down.isDown) - Number(controls.up.isDown);
    const direction = normalizeVector(inputX, inputY);
    const body = this.body as Phaser.Physics.Arcade.Body;

    body.setVelocity(direction.x * this.stats.moveSpeed, direction.y * this.stats.moveSpeed);
    this.updateMovementVisual(time, inputX, inputY);
  }

  private updateMovementVisual(time: number, inputX: number, inputY: number): void {
    const moving = inputX !== 0 || inputY !== 0;
    const facingVisual = resolvePlayerFacing(inputX, inputY);
    this.facing = facingVisual.facing;
    this.setFlipX(facingVisual.flipX);

    if (this.usesExternalAssets) {
      if (time < this.hurtAnimationUntil) {
        this.playDirectionalAnimation('hurt');
      } else {
        this.playDirectionalAnimation(moving ? 'walk' : 'idle');
      }

      return;
    }

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
    const seedDirections = createSpreadDirections(
      direction,
      this.attackProfile.seedCount,
      this.attackProfile.spreadStepDegrees,
    );
    const centerIndex = (seedDirections.length - 1) / 2;
    this.nextShotAt = time + 1000 / fireRate;

    seedDirections.forEach((seedDirection, index) => {
      const lateralOffset = (index - centerIndex) * 2;
      const seedX = this.x + seedDirection.x * 12 - direction.y * lateralOffset;
      const seedY = this.y + seedDirection.y * 12 + direction.x * lateralOffset;

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
    });

    const muzzleX = this.x + direction.x * 12;
    const muzzleY = this.y + direction.y * 12;
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
      const event: BeamFiredEvent = {
        directions: createSpreadDirections(
          this.beamChargeDirection,
          this.attackProfile.seedCount,
          this.attackProfile.spreadStepDegrees,
        ),
      };
      this.emit('beam-fired', event);
    }

    this.beamChargeStartedAt = null;
    this.beamChargeDirection = null;
    this.clearTint();
  }

  private getFireDirection(controls: PlayerControls): AttackDirection | null {
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
    this.x = clamp(this.x, ROOM_RECT.left + 12, ROOM_RECT.right - 12);
    this.y = clamp(this.y, ROOM_RECT.top + 12, ROOM_RECT.bottom - 12);
  }

  private syncCosmetics(): void {
    const visible = this.visible && this.active;
    const eyeYOffset = this.usesExternalAssets ? 8 : 7;
    const toothpickOffsetX = this.usesExternalAssets ? 6 : 5;
    const toothpickOffsetY = this.usesExternalAssets ? 14 : 15;
    this.shadow
      .setPosition(this.x, this.y)
      .setFlipX(this.flipX)
      .setAlpha(this.alpha)
      .setVisible(visible && this.usesExternalAssets);
    this.extraEyes
      .setPosition(this.x, this.y - eyeYOffset)
      .setFlipX(this.flipX)
      .setAlpha(this.alpha)
      .setVisible(!this.dead && visible && this.attackProfile.extraForeheadEyeCount > 0);
    this.toothpick
      .setPosition(
        this.x + (this.flipX ? -toothpickOffsetX : toothpickOffsetX),
        this.y - toothpickOffsetY,
      )
      .setFlipX(this.flipX)
      .setAlpha(this.alpha)
      .setVisible(!this.dead && visible && this.attackProfile.hasToothpickCosmetic);
  }

  private playDirectionalAnimation(state: PlayerAnimationState): void {
    if (!this.usesExternalAssets) {
      return;
    }

    const animationKey = PLAYER_ANIMATIONS[state][this.facing];

    if (this.scene.anims.exists(animationKey)) {
      this.play(animationKey, true);
    }
  }

  playDeathAnimation(): void {
    this.dead = true;
    this.scene.tweens.killTweensOf(this);
    this.setAlpha(1);
    this.playDirectionalAnimation('death');

    if (this.usesExternalAssets) {
      const shadowAnimationKey = PLAYER_SHADOW_DEATH_ANIMATIONS[this.facing];

      if (this.scene.anims.exists(shadowAnimationKey)) {
        this.shadow.play(shadowAnimationKey, true);
      }
    }

    this.extraEyes.setVisible(false);
    this.toothpick.setVisible(false);
  }

  override destroy(fromScene?: boolean): void {
    this.shadow.destroy();
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
