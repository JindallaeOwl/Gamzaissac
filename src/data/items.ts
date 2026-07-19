import type { PlayerStats } from '../config/gameConfig';

export type StatModifier = Partial<Omit<PlayerStats, 'health'>> & {
  heal?: number;
};

export interface AttackProfileModifier {
  seedCountAdd?: number;
  spreadStepDegrees?: number;
  overflowPenetration?: boolean;
  seedScaleMultiplier?: number;
  forceRedSeeds?: boolean;
  extraForeheadEyeCountAdd?: number;
  hasToothpickCosmetic?: boolean;
}

export interface PassiveItemDefinition {
  id: string;
  nameKey: string;
  descriptionKey: string;
  tint: number;
  modifiers: StatModifier;
  attackModifiers?: AttackProfileModifier;
  abilityId?: 'charge-beam';
  treasureOnly?: boolean;
  bossOnly?: boolean;
}

export const PASSIVE_ITEMS: PassiveItemDefinition[] = [
  {
    id: 'life-seed',
    nameKey: 'items.lifeSeed.name',
    descriptionKey: 'items.lifeSeed.description',
    tint: 0xff5d72,
    modifiers: { maxHealth: 2, heal: 2 },
    bossOnly: true,
  },
  {
    id: 'quad-shot',
    nameKey: 'items.quadShot.name',
    descriptionKey: 'items.quadShot.description',
    tint: 0xb28cff,
    modifiers: { fireRateMultiplier: 0.42 },
    attackModifiers: { seedCountAdd: 3, spreadStepDegrees: 12, extraForeheadEyeCountAdd: 2 },
  },
  {
    id: 'mega-seed',
    nameKey: 'items.megaSeed.name',
    descriptionKey: 'items.megaSeed.description',
    tint: 0x74c94f,
    modifiers: { damage: 4, damageMultiplier: 2, fireRateMultiplier: 0.42 },
    attackModifiers: { overflowPenetration: true, seedScaleMultiplier: 1.65 },
  },
  {
    id: 'toothpick',
    nameKey: 'items.toothpick.name',
    descriptionKey: 'items.toothpick.description',
    tint: 0xff645e,
    modifiers: { fireRate: 0.7, projectileSpeedMultiplier: 1.16 },
    attackModifiers: { forceRedSeeds: true, hasToothpickCosmetic: true },
  },
  {
    id: 'pulse-relay',
    nameKey: 'items.pulseRelay.name',
    descriptionKey: 'items.pulseRelay.description',
    tint: 0x75f0ff,
    modifiers: { fireRate: 0.55 },
  },
  {
    id: 'glass-fern',
    nameKey: 'items.glassFern.name',
    descriptionKey: 'items.glassFern.description',
    tint: 0x9dff8a,
    modifiers: { damage: 0.45 },
  },
  {
    id: 'feather-coil',
    nameKey: 'items.featherCoil.name',
    descriptionKey: 'items.featherCoil.description',
    tint: 0xffe07a,
    modifiers: { moveSpeed: 34 },
  },
  {
    id: 'hot-pebble',
    nameKey: 'items.hotPebble.name',
    descriptionKey: 'items.hotPebble.description',
    tint: 0xff6b45,
    modifiers: { range: 85, projectileSpeed: 72, damage: 0.15 },
  },
  {
    id: 'pocket-battery',
    nameKey: 'items.pocketBattery.name',
    descriptionKey: 'items.pocketBattery.description',
    tint: 0xc38cff,
    modifiers: { maxHealth: 2, heal: 2 },
  },
  {
    id: 'steady-pin',
    nameKey: 'items.steadyPin.name',
    descriptionKey: 'items.steadyPin.description',
    tint: 0xffffff,
    modifiers: { fireRate: 0.35, projectileSpeed: 40 },
  },
  {
    id: 'moon-dial',
    nameKey: 'items.moonDial.name',
    descriptionKey: 'items.moonDial.description',
    tint: 0x8fd2ff,
    modifiers: { luck: 1 },
  },
  {
    id: 'long-echo',
    nameKey: 'items.longEcho.name',
    descriptionKey: 'items.longEcho.description',
    tint: 0xaef7c3,
    modifiers: { range: 115 },
  },
  {
    id: 'prism-lance',
    nameKey: 'items.prismLance.name',
    descriptionKey: 'items.prismLance.description',
    tint: 0xff7af2,
    modifiers: {},
    abilityId: 'charge-beam',
    treasureOnly: true,
  },
];

export const PRISM_LANCE_ITEM_ID = 'prism-lance';
export const QUAD_SHOT_ITEM_ID = 'quad-shot';
