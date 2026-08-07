import Phaser from 'phaser';
import type { EnemyId } from '../../data/enemies';
import { getNextTelegraphAt, resolveKeepAwayMove } from '../../systems/SummonerRules';
import type { Player } from '../Player';
import { BaseEnemy } from './BaseEnemy';

// 소환형 적. 거리를 벌리며 주기적으로 하수인을 부른다. 눈앞의 적부터 처리하는
// 습관을 무효화해 "뒤를 먼저 칠까"라는 판단을 만드는 것이 목적이다.
// 소환은 직접 적을 만들지 않고 'summon-request'를 쏘면 RoomController가 소유권과
// 상한을 적용해 생성한다(지렁이 왕과 같은 공통 경로).

// state는 Phaser GameObject.state와 충돌하므로 쓰지 않는다.
type SummonerAttackState = 'maintainingDistance' | 'telegraphing' | 'recovering';

const DEFAULTS = {
  keepAwayDistance: 150,
  summonCount: 2,
  summonMaxAlive: 2,
  summonCooldownMs: 4200,
  summonTelegraphMs: 420,
  summonRecoveryMs: 320,
} as const;

const STRAFE_SPEED = 22;
// 바깥 링은 호박색, 안쪽 점만 하수인 민트색. 플랭커 예고(초록)와 색·형태로 구분한다.
const TELEGRAPH_RING_COLOR = 0xffc24d;
const TELEGRAPH_SPAWN_COLOR = 0x63dcb7;
const TELEGRAPH_SPAWN_DOTS = 6;

export class SummonerEnemy extends BaseEnemy {
  private attackState: SummonerAttackState = 'maintainingDistance';
  private stateEndsAt = 0;
  // 0이므로 첫 행동에서 곧바로 예고를 시작한다(사수의 빠른 첫 예고와 같은 감각).
  private nextTelegraphAt = 0;
  private telegraph?: Phaser.GameObjects.Graphics;

  updateAI(time: number, player: Player): void {
    switch (this.attackState) {
      case 'maintainingDistance':
        this.updateMaintainingDistance(time, player);
        return;
      case 'telegraphing':
        this.updateTelegraphing(time);
        return;
      case 'recovering':
        this.updateRecovering(time);
    }
  }

  override destroy(fromScene?: boolean): void {
    this.clearTelegraph(fromScene);
    super.destroy(fromScene);
  }

  private updateMaintainingDistance(time: number, player: Player): void {
    if (time >= this.nextTelegraphAt) {
      this.beginTelegraph(time);
      return;
    }

    const body = this.body as Phaser.Physics.Arcade.Body;
    const distance = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y);
    // floorScale을 곱하지 않는다. 기준으로 삼은 사수와 같고, 스트레이프가 22 고정이라
    // 후반 층에서 접근·후퇴만 빨라지면 두 속도가 지나치게 벌어진다. 느리면 정의의
    // speed를 직접 올린다.
    const speed = this.definition.speed;

    switch (resolveKeepAwayMove(distance, this.tuning('keepAwayDistance'))) {
      case 'retreat': {
        const away = Phaser.Math.Angle.Between(player.x, player.y, this.x, this.y);
        body.setVelocity(Math.cos(away) * speed, Math.sin(away) * speed);
        break;
      }
      case 'approach':
        this.moveToward(player.x, player.y, speed);
        break;
      case 'strafe': {
        const sideways =
          Phaser.Math.Angle.Between(this.x, this.y, player.x, player.y) + Math.PI / 2;
        body.setVelocity(Math.cos(sideways) * STRAFE_SPEED, Math.sin(sideways) * STRAFE_SPEED);
      }
    }

    this.constrainToRoom();
  }

  /** Standing still is the whole point: it is the window to push in and kill it. */
  private beginTelegraph(time: number): void {
    this.attackState = 'telegraphing';
    this.stateEndsAt = time + this.tuning('summonTelegraphMs');
    (this.body as Phaser.Physics.Arcade.Body).stop();
    this.showTelegraph();
  }

  private updateTelegraphing(time: number): void {
    (this.body as Phaser.Physics.Arcade.Body).stop();

    // stop()으로 스스로 서 있어도 피격 넉백은 속도를 다시 넣는다. 특히 빔 피해는
    // 이 stop() 이후 CombatCollisionSystem에서 처리되므로, 위치를 따라 붙이지 않으면
    // 다음 물리 프레임에 본체만 밀려나고 링이 제자리에 남는다.
    this.telegraph?.setPosition(this.x, this.y);

    if (time < this.stateEndsAt) {
      return;
    }

    this.clearTelegraph();

    // Emitted at the END of the telegraph. Emitting at the start would let the
    // minions appear before the warning finished, making the warning a lie.
    // Dying mid-telegraph therefore cancels the summon outright, since updateAI
    // never reaches this line.
    this.emit('summon-request', {
      childId: this.definition.summonChildId as EnemyId,
      count: this.tuning('summonCount'),
      maxAlive: this.tuning('summonMaxAlive'),
    });

    this.nextTelegraphAt = getNextTelegraphAt(
      time,
      this.tuning('summonCooldownMs'),
      this.tuning('summonTelegraphMs'),
    );
    this.attackState = 'recovering';
    this.stateEndsAt = time + this.tuning('summonRecoveryMs');
  }

  private updateRecovering(time: number): void {
    // Still rooted. The recovery is part of the cooldown, not extra time on top.
    (this.body as Phaser.Physics.Arcade.Body).stop();

    if (time >= this.stateEndsAt) {
      this.attackState = 'maintainingDistance';
    }
  }

  private tuning(key: keyof typeof DEFAULTS): number {
    return this.definition[key] ?? DEFAULTS[key];
  }

  /**
   * Drawn once around the Graphics origin, then moved with the body each frame.
   *
   * Local coordinates mean a knockback only has to update the object's position
   * instead of clearing and redrawing the whole ring.
   */
  private showTelegraph(): void {
    this.clearTelegraph();
    this.telegraph = this.scene.add
      .graphics()
      .setDepth(this.depth - 1)
      .setPosition(this.x, this.y);

    const radius = this.effectiveBodyRadius + 8;

    this.telegraph.lineStyle(2, TELEGRAPH_RING_COLOR, 0.85);
    this.telegraph.strokeCircle(0, 0, radius);
    this.telegraph.lineStyle(5, TELEGRAPH_RING_COLOR, 0.14);
    this.telegraph.strokeCircle(0, 0, radius);

    // Dots in the minion's own colour, so the ring says what is coming.
    this.telegraph.fillStyle(TELEGRAPH_SPAWN_COLOR, 0.9);

    for (let i = 0; i < TELEGRAPH_SPAWN_DOTS; i += 1) {
      const angle = (Math.PI * 2 * i) / TELEGRAPH_SPAWN_DOTS;
      this.telegraph.fillCircle(Math.cos(angle) * radius, Math.sin(angle) * radius, 1.5);
    }
  }

  private clearTelegraph(fromScene?: boolean): void {
    this.telegraph?.destroy(fromScene);
    this.telegraph = undefined;
  }
}
