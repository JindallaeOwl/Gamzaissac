import Phaser from 'phaser';
import { TextureKeys } from '../config/assets';
import { DEPTH, OBSTACLE_TUNING } from '../config/gameConfig';
import { EnemyDamageVisual } from '../systems/EnemyDamageVisual';
import type { DamageScar, FragmentImpact } from '../systems/EnemyDamagePixels';

export class Obstacle extends Phaser.Physics.Arcade.Sprite {
  private hp: number;
  private destroyQueued = false;
  private damageVisual?: EnemyDamageVisual;
  private readonly scars: DamageScar[];
  private readonly onHealthChanged?: (remainingHealth: number) => void;
  private readonly onDestroyed?: (x: number, y: number) => void;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    initialHealth = OBSTACLE_TUNING.maxHealth,
    onHealthChanged?: (remainingHealth: number) => void,
    onDestroyed?: (x: number, y: number) => void,
    scars: DamageScar[] = [],
  ) {
    super(scene, x, y, TextureKeys.obstacleCrate);
    this.hp = initialHealth;
    this.scars = scars;
    this.onHealthChanged = onHealthChanged;
    this.onDestroyed = onDestroyed;
    scene.add.existing(this);
    // 축소를 먼저 하고 바디를 만든다. 정적 바디는 나중에 setScale을 해도 따라
    // 줄지 않아, 순서가 바뀌면 그림보다 큰 충돌 범위가 남는다.
    this.setDepth(DEPTH.item).setScale(OBSTACLE_TUNING.displayScale);
    scene.physics.add.existing(this, true);

    const body = this.body as Phaser.Physics.Arcade.StaticBody | undefined;

    // 텍스처 여백과 접지 그림자를 뺀, 실제로 그려진 상자만 막는다.
    body?.setSize(OBSTACLE_TUNING.bodyWidth, OBSTACLE_TUNING.bodyHeight);
    if (scars.length) this.damageVisual = new EnemyDamageVisual(this, scars);
  }

  takeDamage(amount: number, sourceX = this.x, sourceY = this.y, impact?: FragmentImpact): boolean {
    if (!this.active || this.destroyQueued) {
      return false;
    }

    this.hp -= amount;
    this.damageVisual ??= new EnemyDamageVisual(this, this.scars);
    this.damageVisual.hit(sourceX, sourceY, 0xffffff, this.hp <= 0, impact);
    this.onHealthChanged?.(Math.max(0, this.hp));

    if (this.hp <= 0) {
      return this.destroyObstacle();
    }

    this.setTint(OBSTACLE_TUNING.hitTint);
    this.scene.time.delayedCall(OBSTACLE_TUNING.hitFlashMs, () => {
      if (this.active) {
        this.clearTint();
      }
    });

    return false;
  }

  destroyByBomb(sourceX = this.x, sourceY = this.y): boolean {
    if (!this.active || this.destroyQueued) return false;
    this.damageVisual ??= new EnemyDamageVisual(this, this.scars);
    this.damageVisual.hit(sourceX, sourceY, 0xffffff, true, {
      kind: 'explosion',
      x: this.x - sourceX,
      y: this.y - sourceY,
    });
    return this.destroyObstacle();
  }

  override destroy(fromScene?: boolean): void {
    this.damageVisual?.destroy();
    this.damageVisual = undefined;
    super.destroy(fromScene);
  }

  private destroyObstacle(): boolean {
    if (!this.active || this.destroyQueued) {
      return false;
    }

    this.destroyQueued = true;
    this.hp = 0;
    this.onHealthChanged?.(0);
    this.setActive(false);
    this.setVisible(false);

    const body = this.body as Phaser.Physics.Arcade.StaticBody | undefined;

    if (body) {
      body.enable = false;
    }

    this.onDestroyed?.(this.x, this.y);

    this.scene.time.delayedCall(0, () => {
      if (this.scene) {
        this.destroy();
      }
    });

    return true;
  }
}
