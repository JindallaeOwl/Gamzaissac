import Phaser from 'phaser';
import { ENEMY_DEFINITIONS, type EnemyId } from '../../data/enemies';
import { ChaserEnemy } from './ChaserEnemy';
import { DasherEnemy } from './DasherEnemy';
import { FaultWardenBoss } from './FaultWardenBoss';
import { ShooterEnemy } from './ShooterEnemy';
import type { BaseEnemy } from './BaseEnemy';

export function createEnemy(
  scene: Phaser.Scene,
  group: Phaser.Physics.Arcade.Group,
  enemyId: EnemyId,
  x: number,
  y: number,
  floor: number,
): BaseEnemy {
  const definition = ENEMY_DEFINITIONS[enemyId];
  const enemy =
    enemyId === 'chaser'
      ? new ChaserEnemy(scene, x, y, definition, floor)
      : enemyId === 'shooter'
        ? new ShooterEnemy(scene, x, y, definition, floor)
        : enemyId === 'faultWarden'
          ? new FaultWardenBoss(scene, x, y, definition, floor)
          : new DasherEnemy(scene, x, y, definition, floor);

  group.add(enemy);
  return enemy;
}
