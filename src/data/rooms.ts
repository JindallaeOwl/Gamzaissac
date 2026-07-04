import type { EnemyId } from './enemies';

export type RoomType = 'start' | 'combat' | 'reward' | 'treasure' | 'boss';

export interface EnemySpawn {
  enemyId: EnemyId;
  x: number;
  y: number;
}

export interface RoomTemplate {
  id: string;
  roomType: RoomType;
  accentColor: number;
  spawnSets: EnemySpawn[][];
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

export const BOSS_ROOM_TEMPLATE: RoomTemplate = {
  id: 'error-sanctum',
  roomType: 'boss',
  accentColor: 0xd84f66,
  spawnSets: [[{ enemyId: 'faultWarden', x: 480, y: 260 }]],
};

export const COMBAT_ROOM_TEMPLATES: RoomTemplate[] = [
  {
    id: 'split-lanes',
    roomType: 'combat',
    accentColor: 0x783f5f,
    spawnSets: [
      [
        { enemyId: 'chaser', x: 250, y: 230 },
        { enemyId: 'chaser', x: 710, y: 410 },
        { enemyId: 'shooter', x: 680, y: 230 },
      ],
      [
        { enemyId: 'dasher', x: 250, y: 410 },
        { enemyId: 'chaser', x: 480, y: 210 },
        { enemyId: 'shooter', x: 710, y: 400 },
      ],
    ],
  },
  {
    id: 'burnt-cross',
    roomType: 'combat',
    accentColor: 0x825c34,
    spawnSets: [
      [
        { enemyId: 'chaser', x: 480, y: 190 },
        { enemyId: 'chaser', x: 480, y: 450 },
        { enemyId: 'dasher', x: 275, y: 320 },
        { enemyId: 'dasher', x: 685, y: 320 },
      ],
      [
        { enemyId: 'shooter', x: 250, y: 225 },
        { enemyId: 'shooter', x: 710, y: 415 },
        { enemyId: 'chaser', x: 480, y: 320 },
      ],
    ],
  },
  {
    id: 'staggered-rail',
    roomType: 'combat',
    accentColor: 0x395f7f,
    spawnSets: [
      [
        { enemyId: 'shooter', x: 300, y: 215 },
        { enemyId: 'shooter', x: 660, y: 215 },
        { enemyId: 'chaser', x: 310, y: 440 },
        { enemyId: 'dasher', x: 640, y: 420 },
      ],
      [
        { enemyId: 'dasher', x: 240, y: 235 },
        { enemyId: 'dasher', x: 720, y: 405 },
        { enemyId: 'chaser', x: 480, y: 320 },
      ],
    ],
  },
  {
    id: 'low-orbit',
    roomType: 'combat',
    accentColor: 0x4c6c43,
    spawnSets: [
      [
        { enemyId: 'chaser', x: 245, y: 230 },
        { enemyId: 'chaser', x: 715, y: 230 },
        { enemyId: 'chaser', x: 245, y: 410 },
        { enemyId: 'chaser', x: 715, y: 410 },
        { enemyId: 'shooter', x: 480, y: 320 },
      ],
      [
        { enemyId: 'dasher', x: 480, y: 205 },
        { enemyId: 'dasher', x: 480, y: 435 },
        { enemyId: 'shooter', x: 270, y: 320 },
        { enemyId: 'shooter', x: 690, y: 320 },
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

  if (templateId === BOSS_ROOM_TEMPLATE.id) {
    return BOSS_ROOM_TEMPLATE;
  }

  const template = COMBAT_ROOM_TEMPLATES.find((candidate) => candidate.id === templateId);

  if (!template) {
    throw new Error(`Unknown room template: ${templateId}`);
  }

  return template;
}
