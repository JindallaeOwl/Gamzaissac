import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PLAYER_BASE_ATTACK_PROFILE } from '../src/config/gameConfig';

// 공격 프로필에 속성을 추가하고 ItemSystem 병합까지 마쳐도, 전투 코드가 그 속성을
// 읽지 않으면 "정의만 있고 아무 일도 안 하는 아이템"이 된다 — 프리즘 배열이
// 실제로 그런 상태로 출시 직전까지 갔다. 타입 검사는 병합 누락만 잡고 소비
// 누락은 못 잡으므로, 소비 코드 원문에 속성 이름이 등장하는지로 못을 박는다.
//
// 새 속성을 추가하면 이 테스트가 먼저 실패한다. 그때 아래 소비자 목록의 파일
// 중 하나(대부분 Player 또는 Bullet)에서 속성을 실제로 읽는 코드를 구현하라.
const CONSUMER_FILES = [
  'src/entities/Player.ts',
  'src/entities/Bullet.ts',
  'src/scenes/GameScene.ts',
  'src/systems/PlayerStatSystem.ts',
  'src/systems/ItemFeedbackRules.ts',
];

const consumerSources = CONSUMER_FILES.map((path) =>
  readFileSync(new URL(`../${path}`, import.meta.url), 'utf8'),
);

describe('attack profile consumption', () => {
  for (const field of Object.keys(PLAYER_BASE_ATTACK_PROFILE)) {
    it(`${field} is actually read by combat code`, () => {
      expect(
        consumerSources.some((source) => source.includes(field)),
        `${field}가 어떤 전투 코드에서도 읽히지 않는다 — 속성만 있고 효과가 없는 아이템이 된다`,
      ).toBe(true);
    });
  }
});
