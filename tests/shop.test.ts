import { describe, expect, it } from 'vitest';
import { calculateShopDiscountPrice, getShopProduct } from '../src/data/shop';
import { ItemSystem } from '../src/systems/ItemSystem';
import { ShopSystem } from '../src/systems/ShopSystem';
import { createInitialRunState } from '../src/systems/RunState';

describe('ShopSystem', () => {
  it('creates four persistent offer states with two passives, one heart, and one utility', () => {
    const system = new ShopSystem(new ItemSystem(() => 0), () => 0);

    const offers = system.createOffers([]);

    expect(offers).toHaveLength(4);
    expect(new Set(offers.map((offer) => offer.productId)).size).toBe(4);
    expect(offers.filter((offer) => offer.productId.startsWith('shop-')).length).toBe(4);
    expect(offers.some((offer) => offer.productId === 'shop-full-heart')).toBe(true);
    expect(
      offers.some((offer) => offer.productId === 'shop-key' || offer.productId === 'shop-bomb'),
    ).toBe(true);
    expect(offers.filter((offer) => offer.discounted)).toHaveLength(1);
  });

  it('rounds a 50% discount down to a whole coin', () => {
    expect(calculateShopDiscountPrice(15)).toBe(7);
    expect(calculateShopDiscountPrice(5)).toBe(2);
  });

  it('discounts at most one random offer and keeps the other prices unchanged', () => {
    const system = new ShopSystem(new ItemSystem(() => 0), () => 0);
    const offers = system.createOffers([]);
    const discountedOffers = offers.filter((offer) => offer.discounted);

    expect(discountedOffers).toHaveLength(1);

    for (const offer of offers) {
      const product = getShopProduct(offer.productId)!;
      expect(offer.price).toBe(
        offer.discounted ? calculateShopDiscountPrice(product.price) : product.price,
      );
    }
  });

  it('can generate a shop without a discount when the chance roll fails', () => {
    const system = new ShopSystem(new ItemSystem(() => 0.999999), () => 0.999999);

    expect(system.createOffers([]).some((offer) => offer.discounted)).toBe(false);
  });

  it('can force a discount on one available offer for developer testing', () => {
    const system = new ShopSystem(new ItemSystem(() => 0.999999), () => 0.999999);
    const offers = system.createOffers([]);

    expect(offers.some((offer) => offer.discounted)).toBe(false);
    const discounted = system.forceDiscount(offers);

    expect(discounted).not.toBeNull();
    expect(discounted?.discounted).toBe(true);
    expect(offers.filter((offer) => offer.discounted)).toHaveLength(1);
  });

  it('does not charge coins when the player cannot afford an offer', () => {
    const system = new ShopSystem(new ItemSystem(() => 0), () => 0);
    const state = createInitialRunState();
    const offer = {
      slot: 0,
      productId: 'shop-glass-fern',
      price: 15,
      discounted: false,
      purchased: false,
    };

    expect(system.purchase(state, offer)).toEqual({ status: 'coins-needed', price: 15 });
    expect(state.inventory.coins).toBe(0);
    expect(offer.purchased).toBe(false);
    expect(state.collectedItemIds).toHaveLength(0);
  });

  it('charges coins once, grants the passive, and marks the offer purchased', () => {
    const itemSystem = new ItemSystem(() => 0);
    const system = new ShopSystem(itemSystem, () => 0);
    const state = createInitialRunState();
    state.inventory.coins = 20;
    const offer = {
      slot: 0,
      productId: 'shop-glass-fern',
      price: 15,
      discounted: false,
      purchased: false,
    };

    expect(system.purchase(state, offer).status).toBe('purchased');
    expect(state.inventory.coins).toBe(5);
    expect(state.collectedItemIds).toEqual(['glass-fern']);
    expect(offer.purchased).toBe(true);

    expect(system.purchase(state, offer)).toEqual({ status: 'sold-out' });
    expect(state.inventory.coins).toBe(5);
  });

  it('does not sell healing when health is already full', () => {
    const system = new ShopSystem(new ItemSystem(() => 0), () => 0);
    const state = createInitialRunState();
    state.inventory.coins = 10;
    const offer = {
      slot: 0,
      productId: 'shop-full-heart',
      price: 5,
      discounted: false,
      purchased: false,
    };

    expect(system.purchase(state, offer)).toEqual({ status: 'health-full' });
    expect(state.inventory.coins).toBe(10);
    expect(offer.purchased).toBe(false);
  });
});
