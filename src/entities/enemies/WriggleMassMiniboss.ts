import Phaser from 'phaser';
import { MINIBOSS_TUNING } from '../../config/gameConfig';
import type { EnemyId } from '../../data/enemies';
import type { Player } from '../Player';
import { BaseEnemy } from './BaseEnemy';

/**
 * 1스테이지 I층 중간보스 "꿈틀대는 덩어리".
 *
 * 패턴: 추격 + 예고 후 짧게 파고드는 꿈틀 돌진. 체력 절반에서 각성해 새끼를
 * 뱉고(소환) 돌진 주기가 짧아진다. 원래는 일반 추격자 AI라 살아있는 동안은
 * 아무것도 하지 않고, 죽을 때 4마리로 분열하는 것이 전부였다 — 그 분열은
 * 그대로 남는다(RoomController가 정의의 splitChildId로 처리한다).
 *
 * 소환은 직접 적을 만들지 않고 'summon-request'를 쏘면 RoomController가 소유권과
 * 상한을 적용해 생성한다(지렁이 왕·소환사와 같은 공통 경로).
 */

type WriggleMassState = 'chasing' | 'windup' | 'charging' | 'recovering';

const TUNING = MINIBOSS_TUNING.wriggleMass;

// 방에 들어선 직후 곧바로 돌진하지 않게 두는 첫 여유.
const FIRST_CHARGE_DELAY_MS = 1100;

export class WriggleMassMiniboss extends BaseEnemy {
  private attackState: WriggleMassState = 'chasing';
  private stateEndsAt = 0;
  private nextChargeAt = 0;
  private chargeDirection = { x: 0, y: 0 };

  updateAI(time: number, player: Player): void {
    this.updatePhase(time);

    if (this.nextChargeAt === 0) {
      this.nextChargeAt = time + FIRST_CHARGE_DELAY_MS;
    }

    switch (this.attackState) {
      case 'chasing':
        this.updateChasing(time, player);
        return;
      case 'windup':
        this.updateWindup(time);
        return;
      case 'charging':
        this.updateCharging(time);
        return;
      case 'recovering':
        this.updateRecovering(time);
    }
  }

  /** 각성: 몸을 부풀려 새끼를 뱉고 이후 더 자주 파고든다. */
  private updatePhase(time: number): void {
    if (!this.tryLatchPhaseTwo(MINIBOSS_TUNING.phaseTwoThreshold)) {
      return;
    }

    this.setPersistentTint(TUNING.phaseTwoTint);
    this.emit('summon-request', {
      childId: this.definition.summonChildId as EnemyId,
      count: TUNING.phaseTwoSpitCount,
      maxAlive: TUNING.summonMaxAlive,
    });
    // 각성이 돌진 예고 중에 걸릴 수 있다. 그 예고는 취소되므로 링도 걷어낸다 —
    // 남겨 두면 아무 의미 없는 링이 회복 시간 내내 굳어 있다.
    this.clearTelegraphRing();
    // 뱉은 직후에 돌진까지 겹치면 피할 자리가 없다.
    this.attackState = 'recovering';
    this.stateEndsAt = time + TUNING.recoveryMs;
    this.nextChargeAt = time + this.chargeCooldown();
  }

  private updateChasing(time: number, player: Player): void {
    // 사거리 안일 때만 돌진한다. 방 반대편에서 뛰면 예고만 하고 늘 빗나가
    // "예고 → 헛돌진 → 회복"이 그냥 쉬는 시간이 된다.
    const inChargeRange =
      Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y) <= TUNING.chargeMaxDistance;

    if (time >= this.nextChargeAt && inChargeRange) {
      this.beginWindup(time, player);
      return;
    }

    this.moveToward(player.x, player.y, this.definition.speed * this.floorScale);
  }

  private beginWindup(time: number, player: Player): void {
    const angle = Phaser.Math.Angle.Between(this.x, this.y, player.x, player.y);

    this.chargeDirection = { x: Math.cos(angle), y: Math.sin(angle) };
    this.attackState = 'windup';
    this.stateEndsAt = time + TUNING.chargeWindupMs;
    (this.body as Phaser.Physics.Arcade.Body).stop();
    this.showTelegraphRing(TUNING.telegraphColor);
  }

  private updateWindup(time: number): void {
    (this.body as Phaser.Physics.Arcade.Body).stop();
    this.syncTelegraphRing();

    if (time < this.stateEndsAt) {
      return;
    }

    // 돌진 방향은 예고 시작 때 정한 것을 쓴다 — 예고 중에 방향이 따라오면
    // 피해도 맞으므로 예고가 거짓이 된다.
    this.clearTelegraphRing();
    (this.body as Phaser.Physics.Arcade.Body).setVelocity(
      this.chargeDirection.x * TUNING.chargeSpeed,
      this.chargeDirection.y * TUNING.chargeSpeed,
    );
    this.attackState = 'charging';
    this.stateEndsAt = time + TUNING.chargeDurationMs;
  }

  private updateCharging(time: number): void {
    this.constrainToRoom();

    if (time < this.stateEndsAt) {
      return;
    }

    this.attackState = 'recovering';
    this.stateEndsAt = time + TUNING.recoveryMs;
    this.nextChargeAt = time + this.chargeCooldown();
  }

  private updateRecovering(time: number): void {
    (this.body as Phaser.Physics.Arcade.Body).stop();

    if (time >= this.stateEndsAt) {
      this.attackState = 'chasing';
    }
  }

  private chargeCooldown(): number {
    return this.isInPhaseTwo() ? TUNING.phaseTwoChargeCooldownMs : TUNING.chargeCooldownMs;
  }
}
