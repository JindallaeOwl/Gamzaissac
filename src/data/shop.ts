import type { ConsumableType } from './rewards';

export type ShopProductDefinition =
  | {
      id: string;
      kind: 'passive';
      itemId: string;
      price: number;
    }
  | {
      id: string;
      kind: 'heal';
      amount: number;
      price: number;
      nameKey: string;
      descriptionKey: string;
    }
  | {
      id: string;
      kind: 'consumable';
      consumable: Extract<ConsumableType, 'keys' | 'bombs'>;
      amount: number;
      price: number;
      nameKey: string;
      descriptionKey: string;
    };

export interface ShopOfferState {
  slot: number;
  productId: string;
  price: number;
  discounted: boolean;
  purchased: boolean;
}

export const SHOP_PASSIVE_PRODUCTS: readonly ShopProductDefinition[] = [
  { id: 'shop-pulse-relay', kind: 'passive', itemId: 'pulse-relay', price: 15 },
  { id: 'shop-glass-fern', kind: 'passive', itemId: 'glass-fern', price: 15 },
  { id: 'shop-feather-coil', kind: 'passive', itemId: 'feather-coil', price: 12 },
  { id: 'shop-hot-pebble', kind: 'passive', itemId: 'hot-pebble', price: 15 },
  { id: 'shop-pocket-battery', kind: 'passive', itemId: 'pocket-battery', price: 15 },
  { id: 'shop-steady-pin', kind: 'passive', itemId: 'steady-pin', price: 15 },
  { id: 'shop-moon-dial', kind: 'passive', itemId: 'moon-dial', price: 12 },
  { id: 'shop-long-echo', kind: 'passive', itemId: 'long-echo', price: 12 },
  { id: 'shop-toothpick', kind: 'passive', itemId: 'toothpick', price: 18 },
] as const;

export const SHOP_HEART_PRODUCT: ShopProductDefinition = {
  id: 'shop-full-heart',
  kind: 'heal',
  amount: 2,
  price: 5,
  nameKey: 'shop.products.heart.name',
  descriptionKey: 'shop.products.heart.description',
};

export const SHOP_CONSUMABLE_PRODUCTS: readonly ShopProductDefinition[] = [
  {
    id: 'shop-key',
    kind: 'consumable',
    consumable: 'keys',
    amount: 1,
    price: 5,
    nameKey: 'shop.products.key.name',
    descriptionKey: 'shop.products.key.description',
  },
  {
    id: 'shop-bomb',
    kind: 'consumable',
    consumable: 'bombs',
    amount: 1,
    price: 5,
    nameKey: 'shop.products.bomb.name',
    descriptionKey: 'shop.products.bomb.description',
  },
] as const;

export const SHOP_PRODUCTS: readonly ShopProductDefinition[] = [
  ...SHOP_PASSIVE_PRODUCTS,
  SHOP_HEART_PRODUCT,
  ...SHOP_CONSUMABLE_PRODUCTS,
];

export const SHOP_OFFER_POSITIONS = [
  { x: 128, y: 164 },
  { x: 202, y: 164 },
  { x: 278, y: 164 },
  { x: 352, y: 164 },
] as const;

export const SHOP_NPC_POSITION = { x: 240, y: 90 } as const;
export const SHOP_NPC_DISPLAY_SIZE = 64;
export const SHOP_INTERACTION_RADIUS = 44;
export const SHOP_DISCOUNT_CHANCE = 0.3;
export const SHOP_DISCOUNT_RATE = 0.5;

export function calculateShopDiscountPrice(price: number): number {
  return Math.max(1, Math.floor(price * SHOP_DISCOUNT_RATE));
}

export function getShopProduct(productId: string): ShopProductDefinition | undefined {
  return SHOP_PRODUCTS.find((product) => product.id === productId);
}
