import Phaser from 'phaser';
import { ROOM_RECT } from '../../config/gameConfig';
import {
  computeEffectiveGoalAngle,
  computeFlankAngleError,
  computeFlankGoalAngle,
  computeFlankTarget,
  computeSlideDirection,
  hasStalledTowardTarget,
  oppositeFlankSide,
  pickFlankSide,
  shouldCommitLunge,
  type FlankPoint,
  type FlankSide,
} from '../../systems/FlankerRules';
import type { Player } from '../Player';
import { BaseEnemy } from './BaseEnemy';

// 측면 포위형 적. 직선으로 다가오지 않고 플레이어 주위 링 위를 옆으로 파고들어
// 자리를 잡은 뒤에야 돌진한다. 뒤로 물러나는 것만으로는 안전하지 않게 만드는 것이
// 목적이라, 돌진 조건에 "측면 목표 도달"과 "각도 오차"가 함께 들어간다.
// 좌표 계산은 장면 없이 테스트할 수 있도록 FlankerRules로 분리했다.

// state는 Phaser GameObject.state와 충돌하므로 쓰지 않는다(WormKingBoss와 동일).
type FlankerAttackState = 'circling' | 'windup' | 'lunging' | 'recovering';

const DEFAULTS = {
  flankRingRadius: 86,
  flankArcDegrees: 68,
  flankArrivalTolerance: 16,
  flankRetargetMs: 1400,
  lungeRange: 110,
  lungeAngleToleranceDegrees: 18,
  lungeWindupMs: 300,
  lungeSpeed: 190,
  lungeDurationMs: 280,
  lungeRecoveryMs: 560,
  lungeCooldownMs: 900,
} as const;

const TELEGRAPH_COLOR = 0x5fe0a8;
const TELEGRAPH_LENGTH = 96;

// 상자에 막혀 제자리를 미는 것을 알아채는 창. 선회 속도 80이면 400ms에 32px를
// 나아가므로, 6px 미만은 실제로 막힌 상태로 본다.
const STALL_WINDOW_MS = 400;
const STALL_MIN_PROGRESS = 6;
// 상자 모서리를 벗어날 만큼만 옆으로 흐른다. 길면 선회 자체가 무너진다.
const SLIDE_MS = 220;

export class FlankerEnemy extends BaseEnemy {
  private attackState: FlankerAttackState = 'circling';
  private stateEndsAt = 0;
  private flankRetargetAt = 0;
  private nextLungeAt = 0;
  private flankGoalAngle = 0;
  private flankSide: FlankSide = 1;
  private pendingLungeDirection = { x: 0, y: 0 };
  private telegraph?: Phaser.GameObjects.Graphics;
  private hasEnteredCircling = false;
  private stallCheckpointAt = 0;
  private stallCheckpointDistance = Number.POSITIVE_INFINITY;
  private slideUntil = 0;
  private slideDirection?: FlankPoint;

  updateAI(time: number, player: Player): void {
    if (!this.hasEnteredCircling) {
      this.beginCircling(time, player);
    }

    switch (this.attackState) {
      case 'circling':
        this.updateCircling(time, player);
        return;
      case 'windup':
        this.updateWindup(time);
        return;
      case 'lunging':
        this.updateLunging(time);
        return;
      case 'recovering':
        this.updateRecovering(time, player);
    }
  }

  override destroy(fromScene?: boolean): void {
    this.clearTelegraph(fromScene);
    super.destroy(fromScene);
  }

  /** Picks a fresh side and locks the goal angle it will hold while circling. */
  private beginCircling(time: number, player: Player): void {
    const margin = this.effectiveBodyRadius + 2;
    const arcRadians = Phaser.Math.DegToRad(this.tuning('flankArcDegrees'));

    this.flankSide = pickFlankSide(
      this,
      player,
      this.tuning('flankRingRadius'),
      arcRadians,
      ROOM_RECT,
      margin,
      Math.random,
    );
    this.flankGoalAngle = computeFlankGoalAngle(this, player, this.flankSide, arcRadians);
    this.flankRetargetAt = time + this.tuning('flankRetargetMs');
    this.attackState = 'circling';
    this.hasEnteredCircling = true;
    this.resetStallTracking(time, player);
  }

  /**
   * Gives up on the current approach and swings the other way.
   *
   * Re-running pickFlankSide here could hand back the same side, and the crate
   * that blocked it is still there, so the forced flip is what actually breaks
   * the deadlock.
   */
  private retargetOppositeSide(time: number, player: Player): void {
    const arcRadians = Phaser.Math.DegToRad(this.tuning('flankArcDegrees'));

    this.flankSide = oppositeFlankSide(this.flankSide);
    this.flankGoalAngle = computeFlankGoalAngle(this, player, this.flankSide, arcRadians);
    this.flankRetargetAt = time + this.tuning('flankRetargetMs');
    this.resetStallTracking(time, player);
  }

  private updateCircling(time: number, player: Player): void {
    // Held too long without arriving — usually the player kept moving away, so
    // commit to a new approach rather than trailing the old one forever.
    if (time >= this.flankRetargetAt) {
      this.beginCircling(time, player);
      return;
    }

    if (this.slideDirection) {
      if (time < this.slideUntil) {
        const speed = this.definition.speed * this.floorScale;
        (this.body as Phaser.Physics.Arcade.Body).setVelocity(
          this.slideDirection.x * speed,
          this.slideDirection.y * speed,
        );
        this.constrainToRoom();
        return;
      }

      // Detour finished. The slide deliberately travels away from the fresh
      // goal, so counting it as time spent failing to reach that goal would
      // trip the stall check again and flip the side straight back. Progress is
      // measured from here instead.
      this.slideDirection = undefined;
      this.slideUntil = 0;
      this.resetStallTracking(time, player);
    }

    const target = this.currentFlankTarget(player);
    const distanceToTarget = Phaser.Math.Distance.Between(this.x, this.y, target.x, target.y);

    if (
      hasStalledTowardTarget({
        distanceToTarget,
        checkpointDistance: this.stallCheckpointDistance,
        time,
        checkpointAt: this.stallCheckpointAt,
        windowMs: STALL_WINDOW_MS,
        minProgress: STALL_MIN_PROGRESS,
      })
    ) {
      // Direction comes from the old goal on purpose: body.blocked describes the
      // collision that happened while driving at it, so that is the axis the
      // corner has to be cleared along.
      this.beginSlide(time, target);
      this.retargetOppositeSide(time, player);
      return;
    }

    if (time - this.stallCheckpointAt >= STALL_WINDOW_MS) {
      this.stallCheckpointAt = time;
      this.stallCheckpointDistance = distanceToTarget;
    }

    this.moveToward(target.x, target.y, this.definition.speed * this.floorScale);

    // Against a wall the target no longer sits on the held angle, so the lunge
    // check follows the point the enemy is actually driving at.
    const effectiveGoalAngle = computeEffectiveGoalAngle(player, target);
    const readyToLunge = shouldCommitLunge({
      distanceToTarget,
      angleError: computeFlankAngleError(this, player, effectiveGoalAngle),
      distanceToPlayer: Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y),
      arrivalTolerance: this.tuning('flankArrivalTolerance'),
      angleTolerance: Phaser.Math.DegToRad(this.tuning('lungeAngleToleranceDegrees')),
      lungeRange: this.tuning('lungeRange'),
      time,
      nextLungeAt: this.nextLungeAt,
    });

    if (readyToLunge) {
      this.beginWindup(time, player);
    }
  }

  private currentFlankTarget(player: Player): FlankPoint {
    return computeFlankTarget(
      player,
      this.flankGoalAngle,
      this.tuning('flankRingRadius'),
      ROOM_RECT,
      this.effectiveBodyRadius + 2,
    );
  }

  /** Slips around the corner of whatever is in the way, if a way past exists. */
  private beginSlide(time: number, target: FlankPoint): void {
    const body = this.body as Phaser.Physics.Arcade.Body;
    const slide = computeSlideDirection(body.blocked, {
      x: target.x - this.x,
      y: target.y - this.y,
    });

    if (!slide) {
      this.slideDirection = undefined;
      this.slideUntil = 0;
      return;
    }

    this.slideDirection = slide;
    this.slideUntil = time + SLIDE_MS;
  }

  private resetStallTracking(time: number, player: Player): void {
    this.stallCheckpointAt = time;
    const target = this.currentFlankTarget(player);
    this.stallCheckpointDistance = Phaser.Math.Distance.Between(this.x, this.y, target.x, target.y);
  }

  /** Direction is locked here so the telegraph line matches the real lunge. */
  private beginWindup(time: number, player: Player): void {
    const angle = Phaser.Math.Angle.Between(this.x, this.y, player.x, player.y);

    this.pendingLungeDirection = { x: Math.cos(angle), y: Math.sin(angle) };
    this.attackState = 'windup';
    this.stateEndsAt = time + this.tuning('lungeWindupMs');
    // Slide steering belongs to circling only; leaving it set would bleed into
    // the next approach.
    this.slideDirection = undefined;
    this.slideUntil = 0;
    (this.body as Phaser.Physics.Arcade.Body).stop();
    this.showTelegraph();
  }

  private updateWindup(time: number): void {
    (this.body as Phaser.Physics.Arcade.Body).stop();

    if (time < this.stateEndsAt) {
      return;
    }

    this.clearTelegraph();
    const lungeSpeed = this.tuning('lungeSpeed') * this.floorScale;
    (this.body as Phaser.Physics.Arcade.Body).setVelocity(
      this.pendingLungeDirection.x * lungeSpeed,
      this.pendingLungeDirection.y * lungeSpeed,
    );
    this.attackState = 'lunging';
    this.stateEndsAt = time + this.tuning('lungeDurationMs');
  }

  private updateLunging(time: number): void {
    this.constrainToRoom();

    if (time < this.stateEndsAt) {
      return;
    }

    (this.body as Phaser.Physics.Arcade.Body).stop();
    this.attackState = 'recovering';
    this.stateEndsAt = time + this.tuning('lungeRecoveryMs');
    // Counted from the end of the lunge, and longer than the recovery, so at
    // least a moment of circling is forced between lunges.
    this.nextLungeAt = time + this.tuning('lungeCooldownMs');
  }

  private updateRecovering(time: number, player: Player): void {
    (this.body as Phaser.Physics.Arcade.Body).stop();

    if (time >= this.stateEndsAt) {
      this.beginCircling(time, player);
    }
  }

  private tuning(key: keyof typeof DEFAULTS): number {
    return this.definition[key] ?? DEFAULTS[key];
  }

  private showTelegraph(): void {
    this.clearTelegraph();
    this.telegraph = this.scene.add.graphics().setDepth(this.depth - 1);
    const endX = this.x + this.pendingLungeDirection.x * TELEGRAPH_LENGTH;
    const endY = this.y + this.pendingLungeDirection.y * TELEGRAPH_LENGTH;

    this.telegraph.lineStyle(3, TELEGRAPH_COLOR, 0.72);
    this.telegraph.lineBetween(this.x, this.y, endX, endY);
    this.telegraph.lineStyle(5, TELEGRAPH_COLOR, 0.12);
    this.telegraph.lineBetween(this.x, this.y, endX, endY);
  }

  private clearTelegraph(fromScene?: boolean): void {
    this.telegraph?.destroy(fromScene);
    this.telegraph = undefined;
  }
}
