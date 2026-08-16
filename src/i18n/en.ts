import type { TranslationTree } from './types';

export const en: TranslationTree = {
  title: {
    name: 'GAMZAISSAC',
  },
  menu: {
    start: 'Start',
    settings: 'Settings',
    quit: 'Quit',
    back: 'Back',
  },
  settings: {
    title: 'Settings',
    language: 'Language',
    sound: 'Sound',
    soundOn: 'On',
    soundOff: 'Off',
    volume: 'Effects volume',
    screenShake: 'Screen shake',
    renderQuality: 'Render quality',
    fullscreen: 'Fullscreen',
    low: 'Low',
    balanced: 'Balanced',
    high: 'High',
  },
  pause: {
    title: 'PAUSED',
    continue: 'Continue',
    settings: 'Settings',
    exit: 'Exit',
    fullscreen: 'Fullscreen',
    titleScreen: 'Return to title',
  },
  enemies: {
    summoner: 'Brood Caller',
    flanker: 'Sidle Hook',
  },
  bosses: {
    faultWarden: 'Compost Warden',
    rootKernel: 'Rotten Root Core',
    rootGnarl: 'Root Gnarl',
    wriggleMass: 'Wriggle Mass',
    flyQueen: 'Fly Queen',
    thornTangle: 'Thorn Tangle',
    wormKing: 'Old Worm King',
    pitchforkFarmer: 'Rusty Pitchfork Farmer',
  },
  stages: {
    rottenRoots: 'Rotten Roots',
    wormDen: 'Worm Den',
    compostHeap: 'Compost Heap',
    vinePassage: 'Vine Passage',
  },
  intro: {
    kicker: '[ GAMZAISSAC ]',
    title: 'Chapter 1 : Deep Earth',
    subtitle: 'Dodge the monsters and escape to the surface',
    skip: 'Press any key to begin',
  },
  touch: {
    movement: 'Movement stick',
    fire: 'Fire stick',
    bomb: 'Use bomb',
    purchase: 'BUY',
    pause: 'Pause',
    rotate: 'Rotate your device to landscape',
  },
  gameOver: {
    title: 'GAME OVER',
    summary: 'Rooms {rooms}   Items {items}   Score {score}',
    restart: 'Back to Title (Enter / Space)',
  },
  escape: {
    title: 'ESCAPED!',
    summary: 'Rooms {rooms}   Items {items}   Score {score}   Time {time}',
    returnToTitle: 'Back to Title (Enter / Space)',
  },
  hud: {
    hp: 'HP',
    key: 'KEY',
    bomb: 'BOMB',
    coin: 'COIN',
    damage: 'DMG',
    range: 'RNG',
    fireRate: 'RATE',
    luck: 'LUCK',
    speed: 'SPD',
    floor: 'Floor',
    cleared: 'Cleared',
    left: 'Left',
    room: 'Room',
    enemies: 'Enemies',
    bullets: 'Bullets',
    fps: 'FPS',
    player: 'Player',
    items: 'Items',
    abilities: 'Abilities',
    score: 'Score',
    time: 'Time',
    open: 'open',
    locked: 'locked',
  },
  messages: {
    floor: 'Floor {floor} · {stage} {roman}',
    roomClear: 'Room clear',
    floorCleared: 'Floor cleared',
    nextFloorOpening: 'A root tunnel opened upward',
    stageCleared: 'Stage clear! A root tunnel opened upward',
    escapeOpening: 'The way to the surface is open!',
    stageClear: 'Stage clear',
    shopRoom: 'Shop',
    treasureRoom: 'Treasure room',
    bossRoom: 'Boss room',
    bossPhaseTwo: 'Fault Warden: Phase II',
    rootKernelPhaseTwo: 'ROOT KERNEL: ROOT ACCESS OVERRIDE',
    wormKingPhaseTwo: 'Old Worm King: Sheds Its Skin',
    pitchforkFarmerPhaseTwo: 'Rusty Pitchfork Farmer: FRENZY',
    treasureUnlocked: 'Treasure room unlocked',
    shopUnlocked: 'Shop unlocked',
    keyNeeded: 'A key is needed',
    shopOffer: '{name} · {price} coins · Press F to buy',
    shopCoinsNeeded: 'Not enough coins (need {price})',
    shopHealthFull: 'Health is already full',
    shopResourceFull: 'You cannot carry any more',
    shopPurchased: 'Purchased {name}',
    itemMaxStacks: '{name}: maximum stack count is {max}',
    noBombs: 'No bombs left',
    rewardGain: '+{amount} {resource}',
    resourceFull: '{resource} is full',
    chestHealed: 'Chest: healed {amount}',
    chestConsumable: 'Chest: +{amount} {resource}',
    itemPreview: '[{rarity} · {category}] {name}: {description}',
    secretItemSpawned: 'Secret input detected: Prism Lance + Quad Shot spawned',
    // Scroll title. The announcement UI appends a trailing '!' automatically.
    synergyActivated: '{name} Synergy',
    clear: 'CLEAR',
    localeKo: 'Korean',
    localeEn: 'English',
    quitHint: 'Close the browser tab to quit',
    startFailed: 'Failed to start the game. Please try again',
  },
  resources: {
    hearts: 'Hearts',
    keys: 'Keys',
    bombs: 'Bombs',
    coins: 'Coins',
    chest: 'Chest',
  },
  roomTypes: {
    start: 'Start',
    combat: 'Combat',
    shop: 'Shop',
    treasure: 'Treasure',
    boss: 'Boss',
  },
  shop: {
    greeting: 'Well, look who came by! Come on in.',
    greetingFollowUp: "Take your time. There's no rush at all.",
    products: {
      heart: {
        name: 'Healing Heart',
        description: 'Restores one full heart.',
      },
      key: {
        name: 'Key',
        description: 'Adds one key.',
      },
      bomb: {
        name: 'Bomb',
        description: 'Adds one bomb.',
      },
    },
  },
  items: {
    redMushroom: {
      name: 'Red Mushroom',
      description: 'Adds one maximum heart and restores one full heart.',
    },
    pulseRelay: {
      name: 'Pulse Relay',
      description: 'Fire rate increases (+0.55).',
    },
    glassFern: {
      name: 'Glass Fern',
      description: 'Damage increases (+0.45).',
    },
    featherCoil: {
      name: 'Feather Coil',
      description: 'Move speed increases (+34).',
    },
    hotPebble: {
      name: 'Hot Pebble',
      description:
        'Range, seed speed, and damage all increase (+85 range, +72 seed speed, +0.15 damage).',
    },
    pocketBattery: {
      name: 'Pocket Battery',
      description: 'Adds one maximum heart and restores one full heart.',
    },
    steadyPin: {
      name: 'Steady Pin',
      description: 'Attack speed and seed speed both increase (+0.35 rate, +40 seed speed).',
    },
    moonDial: {
      name: 'Moon Dial',
      description: 'Luck increases, improving reward odds (+1 luck).',
    },
    longEcho: {
      name: 'Long Echo',
      description: 'Range increases significantly (+115).',
    },
    prismLance: {
      name: 'Prism Lance',
      description: 'Replaces seeds with a charged piercing beam.',
    },
    quadShot: {
      name: 'Quad Shot',
      description: 'Fires four seeds in a fan.',
    },
    megaSeed: {
      name: 'Mega Seed',
      description:
        'A huge seed carries excess killing damage through enemies (+4 damage, ×2 damage, ×0.42 attack speed).',
    },
    toothpick: {
      name: 'Toothpick',
      description: 'Attacks faster and turns seeds red (+0.7 attack speed, ×1.16 seed speed).',
    },
    seedPouch: {
      name: 'Seed Pouch',
      description: 'Slightly raises damage and seed speed. Stacks up to 5 times.',
    },
    barkVest: {
      name: 'Bark Vest',
      description: 'Adds and restores half a heart. Stacks up to 3 times.',
    },
    runnerRoots: {
      name: 'Runner Roots',
      description: 'Raises movement speed. Stacks up to 4 times.',
    },
    cloverSprout: {
      name: 'Clover Sprout',
      description: 'Raises luck by 0.5. Stacks up to 4 times.',
    },
    scopeLens: {
      name: 'Scope Lens',
      description: 'Raises range and seed speed. Stacks up to 3 times.',
    },
    thornCrown: {
      name: 'Thorn Crown',
      description: 'Sacrifices half a maximum heart for a large damage increase.',
    },
    rainBoots: {
      name: 'Rain Boots',
      description: 'Greatly raises movement speed and slightly raises range.',
    },
    amberHeart: {
      name: 'Amber Heart',
      description: 'Adds two maximum hearts and restores one. Stacks up to 2 times.',
    },
    overclockBulb: {
      name: 'Overclock Bulb',
      description: 'Greatly raises fire-rate and seed-speed multipliers.',
    },
    luckyLedger: {
      name: 'Lucky Ledger',
      description: 'Raises luck by 2 and slightly raises movement speed.',
    },
    ironHusk: {
      name: 'Iron Husk',
      description:
        'Trades a little speed for one maximum heart and half-heart healing. Stacks up to 3 times.',
    },
    starFertilizer: {
      name: 'Star Fertilizer',
      description: 'Raises the damage multiplier and range. Stacks up to 2 times.',
    },
    twinSeed: {
      name: 'Twin Seed',
      description: 'Splits off one extra seed, at the cost of a little damage per shot.',
    },
    soilGlove: {
      name: 'Soil Glove',
      description: 'Raises damage and luck together. Stacks up to 3 times.',
    },
    heavyGravel: {
      name: 'Heavy Gravel',
      description: 'Seeds grow larger and hit harder, but travel more slowly.',
    },
    thinRind: {
      name: 'Thin Rind',
      description: 'Costs one maximum heart for a large boost to move speed and fire rate.',
    },
    silverDew: {
      name: 'Silver Dew',
      description: 'Greatly raises luck and restores one heart.',
    },
    spikeRind: {
      name: 'Spike Rind',
      description: 'Raises damage and adds half a maximum heart, but weighs you down.',
    },
    deepRoot: {
      name: 'Deep Root',
      description: 'Greatly raises maximum hearts and range at the cost of move speed.',
    },
    boreAwl: {
      name: 'Bore Awl',
      description:
        'Seeds carry excess killing damage on to the enemy behind, but fire slightly more slowly.',
    },
    backPocketSeed: {
      name: 'Back Pocket Seed',
      description: 'Mirrors your whole seed fan backward on every shot (damage -0.1).',
    },
    wavySeed: {
      name: 'Wavy Seed',
      description: 'Seeds swim in waves, sweeping a wider path.',
    },
    burstPod: {
      name: 'Burst Pod',
      description: 'Fires three quick seeds, then takes a breath (fire rate -0.2).',
    },
  },
  rarities: {
    common: 'Common',
    uncommon: 'Uncommon',
    rare: 'Rare',
    legendary: 'Legendary',
  },
  itemCategories: {
    offense: 'Offense',
    defense: 'Defense',
    utility: 'Utility',
    resource: 'Resource',
  },
  synergies: {
    prismArray: {
      name: 'Prism Array',
      description: 'Beam charge time is 30% shorter.',
    },
    glassHorizon: {
      name: 'Glass Horizon',
      description: 'Damage and range rise together (damage +0.55, range +45).',
    },
    tunedCircuit: {
      name: 'Tuned Circuit',
      description: 'Fire rate and seed speed rise together (fire rate +0.4, seed speed +30).',
    },
    backupShell: {
      name: 'Backup Shell',
      description: 'Gain a max heart and restore one heart.',
    },
    compoundLuck: {
      name: 'Compound Luck',
      description: 'Luck rises by 2.',
    },
    meteorSeed: {
      name: 'Meteor Seed',
      description:
        'Seeds get bigger, faster, and harder (damage +0.75, seed speed +60, size ×1.15).',
    },
  },
};
