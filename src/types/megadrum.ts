export type ZoneMode =
  | 'single'
  | 'dual_piezo'
  | 'piezo_switch'
  | 'three_way_roland'
  | 'three_way_yamaha';

export type InputCategory = 'all' | 'drums' | 'cymbals' | 'aux';

export type PadFunctionMode = 'normal' | 'program_change' | 'cut_off';

// Matches MegaDrumManagerFX ConfigPad (55 hardware inputs: 0 = Kick, 1..54 = 27 stereo pairs)
export interface PadConfig {
  id: number; // 1-based MegaDrum hardware input number (1..55)
  name: string;
  customNameIndex: number; // 0 = default hardware name, 1..72 = built-in list, >72 = custom EEPROM name
  category: 'drums' | 'cymbals' | 'aux';
  midiChannel: number; // 1..16 (SysEx stores 0..15)
  padFunction: number; // 0 = Normal, 1 = ProgramChange, 2 = CutOff
  note: number; // 0..127
  altNote: number; // 0..127
  pressrollNote: number; // 0..127
  altNoteLinked: boolean;
  pressrollNoteLinked: boolean;
  disabled: boolean;
  curve: number; // 0..15
  threshold: number; // 0..127
  retrigger: number; // 1..127
  levelMax: number; // 64..1023 (HighLevel)
  minScan: number; // 10..100
  type: boolean; // Right input: false = Piezo, true = Switch (Left input ignores this bit)
  autoLevel: boolean; // HighLevel Auto
  dual: boolean; // Left input: Dual or 3-way Yamaha
  threeWay: boolean; // Left input: 3-way Roland
  gain: number; // 0..8
  xtalkLevel: number; // 0..7
  xtalkGroup: number; // 0..7
  dynTime: number; // 0..15 (UI shows 0..60 ms in steps of 4ms)
  dynLevel: number; // 0..15
  compression: number; // 0..7
  shift: number; // 0..7 (Level Shift: 0, 8, 16, 24, 32, 40, 48, 56)
  rollSmoothLevel: number; // 0..3
  extraFalseSupp: boolean;
}

// Matches MegaDrumManagerFX Config3rd (27 instances, one per stereo pair 1..27)
export interface ThirdZoneConfig {
  id: number; // 0..26 (pair - 1)
  disabled: boolean;
  note: number; // 0..127
  threshold: number; // 0..255
  altNote: number; // 0..127
  pressrollNote: number; // 0..127
  dampenedNote: number; // 0..127
  altNoteLinked: boolean;
  pressrollNoteLinked: boolean;
}

// Matches MegaDrumManagerFX ConfigPositional (55 instances)
export interface PositionalConfig {
  id: number; // 0..54
  level: number; // 0..3 (0=Disabled, 1..3)
  low: number; // 0..100
  high: number; // 0..100
}

export type PedalType = 'potentiometer' | 'foot_controller';

// Matches MegaDrumManagerFX ConfigPedal
export interface PedalConfig {
  type: PedalType; // false=Pot, true=FootContr
  newAlgorithm: boolean;
  autoLevels: boolean;
  altIn: boolean;
  reverseLevels: boolean;
  softChicks: boolean;
  curve: number; // 0..15
  chickDelay: number; // 0..127
  cc: number; // 0..127 (usually 4)
  ccRdcLvl: number; // 0..3
  lowLevel: number; // 0..1023
  highLevel: number; // 0..1023
  openLevel: number; // 0..127
  semiOpenLevel: number; // 0..127
  semiOpenLevel2: number; // 0..127
  halfOpenLevel: number; // 0..127
  halfOpenLevel2: number; // 0..127
  closedLevel: number; // 0..127
  shortThres: number; // 0..127
  longThres: number; // 0..127
  chickThres: number; // 0..127
  hhInput: number; // 2, 4, 6 ... 54
  chickParam1: number; // 0..1023
  chickParam2: number; // 0..1023
  chickParam3: number; // 0..1023
  chickCurve: number; // 0..15
  bowSemiOpenNote: number;
  edgeSemiOpenNote: number;
  bellSemiOpenNote: number;
  bowSemiOpen2Note: number;
  edgeSemiOpen2Note: number;
  bellSemiOpen2Note: number;
  bowHalfOpenNote: number;
  edgeHalfOpenNote: number;
  bellHalfOpenNote: number;
  bowHalfOpen2Note: number;
  edgeHalfOpen2Note: number;
  bellHalfOpen2Note: number;
  bowSemiClosedNote: number;
  edgeSemiClosedNote: number;
  bellSemiClosedNote: number;
  bowClosedNote: number;
  edgeClosedNote: number;
  bellClosedNote: number;
  chickNote: number;
  splashNote: number;
  // Open notes reside on HiHat Bow/Edge/3rd inputs in hardware, kept synced for quick matrix view
  bowOpenNote: number;
  edgeOpenNote: number;
  bellOpenNote: number;
}

// Matches MegaDrumManagerFX ConfigCurve (all 16 curves 0..15 are editable & syncable)
export interface CurveConfig {
  id: number; // 0..15
  name: string;
  points: number[]; // 9 points P1..P9, each 2..255
}

// Matches MegaDrumManagerFX ConfigGlobalMisc (MD_SYSEX_GLOBAL_MISC = 0x09)
export interface GlobalConfig {
  maxInputs: number; // 18..56 (even numbers, inputs_count)
  lcdContrast: number; // 1..100
  customPadNames: boolean;
  customConfigNames: boolean;
  midi2ForSysex: boolean;
  globalMidiChannel: number; // UI convenience (stored per-pad in MD hardware)
  activeSlot: number; // 1..16
  configName: string;
  maxConfigCount?: number;
  configNames?: Record<number, string>;
}

// Matches MegaDrumManagerFX ConfigMisc (MD_SYSEX_MISC = 0x01)
export interface MiscConfig {
  noteOff: number; // 2..200 ms
  latency: number; // 10..100 (1.0..10.0 ms, step 0.5)
  pressroll: number; // 0..noteOff
  octaveShift: number; // 0..4
  noiseFilter: number; // 0..9
  allGainsLow: boolean;
  bigVuMeter: boolean;
  bigVuSplit: boolean;
  quickAccess: boolean;
  altFalseTrSupp: boolean;
  inputsPriority: boolean;
  midiThru: boolean;
  sendTriggeredIn: boolean;
  altNoteChoking: boolean;
}

export interface MegaDrumConfig {
  version: string;
  mcuTypeId: number; // Constants.MCU_TYPES index
  kitName: string;
  chainId: number; // 0..3
  global: GlobalConfig;
  misc: MiscConfig;
  pedal: PedalConfig;
  curves: CurveConfig[]; // 16 curves (0..15)
  pads: PadConfig[]; // 55 inputs (index 0 = input 1 Kick, index 1..54 = pairs 1..27)
  thirdZones: ThirdZoneConfig[]; // 27 third-zone configs (pair 1..27)
  positionals: PositionalConfig[]; // 55 positional sensing configs
}

export type MidiLogEventType =
  | 'note'
  | 'note_off'
  | 'cc'
  | 'sysex'
  | 'aftertouch'
  | 'program'
  | 'system'
  | 'error';

export interface MidiEventLog {
  id: string;
  timestamp: string;
  timestampMs: number;
  direction: 'in' | 'out';
  type: MidiLogEventType;
  channel?: number;
  note?: number;
  velocity?: number;
  cc?: number;
  ccValue?: number;
  program?: number;
  byteLength?: number;
  summary: string;
  rawHex: string;
}

export interface ActiveHit {
  padId: number; // 1..55
  zone: 'head' | 'rim' | 'bell' | 'chick' | 'splash';
  velocity: number;
  timestamp: number;
}

export type SysexStatusCode =
  | 'idle'
  | 'working'
  | 'ok'
  | 'timeout'
  | 'mismatch'
  | 'midi_not_open'
  | 'error';

export interface SysexStatusState {
  code: SysexStatusCode;
  message: string;
  completed?: number;
  total?: number;
}

export type ParamSyncState = 'in_sync' | 'modified' | 'unknown';

export interface FieldSyncInfo<T = number | boolean | string> {
  state: ParamSyncState;
  moduleValue?: T;
}

export interface ModuleSyncSnapshot {
  global: GlobalConfig | null;
  misc: MiscConfig | null;
  pedal: PedalConfig | null;
  pads: (PadConfig | null)[];
  thirdZones: (ThirdZoneConfig | null)[];
  positionals: (PositionalConfig | null)[];
  curves: (CurveConfig | null)[];
}

export const MD_CURVES_LIST: {
  id: number;
  name: string;
  description: string;
  defaultPoints: number[];
}[] = [
  { id: 0, name: 'LinearCustom1', description: '1:1 proportional response (Curve 1)', defaultPoints: [2, 32, 64, 96, 128, 160, 192, 224, 255] },
  { id: 1, name: 'Log1Custom2', description: 'Gentle early boost for light touch (Curve 2)', defaultPoints: [2, 54, 96, 132, 164, 192, 216, 238, 255] },
  { id: 2, name: 'Log2Custom3', description: 'Medium logarithmic mesh curve (Curve 3)', defaultPoints: [2, 72, 122, 162, 192, 214, 232, 245, 255] },
  { id: 3, name: 'Log3Custom4', description: 'Stronger low-velocity sensitivity (Curve 4)', defaultPoints: [2, 92, 148, 186, 212, 230, 242, 250, 255] },
  { id: 4, name: 'Log4Custom5', description: 'Maximum ghost-note boost (Curve 5)', defaultPoints: [2, 110, 166, 200, 222, 236, 246, 251, 255] },
  { id: 5, name: 'Exp1Custom6', description: 'Tames hot piezo soft hits cleanly (Curve 6)', defaultPoints: [2, 16, 36, 62, 94, 132, 172, 214, 255] },
  { id: 6, name: 'Exp2Custom7', description: 'Deep exponential attenuation (Curve 7)', defaultPoints: [2, 10, 22, 42, 68, 102, 144, 196, 255] },
  { id: 7, name: 'S1Custom8', description: 'Controlled low end with smooth midrange (Curve 8)', defaultPoints: [2, 18, 46, 86, 128, 170, 210, 238, 255] },
  { id: 8, name: 'S2Custom9', description: 'Wide dynamic sweet spot for snare (Curve 9)', defaultPoints: [2, 12, 32, 74, 128, 182, 224, 244, 255] },
  { id: 9, name: 'Strong1Custom10', description: 'Raised plateau for punchy velocity (Curve 10)', defaultPoints: [2, 64, 118, 162, 196, 220, 236, 248, 255] },
  { id: 10, name: 'Strong2Custom11', description: 'Compressed high-output curve (Curve 11)', defaultPoints: [2, 86, 144, 184, 214, 234, 246, 252, 255] },
  { id: 11, name: 'MaxCustom12', description: 'High fixed output for switch/pad triggers (Curve 12)', defaultPoints: [255, 255, 255, 255, 255, 255, 255, 255, 255] },
  { id: 12, name: 'Custom13', description: 'User-editable EEPROM curve 13', defaultPoints: [2, 32, 64, 96, 128, 160, 192, 224, 255] },
  { id: 13, name: 'Custom14', description: 'User-editable EEPROM curve 14', defaultPoints: [2, 48, 88, 124, 156, 184, 210, 234, 255] },
  { id: 14, name: 'Custom15', description: 'User-editable EEPROM curve 15', defaultPoints: [2, 18, 40, 72, 112, 156, 198, 232, 255] },
  { id: 15, name: 'Custom16', description: 'User-editable EEPROM curve 16', defaultPoints: [2, 24, 56, 94, 132, 168, 200, 228, 255] },
];

// Backward compatibility alias for components referencing CURVE_DEFINITIONS
export const CURVE_DEFINITIONS = MD_CURVES_LIST.map((c) => ({
  id: c.id,
  name: c.name,
  isCustom: true,
  description: c.description,
  points: c.defaultPoints,
}));

export const MD_PADS_NAMES_LIST = [
  'Kick', 'HiHatB', 'HiHatE', 'SnareH', 'SnareR', 'RideB', 'RideE', 'CrashB', 'CrashE',
  'Tom1H', 'Tom1R', 'Tom2H', 'Tom2R', 'Tom3H', 'Tom3R', 'Tom4H', 'Tom4R',
  'Aux1H', 'Aux1R', 'Aux2H', 'Aux2R', 'Aux3H', 'Aux3R', 'Aux4H', 'Aux4R',
  'Aux5H', 'Aux5R', 'Aux6H', 'Aux6R', 'Aux7H', 'Aux7R', 'Aux8H', 'Aux8R',
  'Aux9H', 'Aux9R', 'Aux10H', 'Aux10R', 'Aux11H', 'Aux11R', 'Aux12H', 'Aux12R',
  'Aux13H', 'Aux13R', 'Aux14H', 'Aux14R', 'Aux15H', 'Aux15R', 'Aux16H', 'Aux16R',
  'Aux17H', 'Aux17R', 'Aux18H', 'Aux18R', 'Aux19H', 'Aux19R',
] as const;

export const MD_CUSTOM_PADS_NAMES_LIST = [
  'Kick', 'HiHat', 'Snare1', 'Snare2', 'Ride1', 'Ride2', 'Crash1', 'Crash2', 'Tom1',
  'Tom2', 'Tom3', 'Tom4', 'Tom5', 'Tom6', 'Chinese1', 'Chinese2', 'Tambrn1', 'Tambrn2',
  'Cowbell1', 'Cowbell2', 'Bongo1', 'Bongo2', 'Conga1', 'Conga2', 'Conga3', 'Timbale1',
  'Timbale2', 'Agogo1', 'Agogo2', 'Claves1', 'Claves2', 'Wood1', 'Wood2', 'Cuica1',
  'Cuica2', 'Triangl1', 'Triangl2', 'Bass1', 'Bass2', 'Sizzle1', 'Sizzle2', 'Splash1',
  'Splash2', 'Swish1', 'Swish2', 'Clash1', 'Clash2', 'Chenda1', 'Chenda2', 'Tenor1',
  'Tenor2', 'Timpani1', 'Timpani2', 'Timpani3', 'Timpani4', 'Crash3', 'Crash4', 'Crash5',
  'Splash3', 'Splash4', 'Splash5', 'RotoTom1', 'RotoTom2', 'RotoTom3', 'Sticks1',
  'Sticks2', 'Sticks3', 'HndClap1', 'HndClap2', 'HndClap3', 'FngrSnap', 'Mtronome',
] as const;

export const MD_MCU_TYPES = [
  'Unknown',
  'Atmega644',
  'Atmega1284',
  'STM32F103VBT6',
  'STM32F103RBT6',
  'STM32F103RCT6',
  'STM32F205RBT6',
  'STM32F205RCT6',
  'STM32F205LITE',
  'STM32F205TEST1',
  'STM32F446RCT6',
  'STM32F446RET6',
  'STM32F405RGT6',
  'GD32F405RGT6',
  'STM32TEST14',
] as const;

export const PAD_LEVEL_SHIFT_VALUES = [0, 8, 16, 24, 32, 40, 48, 56] as const;
export const PAD_DYN_TIME_VALUES = [0, 4, 8, 12, 16, 20, 24, 28, 32, 36, 40, 44, 48, 52, 56, 60] as const;
export const PAD_FUNCTION_LABELS = ['Normal', 'Program Change', 'Cut Off'] as const;

export const GM_DRUM_MAP: Record<number, string> = {
  0: 'Off / Disabled',
  21: 'Hi-Hat Splash',
  22: 'Hi-Hat Closed Edge',
  23: 'Hi-Hat Half Open Edge',
  24: 'Hi-Hat Open Edge',
  25: 'Hi-Hat Semi-Open Bow',
  26: 'Hi-Hat Open Edge (Alt)',
  27: 'High Q / Aux',
  35: 'Acoustic Bass Drum',
  36: 'Bass Drum 1 (Kick)',
  37: 'Side Stick / Rim Click',
  38: 'Acoustic Snare',
  39: 'Hand Clap',
  40: 'Electric Snare (Rimshot)',
  41: 'Low Floor Tom',
  42: 'Closed Hi-Hat',
  43: 'High Floor Tom',
  44: 'Pedal Hi-Hat (Chick)',
  45: 'Low Tom',
  46: 'Open Hi-Hat',
  47: 'Low-Mid Tom',
  48: 'Hi-Mid Tom',
  49: 'Crash Cymbal 1',
  50: 'High Tom',
  51: 'Ride Cymbal 1 (Bow)',
  52: 'Chinese Cymbal',
  53: 'Ride Bell',
  54: 'Tambourine',
  55: 'Splash Cymbal',
  56: 'Cowbell',
  57: 'Crash Cymbal 2',
  58: 'Vibraslap',
  59: 'Ride Cymbal 2 (Edge)',
  60: 'Hi Bongo',
  61: 'Low Bongo',
  62: 'Mute Hi Conga',
  63: 'Open Hi Conga',
  64: 'Low Conga',
  75: 'Claves',
  76: 'Hi Wood Block',
  77: 'Low Wood Block',
};

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export function formatMidiNote(note: number): { pitch: string; label: string } {
  const clamped = Math.max(0, Math.min(127, Math.round(note)));
  const octave = Math.floor(clamped / 12) - 1;
  const pitch = `${NOTE_NAMES[clamped % 12]}${octave}`;
  const label = GM_DRUM_MAP[clamped] || 'Custom Note';
  return { pitch, label };
}

export function getPairZoneMode(leftPad: PadConfig, rightPad?: PadConfig): ZoneMode {
  if (!leftPad.dual && !leftPad.threeWay) return 'single';
  if (leftPad.threeWay) return 'three_way_roland';
  if (rightPad?.type) return 'piezo_switch';
  return 'dual_piezo';
}
