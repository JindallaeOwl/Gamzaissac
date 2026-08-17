import type Phaser from 'phaser';
import { MINIBOSS_TUNING } from '../../config/gameConfig';
import { createRadialDirections } from '../../utils/attackDirections';
import type { Player } from '../Player';
import { DasherEnemy } from './DasherEnemy';

/**
 * 1스테이지 I층 중간보스 "가시넝쿨 뭉치".
 *
 * 돌진 AI(배회 → 예고 → 돌진)를 물려받고, 돌진이 끝난 자리에서 가시를 방사한다.
 * 돌진을 피하는 것만으로 끝나던 것을 "피한 뒤에도 한 번 더 피해야 한다"로 바꾼다.
 * 체력 절반에서 각성해 가시가 늘고 돌진 주기가 짧아진다.
 * 원래는 일반 대셔와 코드가 완전히 같았다.
 */

const TUNING = MINIBOSS_TUNING.thornTangle;

export class ThornTangleMiniboss extends DasherEnemy {
  override updateAI(time: number, player: Player, enemyBullets: Phaser.Physics.Arcade.Group): void {
    this.updatePhase();
    super.updateAI(time, player, enemyBullets);
  }

  /** 돌진이 끝난 자리에서 가시가 원형으로 퍼진다. */
  protected override onDashEnded(_time: number, enemyBullets: Phaser.Physics.Arcade.Group): void {
    const radius = this.effectiveBodyRadius + 4;

    // 기준각을 두지 않아 착지 지점 기준의 고른 원이 된다 — 돌진 방향과 무관하게
    // "이 자리에서 물러나라"는 한 가지 읽기만 남는다.
    for (const direction of createRadialDirections(this.thornCount())) {
      this.fireBullet(
        this.x + direction.x * radius,
        this.y + direction.y * radius,
        direction,
        enemyBullets,
        TUNING.thornSpeed,
        this.definition.bulletDamage ?? 1,
      );
    }
  }

  protected override getDashCooldownMs(): number {
    return this.isInPhaseTwo() ? TUNING.phaseTwoDashCooldownMs : super.getDashCooldownMs();
  }

  private updatePhase(): void {
    if (!this.tryLatchPhaseTwo(MINIBOSS_TUNING.phaseTwoThreshold)) {
      return;
    }

    this.setPersistentTint(TUNING.phaseTwoTint);
  }

  private thornCount(): number {
    return this.isInPhaseTwo() ? TUNING.phaseTwoThornCount : TUNING.thornCount;
  }
}
