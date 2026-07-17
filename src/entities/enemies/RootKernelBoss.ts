import Phaser from 'phaser';
import {
  DEPTH,
  GAME_CENTER_X,
  GAME_CENTER_Y,
  ROOT_KERNEL_TUNING,
  ROOM_RECT,
} from '../../config/gameConfig';
import type { Player } from '../Player';
import { normalizeVector } from '../../utils/math';
import { BaseEnemy } from './BaseEnemy';

type AttackState =
  'idle' | 'crossTelegraph' | 'curtainTelegraph' | 'ringTelegraph' | 'phaseTransition';
type CurtainDirection = 'north' | 'south' | 'west' | 'east';

interface CurtainSpawn {
  x: number;
  y: number;
  direction: { x: number; y: number };
}

export class RootKernelBoss extends BaseEnemy {
  private attackState: AttackState = 'idle';
  private attackEndsAt = 0;
  private recoveryUntil = 0;
  private nextCrossAt = 0;
  private nextCurtainAt = 0;
  private initializedSchedule = false;
  private isPhaseTwo = false;
  private crossIsDiagonal = false;
  private phaseTwoCrossCount = 0;
  private ringPending = false;
  private ringSafeStartIndex = 0;
  private curtainDirection: CurtainDirection = 'north';
  private lastCurtainDirection?: CurtainDirection;
  private repeatedCurtainDirectionCount = 0;
  private curtainSafeIndex = 0;
  private curtainSpawns: CurtainSpawn[] = [];
  private warningGraphics?: Phaser.GameObjects.Graphics;
  private cleanedUp = false;

  override takeDamage(amount: number, sourceX: number, sourceY: number): boolean {
    const defeated = super.takeDamage(amount, sourceX, sourceY);

    if (!defeated) {
      this.tryEnterPhaseTwo(this.scene.time.now);
    }

    return defeated;
  }

  updateAI(time: number, player: Player, enemyBullets: Phaser.Physics.Arcade.Group): void {
    const body = this.body as Phaser.Physics.Arcade.Body | undefined;

    if (!this.active || !body || this.cleanedUp) {
      return;
    }

    if (!this.initializedSchedule) {
      this.initializedSchedule = true;
      this.nextCrossAt = time + 900;
      this.nextCurtainAt = time + 1800;
    }

    if (this.attackState === 'phaseTransition') {
      body.stop();

      if (time >= this.attackEndsAt) {
        this.attackState = 'idle';
        this.recoveryUntil = time + ROOT_KERNEL_TUNING.attackRecoveryMs;
        this.nextCrossAt = time + ROOT_KERNEL_TUNING.attackRecoveryMs;
        this.nextCurtainAt = time + ROOT_KERNEL_TUNING.phaseTwoCurtainCooldownMs * 0.5;
      }

      return;
    }

    if (this.attackState !== 'idle') {
      body.stop();
      this.updateAttackTelegraph(time, enemyBullets);
      return;
    }

    this.updateMovement(player);

    if (time < this.recoveryUntil) {
      return;
    }

    if (this.ringPending) {
      this.startRingTelegraph(time, player);
      return;
    }

    const crossReady = time >= this.nextCrossAt;
    const curtainReady = time >= this.nextCurtainAt;

    if (curtainReady && (!crossReady || this.nextCurtainAt <= this.nextCrossAt)) {
      this.startCurtainTelegraph(time);
    } else if (crossReady) {
      this.startCrossTelegraph(time);
    }
  }

  override getDisplayName(): string {
    const displayName = super.getDisplayName();
    return this.isPhaseTwo ? `${displayName} II` : displayName;
  }

  isInPhaseTwo(): boolean {
    return this.isPhaseTwo;
  }

  override destroy(fromScene?: boolean): void {
    if (!this.cleanedUp) {
      this.cleanedUp = true;
      this.clearAttackVisuals();
      this.curtainSpawns = [];
    }

    super.destroy(fromScene);
  }

  private updateMovement(player: Player): void {
    const body = this.body as Phaser.Physics.Arcade.Body;
    const toPlayer = normalizeVector(player.x - this.x, player.y - this.y);
    const distance = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y);
    const toCenter = normalizeVector(GAME_CENTER_X - this.x, GAME_CENTER_Y - this.y);
    let velocityX: number;
    let velocityY: number;

    if (distance < ROOT_KERNEL_TUNING.preferredMinDistance) {
      velocityX = -toPlayer.x;
      velocityY = -toPlayer.y;
    } else if (distance > ROOT_KERNEL_TUNING.preferredMaxDistance) {
      velocityX = toPlayer.x * 0.65 + toCenter.x * 0.35;
      velocityY = toPlayer.y * 0.65 + toCenter.y * 0.35;
    } else {
      velocityX = -toPlayer.y * 0.78 + toCenter.x * 0.22;
      velocityY = toPlayer.x * 0.78 + toCenter.y * 0.22;
    }

    const direction = normalizeVector(velocityX, velocityY);
    body.setVelocity(
      direction.x * ROOT_KERNEL_TUNING.speed,
      direction.y * ROOT_KERNEL_TUNING.speed,
    );
    this.constrainToRoom();
  }

  private updateAttackTelegraph(time: number, enemyBullets: Phaser.Physics.Arcade.Group): void {
    const remaining = Math.max(0, this.attackEndsAt - time);
    const flashing = Math.floor(remaining / 100) % 2 === 0;
    this.warningGraphics?.setAlpha(flashing ? 1 : 0.48);

    if (time < this.attackEndsAt) {
      return;
    }

    if (this.attackState === 'crossTelegraph') {
      this.fireChecksumCross(enemyBullets);
      this.finishCrossAttack(time);
    } else if (this.attackState === 'curtainTelegraph') {
      this.firePacketCurtain(enemyBullets);
      this.finishCurtainAttack(time);
    } else if (this.attackState === 'ringTelegraph') {
      this.fireBrokenRing(enemyBullets);
      this.finishRingAttack(time);
    }
  }

  private startCrossTelegraph(time: number): void {
    this.attackState = 'crossTelegraph';
    this.attackEndsAt = time + ROOT_KERNEL_TUNING.crossTelegraphMs;
    this.crossIsDiagonal = this.isPhaseTwo && this.phaseTwoCrossCount % 2 === 1;
    this.warningGraphics = this.createWarningGraphics();
    this.drawCrossWarning(this.warningGraphics, this.crossIsDiagonal);
  }

  private drawCrossWarning(graphics: Phaser.GameObjects.Graphics, diagonal: boolean): void {
    const angles = diagonal ? [Math.PI / 4, (Math.PI * 3) / 4] : [0, Math.PI / 2];
    graphics.lineStyle(6, 0x8cff9b, 0.14);

    for (const angle of angles) {
      const dx = Math.cos(angle) * 300;
      const dy = Math.sin(angle) * 300;
      graphics.lineBetween(this.x - dx, this.y - dy, this.x + dx, this.y + dy);
    }

    graphics.lineStyle(3, 0xbaffc3, 0.84);

    for (const angle of angles) {
      const dx = Math.cos(angle) * 300;
      const dy = Math.sin(angle) * 300;
      graphics.lineBetween(this.x - dx, this.y - dy, this.x + dx, this.y + dy);
    }
  }

  private fireChecksumCross(enemyBullets: Phaser.Physics.Arcade.Group): void {
    const angleOffset = this.crossIsDiagonal ? Math.PI / 4 : 0;

    for (let directionIndex = 0; directionIndex < 4; directionIndex += 1) {
      const angle = angleOffset + (Math.PI * directionIndex) / 2;
      const direction = { x: Math.cos(angle), y: Math.sin(angle) };
      const perpendicular = { x: -direction.y, y: direction.x };

      for (let lane = -1; lane <= 1; lane += 1) {
        const laneOffset = lane * ROOT_KERNEL_TUNING.crossLaneSpacing;
        this.fireBullet(
          this.x + direction.x * 30 + perpendicular.x * laneOffset,
          this.y + direction.y * 30 + perpendicular.y * laneOffset,
          direction,
          enemyBullets,
          ROOT_KERNEL_TUNING.crossBulletSpeed,
          ROOT_KERNEL_TUNING.bulletDamage,
        );
      }
    }
  }

  private finishCrossAttack(time: number): void {
    this.clearAttackVisuals();
    this.attackState = 'idle';
    this.recoveryUntil = time + ROOT_KERNEL_TUNING.attackRecoveryMs;
    this.nextCrossAt =
      time +
      (this.isPhaseTwo
        ? ROOT_KERNEL_TUNING.phaseTwoCrossCooldownMs
        : ROOT_KERNEL_TUNING.crossCooldownMs);

    if (this.isPhaseTwo) {
      this.phaseTwoCrossCount += 1;
      this.ringPending = this.phaseTwoCrossCount % 2 === 0;
    }
  }

  private startCurtainTelegraph(time: number): void {
    this.attackState = 'curtainTelegraph';
    this.attackEndsAt = time + ROOT_KERNEL_TUNING.curtainTelegraphMs;
    this.curtainDirection = this.pickCurtainDirection();
    this.curtainSafeIndex = Phaser.Math.Between(1, ROOT_KERNEL_TUNING.curtainLaneCount - 2);
    this.curtainSpawns = this.buildCurtainSpawns(this.curtainDirection);
    this.warningGraphics = this.createWarningGraphics();
    this.drawCurtainWarning(this.warningGraphics);
  }

  private pickCurtainDirection(): CurtainDirection {
    const directions: CurtainDirection[] = ['north', 'south', 'west', 'east'];
    let candidates = directions;

    if (this.lastCurtainDirection && this.repeatedCurtainDirectionCount >= 2) {
      candidates = directions.filter((direction) => direction !== this.lastCurtainDirection);
    }

    const selected = Phaser.Utils.Array.GetRandom(candidates);

    if (selected === this.lastCurtainDirection) {
      this.repeatedCurtainDirectionCount += 1;
    } else {
      this.lastCurtainDirection = selected;
      this.repeatedCurtainDirectionCount = 1;
    }

    return selected;
  }

  private buildCurtainSpawns(direction: CurtainDirection): CurtainSpawn[] {
    const spawns: CurtainSpawn[] = [];
    const horizontal = direction === 'north' || direction === 'south';
    const start = horizontal ? ROOM_RECT.left + 48 : ROOM_RECT.top + 36;
    const end = horizontal ? ROOM_RECT.right - 48 : ROOM_RECT.bottom - 36;

    for (let index = 0; index < ROOT_KERNEL_TUNING.curtainLaneCount; index += 1) {
      const position = Phaser.Math.Linear(
        start,
        end,
        index / (ROOT_KERNEL_TUNING.curtainLaneCount - 1),
      );

      if (direction === 'north') {
        spawns.push({ x: position, y: ROOM_RECT.top + 12, direction: { x: 0, y: 1 } });
      } else if (direction === 'south') {
        spawns.push({ x: position, y: ROOM_RECT.bottom - 12, direction: { x: 0, y: -1 } });
      } else if (direction === 'west') {
        spawns.push({ x: ROOM_RECT.left + 12, y: position, direction: { x: 1, y: 0 } });
      } else {
        spawns.push({ x: ROOM_RECT.right - 12, y: position, direction: { x: -1, y: 0 } });
      }
    }

    return spawns;
  }

  private drawCurtainWarning(graphics: Phaser.GameObjects.Graphics): void {
    this.curtainSpawns.forEach((spawn, index) => {
      const safe = index === this.curtainSafeIndex;
      graphics.fillStyle(safe ? 0x6fffa0 : 0xffb347, safe ? 0.3 : 0.76);
      graphics.fillRect(spawn.x - 4, spawn.y - 4, 8, 8);
      graphics.lineStyle(1, safe ? 0xbaffc3 : 0xffe09c, 0.9);
      graphics.strokeRect(spawn.x - 5, spawn.y - 5, 10, 10);
    });
  }

  private firePacketCurtain(enemyBullets: Phaser.Physics.Arcade.Group): void {
    this.curtainSpawns.forEach((spawn, index) => {
      if (index === this.curtainSafeIndex) {
        return;
      }

      this.fireBullet(
        spawn.x,
        spawn.y,
        spawn.direction,
        enemyBullets,
        ROOT_KERNEL_TUNING.curtainBulletSpeed,
        ROOT_KERNEL_TUNING.bulletDamage,
      );
    });
  }

  private finishCurtainAttack(time: number): void {
    this.clearAttackVisuals();
    this.curtainSpawns = [];
    this.attackState = 'idle';
    this.recoveryUntil = time + ROOT_KERNEL_TUNING.attackRecoveryMs;
    this.nextCurtainAt =
      time +
      (this.isPhaseTwo
        ? ROOT_KERNEL_TUNING.phaseTwoCurtainCooldownMs
        : ROOT_KERNEL_TUNING.curtainCooldownMs);
  }

  private startRingTelegraph(time: number, player: Player): void {
    this.ringPending = false;
    this.attackState = 'ringTelegraph';
    this.attackEndsAt = time + ROOT_KERNEL_TUNING.ringTelegraphMs;
    const playerAngle = Phaser.Math.Angle.Between(this.x, this.y, player.x, player.y);
    const normalizedAngle = Phaser.Math.Angle.Normalize(playerAngle);
    this.ringSafeStartIndex =
      Math.round((normalizedAngle / (Math.PI * 2)) * ROOT_KERNEL_TUNING.ringBulletCount - 0.5) %
      ROOT_KERNEL_TUNING.ringBulletCount;
    this.warningGraphics = this.createWarningGraphics();
    this.drawRingWarning(this.warningGraphics);
  }

  private drawRingWarning(graphics: Phaser.GameObjects.Graphics): void {
    graphics.lineStyle(3, 0xff866f, 0.62);
    graphics.strokeCircle(this.x, this.y, 36);

    for (let offset = 0; offset < 2; offset += 1) {
      const index = (this.ringSafeStartIndex + offset) % ROOT_KERNEL_TUNING.ringBulletCount;
      const angle = (Math.PI * 2 * index) / ROOT_KERNEL_TUNING.ringBulletCount;
      graphics.lineStyle(4, 0x78ffa1, 0.84);
      graphics.lineBetween(
        this.x + Math.cos(angle) * 30,
        this.y + Math.sin(angle) * 30,
        this.x + Math.cos(angle) * 75,
        this.y + Math.sin(angle) * 75,
      );
    }
  }

  private fireBrokenRing(enemyBullets: Phaser.Physics.Arcade.Group): void {
    for (let index = 0; index < ROOT_KERNEL_TUNING.ringBulletCount; index += 1) {
      const safeOffset =
        (index - this.ringSafeStartIndex + ROOT_KERNEL_TUNING.ringBulletCount) %
        ROOT_KERNEL_TUNING.ringBulletCount;

      if (safeOffset < 2) {
        continue;
      }

      const angle = (Math.PI * 2 * index) / ROOT_KERNEL_TUNING.ringBulletCount;
      const direction = { x: Math.cos(angle), y: Math.sin(angle) };
      this.fireBullet(
        this.x + direction.x * 30,
        this.y + direction.y * 30,
        direction,
        enemyBullets,
        ROOT_KERNEL_TUNING.ringBulletSpeed,
        ROOT_KERNEL_TUNING.bulletDamage,
      );
    }
  }

  private finishRingAttack(time: number): void {
    this.clearAttackVisuals();
    this.attackState = 'idle';
    this.recoveryUntil = time + ROOT_KERNEL_TUNING.attackRecoveryMs;
  }

  private tryEnterPhaseTwo(time: number): void {
    if (
      this.isPhaseTwo ||
      !this.active ||
      !this.body ||
      this.getHealthRatio() > ROOT_KERNEL_TUNING.phaseTwoThreshold
    ) {
      return;
    }

    this.isPhaseTwo = true;
    this.attackState = 'phaseTransition';
    this.attackEndsAt = time + ROOT_KERNEL_TUNING.phaseTwoTransitionLockMs;
    this.ringPending = false;
    this.curtainSpawns = [];
    this.clearAttackVisuals();
    this.setPersistentTint(ROOT_KERNEL_TUNING.phaseTwoTint);
    (this.body as Phaser.Physics.Arcade.Body).stop();
    this.emit('boss-phase-two', this);
  }

  private createWarningGraphics(): Phaser.GameObjects.Graphics {
    this.clearAttackVisuals();
    return this.scene.add.graphics().setDepth(DEPTH.effect - 1);
  }

  private clearAttackVisuals(): void {
    this.warningGraphics?.destroy();
    this.warningGraphics = undefined;
  }
}
