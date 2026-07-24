import Phaser from 'phaser';
import { ENEMY_DEFINITIONS, type EnemyId } from '../../data/enemies';
import { ChaserEnemy } from './ChaserEnemy';
import { DasherEnemy } from './DasherEnemy';
import { FaultWardenBoss } from './FaultWardenBoss';
import { RootKernelBoss } from './RootKernelBoss';
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
  let enemy: BaseEnemy;

  switch (enemyId) {
    case 'chaser':
      enemy = new ChaserEnemy(scene, x, y, definition, floor);
      break;
    case 'shooter':
      enemy = new ShooterEnemy(scene, x, y, definition, floor);
      break;
    case 'dasher':
      enemy = new DasherEnemy(scene, x, y, definition, floor);
      break;
    case 'splitter':
    case 'splitterling':
    case 'rootGnarl':
    case 'wriggleMass':
      // All use the chaser's pursuit behavior; splitting is wired in RoomController.
      enemy = new ChaserEnemy(scene, x, y, definition, floor);
      break;
    case 'flyQueen':
      enemy = new ShooterEnemy(scene, x, y, definition, floor);
      break;
    case 'thornTangle':
      enemy = new DasherEnemy(scene, x, y, definition, floor);
      break;
    case 'faultWarden':
      enemy = new FaultWardenBoss(scene, x, y, definition, floor);
      break;
    case 'rootKernel':
      enemy = new RootKernelBoss(scene, x, y, definition, floor);
      break;
  }

  group.add(enemy);
  return enemy;
}
