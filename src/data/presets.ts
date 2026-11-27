import {
  CurveConfig,
  MD_CURVES_LIST,
  MD_PADS_NAMES_LIST,
  MegaDrumConfig,
  PadConfig,
  PositionalConfig,
  ThirdZoneConfig,
} from '../types/megadrum';

export function makePad(id: number, overrides: Partial<PadConfig> = {}): PadConfig {
  const defaultName = MD_PADS_NAMES_LIST[id - 1] || `Input ${id}`;
  const isCymbalInput = id === 2 || id === 3 || id === 6 || id === 7 || id === 8 || id === 9;
  return {
    id,
    name: defaultName,
    customNameIndex: 0,
    category: isCymbalInput ? 'cymbals' : id <= 17 ? 'drums' : 'aux',
    midiChannel: 10,
    padFunction: 0,
    note: 36 + ((id - 1) % 36),
    altNote: 0,
    pressrollNote: 0,
    altNoteLinked: false,
    pressrollNoteLinked: false,
    disabled: false,
    curve: 0,
    threshold: 30,
    retrigger: 8,
    levelMax: 720,
    minScan: 20,
    type: false,
    autoLevel: true,
    dual: false,
    threeWay: false,
    gain: 4,
    xtalkLevel: 3,
    xtalkGroup: 0,
    dynTime: 3,
    dynLevel: 4,
    compression: 0,
    shift: 0,
    rollSmoothLevel: 0,
    extraFalseSupp: false,
    ...overrides,
  };
}

export function makeThirdZone(id: number, overrides: Partial<ThirdZoneConfig> = {}): ThirdZoneConfig {
  return {
    id,
    disabled: true,
    note: 0,
    threshold: 100,
    altNote: 0,
    pressrollNote: 0,
    dampenedNote: 0,
    altNoteLinked: false,
    pressrollNoteLinked: false,
    ...overrides,
  };
}

export function makePositional(id: number, overrides: Partial<PositionalConfig> = {}): PositionalConfig {
  return {
    id,
    level: 0,
    low: 5,
    high: 15,
    ...overrides,
  };
}

export function default16Curves(): CurveConfig[] {
  return MD_CURVES_LIST.map((c) => ({
    id: c.id,
    name: c.name,
    points: [...c.defaultPoints],
  }));
}

function createBase55Pads(overrides: Record<number, Partial<PadConfig>>): PadConfig[] {
  const pads: PadConfig[] = [];
  for (let i = 1; i <= 55; i++) {
    pads.push(makePad(i, overrides[i] || {}));
  }
  return pads;
}

function createBase27ThirdZones(
  overrides: Record<number, Partial<ThirdZoneConfig>>
): ThirdZoneConfig[] {
  const zones: ThirdZoneConfig[] = [];
  for (let i = 0; i < 27; i++) {
    zones.push(makeThirdZone(i, overrides[i] || {}));
  }
  return zones;
}

function createBase55Positionals(): PositionalConfig[] {
  const arr: PositionalConfig[] = [];
  for (let i = 0; i < 55; i++) {
    arr.push(makePositional(i));
  }
  return arr;
}

const STANDARD_PAD_OVERRIDES: Record<number, Partial<PadConfig>> = {
  // Input 1: Kick
  1: {
    name: 'Kick',
    category: 'drums',
    note: 36,
    threshold: 32,
    gain: 4,
    levelMax: 840,
    autoLevel: false,
    retrigger: 12,
    dynLevel: 6,
    dynTime: 5,
    minScan: 25,
    curve: 7,
    xtalkGroup: 1,
    xtalkLevel: 4,
  },
  // Pair 1 (In 2+3): Hi-Hat Bow / Edge
  2: {
    name: 'HiHat Bow',
    category: 'cymbals',
    note: 46,
    dual: true,
    threeWay: false,
    threshold: 26,
    gain: 4,
    levelMax: 700,
    autoLevel: false,
    retrigger: 8,
    dynLevel: 5,
    dynTime: 4,
    minScan: 18,
    curve: 1,
    xtalkGroup: 3,
    xtalkLevel: 3,
  },
  3: {
    name: 'HiHat Edge',
    category: 'cymbals',
    note: 26,
    type: true, // Switch
    threshold: 28,
    gain: 4,
    levelMax: 700,
    autoLevel: false,
    retrigger: 8,
    dynLevel: 5,
    dynTime: 4,
    minScan: 18,
    curve: 1,
    xtalkGroup: 3,
    xtalkLevel: 3,
  },
  // Pair 2 (In 4+5): Snare Head / Rim
  4: {
    name: 'Snare Head',
    category: 'drums',
    note: 38,
    altNote: 38,
    pressrollNote: 38,
    dual: true,
    threeWay: false,
    threshold: 22,
    gain: 5,
    levelMax: 780,
    autoLevel: false,
    retrigger: 6,
    dynLevel: 5,
    dynTime: 3,
    minScan: 20,
    curve: 8,
    xtalkGroup: 2,
    xtalkLevel: 2,
  },
  5: {
    name: 'Snare Rim',
    category: 'drums',
    note: 40,
    type: false, // Piezo rim
    threshold: 34,
    gain: 4,
    levelMax: 660,
    autoLevel: false,
    retrigger: 8,
    dynLevel: 5,
    dynTime: 4,
    minScan: 20,
    curve: 0,
    xtalkGroup: 2,
    xtalkLevel: 2,
  },
  // Pair 3 (In 6+7): Ride Bow / Edge (3-Way Roland)
  6: {
    name: 'Ride Bow',
    category: 'cymbals',
    note: 51,
    dual: false,
    threeWay: true,
    threshold: 24,
    gain: 5,
    levelMax: 720,
    autoLevel: false,
    retrigger: 8,
    dynLevel: 6,
    dynTime: 4,
    minScan: 18,
    curve: 9,
    xtalkGroup: 5,
    xtalkLevel: 3,
  },
  7: {
    name: 'Ride Edge',
    category: 'cymbals',
    note: 59,
    type: true, // Switch
    threshold: 28,
    gain: 4,
    levelMax: 700,
    autoLevel: false,
    curve: 1,
    xtalkGroup: 5,
    xtalkLevel: 3,
  },
  // Pair 4 (In 8+9): Crash 1 Bow / Edge
  8: {
    name: 'Crash 1 Bow',
    category: 'cymbals',
    note: 49,
    dual: true,
    threeWay: false,
    threshold: 28,
    gain: 5,
    levelMax: 710,
    autoLevel: false,
    retrigger: 10,
    dynLevel: 7,
    dynTime: 5,
    minScan: 20,
    curve: 1,
    xtalkGroup: 5,
    xtalkLevel: 4,
  },
  9: {
    name: 'Crash 1 Edge',
    category: 'cymbals',
    note: 55,
    type: true, // Switch
    threshold: 30,
    gain: 4,
    levelMax: 680,
    autoLevel: false,
    curve: 1,
    xtalkGroup: 5,
    xtalkLevel: 4,
  },
  // Pair 5 (In 10+11): Tom 1 Head / Rim
  10: {
    name: 'Tom 1 Head',
    category: 'drums',
    note: 48,
    dual: true,
    threshold: 28,
    gain: 4,
    levelMax: 740,
    autoLevel: false,
    curve: 9,
    xtalkGroup: 4,
    xtalkLevel: 3,
  },
  11: {
    name: 'Tom 1 Rim',
    category: 'drums',
    note: 50,
    type: false,
    threshold: 35,
    gain: 4,
    levelMax: 680,
    autoLevel: false,
    curve: 0,
    xtalkGroup: 4,
    xtalkLevel: 3,
  },
  // Pair 6 (In 12+13): Tom 2 Head / Rim
  12: {
    name: 'Tom 2 Head',
    category: 'drums',
    note: 45,
    dual: true,
    threshold: 28,
    gain: 4,
    levelMax: 750,
    autoLevel: false,
    curve: 9,
    xtalkGroup: 4,
    xtalkLevel: 3,
  },
  13: {
    name: 'Tom 2 Rim',
    category: 'drums',
    note: 47,
    type: false,
    threshold: 35,
    gain: 4,
    levelMax: 680,
    autoLevel: false,
    curve: 0,
    xtalkGroup: 4,
    xtalkLevel: 3,
  },
  // Pair 7 (In 14+15): Tom 3 Floor Head / Rim
  14: {
    name: 'Tom 3 Head',
    category: 'drums',
    note: 43,
    dual: true,
    threshold: 30,
    gain: 4,
    levelMax: 760,
    autoLevel: false,
    curve: 9,
    xtalkGroup: 4,
    xtalkLevel: 3,
  },
  15: {
    name: 'Tom 3 Rim',
    category: 'drums',
    note: 41,
    type: false,
    threshold: 36,
    gain: 4,
    levelMax: 680,
    autoLevel: false,
    curve: 0,
    xtalkGroup: 4,
    xtalkLevel: 3,
  },
  // Pair 8 (In 16+17): Crash 2 Bow / Edge
  16: {
    name: 'Crash 2 Bow',
    category: 'cymbals',
    note: 57,
    dual: true,
    threshold: 28,
    gain: 5,
    levelMax: 710,
    autoLevel: false,
    curve: 1,
    xtalkGroup: 5,
    xtalkLevel: 4,
  },
  17: {
    name: 'Crash 2 Edge',
    category: 'cymbals',
    note: 52,
    type: true,
    threshold: 30,
    gain: 4,
    levelMax: 680,
    autoLevel: false,
    curve: 1,
    xtalkGroup: 5,
    xtalkLevel: 4,
  },
};

const STANDARD_3RD_OVERRIDES: Record<number, Partial<ThirdZoneConfig>> = {
  0: { disabled: true, note: 42, threshold: 90, dampenedNote: 42 }, // HiHat
  1: { disabled: false, note: 37, threshold: 110, dampenedNote: 0 }, // Snare side stick / mid zone
  2: { disabled: false, note: 53, threshold: 95, dampenedNote: 51 }, // Ride Bell + Choke
  3: { disabled: false, note: 55, threshold: 100, dampenedNote: 49 }, // Crash 1 Choke
  7: { disabled: false, note: 52, threshold: 100, dampenedNote: 57 }, // Crash 2 Choke
};

export interface PresetDefinition {
  id: string;
  name: string;
  subtitle: string;
  config: MegaDrumConfig;
}

function buildConfig(
  kitName: string,
  maxInputs: number,
  padOverrides: Record<number, Partial<PadConfig>>,
  thirdOverrides: Record<number, Partial<ThirdZoneConfig>> = STANDARD_3RD_OVERRIDES,
  pedalOverrides: Partial<MegaDrumConfig['pedal']> = {},
  miscOverrides: Partial<MegaDrumConfig['misc']> = {}
): MegaDrumConfig {
  return {
    version: '20250201',
    mcuTypeId: 11, // STM32F446RET6
    kitName,
    chainId: 0,
    global: {
      maxInputs,
      lcdContrast: 55,
      customPadNames: true,
      customConfigNames: true,
      midi2ForSysex: false,
      globalMidiChannel: 10,
      activeSlot: 1,
      configName: kitName.slice(0, 12),
    },
    misc: {
      noteOff: 60,
      latency: 20, // 2.0 ms
      pressroll: 0,
      octaveShift: 0,
      noiseFilter: 5,
      allGainsLow: false,
      bigVuMeter: true,
      bigVuSplit: false,
      quickAccess: true,
      altFalseTrSupp: true,
      inputsPriority: false,
      midiThru: false,
      sendTriggeredIn: false,
      altNoteChoking: true,
      ...miscOverrides,
    },
    pedal: {
      type: 'potentiometer',
      newAlgorithm: true,
      autoLevels: false,
      altIn: false,
      reverseLevels: false,
      softChicks: true,
      curve: 0,
      chickDelay: 25,
      cc: 4,
      ccRdcLvl: 2,
      lowLevel: 120,
      highLevel: 845,
      openLevel: 90,
      semiOpenLevel: 42,
      semiOpenLevel2: 52,
      halfOpenLevel: 68,
      halfOpenLevel2: 78,
      closedLevel: 15,
      shortThres: 35,
      longThres: 85,
      chickThres: 55,
      hhInput: 2,
      chickParam1: 380,
      chickParam2: 210,
      chickParam3: 590,
      chickCurve: 0,
      bowSemiOpenNote: 25,
      edgeSemiOpenNote: 23,
      bellSemiOpenNote: 25,
      bowSemiOpen2Note: 25,
      edgeSemiOpen2Note: 23,
      bellSemiOpen2Note: 25,
      bowHalfOpenNote: 46,
      edgeHalfOpenNote: 24,
      bellHalfOpenNote: 46,
      bowHalfOpen2Note: 46,
      edgeHalfOpen2Note: 24,
      bellHalfOpen2Note: 46,
      bowSemiClosedNote: 42,
      edgeSemiClosedNote: 22,
      bellSemiClosedNote: 42,
      bowClosedNote: 42,
      edgeClosedNote: 22,
      bellClosedNote: 42,
      chickNote: 44,
      splashNote: 21,
      bowOpenNote: 46,
      edgeOpenNote: 26,
      bellOpenNote: 46,
      ...pedalOverrides,
    },
    curves: default16Curves(),
    pads: createBase55Pads(padOverrides),
    thirdZones: createBase27ThirdZones(thirdOverrides),
    positionals: createBase55Positionals(),
    customNames: Array.from({ length: 32 }, (_, i) => `Custom${i + 1}`),
  };
}

export const FACTORY_PRESETS: PresetDefinition[] = [
  {
    id: 'gm-studio',
    name: 'GM Studio Kit (32 Inputs)',
    subtitle: 'Balanced dual-zone mesh pads, 3-way Roland ride, and variable hi-hat pedal',
    config: buildConfig('GM Studio Kit', 32, STANDARD_PAD_OVERRIDES),
  },
  {
    id: 'roland-td',
    name: 'Roland VH-11 / PD-125 / CY-15R',
    subtitle: 'Tuned for hot Roland mesh pads with Exp1 curve and 3-way Roland ride',
    config: buildConfig(
      'Roland Mesh Pro',
      32,
      {
        ...STANDARD_PAD_OVERRIDES,
        4: {
          ...STANDARD_PAD_OVERRIDES[4],
          name: 'PD-125 Head',
          gain: 3,
          threshold: 26,
          levelMax: 910,
          dynLevel: 7,
          dynTime: 4,
          curve: 5,
        },
        6: {
          ...STANDARD_PAD_OVERRIDES[6],
          name: 'CY-15R Bow',
          threeWay: true,
          dual: false,
          minScan: 16,
        },
      },
      STANDARD_3RD_OVERRIDES,
      {
        type: 'foot_controller',
        lowLevel: 95,
        highLevel: 890,
        chickThres: 60,
      }
    ),
  },
  {
    id: 'yamaha-dtx',
    name: 'Yamaha PCY 3-Zone & RHH135',
    subtitle: 'Configured for Yamaha 3-way resistor-mux cymbals and RHH135 hi-hat',
    config: buildConfig(
      'Yamaha PCY Kit',
      32,
      {
        ...STANDARD_PAD_OVERRIDES,
        6: {
          ...STANDARD_PAD_OVERRIDES[6],
          name: 'PCY155 Bow',
          dual: true,
          threeWay: false,
        },
        7: {
          ...STANDARD_PAD_OVERRIDES[7],
          name: 'PCY155 Edge',
          type: true,
        },
        8: {
          ...STANDARD_PAD_OVERRIDES[8],
          name: 'PCY135 Bow',
          dual: true,
          threeWay: false,
        },
        9: {
          ...STANDARD_PAD_OVERRIDES[9],
          name: 'PCY135 Edge',
          type: true,
        },
      },
      {
        ...STANDARD_3RD_OVERRIDES,
        2: { disabled: false, note: 53, threshold: 90, dampenedNote: 51 },
        3: { disabled: false, note: 55, threshold: 95, dampenedNote: 49 },
      },
      {
        reverseLevels: true,
        lowLevel: 140,
        highLevel: 780,
      }
    ),
  },
  {
    id: 'acoustic-hybrid',
    name: 'Acoustic A2E Conversion (56 Inputs)',
    subtitle: 'Full 55-input / 27-pair configuration with tight crosstalk suppression',
    config: buildConfig(
      'A2E 56-Ch Kit',
      56,
      {
        ...STANDARD_PAD_OVERRIDES,
        1: { ...STANDARD_PAD_OVERRIDES[1], threshold: 40, xtalkLevel: 5, minScan: 28 },
        4: { ...STANDARD_PAD_OVERRIDES[4], threshold: 28, xtalkLevel: 4, dynLevel: 8 },
      },
      STANDARD_3RD_OVERRIDES,
      {},
      {
        latency: 15,
        altFalseTrSupp: true,
        allGainsLow: true,
      }
    ),
  },
];

export function cloneConfig(config: MegaDrumConfig): MegaDrumConfig {
  return JSON.parse(JSON.stringify(config)) as MegaDrumConfig;
}
