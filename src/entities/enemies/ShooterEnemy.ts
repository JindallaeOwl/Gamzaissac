import Phaser from 'phaser';
import { shooterPulseScale } from '../../systems/EnemyScaleRules';
import type { Player } from '../Player';
import { BaseEnemy } from './BaseEnemy';

export class ShooterEnemy extends BaseEnemy {
  private nextShotAt = 0;
  private fireAt = 0;
  private baseScale?: number;

  /**
   * 발사 예고가 진행 중인지(노란 점등·확대 상태).
   *
   * 사수 행동을 가로채는 하위 클래스(파리 여왕의 소환)가 예고 중에 끼어들면
   * 노란 tint와 확대 배율이 그대로 남고 돌아오는 순간 즉시 발사된다. 그걸
   * 피하려면 예고가 끝날 때까지 기다려야 하므로 판단 근거를 열어 둔다.
   */
  protected get isTelegraphingShot(): boolean {
    return this.fireAt > 0;
  }

  updateAI(time: number, player: Player, enemyBullets: Phaser.Physics.Arcade.Group): void {
    const baseScale = (this.baseScale ??= this.scaleX);
    const body = this.body as Phaser.Physics.Arcade.Body;
    const keepAwayDistance = this.definition.keepAwayDistance ?? 125;
    const distance = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y);

    if (distance < keepAwayDistance - 24) {
      const angle = Phaser.Math.Angle.Between(player.x, player.y, this.x, this.y);
      body.setVelocity(
        Math.cos(angle) * this.definition.speed,
        Math.sin(angle) * this.definition.speed,
      );
    } else if (distance > keepAwayDistance + 30) {
      this.moveToward(player.x, player.y, this.definition.speed);
    } else {
      const strafeAngle =
        Phaser.Math.Angle.Between(this.x, this.y, player.x, player.y) + Math.PI / 2;
      body.setVelocity(Math.cos(strafeAngle) * 22, Math.sin(strafeAngle) * 22);
    }

    this.constrainToRoom();

    if (this.fireAt > 0 && time >= this.fireAt) {
      this.fireAt = 0;
      // clearTint를 직접 부르면 챔피언 금색 같은 지속 tint까지 지워진다.
      this.restorePersistentTint();
      this.setScale(shooterPulseScale(baseScale, 'idle'));
      this.fireAtPlayer(
        player,
        enemyBullets,
        (this.definition.bulletSpeed ?? 112) * (1 + (this.floorScale - 1) * 0.35),
        this.definition.bulletDamage ?? 1,
      );
      return;
    }

    if (this.fireAt === 0 && time >= this.nextShotAt) {
      this.nextShotAt = time + (this.definition.fireCooldownMs ?? 1400);
      this.fireAt = time + 240;
      this.setTint(0xfff0ad);
      this.setScale(shooterPulseScale(baseScale, 'telegraph'));
    }
  }
}
