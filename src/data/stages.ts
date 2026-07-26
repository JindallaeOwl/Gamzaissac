import type { EnemyId } from './enemies';
import type { RoomType } from './rooms';

// 스테이지 정의: 감자의 농장 탈출기 — 땅속 깊은 곳에서 위로 파고 올라간다.
// 각 스테이지는 2개 층으로 구성되고, 모든 층 마지막에는 보스방이 있다.
// bossIds = [I층 중간보스, II층 스테이지 보스]. S4-II는 최종 보스 녹슨 쇠스랑의 농부.
export interface StageDefinition {
  id: string;
  nameKey: string;
  bossIds: readonly [EnemyId, EnemyId];
  accentColor: number;
}

export const FLOORS_PER_STAGE = 2;

export const STAGES: readonly StageDefinition[] = [
  {
    id: 'rotten-roots',
    nameKey: 'stages.rottenRoots',
    bossIds: ['rootGnarl', 'rootKernel'],
    accentColor: 0x8a4a3a,
  },
  {
    id: 'worm-den',
    nameKey: 'stages.wormDen',
    bossIds: ['wriggleMass', 'wormKing'],
    accentColor: 0x9c5a6d,
  },
  {
    id: 'compost-heap',
    nameKey: 'stages.compostHeap',
    bossIds: ['flyQueen', 'faultWarden'],
    accentColor: 0x7f8a3f,
  },
  {
    id: 'vine-passage',
    nameKey: 'stages.vinePassage',
    bossIds: ['thornTangle', 'pitchforkFarmer'],
    accentColor: 0x63c978,
  },
];

export const TOTAL_FLOORS = STAGES.length * FLOORS_PER_STAGE;

export interface StageProgress {
  stage: StageDefinition;
  stageNumber: number;
  floorInStage: 1 | 2;
  bossId: EnemyId;
  isFinalFloor: boolean;
}

// 층 번호(1~TOTAL_FLOORS)를 스테이지 진행 정보로 변환한다.
// 범위 밖·비정수 입력은 조용히 잘못된 값을 돌려주는 대신 명시적으로 실패한다.
export function getStageProgress(floor: number): StageProgress {
  if (!Number.isInteger(floor) || floor < 1 || floor > TOTAL_FLOORS) {
    throw new Error(`Invalid floor: ${floor} (expected an integer in 1-${TOTAL_FLOORS})`);
  }

  const stageIndex = Math.floor((floor - 1) / FLOORS_PER_STAGE);
  const stage = STAGES[stageIndex];
  const floorInStage: 1 | 2 = (floor - 1) % FLOORS_PER_STAGE === 0 ? 1 : 2;

  return {
    stage,
    stageNumber: stageIndex + 1,
    floorInStage,
    bossId: stage.bossIds[floorInStage - 1],
    isFinalFloor: floor === TOTAL_FLOORS,
  };
}

export function stageFloorRoman(floorInStage: 1 | 2): 'I' | 'II' {
  return floorInStage === 1 ? 'I' : 'II';
}

// 방 색조 규칙: 전투방·시작방은 스테이지 분위기 색을 쓰고,
// 상점·보물·보스방은 기능을 나타내는 기존 방 종류 색을 유지한다.
export function resolveRoomAccentColor(
  roomType: RoomType,
  templateAccent: number,
  stageAccent: number,
): number {
  return roomType === 'combat' || roomType === 'start' ? stageAccent : templateAccent;
}
