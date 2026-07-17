import type { EnemyId } from './enemies';

export type RoomType = 'start' | 'combat' | 'reward' | 'treasure' | 'boss';

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
  spawnSets: EnemySpawn[][];
  obstacles?: ObstacleSpawn[];
}

export const START_ROOM_TEMPLATE: RoomTemplate = {
  id: 'quiet-entry',
  roomType: 'start',
  accentColor: 0x49636f,
  spawnSets: [[]],
};

export const REWARD_ROOM_TEMPLATE: RoomTemplate = {
  id: 'small-cache',
  roomType: 'reward',
  accentColor: 0xcaa64f,
  spawnSets: [[]],
};

export const TREASURE_ROOM_TEMPLATE: RoomTemplate = {
  id: 'locked-gallery',
  roomType: 'treasure',
  accentColor: 0x7f6bd9,
  spawnSets: [[]],
};

export const BOSS_ROOM_TEMPLATES: RoomTemplate[] = [
  {
    id: 'error-sanctum',
    roomType: 'boss',
    accentColor: 0xd84f66,
    spawnSets: [[{ enemyId: 'faultWarden', x: 240, y: 110 }]],
  },
  {
    id: 'root-cellar',
    roomType: 'boss',
    accentColor: 0x4f9f71,
    spawnSets: [[{ enemyId: 'rootKernel', x: 240, y: 110 }]],
  },
];

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
    ],
  },
];

export function getRoomTemplate(templateId: string): RoomTemplate {
  if (templateId === START_ROOM_TEMPLATE.id) {
    return START_ROOM_TEMPLATE;
  }

  if (templateId === REWARD_ROOM_TEMPLATE.id) {
    return REWARD_ROOM_TEMPLATE;
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
