import { PixelSprite, type EnemySpriteBuilder } from './enemyPixelSprites';

/**
 * 땅속 방 바닥·벽의 임시 흙 타일. 적 스프라이트처럼 굵은 픽셀 느낌이 나도록
 * 8×8 설계 격자에 그리고 2배로 확대해 화면에서는 16×16 타일(설계 1픽셀 = 2×2 블록)이
 * 된다. 베이스 타일은 이어 붙여도 티가 나지 않게 가장자리를 조용하게 두고, 장식
 * 타일(돌·뿌리·균열·습기)은 베이스 위에 얹는 변형이다. 플레이어·적·탄환 가독성을
 * 위해 명암 대비는 낮게 유지한다. 최종 아트로 교체 예정.
 */
export const FLOOR_TILE_DESIGN_SIZE = 8;
export const FLOOR_TILE_SCALE = 2;
// 화면(월드) 기준 타일 한 칸 크기. RoomController의 장식 산재 격자가 이 값을 쓴다.
export const FLOOR_TILE_SIZE = FLOOR_TILE_DESIGN_SIZE * FLOOR_TILE_SCALE;

const SOIL = {
  base: 0x3c2e1f,
  dark: 0x332619,
  darker: 0x281c11,
  light: 0x4a3a26,
  pebble: 0x60564a,
  pebbleShade: 0x453d33,
  root: 0x6e5a3d,
  rootLight: 0x836c4a,
  damp: 0x241a10,
};

// 베이스 흙: 전 픽셀 채움 + 낮은 대비의 알갱이(고정 좌표, 가장자리 제외 = 이음새 억제).
function fillSoil(s: PixelSprite): void {
  for (let y = 0; y < FLOOR_TILE_DESIGN_SIZE; y += 1) {
    for (let x = 0; x < FLOOR_TILE_DESIGN_SIZE; x += 1) {
      s.set(x, y, SOIL.base);
    }
  }

  for (const [x, y] of [
    [2, 1],
    [5, 2],
    [1, 4],
    [6, 5],
    [3, 6],
  ]) {
    s.set(x, y, SOIL.dark);
  }

  for (const [x, y] of [
    [4, 1],
    [2, 3],
    [6, 3],
    [5, 6],
  ]) {
    s.set(x, y, SOIL.light);
  }
}

export const buildSoilBase: EnemySpriteBuilder = (s) => {
  fillSoil(s);
};

export const buildSoilPebbles: EnemySpriteBuilder = (s) => {
  fillSoil(s);
  // 작은 돌: 밝은 윗면 + 아랫면 그늘, 그리고 잔돌 하나.
  s.set(2, 2, SOIL.pebble);
  s.set(3, 2, SOIL.pebble);
  s.set(2, 3, SOIL.pebbleShade);
  s.set(3, 3, SOIL.pebbleShade);
  s.set(5, 5, SOIL.pebble);
  s.set(5, 6, SOIL.pebbleShade);
};

export const buildSoilRoots: EnemySpriteBuilder = (s) => {
  fillSoil(s);
  // 가는 뿌리 한 가닥이 비스듬히 지나간다(가장자리 안쪽에서 시작·끝).
  for (const [x, y] of [
    [1, 1],
    [2, 2],
    [3, 3],
    [4, 3],
    [5, 4],
    [6, 5],
  ]) {
    s.set(x, y, SOIL.root);
  }

  s.set(3, 3, SOIL.rootLight);
};

export const buildSoilCracks: EnemySpriteBuilder = (s) => {
  fillSoil(s);
  // 마른 균열: 지그재그 어두운 선 + 갈라진 가지.
  for (const [x, y] of [
    [4, 1],
    [4, 2],
    [3, 3],
    [3, 4],
    [4, 5],
    [4, 6],
  ]) {
    s.set(x, y, SOIL.darker);
  }

  s.set(2, 3, SOIL.darker);
};

export const buildSoilDamp: EnemySpriteBuilder = (s) => {
  fillSoil(s);
  // 축축하게 젖은 자국: 낮은 대비의 어두운 얼룩.
  for (const [x, y] of [
    [3, 3],
    [4, 3],
    [2, 4],
    [3, 4],
    [4, 4],
    [5, 4],
    [3, 5],
    [4, 5],
  ]) {
    s.set(x, y, SOIL.damp);
  }

  s.set(2, 3, SOIL.dark);
  s.set(5, 5, SOIL.dark);
};

// ── 벽 타일: 아이작류 탑다운의 입체감을 흉내 낸다. 위쪽 벽은 흙 단면(정면)을
// 보여주고, 좌우 벽은 옆면이라 더 어둡게, 아래쪽 벽은 윗면 테두리(캡)가 살짝
// 보이게 밝기를 나눠 "방을 내려다보는" 깊이를 만든다. 물리 충돌과는 무관한 외형 전용.
const WALL = {
  faceBase: 0x342618,
  faceTop: 0x463527,
  faceStrata: 0x241811,
  faceSpeck: 0x40311f,
  faceFoot: 0x1a1109,
  sideBase: 0x2a1e12,
  sideOuter: 0x190f08,
  sideEdge: 0x3e2e1c,
  capTop: 0x483624,
  capMid: 0x392b1a,
  capLine: 0x20150c,
  capBase: 0x271c10,
};

// 위쪽 벽: 정면으로 보이는 흙 단면. 가로 지층 줄무늬 + 바닥과 닿는 발치는 가장 어둡다.
export const buildSoilWallFace: EnemySpriteBuilder = (s) => {
  for (let y = 0; y < FLOOR_TILE_DESIGN_SIZE; y += 1) {
    for (let x = 0; x < FLOOR_TILE_DESIGN_SIZE; x += 1) {
      s.set(x, y, WALL.faceBase);
    }
  }

  for (let x = 0; x < FLOOR_TILE_DESIGN_SIZE; x += 1) {
    s.set(x, 0, WALL.faceTop);
    s.set(x, 3, WALL.faceStrata);
    s.set(x, 7, WALL.faceFoot);
  }

  for (const [x, y] of [
    [2, 1],
    [5, 2],
    [1, 5],
    [6, 5],
  ]) {
    s.set(x, y, WALL.faceSpeck);
  }
};

// 좌우 벽: 옆면이라 전체적으로 어둡고, 방 쪽(오른쪽) 모서리에 얇은 경계선을 준다.
// 오른쪽 벽에는 TileSprite flipX로 뒤집어 쓴다.
export const buildSoilWallSide: EnemySpriteBuilder = (s) => {
  for (let y = 0; y < FLOOR_TILE_DESIGN_SIZE; y += 1) {
    for (let x = 0; x < FLOOR_TILE_DESIGN_SIZE; x += 1) {
      s.set(x, y, WALL.sideBase);
    }
  }

  for (let y = 0; y < FLOOR_TILE_DESIGN_SIZE; y += 1) {
    s.set(0, y, WALL.sideOuter);
    s.set(7, y, WALL.sideEdge);
  }

  s.set(3, 2, WALL.sideOuter);
  s.set(5, 5, WALL.sideOuter);
};

// 아래쪽 벽: 윗면(캡)이 살짝 보이는 턱 — 밝은 윗줄 → 경계선 → 어두운 몸통.
export const buildSoilWallCap: EnemySpriteBuilder = (s) => {
  for (let y = 0; y < FLOOR_TILE_DESIGN_SIZE; y += 1) {
    for (let x = 0; x < FLOOR_TILE_DESIGN_SIZE; x += 1) {
      s.set(x, y, WALL.capBase);
    }
  }

  for (let x = 0; x < FLOOR_TILE_DESIGN_SIZE; x += 1) {
    s.set(x, 0, WALL.capTop);
    s.set(x, 1, WALL.capMid);
    s.set(x, 2, WALL.capLine);
  }

  for (const [x, y] of [
    [2, 4],
    [6, 3],
    [4, 6],
  ]) {
    s.set(x, y, WALL.capLine);
  }
};

export type FloorDecoration = 'pebbles' | 'roots' | 'cracks' | 'damp';

const DECORATIONS: readonly FloorDecoration[] = ['pebbles', 'roots', 'cracks', 'damp'];

// 방 id 같은 문자열을 결정론적 정수 시드로 바꾼다 (FNV-1a 32비트).
export function hashSeed(text: string): number {
  let hash = 0x811c9dc5;

  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }

  return hash >>> 0;
}

/**
 * (column,row) 칸에 얹을 장식 타일을 고른다. 같은 (seed,칸)에는 항상 같은 결과가
 * 나오는 결정론적 규칙이다. 전투 가독성과 출입구 동선을 위해 방 한가운데를 지나는
 * 십자 통로(가운데 열·행 ±1)는 장식 없이 조용하게 비워 둔다. 나머지 칸은 낮은
 * 확률로만 장식이 붙어 바닥이 어수선해지지 않는다.
 */
export function pickFloorDecoration(
  column: number,
  row: number,
  columns: number,
  rows: number,
  seed: number,
): FloorDecoration | null {
  const centerColumn = (columns - 1) / 2;
  const centerRow = (rows - 1) / 2;

  if (Math.abs(column - centerColumn) < 2 || Math.abs(row - centerRow) < 2) {
    return null;
  }

  const hash = (Math.imul(column + 1, 0x9e3779b1) ^ Math.imul(row + 1, 0x85ebca77) ^ seed) >>> 0;

  if (hash % 100 >= 13) {
    return null;
  }

  return DECORATIONS[hash % DECORATIONS.length];
}
