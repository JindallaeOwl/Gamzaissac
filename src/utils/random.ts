export type RandomSource = () => number;

/**
 * 시드로 재현 가능한 난수원(mulberry32).
 *
 * 같은 시드로 만들면 언제나 같은 순서의 값이 나온다. 방을 다시 들어올 때마다 새로
 * 그리는 자국·무늬처럼, "무작위처럼 보이되 매번 같아야 하는" 그림에 쓴다.
 */
export function createSeededRandom(seed: number): RandomSource {
  let state = seed >>> 0;

  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function randomOf<T>(items: readonly T[], random: RandomSource = Math.random): T {
  if (items.length === 0) {
    throw new Error('Cannot select a random item from an empty collection.');
  }

  return items[Math.floor(random() * items.length)];
}

export function chance(probability: number, random: RandomSource = Math.random): boolean {
  return random() < probability;
}

export function shuffled<T>(items: readonly T[], random: RandomSource = Math.random): T[] {
  const copy = [...items];

  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }

  return copy;
}

export function randomInt(
  minInclusive: number,
  maxInclusive: number,
  random: RandomSource = Math.random,
): number {
  const span = maxInclusive - minInclusive + 1;
  return minInclusive + Math.floor(random() * span);
}
