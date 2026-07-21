import { INVENTORY_TUNING } from '../config/gameConfig';
import { PASSIVE_ITEMS, type PassiveItemDefinition } from '../data/items';
import {
  SHOP_CONSUMABLE_PRODUCTS,
  SHOP_DISCOUNT_CHANCE,
  SHOP_HEART_PRODUCT,
  SHOP_PASSIVE_PRODUCTS,
  calculateShopDiscountPrice,
  getShopProduct,
  type ShopOfferState,
  type ShopProductDefinition,
} from '../data/shop';
import { clamp } from '../utils/math';
import { chance, randomInt, randomOf, shuffled, type RandomSource } from '../utils/random';
import { addConsumable, spendConsumable } from './InventorySystem';
import { isItemAtStackLimit, type ItemAcquisitionResult, type ItemSystem } from './ItemSystem';
import type { RunState } from './RunState';

export type ShopPurchaseResult =
  | { status: 'sold-out' }
  | { status: 'coins-needed'; price: number }
  | { status: 'health-full' }
  | { status: 'resource-full'; product: ShopProductDefinition }
  | { status: 'item-capped'; item: PassiveItemDefinition }
  | { status: 'invalid-product' }
  | {
      status: 'purchased';
      product: ShopProductDefinition;
      item?: PassiveItemDefinition;
      acquisition?: ItemAcquisitionResult;
    };

export class ShopSystem {
  constructor(
    private readonly itemSystem: ItemSystem,
    private readonly random: RandomSource = Math.random,
  ) {}

  createOffers(collectedItemIds: readonly string[]): ShopOfferState[] {
    const unseenPassives = SHOP_PASSIVE_PRODUCTS.filter(
      (product) => {
        if (product.kind !== 'passive') {
          return false;
        }

        const item = PASSIVE_ITEMS.find((candidate) => candidate.id === product.itemId);
        return item ? !isItemAtStackLimit(item, collectedItemIds) : false;
      },
    );
    const passiveProducts = shuffled(unseenPassives, this.random).slice(0, 2);
    const utilityProduct = randomOf(SHOP_CONSUMABLE_PRODUCTS, this.random);
    const products = shuffled(
      [...passiveProducts, SHOP_HEART_PRODUCT, utilityProduct],
      this.random,
    );

    const discountSlot = chance(SHOP_DISCOUNT_CHANCE, this.random)
      ? randomInt(0, products.length - 1, this.random)
      : -1;

    return products.map((product, slot) => ({
      slot,
      productId: product.id,
      price: slot === discountSlot ? calculateShopDiscountPrice(product.price) : product.price,
      discounted: slot === discountSlot,
      purchased: false,
    }));
  }

  forceDiscount(offers: ShopOfferState[]): ShopOfferState | null {
    const existingDiscount = offers.find((offer) => offer.discounted && !offer.purchased);

    if (existingDiscount) {
      return existingDiscount;
    }

    const candidates = offers.filter((offer) => !offer.purchased);

    if (candidates.length === 0) {
      return null;
    }

    const offer = randomOf(candidates, this.random);
    const product = getShopProduct(offer.productId);

    if (!product) {
      return null;
    }

    offer.discounted = true;
    offer.price = calculateShopDiscountPrice(product.price);
    return offer;
  }

  purchase(runState: RunState, offer: ShopOfferState): ShopPurchaseResult {
    if (offer.purchased) {
      return { status: 'sold-out' };
    }

    const product = getShopProduct(offer.productId);

    if (!product) {
      return { status: 'invalid-product' };
    }

    if (product.kind === 'heal' && runState.stats.health >= runState.stats.maxHealth) {
      return { status: 'health-full' };
    }

    if (
      product.kind === 'consumable' &&
      runState.inventory[product.consumable] >= INVENTORY_TUNING.maxConsumable
    ) {
      return { status: 'resource-full', product };
    }

    const passiveItem =
      product.kind === 'passive'
        ? PASSIVE_ITEMS.find((candidate) => candidate.id === product.itemId)
        : undefined;

    if (product.kind === 'passive' && !passiveItem) {
      return { status: 'invalid-product' };
    }

    if (passiveItem && isItemAtStackLimit(passiveItem, runState.collectedItemIds)) {
      return { status: 'item-capped', item: passiveItem };
    }

    const paidInventory = spendConsumable(runState.inventory, 'coins', offer.price);

    if (!paidInventory) {
      return { status: 'coins-needed', price: offer.price };
    }

    runState.inventory = paidInventory;
    offer.purchased = true;

    if (product.kind === 'heal') {
      runState.stats.health = clamp(
        runState.stats.health + product.amount,
        0,
        runState.stats.maxHealth,
      );
      return { status: 'purchased', product };
    }

    if (product.kind === 'consumable') {
      runState.inventory = addConsumable(runState.inventory, product.consumable, product.amount);
      return { status: 'purchased', product };
    }

    if (!passiveItem) {
      // The catalog is invalid. Restore payment and stock instead of silently
      // charging the player for an item that cannot be granted.
      runState.inventory = addConsumable(runState.inventory, 'coins', offer.price);
      offer.purchased = false;
      return { status: 'invalid-product' };
    }

    const acquisition = this.itemSystem.acquireItem(runState, passiveItem);
    return { status: 'purchased', product, item: passiveItem, acquisition };
  }
}
