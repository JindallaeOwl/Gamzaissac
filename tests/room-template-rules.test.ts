import { describe, expect, it } from 'vitest';
import { ENEMY_DEFINITIONS } from '../src/data/enemies';
import { COMBAT_ROOM_TEMPLATES, type RoomTemplate } from '../src/data/rooms';
import { getEnemyEarliestFloor, getEnemyMaxPerRoom } from '../src/systems/EnemyReinforcementRules';
import { getCombatTemplatesForFloor, pickCombatTemplate } from '../src/systems/RoomTemplateRules';

// 템플릿 좌표는 480×272 기준 논리 공간(방 안쪽 32..448 × 32..240)에 적는다.
// 상자(몸 29×27)와 적이 벽에 파묻히지 않도록 중심에 여백을 요구한다.
const OBSTACLE_MARGIN = { left: 48, right: 432, top: 48, bottom: 224 };
const SPAWN_MARGIN = { left: 44, right: 436, top: 44, bottom: 228 };

// 문은 각 벽의 중앙에 있다(상하 x=240, 좌우 y=136). 문 바로 앞이 상자로 막히면
// 방에 들어서자마자 벽을 마주하므로, 문 앞 접근로에는 상자를 두지 않는다.
const DOOR_ZONES = [
  { name: 'top', left: 200, right: 280, top: 32, bottom: 88 },
  { name: 'bottom', left: 200, right: 280, top: 184, bottom: 240 },
  { name: 'left', left: 32, right: 88, top: 96, bottom: 176 },
  { name: 'right', left: 392, right: 448, top: 96, bottom: 176 },
] as const;

function inZone(x: number, y: number, zone: (typeof DOOR_ZONES)[number]): boolean {
  return x >= zone.left && x <= zone.right && y >= zone.top && y <= zone.bottom;
}

describe('combat template data', () => {
  it('gives every template a unique id and at least three spawn sets', () => {
    const ids = COMBAT_ROOM_TEMPLATES.map((template) => template.id);

    expect(new Set(ids).size).toBe(ids.length);

    for (const template of COMBAT_ROOM_TEMPLATES) {
      expect(template.spawnSets.length, template.id).toBeGreaterThanOrEqual(3);

      for (const spawnSet of template.spawnSets) {
        expect(spawnSet.length, template.id).toBeGreaterThan(0);
      }
    }
  });

  // 한 판에 전투방을 약 44개 돌므로, 조합이 이보다 크게 적으면 같은 방을 되풀이해
  // 보게 된다. 조합 36개면 평균 반복이 1.2회로 내려온다. 이 하한이 깨지면 반복
  // 문제(알파 피드백)가 되돌아온 것이다.
  it('keeps at least 36 layout-spawn combinations against the ~44 combat rooms per run', () => {
    const combinations = COMBAT_ROOM_TEMPLATES.reduce(
      (sum, template) => sum + template.spawnSets.length,
      0,
    );

    expect(combinations).toBeGreaterThanOrEqual(36);
  });

  it('keeps every spawn and obstacle inside the room walls', () => {
    for (const template of COMBAT_ROOM_TEMPLATES) {
      for (const spawn of template.spawnSets.flat()) {
        expect(spawn.x, `${template.id} spawn x`).toBeGreaterThanOrEqual(SPAWN_MARGIN.left);
        expect(spawn.x, `${template.id} spawn x`).toBeLessThanOrEqual(SPAWN_MARGIN.right);
        expect(spawn.y, `${template.id} spawn y`).toBeGreaterThanOrEqual(SPAWN_MARGIN.top);
        expect(spawn.y, `${template.id} spawn y`).toBeLessThanOrEqual(SPAWN_MARGIN.bottom);
      }

      for (const obstacle of template.obstacles ?? []) {
        expect(obstacle.x, `${template.id} obstacle x`).toBeGreaterThanOrEqual(
          OBSTACLE_MARGIN.left,
        );
        expect(obstacle.x, `${template.id} obstacle x`).toBeLessThanOrEqual(OBSTACLE_MARGIN.right);
        expect(obstacle.y, `${template.id} obstacle y`).toBeGreaterThanOrEqual(OBSTACLE_MARGIN.top);
        expect(obstacle.y, `${template.id} obstacle y`).toBeLessThanOrEqual(OBSTACLE_MARGIN.bottom);
      }
    }
  });

  it('leaves the approach in front of every door free of obstacles', () => {
    for (const template of COMBAT_ROOM_TEMPLATES) {
      for (const obstacle of template.obstacles ?? []) {
        for (const zone of DOOR_ZONES) {
          expect(
            inZone(obstacle.x, obstacle.y, zone),
            `${template.id} obstacle (${obstacle.x},${obstacle.y}) blocks the ${zone.name} door`,
          ).toBe(false);
        }
      }
    }
  });

  // 상자 충돌 박스(29×27)와 겹친 자리에 적을 배치하면, 방에 들어서는 첫 물리
  // 프레임에 충돌 분리가 일어나 적이 제 자리에서 튕겨 나간다. 입장 안전 로직은
  // 문 근처로 옮겨진 스폰에만 장애물 여유를 적용하므로, 템플릿 원좌표는 여기서
  // 직접 지켜야 한다. (code-review가 잡은 부류)
  it('keeps every spawn clear of obstacle collision boxes', () => {
    const OBSTACLE_HALF_W = 29 / 2;
    const OBSTACLE_HALF_H = 27 / 2;

    for (const template of COMBAT_ROOM_TEMPLATES) {
      for (const spawn of template.spawnSets.flat()) {
        const radius = ENEMY_DEFINITIONS[spawn.enemyId].bodyRadius;

        for (const obstacle of template.obstacles ?? []) {
          const overlaps =
            Math.abs(spawn.x - obstacle.x) < OBSTACLE_HALF_W + radius &&
            Math.abs(spawn.y - obstacle.y) < OBSTACLE_HALF_H + radius;

          expect(
            overlaps,
            `${template.id}: ${spawn.enemyId} (${spawn.x},${spawn.y}) overlaps the crate at (${obstacle.x},${obstacle.y})`,
          ).toBe(false);
        }
      }
    }
  });

  // 층 제한 적을 이른 층 템플릿에 넣으면 minFloor 게이팅이 무의미해진다. 예컨대
  // 소환사가 1층 템플릿에 실리면 5층 제한이 조용히 뚫린다.
  it('never places a gated enemy in a template below its earliest floor', () => {
    for (const template of COMBAT_ROOM_TEMPLATES) {
      const templateFloor = template.minFloor ?? 1;

      for (const spawn of template.spawnSets.flat()) {
        expect(
          getEnemyEarliestFloor(spawn.enemyId),
          `${template.id} places ${spawn.enemyId} but only allows floor ${templateFloor}+`,
        ).toBeLessThanOrEqual(templateFloor);
      }
    }
  });

  // 증원과 동일한 방당 상한이 고정 배치에도 적용된다(플랭커 2·소환사 1).
  it('respects the per-room enemy caps inside every spawn set', () => {
    for (const template of COMBAT_ROOM_TEMPLATES) {
      for (const spawnSet of template.spawnSets) {
        const counts = new Map<string, number>();

        for (const spawn of spawnSet) {
          counts.set(spawn.enemyId, (counts.get(spawn.enemyId) ?? 0) + 1);
        }

        for (const [enemyId, count] of counts) {
          expect(count, `${template.id} places ${count} ${enemyId} in one set`).toBeLessThanOrEqual(
            getEnemyMaxPerRoom(enemyId as Parameters<typeof getEnemyMaxPerRoom>[0]),
          );
        }
      }
    }
  });
});

describe('combat template selection', () => {
  const stub = (id: string, minFloor?: number): RoomTemplate => ({
    id,
    roomType: 'combat',
    accentColor: 0xffffff,
    minFloor,
    spawnSets: [[{ enemyId: 'chaser', x: 240, y: 136 }]],
  });

  it('hides templates until their floor is reached', () => {
    const floors = COMBAT_ROOM_TEMPLATES.map((template) => template.minFloor ?? 1);

    // 게이팅이 실제로 쓰이고 있는지부터 확인한다. 전부 1층이면 이 테스트가 헛돈다.
    expect(Math.max(...floors)).toBeGreaterThan(1);

    for (let floor = 1; floor <= 8; floor += 1) {
      for (const template of getCombatTemplatesForFloor(floor)) {
        expect((template.minFloor ?? 1) <= floor, `${template.id} on floor ${floor}`).toBe(true);
      }
    }
  });

  // 반복 완화는 저층에서도 성립해야 한다. 1층 후보가 너무 적으면 직전 제외를 해도
  // 사실상 몇 개를 돌려막게 된다.
  it('offers at least six templates from floor one', () => {
    expect(getCombatTemplatesForFloor(1).length).toBeGreaterThanOrEqual(6);
  });

  it('never repeats the previous template back-to-back', () => {
    // 난수를 전 구간 훑어, 어떤 값에서도 직전 것이 다시 나오지 않음을 확인한다.
    for (let step = 0; step < 40; step += 1) {
      const random = () => step / 40;

      for (const previous of getCombatTemplatesForFloor(8)) {
        const picked = pickCombatTemplate(8, previous.id, random);

        expect(picked.id).not.toBe(previous.id);
      }
    }
  });

  it('falls back to a repeat only when there is a single candidate', () => {
    const only = stub('lonely');

    expect(pickCombatTemplate(1, 'lonely', () => 0, [only]).id).toBe('lonely');
  });

  it('throws when no template fits the floor', () => {
    expect(() => pickCombatTemplate(1, null, () => 0, [stub('late', 3)])).toThrow();
  });
});
