import type { PlayerStats } from '../config/gameConfig';

export type StatModifier = Partial<Omit<PlayerStats, 'health'>> & {
  heal?: number;
};

export interface PassiveItemDefinition {
  id: string;
  nameKey: string;
  descriptionKey: string;
  tint: number;
  modifiers: StatModifier;
  abilityId?: 'charge-beam';
  treasureOnly?: boolean;
}

export const PASSIVE_ITEMS: PassiveItemDefinition[] = [
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

export const TEST_BEAM_ITEM_ID = 'prism-lance';
