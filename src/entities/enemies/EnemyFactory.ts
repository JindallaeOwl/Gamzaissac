import Phaser from 'phaser';
import { ENEMY_DEFINITIONS, type EnemyId } from '../../data/enemies';
import { ChaserEnemy } from './ChaserEnemy';
import { DasherEnemy } from './DasherEnemy';
import { FaultWardenBoss } from './FaultWardenBoss';
import { FlankerEnemy } from './FlankerEnemy';
import { FlyQueenMiniboss } from './FlyQueenMiniboss';
import { PitchforkFarmerBoss } from './PitchforkFarmerBoss';
import { RootGnarlMiniboss } from './RootGnarlMiniboss';
import { RootKernelBoss } from './RootKernelBoss';
import { ShooterEnemy } from './ShooterEnemy';
import { SummonerEnemy } from './SummonerEnemy';
import { ThornTangleMiniboss } from './ThornTangleMiniboss';
import { WormKingBoss } from './WormKingBoss';
import { WriggleMassMiniboss } from './WriggleMassMiniboss';
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
    case 'flanker':
      enemy = new FlankerEnemy(scene, x, y, definition, floor);
      break;
    case 'summoner':
      enemy = new SummonerEnemy(scene, x, y, definition, floor);
      break;
    case 'splitter':
    case 'splitterling':
      // Both use the chaser's pursuit behavior; splitting is wired in RoomController.
      enemy = new ChaserEnemy(scene, x, y, definition, floor);
      break;
    // I층 중간보스 4종. 원래는 위의 일반 적 AI를 그대로 재사용했지만, 각자 서명
    // 패턴을 받아 전용 클래스가 되었다(2026-08-17). 죽을 때의 분열은 여전히
    // RoomController가 정의를 보고 처리한다.
    case 'rootGnarl':
      enemy = new RootGnarlMiniboss(scene, x, y, definition, floor);
      break;
    case 'wriggleMass':
      enemy = new WriggleMassMiniboss(scene, x, y, definition, floor);
      break;
    case 'flyQueen':
      enemy = new FlyQueenMiniboss(scene, x, y, definition, floor);
      break;
    case 'thornTangle':
      enemy = new ThornTangleMiniboss(scene, x, y, definition, floor);
      break;
    case 'wormKing':
      enemy = new WormKingBoss(scene, x, y, definition, floor);
      break;
    case 'faultWarden':
      enemy = new FaultWardenBoss(scene, x, y, definition, floor);
      break;
    case 'rootKernel':
      enemy = new RootKernelBoss(scene, x, y, definition, floor);
      break;
    case 'pitchforkFarmer':
      enemy = new PitchforkFarmerBoss(scene, x, y, definition, floor);
      break;
  }

  group.add(enemy);
  return enemy;
}
