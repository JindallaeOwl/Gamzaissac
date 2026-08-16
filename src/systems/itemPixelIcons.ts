import type Phaser from 'phaser';
import { PixelSprite } from './enemyPixelSprites';

/**
 * Hand-pixeled item icons.
 *
 * Older items are drawn by AssetFactory as a tinted badge circle plus a small
 * symbol, which reads as a UI chip rather than an object. Icons added from here
 * on are authored pixel by pixel instead: each one is a 16x16 grid of palette
 * characters, so the silhouette itself carries the meaning the way classic
 * roguelike item art does.
 *
 * Authoring rules:
 * - Exactly ITEM_ICON_DESIGN_SIZE rows, each exactly that many characters.
 * - '.' is transparent; every other character must exist in the icon's palette.
 * - Leave a one pixel margin. The dark outline is grown outward from the
 *   silhouette after the grid is read, and would be clipped at the edges.
 */
export const ITEM_ICON_DESIGN_SIZE = 16;
export const ITEM_ICON_SCALE = 2;
export const ITEM_ICON_OUTLINE_COLOR = 0x140f08;
export const ITEM_ICON_TRANSPARENT = '.';

export interface ItemIconArt {
  /** Maps a grid character to its colour. '.' must not appear here. */
  readonly palette: Readonly<Record<string, number>>;
  readonly rows: readonly string[];
}

const SEED_LIGHT = 0xf6e0a0;
const SEED_BASE = 0xc98f3a;
const STONE_LIGHT = 0xb9c0c9;
const STONE_BASE = 0x7d8794;
const STONE_SHADE = 0x4c5563;
const STEEL_LIGHT = 0xe4ebf5;
const STEEL_BASE = 0x94a1b5;
const WOOD_LIGHT = 0xb07a3e;
const WOOD_SHADE = 0x6f4a24;
const PEEL_LIGHT = 0xe8c07a;
const PEEL_SHADE = 0xb07c33;
const LEATHER_LIGHT = 0xd9a45c;
const LEATHER_BASE = 0x8f6427;
const LEATHER_CUFF = 0x6d4a1c;
const TUBER_LIGHT = 0xd8a765;
const TUBER_BASE = 0x9c6a2e;
const ROOT_SHADE = 0x6b4a22;
const DEW_LIGHT = 0xeaf6ff;
const DEW_BASE = 0x9fd0ec;
const DEW_SHADE = 0x5f9bc4;
const HUSK_LIGHT = 0x8fae5f;
const HUSK_SHADE = 0x5d7c3a;
const CASING_LIGHT = 0x77839a;
const CASING_SHADE = 0x424c60;
const SPARK_CORE = 0xffe066;
const GLASS_LEAF = 0xb8e8cf;
const GLASS_VEIN = 0x6fae95;
const PLUME_LIGHT = 0xf2f6ff;
const PLUME_SHADE = 0xa8b8cf;
const PLUME_SHAFT = 0x7d8ca3;
const EMBER_CRUST = 0x5a4038;
const EMBER_GLOW = 0xd9622b;
const EMBER_CORE = 0xffd35c;
const CELL_SHELL = 0x4a5563;
const CELL_BAND = 0xe8c14b;
const CELL_CHARGE = 0x2f7fd0;
const MOON_LIGHT = 0xf0e6c8;
const MOON_SHADE = 0xb9a97e;
const MOON_CRATER = 0x8a7a56;
const WAVE_NEAR = 0xd8e8f5;
const WAVE_MID = 0x9ab8d0;
const WAVE_FAR = 0x6a8ba8;
const PRISM_LIGHT = 0xe6c8ff;
const PRISM_SHADE = 0xa070d8;
const SHAFT_LIGHT = 0xc0a878;
const SHAFT_SHADE = 0x7d6440;
const ARCANE_LIGHT = 0xd8b4ff;
const ARCANE_SHADE = 0x8a5fd0;
const GIANT_SEED_LIGHT = 0xfff0b8;
const GIANT_SEED_SHADE = 0xd89a3a;
const SPLINTER_LIGHT = 0xe8cf9a;
const SPLINTER_SHADE = 0xb08c4f;
const BLOOD_TIP = 0xd8453f;
const POUCH_CORD = 0xc9a06a;
const POUCH_BODY = 0x8a6134;
const BARK_OUTER = 0x8a6b45;
const BARK_INNER = 0x5c4530;
const BARK_STRAP = 0xc9a578;
const SPROUT_ROOT = 0x6fae4f;
const SPROUT_BULB = 0xd8e08a;
const CLOVER_LEAF = 0x74c04a;
const CLOVER_STEM = 0x4a7a2c;
const BRASS_RIM = 0xc9a24a;
const BRASS_INNER = 0x8a6a28;
const LENS_GLASS = 0x9fd8e8;
const LENS_RETICLE = 0x2b3a44;
const THORN_DARK = 0x7a5a3a;
const THORN_LIGHT = 0xa8804a;
const RUBBER_EDGE = 0x2f6a8a;
const RUBBER_BODY = 0x4a9fc9;
const RUBBER_SOLE = 0x2b3a44;
const AMBER_LIGHT = 0xf5b942;
const AMBER_DEEP = 0xc07818;
const BULB_GLASS = 0xffe9a8;
const BULB_FILAMENT = 0xf5c04a;
const BULB_SPARK = 0xfff5c8;
const BULB_SOCKET = 0x7a6a4a;
const COVER_DARK = 0x6a4a2a;
const COVER_LIGHT = 0x9a7040;
const PAGE_LIGHT = 0xf0e6d0;
const PAGE_LINE = 0xa89878;
const IRON_LIGHT = 0x8a949e;
const IRON_MID = 0x5c6670;
const IRON_DEEP = 0x39424c;
const IRON_RIVET = 0xb8c2cc;
const SACK_EDGE = 0x9a7a4a;
const SACK_BODY = 0xc9a86a;
const SACK_STAR = 0xfff0a8;

/** Two seeds splitting apart, echoing the extra projectile the item grants. */
const TWIN_SEED: ItemIconArt = {
  palette: { a: SEED_LIGHT, b: SEED_BASE },
  rows: [
    '................',
    '................',
    '................',
    '....aa....aa....',
    '...aaab..aaab...',
    '..aaabb..aaabb..',
    '..aabbb..aabbb..',
    '..aabbb..aabbb..',
    '...abbb...abbb..',
    '....bb.....bb...',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
  ],
};

/** A blunt angular stone: heavy, slow, and obviously not aerodynamic. */
const HEAVY_GRAVEL: ItemIconArt = {
  palette: { a: STONE_LIGHT, b: STONE_BASE, c: STONE_SHADE },
  rows: [
    '................',
    '................',
    '................',
    '.....aaaa.......',
    '....aaaabb......',
    '...aaaabbbb.....',
    '..aaabbbbbbb....',
    '..aabbbbbbccc...',
    '..abbbbbbccc....',
    '..bbbbbbcccc....',
    '...bbbbcccc.....',
    '....bbcccc......',
    '.....cccc.......',
    '................',
    '................',
    '................',
  ],
};

/** A steel awl on a wooden grip — the piercing tool silhouette. */
const BORE_AWL: ItemIconArt = {
  palette: { a: STEEL_LIGHT, b: STEEL_BASE, c: WOOD_LIGHT, d: WOOD_SHADE },
  rows: [
    '................',
    '.......a........',
    '.......ab.......',
    '......aabb......',
    '......aabb......',
    '......aabb......',
    '.....aaabbb.....',
    '....ccccdddd....',
    '....ccccdddd....',
    '.....cccddd.....',
    '.....cccddd.....',
    '.....cccddd.....',
    '......ccdd......',
    '................',
    '................',
    '................',
  ],
};

/** A curled potato peel: almost nothing left, so nothing slows you down. */
const THIN_RIND: ItemIconArt = {
  palette: { a: PEEL_LIGHT, b: PEEL_SHADE },
  rows: [
    '................',
    '................',
    '......aaaa......',
    '....aaabbbb.....',
    '...aab...bbb....',
    '..aab.....bb....',
    '..aab......b....',
    '..aab...........',
    '..aab...........',
    '...aab..........',
    '....aabb........',
    '.....aabbb......',
    '.......aabbb....',
    '.........aab....',
    '................',
    '................',
  ],
};

/** A work glove with the thumb out to the side. */
const SOIL_GLOVE: ItemIconArt = {
  palette: { a: LEATHER_LIGHT, b: LEATHER_BASE, c: LEATHER_CUFF },
  rows: [
    '................',
    '................',
    '......aaaa......',
    '.....aaaaaa.....',
    '..a..aaaaaa.....',
    '.aaa.aaaaaab....',
    '.aaaaaaaaaab....',
    '.aaaaaaaaabb....',
    '..aaaaaaaabb....',
    '...bbbbbbbb.....',
    '...cccccccc.....',
    '...cccccccc.....',
    '....cccccc......',
    '................',
    '................',
    '................',
  ],
};

/** A tuber trailing three roots — it holds on, but it does not run. */
const DEEP_ROOT: ItemIconArt = {
  palette: { a: TUBER_LIGHT, b: TUBER_BASE, c: ROOT_SHADE },
  rows: [
    '................',
    '................',
    '.....aaaaa......',
    '....aaaaaaa.....',
    '...aaaabbbbb....',
    '...aaabbbbbb....',
    '...aabbbbbbb....',
    '....abbbbbb.....',
    '....bbbbbbb.....',
    '...cc..bb..cc...',
    '..cc...bb...cc..',
    '..c....bb....c..',
    '.c.....bb.....c.',
    '.c............c.',
    '................',
    '................',
  ],
};

/** A single droplet, bright enough to read as a lucky charm. */
const SILVER_DEW: ItemIconArt = {
  palette: { a: DEW_LIGHT, b: DEW_BASE, c: DEW_SHADE },
  rows: [
    '................',
    '.......a........',
    '.......aa.......',
    '......aaab......',
    '......aabb......',
    '.....aaabbb.....',
    '....aaabbbbb....',
    '....aabbbbbb....',
    '...aabbbbbbbc...',
    '...abbbbbbbcc...',
    '...abbbbbbccc...',
    '....bbbbbccc....',
    '.....bbccccc....',
    '......ccccc.....',
    '................',
    '................',
  ],
};

/** A burr husk. The spikes sit on the silhouette so the outline keeps them sharp. */
const SPIKE_RIND: ItemIconArt = {
  palette: { a: HUSK_LIGHT, b: HUSK_SHADE },
  rows: [
    '................',
    '................',
    '..a...a...a.....',
    '..aa.aaa.aa.....',
    '.aaaaaaaaaaa....',
    '.aaaaaaaaaaaa...',
    '.aabbbbbbbbba...',
    '.abbbbbbbbbba...',
    '.abbbbbbbbbba...',
    '.aabbbbbbbbaa...',
    '.aaaaaaaaaaaa...',
    '..aaaaaaaaaa....',
    '..aa.aaa.aa.....',
    '..a...a...a.....',
    '................',
    '................',
  ],
};

/** A relay housing with a bolt punched through it: raw rate of fire. */
const PULSE_RELAY: ItemIconArt = {
  palette: { a: CASING_LIGHT, b: CASING_SHADE, c: SPARK_CORE },
  rows: [
    '................',
    '................',
    '...aaaaaaaaaa...',
    '..abbbbbbbbbba..',
    '..ab...ccc..ba..',
    '..ab..ccc...ba..',
    '..ab.ccc....ba..',
    '..ab.ccccc..ba..',
    '..ab...ccc..ba..',
    '..ab..ccc...ba..',
    '..abbbbbbbbbba..',
    '...aaaaaaaaaa...',
    '................',
    '................',
    '................',
    '................',
  ],
};

/** A fern frond whose leaflets widen downward, edged like cut glass. */
const GLASS_FERN: ItemIconArt = {
  palette: { a: GLASS_LEAF, b: GLASS_VEIN },
  rows: [
    '................',
    '................',
    '........a.......',
    '.......aab......',
    '......aaabb.....',
    '.....aaaabbb....',
    '.....aaaabbb....',
    '....aaaaabbbb...',
    '....aaaaabbbb...',
    '.....aaaabbb....',
    '.....aaaabbb....',
    '......aaabb.....',
    '.......aab......',
    '........a.......',
    '................',
    '................',
  ],
};

/** A single plume swept along a diagonal, reading as pure speed. */
const FEATHER_COIL: ItemIconArt = {
  palette: { a: PLUME_LIGHT, b: PLUME_SHADE, c: PLUME_SHAFT },
  rows: [
    '................',
    '................',
    '.......c........',
    '......acb.......',
    '.....aacbb......',
    '.....aacbb......',
    '....aaacbbb.....',
    '....aaacbbb.....',
    '...aaaacbbbb....',
    '...aaaacbbbb....',
    '....aaacbbb.....',
    '....aaacbbb.....',
    '.....aacbb......',
    '......acb.......',
    '.......c........',
    '................',
  ],
};

/** A stone cracked open around a burning core. */
const HOT_PEBBLE: ItemIconArt = {
  palette: { a: EMBER_CRUST, b: EMBER_GLOW, c: EMBER_CORE },
  rows: [
    '................',
    '................',
    '................',
    '.....aaaa.......',
    '....aaaaaa......',
    '...aabbbbaa.....',
    '..aabbccbbaa....',
    '..abbccccbba....',
    '..abbccccbba....',
    '..aabbccbbaa....',
    '...aabbbbaa.....',
    '....aaaaaa......',
    '.....aaaa.......',
    '................',
    '................',
    '................',
  ],
};

/** A cell with its terminal on top and a charge band down the middle. */
const POCKET_BATTERY: ItemIconArt = {
  palette: { a: CELL_SHELL, b: CELL_BAND, c: CELL_CHARGE },
  rows: [
    '................',
    '................',
    '......aa........',
    '....aaaaaa......',
    '....abbbba......',
    '....abccba......',
    '....abccba......',
    '....abccba......',
    '....abccba......',
    '....abccba......',
    '....abccba......',
    '....abbbba......',
    '....aaaaaa......',
    '................',
    '................',
    '................',
  ],
};

/** A headed pin driven at an angle: it keeps the shot on line. */
const STEADY_PIN: ItemIconArt = {
  palette: { a: STEEL_LIGHT, b: STEEL_BASE },
  rows: [
    '................',
    '.....aaa........',
    '....aaaaa.......',
    '....aabaa.......',
    '.....aaa........',
    '......ab........',
    '.......ab.......',
    '.......ab.......',
    '........ab......',
    '........ab......',
    '.........ab.....',
    '.........ab.....',
    '..........a.....',
    '................',
    '................',
    '................',
  ],
};

/** A crescent moon read as a dial face. */
const MOON_DIAL: ItemIconArt = {
  palette: { a: MOON_LIGHT, b: MOON_SHADE, c: MOON_CRATER },
  rows: [
    '................',
    '................',
    '......aaaa......',
    '.....aabbbb.....',
    '....aabb..bb....',
    '....abb....b....',
    '...abbb.........',
    '...abcb.........',
    '...abbb.........',
    '...abcb.........',
    '....abb....b....',
    '....aabb..bb....',
    '.....aabbbb.....',
    '......aaaa......',
    '................',
    '................',
  ],
};

/** Three arcs fading as they travel: sound carrying further out. */
const LONG_ECHO: ItemIconArt = {
  palette: { a: WAVE_NEAR, b: WAVE_MID, c: WAVE_FAR },
  rows: [
    '................',
    '................',
    '................',
    '.....a..........',
    '....aa..b.......',
    '...aa...bb..c...',
    '...aa....b..cc..',
    '...aa....b...c..',
    '...aa....b...c..',
    '...aa....b..cc..',
    '...aa...bb..c...',
    '....aa..b.......',
    '.....a..........',
    '................',
    '................',
    '................',
  ],
};

/** A faceted crystal head on a short haft — the charged beam weapon. */
const PRISM_LANCE: ItemIconArt = {
  palette: { a: PRISM_LIGHT, b: PRISM_SHADE, c: SHAFT_LIGHT, d: SHAFT_SHADE },
  rows: [
    '................',
    '.......a........',
    '......aab.......',
    '......aab.......',
    '......aab.......',
    '.....aaabb......',
    '.....aaabb......',
    '......cdd.......',
    '.....ccddd......',
    '......cdd.......',
    '......cdd.......',
    '......cdd.......',
    '......cdd.......',
    '......cdd.......',
    '................',
    '................',
  ],
};

/** Four seeds already split into their fan. */
const QUAD_SHOT: ItemIconArt = {
  palette: { a: ARCANE_LIGHT, b: ARCANE_SHADE },
  rows: [
    '................',
    '................',
    '..aa........aa..',
    '..aab......aab..',
    '..abb......abb..',
    '...b........b...',
    '................',
    '.....aa..aa.....',
    '.....aab.aab....',
    '.....abb.abb....',
    '......b...b.....',
    '................',
    '................',
    '................',
    '................',
    '................',
  ],
};

/** One seed grown far past the others, filling the whole frame. */
const MEGA_SEED: ItemIconArt = {
  palette: { a: GIANT_SEED_LIGHT, b: GIANT_SEED_SHADE },
  rows: [
    '................',
    '................',
    '.....aaaa.......',
    '...aaaaaaa......',
    '..aaaaaabbb.....',
    '..aaaaabbbbb....',
    '.aaaaabbbbbb....',
    '.aaaabbbbbbbb...',
    '.aaabbbbbbbbb...',
    '.aaabbbbbbbbb...',
    '..abbbbbbbbb....',
    '..bbbbbbbbbb....',
    '...bbbbbbbb.....',
    '.....bbbb.......',
    '................',
    '................',
  ],
};

/** A sliver of wood with a stained point. */
const TOOTHPICK: ItemIconArt = {
  palette: { a: SPLINTER_LIGHT, b: SPLINTER_SHADE, c: BLOOD_TIP },
  rows: [
    '................',
    '................',
    '............cc..',
    '...........ccc..',
    '..........cca...',
    '.........caa....',
    '........baa.....',
    '.......baa......',
    '......baa.......',
    '.....baa........',
    '....baa.........',
    '...baa..........',
    '...ba...........',
    '................',
    '................',
    '................',
  ],
};

/** A drawstring pouch, tied and full. */
const SEED_POUCH: ItemIconArt = {
  palette: { a: POUCH_CORD, b: POUCH_BODY },
  rows: [
    '................',
    '................',
    '......aaaa......',
    '.....aaaaaa.....',
    '.....aabbaa.....',
    '....abbbbbba....',
    '...abbbbbbbba...',
    '..abbbbbbbbbba..',
    '..abbbbbbbbbba..',
    '..abbbbbbbbbba..',
    '...abbbbbbbba...',
    '....aabbbbaa....',
    '.....aaaaaa.....',
    '................',
    '................',
    '................',
  ],
};

/** A slab-shouldered vest cut from bark. */
const BARK_VEST: ItemIconArt = {
  palette: { a: BARK_OUTER, b: BARK_INNER, c: BARK_STRAP },
  rows: [
    '................',
    '................',
    '..aaa......aaa..',
    '.aaaaa....aaaaa.',
    '.aabbaaaaaabbaa.',
    '.abbbbbaabbbbba.',
    '.abbbbb..bbbbba.',
    '.abbbbb..bbbbba.',
    '.abbbbb..bbbbba.',
    '.abbbbb..bbbbba.',
    '.acccccccccccca.',
    '.abbbbb..bbbbba.',
    '.abbbbb..bbbbba.',
    '..aaaa....aaaa..',
    '................',
    '................',
  ],
};

/** A pale bulb throwing runners out sideways, unlike the deep root's drop. */
const RUNNER_ROOTS: ItemIconArt = {
  palette: { a: SPROUT_ROOT, b: SPROUT_BULB },
  rows: [
    '................',
    '................',
    '......aaaa......',
    '.....aaaaaa.....',
    '.....abbbba.....',
    '.....abbbba.....',
    '......abba......',
    '.....a.aa.a.....',
    '....a..aa..a....',
    '...a...aa...a...',
    '..a....aa....a..',
    '.a.....aa.....a.',
    '.a......a.....a.',
    '................',
    '................',
    '................',
  ],
};

/** Four leaves on a bent stem. */
const CLOVER_SPROUT: ItemIconArt = {
  palette: { a: CLOVER_LEAF, b: CLOVER_STEM },
  rows: [
    '................',
    '................',
    '....aaa..aaa....',
    '...aaaaaaaaa....',
    '...aaaaaaaaa....',
    '....aaaaaaa.....',
    '...aaaaaaaaa....',
    '...aaaaaaaaa....',
    '....aaa.aaa.....',
    '.......b........',
    '.......b........',
    '......bb........',
    '.....bb.........',
    '................',
    '................',
    '................',
  ],
};

/** A brass lens with a reticle etched across the glass. */
const SCOPE_LENS: ItemIconArt = {
  palette: { a: BRASS_RIM, b: BRASS_INNER, c: LENS_GLASS, d: LENS_RETICLE },
  rows: [
    '................',
    '................',
    '.....aaaaaa.....',
    '...aaabbbbaaa...',
    '..aabbcddcbbaa..',
    '..abbccddccbba..',
    '.aabcccddcccbaa.',
    '.aabddddddddbaa.',
    '.aabcccddcccbaa.',
    '.aabcccddcccbaa.',
    '..abbccddccbba..',
    '..aabbcddcbbaa..',
    '...aaabbbbaaa...',
    '.....aaaaaa.....',
    '................',
    '................',
  ],
};

/** A band studded with thorns and one red bead: power bought with blood. */
const THORN_CROWN: ItemIconArt = {
  palette: { a: THORN_DARK, b: THORN_LIGHT, c: BLOOD_TIP },
  rows: [
    '................',
    '................',
    '...a...a...a....',
    '...a..aaa..a....',
    '..aa..aaa..aa...',
    '..aaaaaaaaaaa...',
    '..abbbbbbbbba...',
    '..abbbbcbbbba...',
    '..abbbbbbbbba...',
    '..aaaaaaaaaaa...',
    '...aaaaaaaaa....',
    '................',
    '................',
    '................',
    '................',
    '................',
  ],
};

/** A rubber boot with a heavy sole. */
const RAIN_BOOTS: ItemIconArt = {
  palette: { a: RUBBER_EDGE, b: RUBBER_BODY, c: RUBBER_SOLE },
  rows: [
    '................',
    '................',
    '....aaaaa.......',
    '....abbba.......',
    '....abbba.......',
    '....abbba.......',
    '....abbba.......',
    '....abbbaa......',
    '....abbbbbaa....',
    '....abbbbbbba...',
    '...abbbbbbbbba..',
    '...abbbbbbbbba..',
    '...aaaaaaaaaaa..',
    '....ccccccccc...',
    '................',
    '................',
  ],
};

/** A heart cut from amber, lit from within. */
const AMBER_HEART: ItemIconArt = {
  palette: { a: AMBER_LIGHT, b: AMBER_DEEP },
  rows: [
    '................',
    '................',
    '...aa......aa...',
    '..aaaa....aaaa..',
    '.aaaaaa..aaaaaa.',
    '.aaaaaaaaaaaaaa.',
    '.aaaabbbbbbaaaa.',
    '..aaabbbbbbaaa..',
    '...aabbbbbbaa...',
    '....aabbbbaa....',
    '.....aabbaa.....',
    '......aaaa......',
    '.......aa.......',
    '................',
    '................',
    '................',
  ],
};

/** A bulb pushed past its rating, throwing sparks from every corner. */
const OVERCLOCK_BULB: ItemIconArt = {
  palette: { a: BULB_GLASS, b: BULB_FILAMENT, c: BULB_SPARK, d: BULB_SOCKET },
  rows: [
    '................',
    '..cc........cc..',
    '...c...aa...c...',
    '......aaaa......',
    '.....aaaaaa.....',
    '....aabbbbaa....',
    '....abbccbba....',
    '....abbccbba....',
    '....aabbbbaa....',
    '.....aaaaaa.....',
    '......dddd......',
    '......dddd......',
    '.......dd.......',
    '...c........c...',
    '..cc........cc..',
    '................',
  ],
};

/** A ruled ledger: luck written down and counted. */
const LUCKY_LEDGER: ItemIconArt = {
  palette: { a: COVER_DARK, b: COVER_LIGHT, c: PAGE_LIGHT, d: PAGE_LINE },
  rows: [
    '................',
    '................',
    '..aaaaaaaaaaa...',
    '..abbbbbbbbba...',
    '..abcccccccba...',
    '..abdddddddba...',
    '..abcccccccba...',
    '..abdddddddba...',
    '..abcccccccba...',
    '..abbbbbbbbba...',
    '..aaaaaaaaaaa...',
    '...ddddddddd....',
    '................',
    '................',
    '................',
    '................',
  ],
};

/** A riveted iron shell: heavy plate, no spikes. */
const IRON_HUSK: ItemIconArt = {
  palette: { a: IRON_LIGHT, b: IRON_MID, c: IRON_DEEP, d: IRON_RIVET },
  rows: [
    '................',
    '................',
    '....aaaaaaaa....',
    '...aabbbbbbaa...',
    '..aabbbbbbbbaa..',
    '..abbccddccbba..',
    '..abbccddccbba..',
    '..abbccddccbba..',
    '..abbccddccbba..',
    '..aabbbbbbbbaa..',
    '...aabbbbbbaa...',
    '....aaaaaaaa....',
    '................',
    '................',
    '................',
    '................',
  ],
};

/** A feed sack marked with a star. */
const STAR_FERTILIZER: ItemIconArt = {
  palette: { a: SACK_EDGE, b: SACK_BODY, c: SACK_STAR },
  rows: [
    '................',
    '................',
    '....aaaaaaaa....',
    '...abbbbbbbba...',
    '..abbbbccbbbba..',
    '..abbbccccbbba..',
    '..abccccccccba..',
    '..abccccccccba..',
    '..abbbccccbbba..',
    '..abbbbccbbbba..',
    '..abbbbbbbbbba..',
    '...abbbbbbbba...',
    '....aaaaaaaa....',
    '................',
    '................',
    '................',
  ],
};

/** A leather back pocket with a seed tucked in, pointing the wrong way on purpose. */
const BACK_POCKET_SEED: ItemIconArt = {
  palette: {
    a: SEED_LIGHT,
    b: SEED_BASE,
    c: LEATHER_CUFF,
    d: LEATHER_BASE,
    e: LEATHER_LIGHT,
  },
  rows: [
    '................',
    '................',
    '......aa........',
    '.....aaab.......',
    '.....aabb.......',
    '......bb........',
    '..ceeeeeeeeeec..',
    '..cddddddddddc..',
    '...cddddddddc...',
    '...cddddddddc...',
    '....cddddddc....',
    '.....cddddc.....',
    '......cccc......',
    '................',
    '................',
    '................',
  ],
};

/** A seed leaving two rippling wakes: the trajectory is the item. */
const WAVY_SEED: ItemIconArt = {
  palette: { a: SEED_LIGHT, b: SEED_BASE, m: DEW_BASE, n: DEW_SHADE },
  rows: [
    '................',
    '................',
    '................',
    '......aa........',
    '.....aaab.......',
    '.....aabb.......',
    '......bb........',
    '................',
    '..mm..mm..mm....',
    '.m..mm..mm..m...',
    '................',
    '..nn..nn..nn....',
    '.n..nn..nn..n...',
    '................',
    '................',
    '................',
  ],
};

/** A pea pod with three seeds bulging out: one squeeze, three shots. */
const BURST_POD: ItemIconArt = {
  palette: { a: SEED_LIGHT, b: SEED_BASE, h: HUSK_LIGHT, s: HUSK_SHADE },
  rows: [
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '..hh..hh..hh....',
    '.haahhaahhaah...',
    '.habhhabhhabh...',
    '..ssssssssss....',
    '...ssssssss.....',
    '................',
    '................',
    '................',
    '................',
    '................',
  ],
};

export const ITEM_PIXEL_ICONS: Readonly<Record<string, ItemIconArt>> = {
  'quad-shot': QUAD_SHOT,
  'mega-seed': MEGA_SEED,
  toothpick: TOOTHPICK,
  'pulse-relay': PULSE_RELAY,
  'glass-fern': GLASS_FERN,
  'feather-coil': FEATHER_COIL,
  'hot-pebble': HOT_PEBBLE,
  'pocket-battery': POCKET_BATTERY,
  'steady-pin': STEADY_PIN,
  'moon-dial': MOON_DIAL,
  'long-echo': LONG_ECHO,
  'prism-lance': PRISM_LANCE,
  'seed-pouch': SEED_POUCH,
  'bark-vest': BARK_VEST,
  'runner-roots': RUNNER_ROOTS,
  'clover-sprout': CLOVER_SPROUT,
  'scope-lens': SCOPE_LENS,
  'thorn-crown': THORN_CROWN,
  'rain-boots': RAIN_BOOTS,
  'amber-heart': AMBER_HEART,
  'overclock-bulb': OVERCLOCK_BULB,
  'lucky-ledger': LUCKY_LEDGER,
  'iron-husk': IRON_HUSK,
  'star-fertilizer': STAR_FERTILIZER,
  'twin-seed': TWIN_SEED,
  'heavy-gravel': HEAVY_GRAVEL,
  'bore-awl': BORE_AWL,
  'thin-rind': THIN_RIND,
  'soil-glove': SOIL_GLOVE,
  'deep-root': DEEP_ROOT,
  'silver-dew': SILVER_DEW,
  'spike-rind': SPIKE_RIND,
  'back-pocket-seed': BACK_POCKET_SEED,
  'wavy-seed': WAVY_SEED,
  'burst-pod': BURST_POD,
};

export function hasItemPixelIcon(itemId: string): boolean {
  return itemId in ITEM_PIXEL_ICONS;
}

/**
 * Reports why an icon grid is unusable, or null when it is valid. Kept separate
 * from the builder so tests can check every icon without a Phaser scene.
 */
export function findItemIconArtProblem(art: ItemIconArt): string | null {
  if (art.rows.length !== ITEM_ICON_DESIGN_SIZE) {
    return `expected ${ITEM_ICON_DESIGN_SIZE} rows but found ${art.rows.length}`;
  }

  if (ITEM_ICON_TRANSPARENT in art.palette) {
    return `palette must not define the transparent character '${ITEM_ICON_TRANSPARENT}'`;
  }

  for (let y = 0; y < art.rows.length; y += 1) {
    const row = art.rows[y];

    if (row.length !== ITEM_ICON_DESIGN_SIZE) {
      return `row ${y} has ${row.length} characters, expected ${ITEM_ICON_DESIGN_SIZE}`;
    }

    for (const character of row) {
      if (character !== ITEM_ICON_TRANSPARENT && !(character in art.palette)) {
        return `row ${y} uses '${character}', which the palette does not define`;
      }
    }
  }

  return null;
}

/** Builds the sprite for an icon grid, including the outward dark outline. */
export function buildItemIconSprite(art: ItemIconArt): PixelSprite {
  const problem = findItemIconArtProblem(art);

  if (problem) {
    throw new Error(`Invalid item icon art: ${problem}`);
  }

  const sprite = new PixelSprite(ITEM_ICON_DESIGN_SIZE);

  for (let y = 0; y < art.rows.length; y += 1) {
    const row = art.rows[y];

    for (let x = 0; x < row.length; x += 1) {
      const character = row[x];

      if (character === ITEM_ICON_TRANSPARENT) {
        continue;
      }

      sprite.set(x, y, art.palette[character]);
    }
  }

  sprite.outline(ITEM_ICON_OUTLINE_COLOR);

  return sprite;
}

/** Bakes one hand-pixeled icon into a texture. Returns false when none exists. */
export function createItemPixelIcon(
  scene: Phaser.Scene,
  itemId: string,
  textureKey: string,
): boolean {
  const art = ITEM_PIXEL_ICONS[itemId];

  if (!art) {
    return false;
  }

  buildItemIconSprite(art).generateTexture(scene, textureKey, ITEM_ICON_SCALE);

  return true;
}
