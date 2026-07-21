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

export type ItemRarity = 'common' | 'uncommon' | 'rare' | 'legendary';
export type ItemCategory = 'offense' | 'defense' | 'utility' | 'resource';
export type ItemDropSource = 'combat' | 'shop' | 'treasure' | 'boss';

export interface ItemDropTable {
  dropChance: number;
  rarityWeights: Record<ItemRarity, number>;
}

export interface PassiveItemDefinition {
  /** Shared catalog number used by both passive and future active items. */
  itemNumber: number;
  id: string;
  nameKey: string;
  descriptionKey: string;
  tint: number;
  rarity: ItemRarity;
  category: ItemCategory;
  /** One means unique. Values above one allow that many stat stacks. */
  maxStacks: number;
  dropSources: readonly ItemDropSource[];
  modifiers: StatModifier;
  attackModifiers?: AttackProfileModifier;
  abilityId?: 'charge-beam';
}

export interface ItemSynergyDefinition {
  id: string;
  nameKey: string;
  requiredItemIds: readonly string[];
  modifiers: StatModifier;
  attackModifiers?: AttackProfileModifier;
}

export const ITEM_DROP_TABLES: Record<ItemDropSource, ItemDropTable> = {
  combat: {
    dropChance: 0.18,
    rarityWeights: { common: 64, uncommon: 28, rare: 7, legendary: 1 },
  },
  shop: {
    dropChance: 1,
    rarityWeights: { common: 52, uncommon: 36, rare: 12, legendary: 0 },
  },
  treasure: {
    dropChance: 1,
    rarityWeights: { common: 0, uncommon: 48, rare: 37, legendary: 15 },
  },
  boss: {
    dropChance: 1,
    rarityWeights: { common: 30, uncommon: 35, rare: 35, legendary: 0 },
  },
};

export const PASSIVE_ITEMS: PassiveItemDefinition[] = [
  {
    itemNumber: 1,
    id: 'red-mushroom',
    nameKey: 'items.redMushroom.name',
    descriptionKey: 'items.redMushroom.description',
    tint: 0xff5d72,
    rarity: 'rare',
    category: 'defense',
    maxStacks: 1,
    dropSources: ['boss'],
    modifiers: { maxHealth: 2, heal: 2 },
  },
  {
    itemNumber: 2,
    id: 'quad-shot',
    nameKey: 'items.quadShot.name',
    descriptionKey: 'items.quadShot.description',
    tint: 0xb28cff,
    rarity: 'rare',
    category: 'offense',
    maxStacks: 1,
    dropSources: ['combat', 'treasure'],
    modifiers: { fireRateMultiplier: 0.42 },
    attackModifiers: { seedCountAdd: 3, spreadStepDegrees: 12, extraForeheadEyeCountAdd: 2 },
  },
  {
    itemNumber: 3,
    id: 'mega-seed',
    nameKey: 'items.megaSeed.name',
    descriptionKey: 'items.megaSeed.description',
    tint: 0x74c94f,
    rarity: 'legendary',
    category: 'offense',
    maxStacks: 1,
    dropSources: ['combat', 'treasure'],
    modifiers: { damage: 4, damageMultiplier: 2, fireRateMultiplier: 0.42 },
    attackModifiers: { overflowPenetration: true, seedScaleMultiplier: 1.65 },
  },
  {
    itemNumber: 4,
    id: 'toothpick',
    nameKey: 'items.toothpick.name',
    descriptionKey: 'items.toothpick.description',
    tint: 0xff645e,
    rarity: 'uncommon',
    category: 'offense',
    maxStacks: 1,
    dropSources: ['combat', 'shop', 'treasure'],
    modifiers: { fireRate: 0.7, projectileSpeedMultiplier: 1.16 },
    attackModifiers: { forceRedSeeds: true, hasToothpickCosmetic: true },
  },
  {
    itemNumber: 5,
    id: 'pulse-relay',
    nameKey: 'items.pulseRelay.name',
    descriptionKey: 'items.pulseRelay.description',
    tint: 0x75f0ff,
    rarity: 'common',
    category: 'offense',
    maxStacks: 4,
    dropSources: ['combat', 'shop', 'boss'],
    modifiers: { fireRate: 0.55 },
  },
  {
    itemNumber: 6,
    id: 'glass-fern',
    nameKey: 'items.glassFern.name',
    descriptionKey: 'items.glassFern.description',
    tint: 0x9dff8a,
    rarity: 'common',
    category: 'offense',
    maxStacks: 4,
    dropSources: ['combat', 'shop', 'boss'],
    modifiers: { damage: 0.45 },
  },
  {
    itemNumber: 7,
    id: 'feather-coil',
    nameKey: 'items.featherCoil.name',
    descriptionKey: 'items.featherCoil.description',
    tint: 0xffe07a,
    rarity: 'common',
    category: 'utility',
    maxStacks: 4,
    dropSources: ['combat', 'shop', 'boss'],
    modifiers: { moveSpeed: 34 },
  },
  {
    itemNumber: 8,
    id: 'hot-pebble',
    nameKey: 'items.hotPebble.name',
    descriptionKey: 'items.hotPebble.description',
    tint: 0xff6b45,
    rarity: 'uncommon',
    category: 'offense',
    maxStacks: 3,
    dropSources: ['combat', 'shop', 'treasure', 'boss'],
    modifiers: { range: 85, projectileSpeed: 72, damage: 0.15 },
  },
  {
    itemNumber: 9,
    id: 'pocket-battery',
    nameKey: 'items.pocketBattery.name',
    descriptionKey: 'items.pocketBattery.description',
    tint: 0xc38cff,
    rarity: 'uncommon',
    category: 'defense',
    maxStacks: 2,
    dropSources: ['combat', 'shop', 'treasure'],
    modifiers: { maxHealth: 2, heal: 2 },
  },
  {
    itemNumber: 10,
    id: 'steady-pin',
    nameKey: 'items.steadyPin.name',
    descriptionKey: 'items.steadyPin.description',
    tint: 0xffffff,
    rarity: 'common',
    category: 'offense',
    maxStacks: 4,
    dropSources: ['combat', 'shop', 'boss'],
    modifiers: { fireRate: 0.35, projectileSpeed: 40 },
  },
  {
    itemNumber: 11,
    id: 'moon-dial',
    nameKey: 'items.moonDial.name',
    descriptionKey: 'items.moonDial.description',
    tint: 0x8fd2ff,
    rarity: 'uncommon',
    category: 'resource',
    maxStacks: 3,
    dropSources: ['combat', 'shop', 'treasure', 'boss'],
    modifiers: { luck: 1 },
  },
  {
    itemNumber: 12,
    id: 'long-echo',
    nameKey: 'items.longEcho.name',
    descriptionKey: 'items.longEcho.description',
    tint: 0xaef7c3,
    rarity: 'common',
    category: 'offense',
    maxStacks: 4,
    dropSources: ['combat', 'shop', 'boss'],
    modifiers: { range: 115 },
  },
  {
    itemNumber: 13,
    id: 'prism-lance',
    nameKey: 'items.prismLance.name',
    descriptionKey: 'items.prismLance.description',
    tint: 0xff7af2,
    rarity: 'legendary',
    category: 'offense',
    maxStacks: 1,
    dropSources: ['treasure'],
    modifiers: {},
    abilityId: 'charge-beam',
  },
  {
    itemNumber: 14,
    id: 'seed-pouch',
    nameKey: 'items.seedPouch.name',
    descriptionKey: 'items.seedPouch.description',
    tint: 0xd7b46a,
    rarity: 'common',
    category: 'offense',
    maxStacks: 5,
    dropSources: ['combat', 'shop'],
    modifiers: { damage: 0.25, projectileSpeed: 18 },
  },
  {
    itemNumber: 15,
    id: 'bark-vest',
    nameKey: 'items.barkVest.name',
    descriptionKey: 'items.barkVest.description',
    tint: 0x9b7048,
    rarity: 'common',
    category: 'defense',
    maxStacks: 3,
    dropSources: ['combat', 'shop'],
    modifiers: { maxHealth: 1, heal: 1 },
  },
  {
    itemNumber: 16,
    id: 'runner-roots',
    nameKey: 'items.runnerRoots.name',
    descriptionKey: 'items.runnerRoots.description',
    tint: 0x7edb78,
    rarity: 'common',
    category: 'utility',
    maxStacks: 4,
    dropSources: ['combat', 'shop'],
    modifiers: { moveSpeed: 18 },
  },
  {
    itemNumber: 17,
    id: 'clover-sprout',
    nameKey: 'items.cloverSprout.name',
    descriptionKey: 'items.cloverSprout.description',
    tint: 0x55d77b,
    rarity: 'common',
    category: 'resource',
    maxStacks: 4,
    dropSources: ['combat', 'shop'],
    modifiers: { luck: 0.5 },
  },
  {
    itemNumber: 18,
    id: 'scope-lens',
    nameKey: 'items.scopeLens.name',
    descriptionKey: 'items.scopeLens.description',
    tint: 0x76b8ff,
    rarity: 'uncommon',
    category: 'offense',
    maxStacks: 3,
    dropSources: ['combat', 'shop', 'treasure'],
    modifiers: { range: 55, projectileSpeed: 35 },
  },
  {
    itemNumber: 19,
    id: 'thorn-crown',
    nameKey: 'items.thornCrown.name',
    descriptionKey: 'items.thornCrown.description',
    tint: 0xd66f79,
    rarity: 'uncommon',
    category: 'offense',
    maxStacks: 1,
    dropSources: ['combat', 'treasure'],
    modifiers: { damage: 1.1, maxHealth: -1 },
  },
  {
    itemNumber: 20,
    id: 'rain-boots',
    nameKey: 'items.rainBoots.name',
    descriptionKey: 'items.rainBoots.description',
    tint: 0x4ec5dc,
    rarity: 'uncommon',
    category: 'utility',
    maxStacks: 1,
    dropSources: ['combat', 'shop', 'treasure'],
    modifiers: { moveSpeed: 42, range: 25 },
  },
  {
    itemNumber: 21,
    id: 'amber-heart',
    nameKey: 'items.amberHeart.name',
    descriptionKey: 'items.amberHeart.description',
    tint: 0xffa94d,
    rarity: 'rare',
    category: 'defense',
    maxStacks: 2,
    dropSources: ['treasure', 'boss'],
    modifiers: { maxHealth: 4, heal: 2 },
  },
  {
    itemNumber: 22,
    id: 'overclock-bulb',
    nameKey: 'items.overclockBulb.name',
    descriptionKey: 'items.overclockBulb.description',
    tint: 0xffde59,
    rarity: 'rare',
    category: 'offense',
    maxStacks: 1,
    dropSources: ['treasure'],
    modifiers: { fireRateMultiplier: 1.28, projectileSpeedMultiplier: 1.18 },
  },
  {
    itemNumber: 23,
    id: 'lucky-ledger',
    nameKey: 'items.luckyLedger.name',
    descriptionKey: 'items.luckyLedger.description',
    tint: 0xf3d35b,
    rarity: 'rare',
    category: 'resource',
    maxStacks: 1,
    dropSources: ['shop', 'treasure'],
    modifiers: { luck: 2, moveSpeed: 12 },
  },
  {
    itemNumber: 24,
    id: 'iron-husk',
    nameKey: 'items.ironHusk.name',
    descriptionKey: 'items.ironHusk.description',
    tint: 0x9ba7b4,
    rarity: 'uncommon',
    category: 'defense',
    maxStacks: 3,
    dropSources: ['combat', 'shop'],
    modifiers: { maxHealth: 2, heal: 1, moveSpeed: -8 },
  },
  {
    itemNumber: 25,
    id: 'star-fertilizer',
    nameKey: 'items.starFertilizer.name',
    descriptionKey: 'items.starFertilizer.description',
    tint: 0xff9df1,
    rarity: 'rare',
    category: 'offense',
    maxStacks: 2,
    dropSources: ['treasure', 'boss'],
    modifiers: { damageMultiplier: 1.35, range: 35 },
  },
];

export const ITEM_SYNERGIES: readonly ItemSynergyDefinition[] = [
  {
    id: 'prism-array',
    nameKey: 'synergies.prismArray',
    requiredItemIds: ['quad-shot', 'prism-lance'],
    modifiers: {},
  },
  {
    id: 'glass-horizon',
    nameKey: 'synergies.glassHorizon',
    requiredItemIds: ['glass-fern', 'long-echo'],
    modifiers: { damage: 0.55, range: 45 },
  },
  {
    id: 'tuned-circuit',
    nameKey: 'synergies.tunedCircuit',
    requiredItemIds: ['pulse-relay', 'steady-pin'],
    modifiers: { fireRate: 0.4, projectileSpeed: 30 },
  },
  {
    id: 'backup-shell',
    nameKey: 'synergies.backupShell',
    requiredItemIds: ['pocket-battery', 'bark-vest'],
    modifiers: { maxHealth: 2, heal: 2 },
  },
  {
    id: 'compound-luck',
    nameKey: 'synergies.compoundLuck',
    requiredItemIds: ['clover-sprout', 'lucky-ledger'],
    modifiers: { luck: 2 },
  },
  {
    id: 'meteor-seed',
    nameKey: 'synergies.meteorSeed',
    requiredItemIds: ['hot-pebble', 'mega-seed'],
    modifiers: { damage: 0.75, projectileSpeed: 60 },
    attackModifiers: { seedScaleMultiplier: 1.15 },
  },
];

export const PRISM_LANCE_ITEM_ID = 'prism-lance';
export const QUAD_SHOT_ITEM_ID = 'quad-shot';

export function formatItemNumber(itemNumber: number): string {
  return `ID: ${itemNumber.toString().padStart(3, '0')}`;
}

export function findItemByReference(reference: string): PassiveItemDefinition | undefined {
  if (/^\d+$/.test(reference)) {
    const itemNumber = Number(reference);
    return PASSIVE_ITEMS.find((item) => item.itemNumber === itemNumber);
  }

  return PASSIVE_ITEMS.find((item) => item.id === reference);
}
