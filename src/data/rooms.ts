import type { EnemyId } from './enemies';
import { STAGES } from './stages';

export type RoomType = 'start' | 'combat' | 'shop' | 'treasure' | 'boss';

export interface EnemySpawn {
  enemyId: EnemyId;
  x: number;
  y: number;
}

export interface ObstacleSpawn {
  x: number;
  y: number;
}

export interface RoomTemplate {
  id: string;
  roomType: RoomType;
  accentColor: number;
  /** 이 층부터 등장한다. 생략하면 1층부터. 층 제한이 있는 적(분열형 2층·플랭커
      3층·소환사 5층)을 고정 배치한 템플릿은 그 적의 등장 층 이상이어야 한다 —
      테스트가 이를 강제한다. */
  minFloor?: number;
  spawnSets: EnemySpawn[][];
  obstacles?: ObstacleSpawn[];
}

export const START_ROOM_TEMPLATE: RoomTemplate = {
  id: 'quiet-entry',
  roomType: 'start',
  accentColor: 0x49636f,
  spawnSets: [[]],
};

export const SHOP_ROOM_TEMPLATE: RoomTemplate = {
  id: 'yellow-market',
  roomType: 'shop',
  accentColor: 0xcaa64f,
  spawnSets: [[]],
};

export const TREASURE_ROOM_TEMPLATE: RoomTemplate = {
  id: 'locked-gallery',
  roomType: 'treasure',
  accentColor: 0x7f6bd9,
  spawnSets: [[]],
};

export function bossRoomTemplateId(bossId: EnemyId): string {
  return `boss-${bossId}`;
}

// 보스방 템플릿은 스테이지 데이터에 등장하는 모든 보스에서 파생한다.
// 보스별 전용 방 구조(장애물 배치 등)는 추후 확장 작업으로 남기고,
// v1.0은 공통 구조(중앙 상단 스폰)에 보스만 다르게 배치한다.
const BOSS_SPAWN_POINT = { x: 240, y: 110 } as const;

export const BOSS_ROOM_TEMPLATES: RoomTemplate[] = [
  ...new Set(STAGES.flatMap((stage) => stage.bossIds)),
].map((bossId) => ({
  id: bossRoomTemplateId(bossId),
  roomType: 'boss',
  accentColor: 0xd84f66,
  spawnSets: [[{ enemyId: bossId, x: BOSS_SPAWN_POINT.x, y: BOSS_SPAWN_POINT.y }]],
}));

export const COMBAT_ROOM_TEMPLATES: RoomTemplate[] = [
  {
    id: 'split-lanes',
    roomType: 'combat',
    accentColor: 0x783f5f,
    spawnSets: [
      [
        { enemyId: 'chaser', x: 120, y: 96 },
        { enemyId: 'chaser', x: 360, y: 176 },
        { enemyId: 'shooter', x: 344, y: 96 },
      ],
      [
        { enemyId: 'dasher', x: 120, y: 176 },
        { enemyId: 'chaser', x: 240, y: 88 },
        { enemyId: 'shooter', x: 360, y: 172 },
      ],
      [
        { enemyId: 'chaser', x: 152, y: 88 },
        { enemyId: 'shooter', x: 328, y: 184 },
        { enemyId: 'dasher', x: 240, y: 136 },
      ],
    ],
    obstacles: [
      { x: 200, y: 112 },
      { x: 280, y: 160 },
    ],
  },
  {
    id: 'burnt-cross',
    roomType: 'combat',
    accentColor: 0x825c34,
    spawnSets: [
      [
        { enemyId: 'chaser', x: 240, y: 80 },
        { enemyId: 'chaser', x: 240, y: 192 },
        { enemyId: 'dasher', x: 136, y: 136 },
        { enemyId: 'dasher', x: 344, y: 136 },
      ],
      [
        { enemyId: 'shooter', x: 120, y: 96 },
        { enemyId: 'shooter', x: 360, y: 176 },
        { enemyId: 'chaser', x: 240, y: 136 },
      ],
      [
        { enemyId: 'dasher', x: 136, y: 88 },
        { enemyId: 'dasher', x: 344, y: 184 },
        { enemyId: 'shooter', x: 240, y: 192 },
      ],
    ],
    obstacles: [
      { x: 176, y: 136 },
      { x: 304, y: 136 },
    ],
  },
  {
    id: 'staggered-rail',
    roomType: 'combat',
    accentColor: 0x395f7f,
    spawnSets: [
      [
        { enemyId: 'shooter', x: 144, y: 88 },
        { enemyId: 'shooter', x: 336, y: 88 },
        { enemyId: 'chaser', x: 152, y: 184 },
        { enemyId: 'dasher', x: 328, y: 176 },
      ],
      [
        { enemyId: 'dasher', x: 112, y: 96 },
        { enemyId: 'dasher', x: 368, y: 176 },
        { enemyId: 'chaser', x: 240, y: 136 },
      ],
      [
        { enemyId: 'shooter', x: 240, y: 64 },
        { enemyId: 'chaser', x: 120, y: 136 },
        { enemyId: 'chaser', x: 360, y: 136 },
        { enemyId: 'dasher', x: 240, y: 208 },
      ],
    ],
    obstacles: [
      { x: 240, y: 104 },
      { x: 240, y: 168 },
    ],
  },
  {
    id: 'low-orbit',
    roomType: 'combat',
    accentColor: 0x4c6c43,
    spawnSets: [
      [
        { enemyId: 'chaser', x: 120, y: 96 },
        { enemyId: 'chaser', x: 360, y: 96 },
        { enemyId: 'chaser', x: 120, y: 176 },
        { enemyId: 'chaser', x: 360, y: 176 },
        { enemyId: 'shooter', x: 240, y: 136 },
      ],
      [
        { enemyId: 'dasher', x: 240, y: 88 },
        { enemyId: 'dasher', x: 240, y: 184 },
        { enemyId: 'shooter', x: 128, y: 136 },
        { enemyId: 'shooter', x: 352, y: 136 },
      ],
      [
        { enemyId: 'chaser', x: 168, y: 96 },
        { enemyId: 'chaser', x: 312, y: 96 },
        { enemyId: 'dasher', x: 168, y: 176 },
        { enemyId: 'dasher', x: 312, y: 176 },
        { enemyId: 'shooter', x: 240, y: 64 },
      ],
    ],
  },
  // ── 확장 템플릿 (2026-08-10): 한 판 44개 전투방 대비 조합 8개 → 같은 방을
  //    평균 5.5회 반복하던 것을 완화한다. 상자 배치가 만드는 공간이 서로 겹치지
  //    않게 잡았고, 층 제한 적은 minFloor로 이른 층에 새지 않게 막는다.
  {
    id: 'pillar-hall',
    roomType: 'combat',
    accentColor: 0x5f7a48,
    spawnSets: [
      [
        { enemyId: 'chaser', x: 240, y: 72 },
        { enemyId: 'chaser', x: 240, y: 200 },
        { enemyId: 'shooter', x: 96, y: 136 },
      ],
      [
        { enemyId: 'dasher', x: 120, y: 88 },
        { enemyId: 'dasher', x: 360, y: 184 },
        { enemyId: 'chaser', x: 240, y: 136 },
      ],
      [
        { enemyId: 'shooter', x: 160, y: 136 },
        { enemyId: 'shooter', x: 320, y: 136 },
        { enemyId: 'chaser', x: 240, y: 88 },
        { enemyId: 'chaser', x: 240, y: 184 },
      ],
    ],
    obstacles: [
      { x: 160, y: 96 },
      { x: 320, y: 96 },
      { x: 160, y: 176 },
      { x: 320, y: 176 },
    ],
  },
  {
    id: 'corner-forts',
    roomType: 'combat',
    accentColor: 0x7a5f8a,
    spawnSets: [
      [
        { enemyId: 'shooter', x: 72, y: 56 },
        { enemyId: 'shooter', x: 408, y: 224 },
        { enemyId: 'chaser', x: 240, y: 136 },
      ],
      [
        { enemyId: 'shooter', x: 408, y: 48 },
        { enemyId: 'shooter', x: 72, y: 224 },
        { enemyId: 'dasher', x: 240, y: 136 },
      ],
      [
        { enemyId: 'shooter', x: 72, y: 56 },
        { enemyId: 'shooter', x: 408, y: 56 },
        { enemyId: 'chaser', x: 168, y: 192 },
        { enemyId: 'chaser', x: 312, y: 192 },
      ],
    ],
    obstacles: [
      { x: 112, y: 80 },
      { x: 368, y: 80 },
      { x: 112, y: 192 },
      { x: 368, y: 192 },
    ],
  },
  {
    id: 'broken-wall',
    roomType: 'combat',
    accentColor: 0x8a4f43,
    minFloor: 2,
    spawnSets: [
      [
        { enemyId: 'dasher', x: 240, y: 80 },
        { enemyId: 'dasher', x: 240, y: 192 },
        { enemyId: 'shooter', x: 120, y: 80 },
      ],
      [
        { enemyId: 'chaser', x: 144, y: 88 },
        { enemyId: 'chaser', x: 336, y: 88 },
        { enemyId: 'chaser', x: 144, y: 184 },
        { enemyId: 'chaser', x: 336, y: 184 },
      ],
      [
        { enemyId: 'splitter', x: 240, y: 88 },
        { enemyId: 'shooter', x: 360, y: 192 },
        { enemyId: 'chaser', x: 120, y: 192 },
      ],
    ],
    obstacles: [
      { x: 112, y: 136 },
      { x: 152, y: 136 },
      { x: 192, y: 136 },
      { x: 288, y: 136 },
      { x: 328, y: 136 },
      { x: 368, y: 136 },
    ],
  },
  {
    id: 'slant-ridge',
    roomType: 'combat',
    accentColor: 0x476b6b,
    minFloor: 2,
    spawnSets: [
      [
        { enemyId: 'shooter', x: 352, y: 80 },
        { enemyId: 'shooter', x: 128, y: 192 },
        { enemyId: 'chaser', x: 240, y: 136 },
      ],
      [
        { enemyId: 'dasher', x: 112, y: 96 },
        { enemyId: 'chaser', x: 368, y: 96 },
        { enemyId: 'chaser', x: 240, y: 192 },
      ],
      [
        { enemyId: 'splitter', x: 168, y: 168 },
        { enemyId: 'shooter', x: 344, y: 104 },
        { enemyId: 'chaser', x: 104, y: 72 },
      ],
    ],
    obstacles: [
      { x: 144, y: 96 },
      { x: 208, y: 128 },
      { x: 272, y: 152 },
      { x: 336, y: 184 },
    ],
  },
  {
    id: 'choke-cross',
    roomType: 'combat',
    accentColor: 0x8a6f2f,
    minFloor: 3,
    spawnSets: [
      [
        { enemyId: 'flanker', x: 120, y: 88 },
        { enemyId: 'shooter', x: 360, y: 88 },
        { enemyId: 'chaser', x: 240, y: 200 },
      ],
      [
        { enemyId: 'flanker', x: 360, y: 184 },
        { enemyId: 'chaser', x: 120, y: 88 },
        { enemyId: 'chaser', x: 120, y: 184 },
        { enemyId: 'shooter', x: 360, y: 88 },
      ],
      [
        { enemyId: 'flanker', x: 240, y: 80 },
        { enemyId: 'dasher', x: 128, y: 176 },
        { enemyId: 'shooter', x: 352, y: 176 },
      ],
    ],
    obstacles: [
      { x: 208, y: 136 },
      { x: 240, y: 136 },
      { x: 272, y: 136 },
      { x: 240, y: 112 },
      { x: 240, y: 160 },
    ],
  },
  {
    id: 'flank-alley',
    roomType: 'combat',
    accentColor: 0x3f7a5f,
    minFloor: 3,
    spawnSets: [
      [
        { enemyId: 'flanker', x: 120, y: 136 },
        { enemyId: 'flanker', x: 360, y: 136 },
        { enemyId: 'shooter', x: 240, y: 64 },
      ],
      [
        { enemyId: 'flanker', x: 376, y: 88 },
        { enemyId: 'chaser', x: 104, y: 88 },
        { enemyId: 'chaser', x: 104, y: 184 },
        { enemyId: 'shooter', x: 376, y: 184 },
      ],
      [
        { enemyId: 'dasher', x: 240, y: 136 },
        { enemyId: 'flanker', x: 104, y: 192 },
        { enemyId: 'shooter', x: 376, y: 64 },
      ],
    ],
    obstacles: [
      { x: 144, y: 96 },
      { x: 192, y: 96 },
      { x: 288, y: 96 },
      { x: 336, y: 96 },
      { x: 144, y: 176 },
      { x: 192, y: 176 },
      { x: 288, y: 176 },
      { x: 336, y: 176 },
    ],
  },
  {
    id: 'spore-garden',
    roomType: 'combat',
    accentColor: 0x6b8a3f,
    minFloor: 4,
    spawnSets: [
      [
        { enemyId: 'splitter', x: 176, y: 72 },
        { enemyId: 'splitter', x: 304, y: 208 },
        { enemyId: 'shooter', x: 240, y: 136 },
      ],
      [
        { enemyId: 'splitter', x: 240, y: 96 },
        { enemyId: 'chaser', x: 120, y: 176 },
        { enemyId: 'chaser', x: 384, y: 192 },
        { enemyId: 'dasher', x: 240, y: 192 },
      ],
      [
        { enemyId: 'splitter', x: 128, y: 136 },
        { enemyId: 'splitter', x: 368, y: 128 },
        { enemyId: 'flanker', x: 240, y: 192 },
      ],
    ],
    obstacles: [
      { x: 136, y: 104 },
      { x: 296, y: 84 },
      { x: 176, y: 192 },
      { x: 344, y: 160 },
    ],
  },
  {
    id: 'brood-nest',
    roomType: 'combat',
    accentColor: 0xa8823f,
    minFloor: 5,
    spawnSets: [
      [
        { enemyId: 'summoner', x: 408, y: 64 },
        { enemyId: 'chaser', x: 144, y: 176 },
        { enemyId: 'chaser', x: 240, y: 192 },
      ],
      [
        { enemyId: 'summoner', x: 72, y: 208 },
        { enemyId: 'shooter', x: 416, y: 72 },
        { enemyId: 'dasher', x: 240, y: 88 },
      ],
      [
        { enemyId: 'summoner', x: 408, y: 208 },
        { enemyId: 'flanker', x: 128, y: 96 },
        { enemyId: 'shooter', x: 240, y: 64 },
      ],
    ],
    obstacles: [
      { x: 360, y: 96 },
      { x: 384, y: 120 },
    ],
  },
];

export function getRoomTemplate(templateId: string): RoomTemplate {
  if (templateId === START_ROOM_TEMPLATE.id) {
    return START_ROOM_TEMPLATE;
  }

  if (templateId === SHOP_ROOM_TEMPLATE.id) {
    return SHOP_ROOM_TEMPLATE;
  }

  if (templateId === TREASURE_ROOM_TEMPLATE.id) {
    return TREASURE_ROOM_TEMPLATE;
  }

  const bossTemplate = BOSS_ROOM_TEMPLATES.find((candidate) => candidate.id === templateId);

  if (bossTemplate) {
    return bossTemplate;
  }

  const template = COMBAT_ROOM_TEMPLATES.find((candidate) => candidate.id === templateId);

  if (!template) {
    throw new Error(`Unknown room template: ${templateId}`);
  }

  return template;
}
