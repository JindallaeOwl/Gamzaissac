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
  /** 빔 차징 시간 배율(곱). 프로필 속성이므로 어떤 아이템·시너지든 줄일 수 있다 */
  beamChargeMsMultiplier?: number;
}

export type ItemRarity = 'common' | 'uncommon' | 'rare' | 'legendary';
export type ItemCategory = 'offense' | 'defense' | 'utility' | 'resource';
export type ItemDropSource = 'combat' | 'shop' | 'treasure' | 'boss';

// 획득 연출 등에 쓰는 분류 색. 분류 타입 옆에 두어, UI 쪽에 두 번째 매핑이 생겨
// 서로 어긋나는 일을 막는다. 공격=주홍, 방어=초록, 보조=하늘, 자원=금.
// 개별 tint 필드를 쓰지 않는 이유: tint는 배지 아이콘 시절의 유물로, 지금의
// 손도트 아이콘 색과 무관하다. 연출은 "어떤 분류를 먹었나"를 가르치는 것이
// 목적이라 아이템별 색보다 분류 색이 맞다.
export const ITEM_CATEGORY_COLORS: Record<ItemCategory, number> = {
  offense: 0xff7a5c,
  defense: 0x7ed98a,
  utility: 0x7ab8ff,
  resource: 0xffd166,
};

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
  /** 발동 알림에 보여 줄 효과 설명. 발동이 화면에 전달되지 않으면 시너지는
      없는 것과 같으므로, 모든 시너지는 설명을 반드시 갖는다(테스트로 강제). */
  descriptionKey: string;
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
  // Items from here on carry hand-pixeled icons (see systems/itemPixelIcons.ts).
  {
    itemNumber: 26,
    id: 'twin-seed',
    nameKey: 'items.twinSeed.name',
    descriptionKey: 'items.twinSeed.description',
    tint: 0xf6e0a0,
    rarity: 'common',
    category: 'offense',
    // Unique on purpose. Stacking put a common item's single-target damage
    // above the rare Quad Shot, which pays a large fire-rate cost for its fan.
    maxStacks: 1,
    dropSources: ['combat', 'shop'],
    modifiers: { damage: -0.15 },
    attackModifiers: { seedCountAdd: 1, spreadStepDegrees: 9 },
  },
  {
    itemNumber: 27,
    id: 'soil-glove',
    nameKey: 'items.soilGlove.name',
    descriptionKey: 'items.soilGlove.description',
    tint: 0xd9a45c,
    rarity: 'common',
    category: 'offense',
    maxStacks: 3,
    dropSources: ['combat', 'shop'],
    modifiers: { damage: 0.35, luck: 0.5 },
  },
  {
    itemNumber: 28,
    id: 'heavy-gravel',
    nameKey: 'items.heavyGravel.name',
    descriptionKey: 'items.heavyGravel.description',
    tint: 0x7d8794,
    rarity: 'uncommon',
    category: 'offense',
    maxStacks: 2,
    dropSources: ['combat', 'treasure'],
    modifiers: { damage: 0.8, projectileSpeed: -25 },
    attackModifiers: { seedScaleMultiplier: 1.3 },
  },
  {
    itemNumber: 29,
    id: 'thin-rind',
    nameKey: 'items.thinRind.name',
    descriptionKey: 'items.thinRind.description',
    tint: 0xe8c07a,
    rarity: 'uncommon',
    category: 'utility',
    maxStacks: 1,
    dropSources: ['combat', 'shop'],
    modifiers: { moveSpeed: 30, fireRate: 0.3, maxHealth: -2 },
  },
  {
    itemNumber: 30,
    id: 'silver-dew',
    nameKey: 'items.silverDew.name',
    descriptionKey: 'items.silverDew.description',
    tint: 0x9fd0ec,
    rarity: 'uncommon',
    category: 'resource',
    maxStacks: 2,
    dropSources: ['combat', 'shop', 'treasure'],
    modifiers: { luck: 1.5, heal: 2 },
  },
  {
    itemNumber: 31,
    id: 'spike-rind',
    nameKey: 'items.spikeRind.name',
    descriptionKey: 'items.spikeRind.description',
    tint: 0x8fae5f,
    rarity: 'uncommon',
    category: 'defense',
    maxStacks: 2,
    dropSources: ['combat', 'boss'],
    modifiers: { damage: 0.6, maxHealth: 1, heal: 1, moveSpeed: -14 },
  },
  {
    itemNumber: 32,
    id: 'deep-root',
    nameKey: 'items.deepRoot.name',
    descriptionKey: 'items.deepRoot.description',
    tint: 0x9c6a2e,
    rarity: 'rare',
    category: 'defense',
    maxStacks: 1,
    dropSources: ['treasure', 'boss'],
    modifiers: { maxHealth: 2, heal: 2, range: 30, moveSpeed: -10 },
  },
  {
    itemNumber: 33,
    id: 'bore-awl',
    nameKey: 'items.boreAwl.name',
    descriptionKey: 'items.boreAwl.description',
    tint: 0x94a1b5,
    rarity: 'rare',
    category: 'offense',
    maxStacks: 1,
    dropSources: ['treasure', 'shop'],
    modifiers: { fireRate: -0.15, projectileSpeed: 25 },
    attackModifiers: { overflowPenetration: true },
  },
];

export const ITEM_SYNERGIES: readonly ItemSynergyDefinition[] = [
  {
    id: 'prism-array',
    nameKey: 'synergies.prismArray.name',
    descriptionKey: 'synergies.prismArray.description',
    requiredItemIds: ['quad-shot', 'prism-lance'],
    modifiers: {},
    // 빔과 같은 방향의 씨앗 동시 발사는 관통 빔과 겹쳐 낭비라는 플레이 피드백으로
    // 폐기했다(2026-08-16). 차징 단축은 매 발사마다 체감된다.
    attackModifiers: { beamChargeMsMultiplier: 0.7 },
  },
  {
    id: 'glass-horizon',
    nameKey: 'synergies.glassHorizon.name',
    descriptionKey: 'synergies.glassHorizon.description',
    requiredItemIds: ['glass-fern', 'long-echo'],
    modifiers: { damage: 0.55, range: 45 },
  },
  {
    id: 'tuned-circuit',
    nameKey: 'synergies.tunedCircuit.name',
    descriptionKey: 'synergies.tunedCircuit.description',
    requiredItemIds: ['pulse-relay', 'steady-pin'],
    modifiers: { fireRate: 0.4, projectileSpeed: 30 },
  },
  {
    id: 'backup-shell',
    nameKey: 'synergies.backupShell.name',
    descriptionKey: 'synergies.backupShell.description',
    requiredItemIds: ['pocket-battery', 'bark-vest'],
    modifiers: { maxHealth: 2, heal: 2 },
  },
  {
    id: 'compound-luck',
    nameKey: 'synergies.compoundLuck.name',
    descriptionKey: 'synergies.compoundLuck.description',
    requiredItemIds: ['clover-sprout', 'lucky-ledger'],
    modifiers: { luck: 2 },
  },
  {
    id: 'meteor-seed',
    nameKey: 'synergies.meteorSeed.name',
    descriptionKey: 'synergies.meteorSeed.description',
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
