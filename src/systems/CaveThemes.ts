import type { CaveLight } from './CaveArt';

export type CaveTheme =
  'burrow' | 'ruins' | 'wetClay' | 'nest' | 'compost' | 'scrap' | 'vines' | 'cellar';

export interface CaveThemeSettings {
  id: CaveTheme;
  name: string;
  tint: readonly [number, number, number];
  ambient: number;
  fogColor: number;
  fogAlpha: number;
  dustColor: number;
  lights: readonly CaveLight[];
}

function lights(first: number, second: number, accent: number, fill: number): CaveLight[] {
  return [
    { x: 91, y: 27, radius: 96, color: first, strength: 0.42 },
    { x: 389, y: 27, radius: 96, color: second, strength: 0.42 },
    { x: 54, y: 210, radius: 68, color: accent, strength: 0.26 },
    { x: 424, y: 206, radius: 68, color: fill, strength: 0.26 },
  ];
}

export const CAVE_THEMES: readonly CaveThemeSettings[] = [
  {
    id: 'burrow',
    name: '깊은 뿌리 땅굴',
    tint: [1, 1, 1],
    ambient: 0xc2bbb0,
    fogColor: 0x778da0,
    fogAlpha: 0.035,
    dustColor: 0xb4a283,
    lights: lights(0xff862c, 0xff862c, 0x34e8c7, 0x46baff),
  },
  {
    id: 'ruins',
    name: '뿌리에 잠식된 지하 유적',
    tint: [1, 1, 1],
    ambient: 0xbcb8c9,
    fogColor: 0x8879ac,
    fogAlpha: 0.04,
    dustColor: 0xbeb1d0,
    lights: lights(0xff862c, 0xff862c, 0xb66cff, 0x6b9bff),
  },
  {
    id: 'wetClay',
    name: '축축한 지렁이 굴',
    tint: [0.78, 1.04, 1.2],
    ambient: 0xa9c3c6,
    fogColor: 0x5ca6a7,
    fogAlpha: 0.055,
    dustColor: 0x80b4b5,
    lights: lights(0xffa04b, 0xffa04b, 0x38dfce, 0x53b6ff),
  },
  {
    id: 'nest',
    name: '거대 지렁이의 둥지',
    tint: [0.94, 0.8, 1.22],
    ambient: 0xc6acc7,
    fogColor: 0x995a9d,
    fogAlpha: 0.045,
    dustColor: 0xc29ab9,
    lights: lights(0xff8743, 0xff8743, 0xce62f5, 0xb179ff),
  },
  {
    id: 'compost',
    name: '썩어가는 퇴비층',
    tint: [0.91, 1.06, 0.75],
    ambient: 0xbec7a3,
    fogColor: 0x8c9e47,
    fogAlpha: 0.065,
    dustColor: 0xc3ce7b,
    lights: lights(0xff9938, 0xff9938, 0xa9e648, 0x4ad880),
  },
  {
    id: 'scrap',
    name: '퇴비와 폐기물층',
    tint: [1.03, 0.91, 0.78],
    ambient: 0xc7b99e,
    fogColor: 0xa58953,
    fogAlpha: 0.05,
    dustColor: 0xbca46c,
    lights: lights(0xff7833, 0xff7833, 0xffa334, 0xa8d64e),
  },
  {
    id: 'vines',
    name: '빛이 스미는 넝쿨 통로',
    tint: [0.79, 1.1, 0.91],
    ambient: 0xbcccb7,
    fogColor: 0x91b990,
    fogAlpha: 0.035,
    dustColor: 0xd1d9a0,
    lights: lights(0xffab57, 0xffab57, 0x73ee8c, 0xe6de93),
  },
  {
    id: 'cellar',
    name: '농장 아래의 낡은 지하실',
    tint: [1.13, 1.04, 0.84],
    ambient: 0xd2c5ad,
    fogColor: 0xb5a181,
    fogAlpha: 0.035,
    dustColor: 0xe4cd9a,
    lights: lights(0xffab57, 0xffab57, 0xffd58c, 0x8eb8d4),
  },
];

export function caveThemeSettings(id: CaveTheme): CaveThemeSettings {
  return CAVE_THEMES.find((theme) => theme.id === id)!;
}
