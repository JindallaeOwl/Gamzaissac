import { createSeededRandom } from '../utils/random';

export interface AutumnPixel {
  x: number;
  y: number;
  width: number;
  height: number;
  color: number;
}

/** 고정 시드로 숲을 그려 타이틀로 돌아올 때마다 풍경이 바뀌지 않게 한다. */
export function buildAutumnForest(): AutumnPixel[] {
  const pixels: AutumnPixel[] = [];
  const random = createSeededRandom(202609);
  const rect = (x: number, y: number, width: number, height: number, color: number) => {
    pixels.push({
      x: Math.round(x),
      y: Math.round(y),
      width: Math.ceil(width),
      height: Math.ceil(height),
      color,
    });
  };
  const mix = (a: number, b: number, fraction: number) => {
    const channel = (shift: number) =>
      Math.round(((a >> shift) & 255) * (1 - fraction) + ((b >> shift) & 255) * fraction);
    return (channel(16) << 16) | (channel(8) << 8) | channel(0);
  };
  for (let y = 0; y < 180; y += 2) rect(0, y, 480, 2, mix(0x675052, 0xf5ca81, y / 180));
  // 해의 윤곽도 계단 모양으로 그려 기존 저해상도 픽셀 그림과 어울리게 한다.
  rect(222, 83, 36, 32, 0xf5d799);
  rect(216, 89, 48, 20, 0xf5d799);
  rect(229, 87, 22, 24, 0xffe8ad);

  const crown = (x: number, y: number, radius: number, colors: number[], cell: number) => {
    for (let row = -radius; row <= radius; row += cell) {
      for (let col = -radius; col <= radius; col += cell) {
        const distance = (col * col) / (radius * radius) + (row * row) / (radius * radius * 0.62);
        if (distance > 0.92 + random() * 0.24) continue;
        const light = random() + (col < 0 && row < 0 ? 0.22 : 0);
        const color = colors[Math.min(colors.length - 1, Math.floor(light * colors.length))];
        rect(x + col, y + row, cell + 1, cell + 1, color);
      }
    }
  };

  for (let layer = 0; layer < 3; layer += 1) {
    const ground = 153 + layer * 16;
    const colors = [
      [0xa98460, 0xb58d62, 0xc29967],
      [0x906340, 0xa06f3e, 0xb37c40],
      [0x705035, 0x8b5b32, 0x99642e],
    ][layer];
    for (let x = -15; x < 500; x += 22 + random() * 13) {
      const height = 24 + random() * 29;
      rect(x, ground - height, 3 + layer, height + 8, colors[0]);
      crown(x, ground - height, 16 + layer * 5, colors, 4);
    }
    rect(0, ground, 480, 22, colors[0]);
  }

  // 멀리서 좁고 앞에서 넓어지는 길을 밝게 남겨 시선이 중앙을 향하게 한다.
  for (let y = 177; y < 272; y += 2) {
    const depth = (y - 177) / 95;
    rect(0, y, 480, 2, mix(0x6b563a, 0x302f24, depth));
    const center = 239 + Math.sin(depth * 5) * 17;
    const width = 20 + depth * depth * 183;
    rect(center - width / 2, y, width, 2, mix(0xb58c50, 0x775131, depth));
  }

  for (let i = 0; i < 1300; i += 1) {
    const x = random() * 480;
    const y = 177 + random() * 95;
    const depth = (y - 177) / 95;
    const center = 239 + Math.sin(depth * 5) * 17;
    const onPath = Math.abs(x - center) < (20 + depth * depth * 183) / 2;
    const palette = onPath
      ? [0xc4964b, 0xe3b665, 0x956538, 0x6d492e]
      : [0x896034, 0xaa6d2e, 0x4c452b, 0x383725, 0xc28a3b];
    rect(x, y, 1 + depth * 4, 1 + depth, palette[Math.floor(random() * palette.length)]);
  }

  const tree = (x: number, base: number, height: number, width: number, birch = false) => {
    const top = base - height;
    rect(x - width / 2 + 4, base, width * 2, 4, 0x302b22);
    rect(x - width / 2, top, width, height, birch ? 0xb9ac87 : 0x432d23);
    rect(x - width / 2, top, width / 4, height, birch ? 0xe0c9a0 : 0x765035);
    for (let y = top + 5; y < base; y += 11) {
      rect(
        x - width / 2 + (random() * width) / 2,
        y,
        Math.max(2, width / 3),
        birch ? 2 : 7,
        birch ? 0x554638 : 0x35281f,
      );
    }
    for (let branch = 0; branch < 2; branch += 1) {
      const sign = branch === 0 ? -1 : 1;
      for (let j = 0; j < 6; j += 1)
        rect(x + sign * j * 5, top + height * 0.38 - j * 5, 5, 8, 0x513522);
    }
  };

  tree(105, 202, 109, 12);
  crown(99, 87, 48, [0x77502b, 0x956029, 0xb47a30, 0xc5913c], 5);
  tree(376, 206, 118, 13, true);
  crown(384, 82, 46, [0x8a4925, 0xae6028, 0xc58031, 0xd79d40], 5);
  tree(37, 247, 191, 29);
  tree(435, 252, 189, 25);
  tree(471, 235, 148, 13, true);
  crown(17, 36, 83, [0x623b23, 0x854823, 0xa75c25, 0xc57c2c, 0xd99737], 6);
  crown(82, 14, 55, [0x744022, 0x985022, 0xb66927, 0xcb8b33], 5);
  crown(447, 40, 86, [0x663c23, 0x914622, 0xb26025, 0xcf822d, 0xe2a341], 6);
  crown(388, 8, 49, [0x7a4324, 0xa85825, 0xc77b2a, 0xdba044], 5);

  // 앞쪽 풀과 낙엽은 가장자리에 모아 메뉴 아래가 지나치게 복잡해지지 않게 한다.
  for (let i = 0; i < 160; i += 1) {
    const side = i % 2 === 0;
    const x = side ? random() * 145 : 335 + random() * 145;
    const y = 222 + random() * 50;
    const height = 3 + random() * 9;
    rect(x, y - height, 2, height, [0x615631, 0x7c6432, 0x9d7837][i % 3]);
    rect(x - 2, y, 6, 2, [0x9d642b, 0xc38936, 0x79472a][i % 3]);
  }
  return pixels;
}

export interface AutumnLeafTuning {
  leafCount: number;
  leafMinSpeed: number;
  leafSpeedRange: number;
  leafSway: number;
  leafMargin: number;
}

export function getAutumnLeafPose(
  index: number,
  elapsedMs: number,
  width: number,
  height: number,
  tuning: AutumnLeafTuning,
) {
  const time = Math.max(0, elapsedMs) / 1000;
  const phase = index * 2.399963;
  const speed = tuning.leafMinSpeed + ((index % 7) / 6) * tuning.leafSpeedRange;
  const span = height + tuning.leafMargin * 2;
  const y = ((index * 47 + time * speed) % span) - tuning.leafMargin;
  const x = ((index * 97 + 19) % width) + Math.sin(time * 0.7 + phase) * tuning.leafSway;
  return {
    x,
    y,
    angle: Math.sin(time * 1.2 + phase) * 48 + index * 31,
    scaleX: 0.5 + Math.abs(Math.sin(time * 0.9 + phase)) * 0.5,
  };
}
