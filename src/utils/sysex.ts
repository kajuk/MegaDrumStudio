import {
  MD_MCU_TYPES,
  MegaDrumConfig,
  PadConfig,
  PositionalConfig,
  ThirdZoneConfig,
} from '../types/megadrum';
import { cloneConfig } from '../data/presets';

// Official MegaDrum Manager FX SysEx protocol constants
export const SYSEX_START = 0xf0;
export const SYSEX_END = 0xf7;
export const MD_SYSEX = 0x70;

export const MCU_TYPE_STM32F205TEST1 = 9;

export const MD_SYSEX_CMD = {
  MISC: 0x01,
  PEDAL: 0x02,
  PAD: 0x03,
  THIRD_ZONE: 0x04,
  VERSION: 0x05,
  CURVE: 0x06,
  POS: 0x07,
  CUSTOM_NAME: 0x08,
  GLOBAL_MISC: 0x09,
  BOOTLOADER: 0x0b,
  MCU_TYPE: 0x0c,
  CONFIG_NAME: 0x0d,
  CONFIG_COUNT: 0x0e,
  CONFIG_SAVE: 0x0f,
  CONFIG_CURRENT: 0x10,
  CONFIG_LOAD: 0x11,
  PEDAL_LEVEL_RAW: 0x12,
} as const;

export const MD_SYSEX_SIZE = {
  MISC: 19,
  PEDAL: 95,
  PEDAL_OLD: 79,
  PAD: 36,
  THIRD_ZONE: 16,
  VERSION: 13,
  CURVE: 24,
  POS: 12,
  CUSTOM_NAME: 22,
  GLOBAL_MISC: 13,
  MCU_TYPE: 7,
  CONFIG_NAME: 30,
  CONFIG_COUNT: 6,
  CONFIG_SAVE: 6,
  CONFIG_CURRENT: 6,
  CONFIG_LOAD: 6,
  PEDAL_LEVEL_RAW: 9,
} as const;

export const FW_ERROR = {
  NO_RESPONSE: 0x00,
  OK: 0x11,
  CRC: 0x22,
  READ: 0x23,
} as const;

export const MD_SYSEX_NAMES: Record<number, string> = {
  0x01: 'Misc',
  0x02: 'Pedal',
  0x03: 'Input',
  0x04: '3rd Zone',
  0x05: 'Version',
  0x06: 'Curve',
  0x07: 'Positional',
  0x08: 'Custom Name',
  0x09: 'Global Misc',
  0x0b: 'Bootloader',
  0x0c: 'MCU Type',
  0x0d: 'Config Name',
  0x0e: 'Config Count',
  0x0f: 'Config Save',
  0x10: 'Config Current',
  0x11: 'Config Load',
  0x12: 'Pedal Level Raw',
};

// Official Utils.java nibble conversions
export function byte2sysex(b: number): [number, number] {
  const v = b & 0xff;
  return [(v & 0xf0) >> 4, v & 0x0f];
}

export function short2sysex(s: number): [number, number, number, number] {
  const v = s & 0xffff;
  return [
    (v & 0x00f0) >> 4,
    v & 0x000f,
    (v & 0xf000) >> 12,
    (v & 0x0f00) >> 8,
  ];
}

export function sysex2byte(b0: number, b1: number): number {
  return (((b0 & 0x0f) << 4) | (b1 & 0x0f)) & 0xff;
}

export function sysex2short(b0: number, b1: number, b2 = 0, b3 = 0): number {
  return (
    (((b0 & 0x0f) << 4) |
      (b1 & 0x0f) |
      ((b2 & 0x0f) << 12) |
      ((b3 & 0x0f) << 8)) &
    0xffff
  );
}

export function formatBytesHex(bytes: Uint8Array | number[]): string {
  return Array.from(bytes)
    .map((b) => (b & 0xff).toString(16).toUpperCase().padStart(2, '0'))
    .join(' ');
}

export function splitSysexStream(buffer: Uint8Array): Uint8Array[] {
  const packets: Uint8Array[] = [];
  let start = -1;
  for (let i = 0; i < buffer.length; i++) {
    if (buffer[i] === SYSEX_START) {
      start = i;
    } else if (buffer[i] === SYSEX_END && start !== -1) {
      packets.push(buffer.slice(start, i + 1));
      start = -1;
    }
  }
  return packets;
}

// =========================================================================
// Request Packets (exact Midi_handler.java framing)
// =========================================================================

// 5-byte requests: MISC, PEDAL, VERSION, GLOBAL_MISC, MCU_TYPE, CONFIG_COUNT, CONFIG_CURRENT, PEDAL_LEVEL_RAW
export function buildShortRequest(cmd: number, chainId = 0): Uint8Array {
  return new Uint8Array([SYSEX_START, MD_SYSEX, chainId & 0x7f, cmd & 0x7f, SYSEX_END]);
}

// 6-byte requests: PAD (1-based 1..55!), 3RD (0..26), CURVE (0..15), POS (0..54), CONFIG_SAVE, CONFIG_LOAD
export function buildIdRequest(cmd: number, id: number, chainId = 0): Uint8Array {
  return new Uint8Array([
    SYSEX_START,
    MD_SYSEX,
    chainId & 0x7f,
    cmd & 0x7f,
    id & 0x7f,
    SYSEX_END,
  ]);
}

export function buildRequestPadSysex(padIndex0Based: number, chainId = 0): Uint8Array {
  // MidiController.java line 371: MD_SYSEX_PAD requests use 1-based sysex[4] = id + 1
  return buildIdRequest(MD_SYSEX_CMD.PAD, padIndex0Based + 1, chainId);
}

export function buildRequest3rdSysex(pairIndex0Based: number, chainId = 0): Uint8Array {
  return buildIdRequest(MD_SYSEX_CMD.THIRD_ZONE, pairIndex0Based, chainId);
}

export function buildRequestPosSysex(posId: number, chainId = 0): Uint8Array {
  return buildIdRequest(MD_SYSEX_CMD.POS, posId, chainId);
}

export function buildRequestCurveSysex(curveIndex0Based: number, chainId = 0): Uint8Array {
  return buildIdRequest(MD_SYSEX_CMD.CURVE, curveIndex0Based, chainId);
}

export function buildRequestPedalSysex(chainId = 0): Uint8Array {
  return buildShortRequest(MD_SYSEX_CMD.PEDAL, chainId);
}

export function buildRequestPedalRawSysex(chainId = 0): Uint8Array {
  return buildShortRequest(MD_SYSEX_CMD.PEDAL_LEVEL_RAW, chainId);
}

export function buildRequestGlobalMiscSysex(chainId = 0): Uint8Array {
  return buildShortRequest(MD_SYSEX_CMD.GLOBAL_MISC, chainId);
}

export function buildRequestMiscSysex(chainId = 0): Uint8Array {
  return buildShortRequest(MD_SYSEX_CMD.MISC, chainId);
}

export function buildRequestVersionSysex(chainId = 0): Uint8Array {
  return buildShortRequest(MD_SYSEX_CMD.VERSION, chainId);
}

export function buildRequestMcuSysex(chainId = 0): Uint8Array {
  return buildShortRequest(MD_SYSEX_CMD.MCU_TYPE, chainId);
}

export function buildSaveSlotSysex(slot0Based: number, chainId = 0): Uint8Array {
  return buildIdRequest(MD_SYSEX_CMD.CONFIG_SAVE, slot0Based, chainId);
}

export function buildLoadSlotSysex(slot0Based: number, chainId = 0): Uint8Array {
  return buildIdRequest(MD_SYSEX_CMD.CONFIG_LOAD, slot0Based, chainId);
}

export function buildRequestConfigCountSysex(chainId = 0): Uint8Array {
  return buildShortRequest(MD_SYSEX_CMD.CONFIG_COUNT, chainId);
}

export function buildRequestConfigCurrentSysex(chainId = 0): Uint8Array {
  return buildShortRequest(MD_SYSEX_CMD.CONFIG_CURRENT, chainId);
}

export function buildRequestConfigNameSysex(slot0Based: number, chainId = 0): Uint8Array {
  return buildIdRequest(MD_SYSEX_CMD.CONFIG_NAME, slot0Based, chainId);
}

export function buildSaveConfigNameSysex(slot0Based: number, name: string, chainId = 0): Uint8Array {
  const bytes: number[] = [
    SYSEX_START,
    MD_SYSEX,
    chainId & 0x7f,
    MD_SYSEX_CMD.CONFIG_NAME,
    slot0Based & 0x7f,
  ];
  const trimmed = (name || '').slice(0, 16);
  for (let i = 0; i < 16; i++) {
    const charCode = i < trimmed.length ? trimmed.charCodeAt(i) : 0x20;
    bytes.push(...byte2sysex(charCode));
  }
  bytes.push(SYSEX_END);
  return new Uint8Array(bytes);
}

export function calculateMaxEEPROMSlots(
  maxInputs: number,
  customPadNames: boolean,
  customConfigNames: boolean
): number {
  let count = 16;
  if (maxInputs > 48) count = customPadNames ? 6 : 8;
  else if (maxInputs > 36) count = customPadNames ? 8 : 10;
  else if (maxInputs > 24) count = customPadNames ? 12 : 14;
  else count = customPadNames ? 14 : 16;

  if (customConfigNames) {
    count = Math.max(4, count - 2);
  }
  return Math.max(4, Math.min(16, count));
}

// Exact 21-byte requestArmBootloader from Midi_handler.java lines 400-420
export function buildBootloaderEnterPacket(chainId = 0): Uint8Array {
  return new Uint8Array([
    SYSEX_START,
    MD_SYSEX,
    chainId & 0x7f,
    MD_SYSEX_CMD.BOOTLOADER,
    0x09, 0x03, 0x0a, 0x07,
    0x0c, 0x01, 0x05, 0x0d,
    0x03, 0x0f, 0x0e, 0x06,
    0x04, 0x0b, 0x00, 0x05,
    SYSEX_END,
  ]);
}

// =========================================================================
// Config Encoders (exact Config*.getSysexFromConfig implementations)
// =========================================================================

export function encodeGlobalMiscSysex(config: MegaDrumConfig): Uint8Array {
  const g = config.global;
  const flags =
    ((g.customPadNames ? 1 : 0) << 1) |
    ((g.customConfigNames ? 1 : 0) << 2) |
    ((g.midi2ForSysex ? 1 : 0) << 5);

  return new Uint8Array([
    SYSEX_START,
    MD_SYSEX,
    config.chainId & 0x7f,
    MD_SYSEX_CMD.GLOBAL_MISC,
    ...byte2sysex(100 - Math.max(1, Math.min(100, g.lcdContrast))),
    ...byte2sysex(Math.max(18, Math.min(56, g.maxInputs))),
    ...short2sysex(flags),
    SYSEX_END,
  ]);
}

export function encodeMiscSysex(config: MegaDrumConfig): Uint8Array {
  const m = config.misc;
  const flags =
    (m.allGainsLow ? 1 : 0) |
    ((m.altNoteChoking ? 1 : 0) << 1) |
    ((m.bigVuMeter ? 1 : 0) << 2) |
    ((m.quickAccess ? 1 : 0) << 3) |
    ((m.bigVuSplit ? 1 : 0) << 4) |
    ((m.altFalseTrSupp ? 1 : 0) << 5) |
    ((m.inputsPriority ? 1 : 0) << 6) |
    ((m.midiThru ? 1 : 0) << 8) |
    ((m.sendTriggeredIn ? 1 : 0) << 11);

  return new Uint8Array([
    SYSEX_START,
    MD_SYSEX,
    config.chainId & 0x7f,
    MD_SYSEX_CMD.MISC,
    ...byte2sysex(m.noteOff),
    ...byte2sysex(m.latency),
    ...short2sysex(flags),
    ...byte2sysex(m.pressroll),
    ...byte2sysex(m.octaveShift),
    ...byte2sysex(m.noiseFilter & 0x0f),
    SYSEX_END,
  ]);
}

export function encodePadSysex(pad: PadConfig, chainId = 0): Uint8Array {
  const channel0 = Math.max(0, Math.min(15, pad.midiChannel - 1));
  const flags1 =
    (pad.type ? 1 : 0) |
    ((pad.autoLevel ? 1 : 0) << 1) |
    ((pad.dual ? 1 : 0) << 2) |
    ((pad.threeWay ? 1 : 0) << 3) |
    ((pad.gain & 0x0f) << 4);
  const flags2 = (pad.extraFalseSupp ? 1 : 0) | ((pad.rollSmoothLevel & 0x03) << 1);

  return new Uint8Array([
    SYSEX_START,
    MD_SYSEX,
    chainId & 0x7f,
    MD_SYSEX_CMD.PAD,
    pad.id & 0x7f, // ConfigPad.java: sysex[4] = id + 1 (pad.id is 1-based 1..55!)
    ...byte2sysex((pad.note & 0x7f) | (pad.disabled ? 0x80 : 0)),
    ...byte2sysex((channel0 << 4) | (pad.curve & 0x0f)),
    ...byte2sysex(pad.threshold),
    ...byte2sysex(pad.retrigger),
    ...short2sysex(pad.levelMax),
    ...byte2sysex(pad.minScan),
    ...byte2sysex(flags1),
    ...byte2sysex(((pad.xtalkGroup & 0x07) << 3) | (pad.xtalkLevel & 0x07)),
    ...byte2sysex(((pad.dynLevel & 0x0f) << 4) | (pad.dynTime & 0x0f)),
    ...byte2sysex(((pad.padFunction & 0x03) << 6) | ((pad.shift & 0x07) << 3) | (pad.compression & 0x07)),
    ...byte2sysex(pad.customNameIndex),
    ...byte2sysex(flags2),
    ...byte2sysex(pad.pressrollNote),
    ...byte2sysex(pad.altNote),
    SYSEX_END,
  ]);
}

export function encode3rdSysex(zone: ThirdZoneConfig, chainId = 0): Uint8Array {
  return new Uint8Array([
    SYSEX_START,
    MD_SYSEX,
    chainId & 0x7f,
    MD_SYSEX_CMD.THIRD_ZONE,
    zone.id & 0x7f,
    ...byte2sysex((zone.note & 0x7f) | (zone.disabled ? 0x80 : 0)),
    ...byte2sysex(zone.threshold),
    ...byte2sysex(zone.pressrollNote),
    ...byte2sysex(zone.altNote),
    ...byte2sysex(zone.dampenedNote),
    SYSEX_END,
  ]);
}

export function encodePositionalSysex(
  pos: PositionalConfig,
  sysexPosId = pos.id,
  chainId = 0
): Uint8Array {
  return new Uint8Array([
    SYSEX_START,
    MD_SYSEX,
    chainId & 0x7f,
    MD_SYSEX_CMD.POS,
    sysexPosId & 0x7f,
    ...byte2sysex(pos.level),
    ...byte2sysex(pos.low),
    ...byte2sysex(pos.high),
    SYSEX_END,
  ]);
}

export function encodeCurveSysex(curveIndex: number, points: number[], chainId = 0): Uint8Array {
  const bytes: number[] = [
    SYSEX_START,
    MD_SYSEX,
    chainId & 0x7f,
    MD_SYSEX_CMD.CURVE,
    curveIndex & 0x7f,
  ];
  for (let p = 0; p < 9; p++) {
    bytes.push(...byte2sysex(points[p] ?? 2));
  }
  bytes.push(SYSEX_END);
  return new Uint8Array(bytes);
}

export function encodePedalSysex(config: MegaDrumConfig): Uint8Array {
  const p = config.pedal;
  const isOldMcu = config.mcuTypeId === MCU_TYPE_STM32F205TEST1;
  const flags1 =
    (p.type === 'foot_controller' ? 1 : 0) |
    ((p.autoLevels ? 1 : 0) << 1) |
    ((p.altIn ? 1 : 0) << 2) |
    ((p.reverseLevels ? 1 : 0) << 3) |
    ((p.curve & 0x0f) << 4);
  const flags2 =
    (p.softChicks ? 1 : 0) |
    ((p.ccRdcLvl & 0x03) << 1) |
    ((p.newAlgorithm ? 1 : 0) << 3);

  const out: number[] = [
    SYSEX_START,
    MD_SYSEX,
    config.chainId & 0x7f,
    MD_SYSEX_CMD.PEDAL,
    ...byte2sysex(flags1),
    ...byte2sysex(p.chickDelay),
    ...byte2sysex(p.cc),
    ...short2sysex(p.lowLevel),
    ...short2sysex(p.highLevel),
    ...byte2sysex(p.openLevel),
    ...byte2sysex(p.closedLevel),
    ...byte2sysex(p.shortThres),
    ...byte2sysex(p.longThres),
    ...byte2sysex(p.hhInput),
    ...byte2sysex(flags2),
    ...byte2sysex(p.semiOpenLevel),
    ...byte2sysex(p.halfOpenLevel),
    ...byte2sysex(p.chickThres),
    ...short2sysex(p.chickParam1),
    ...short2sysex(p.chickParam2),
    ...short2sysex(p.chickParam3),
    ...byte2sysex(p.chickCurve & 0x0f),
  ];

  if (!isOldMcu) {
    out.push(...byte2sysex(p.semiOpenLevel2), ...byte2sysex(p.halfOpenLevel2));
  }
  out.push(
    ...byte2sysex(p.bowSemiOpenNote),
    ...byte2sysex(p.edgeSemiOpenNote),
    ...byte2sysex(p.bellSemiOpenNote)
  );
  if (!isOldMcu) {
    out.push(
      ...byte2sysex(p.bowSemiOpen2Note),
      ...byte2sysex(p.edgeSemiOpen2Note),
      ...byte2sysex(p.bellSemiOpen2Note)
    );
  }
  out.push(
    ...byte2sysex(p.bowHalfOpenNote),
    ...byte2sysex(p.edgeHalfOpenNote),
    ...byte2sysex(p.bellHalfOpenNote)
  );
  if (!isOldMcu) {
    out.push(
      ...byte2sysex(p.bowHalfOpen2Note),
      ...byte2sysex(p.edgeHalfOpen2Note),
      ...byte2sysex(p.bellHalfOpen2Note)
    );
  }
  out.push(
    ...byte2sysex(p.bowSemiClosedNote),
    ...byte2sysex(p.edgeSemiClosedNote),
    ...byte2sysex(p.bellSemiClosedNote),
    ...byte2sysex(p.bowClosedNote),
    ...byte2sysex(p.edgeClosedNote),
    ...byte2sysex(p.bellClosedNote),
    ...byte2sysex(p.chickNote),
    ...byte2sysex(p.splashNote),
    SYSEX_END
  );

  return new Uint8Array(out);
}

// Helper: positional ID mapping for Atmega vs STM32 (Controller.java lines 1734-1755)
export function getSysexPosIdForInput(inputIndex0Based: number, mcuTypeId: number): number | null {
  if (mcuTypeId > 2 || mcuTypeId === 0) {
    return inputIndex0Based;
  }
  if (inputIndex0Based > 2 && (inputIndex0Based & 1) > 0) {
    const idx = (inputIndex0Based - 3) / 2;
    if ((idx < 4 && mcuTypeId === 1) || (idx < 8 && mcuTypeId === 2)) {
      return idx;
    }
  }
  return null;
}

export function buildFullConfigSyxFile(config: MegaDrumConfig): Uint8Array {
  const chunks: Uint8Array[] = [
    encodeGlobalMiscSysex(config),
    encodeMiscSysex(config),
    encodePedalSysex(config),
  ];

  const count = Math.min(config.pads.length, Math.max(17, config.global.maxInputs - 1));
  for (let i = 0; i < count; i++) {
    chunks.push(encodePadSysex(config.pads[i], config.chainId));
    const posId = getSysexPosIdForInput(i, config.mcuTypeId);
    if (posId !== null && config.positionals[i]) {
      chunks.push(encodePositionalSysex(config.positionals[i], posId, config.chainId));
    }
    if ((i & 1) > 0) {
      const zIdx = (i - 1) / 2;
      if (config.thirdZones[zIdx]) {
        chunks.push(encode3rdSysex(config.thirdZones[zIdx], config.chainId));
      }
    }
  }

  for (let c = 0; c < config.curves.length; c++) {
    chunks.push(encodeCurveSysex(c, config.curves[c].points, config.chainId));
  }

  const totalLen = chunks.reduce((sum, c) => sum + c.length, 0);
  const out = new Uint8Array(totalLen);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

// =========================================================================
// Incoming SysEx Decoder (exact Controller.processSysex + Config*.setConfigFromSysex)
// =========================================================================

export interface DecodedSysexResult {
  cmd: number;
  id?: number;
  updated: MegaDrumConfig;
  description: string;
  pedalRawLevel?: number;
}

export function applyIncomingSysexPacket(
  packet: Uint8Array,
  current: MegaDrumConfig
): DecodedSysexResult | null {
  if (
    packet.length < 6 ||
    packet[0] !== SYSEX_START ||
    packet[1] !== MD_SYSEX ||
    packet[packet.length - 1] !== SYSEX_END
  ) {
    return null;
  }

  const cmd = packet[3];
  const pointer = packet[4];
  const next = cloneConfig(current);

  if (cmd === MD_SYSEX_CMD.GLOBAL_MISC && packet.length >= MD_SYSEX_SIZE.GLOBAL_MISC) {
    let i = 4;
    next.global.lcdContrast = 100 - sysex2byte(packet[i++], packet[i++]);
    next.global.maxInputs = Math.max(18, Math.min(56, sysex2byte(packet[i++], packet[i++])));
    const flags = sysex2short(packet[i++], packet[i++], packet[i++], packet[i++]);
    next.global.customPadNames = (flags & (1 << 1)) !== 0;
    next.global.customConfigNames = (flags & (1 << 2)) !== 0;
    next.global.midi2ForSysex = (flags & (1 << 5)) !== 0;
    return {
      cmd,
      updated: next,
      description: `Global Misc synced (${next.global.maxInputs} inputs, LCD ${next.global.lcdContrast}%)`,
    };
  }

  if (cmd === MD_SYSEX_CMD.MISC && packet.length >= MD_SYSEX_SIZE.MISC) {
    let i = 4;
    next.misc.noteOff = sysex2short(packet[i++], packet[i++], 0, 0);
    next.misc.latency = sysex2byte(packet[i++], packet[i++]);
    const flags = sysex2short(packet[i++], packet[i++], packet[i++], packet[i++]);
    next.misc.pressroll = sysex2short(packet[i++], packet[i++], 0, 0);
    next.misc.octaveShift = sysex2byte(packet[i++], packet[i++]);
    next.misc.noiseFilter = sysex2byte(packet[i++], packet[i++]) & 0x0f;
    next.misc.allGainsLow = (flags & 1) !== 0;
    next.misc.altNoteChoking = (flags & (1 << 1)) !== 0;
    next.misc.bigVuMeter = (flags & (1 << 2)) !== 0;
    next.misc.quickAccess = (flags & (1 << 3)) !== 0;
    next.misc.bigVuSplit = (flags & (1 << 4)) !== 0;
    next.misc.altFalseTrSupp = (flags & (1 << 5)) !== 0;
    next.misc.inputsPriority = (flags & (1 << 6)) !== 0;
    next.misc.midiThru = (flags & (1 << 8)) !== 0;
    next.misc.sendTriggeredIn = (flags & (1 << 11)) !== 0;
    return {
      cmd,
      updated: next,
      description: `Misc synced (Latency ${(next.misc.latency / 10).toFixed(1)} ms)`,
    };
  }

  if (cmd === MD_SYSEX_CMD.PAD && packet.length >= MD_SYSEX_SIZE.PAD) {
    const idx = pointer - 1;
    if (idx >= 0 && idx < next.pads.length) {
      const p = next.pads[idx];
      let i = 5;
      const bNote = sysex2byte(packet[i++], packet[i++]);
      p.disabled = (bNote & 0x80) > 0;
      p.note = bNote & 0x7f;

      const bChCurve = sysex2byte(packet[i++], packet[i++]);
      p.curve = bChCurve & 0x0f;
      p.midiChannel = ((bChCurve & 0xf0) >> 4) + 1;

      p.threshold = sysex2byte(packet[i++], packet[i++]);
      p.retrigger = Math.max(1, sysex2byte(packet[i++], packet[i++]));
      p.levelMax = sysex2short(packet[i++], packet[i++], packet[i++], packet[i++]);
      p.minScan = sysex2byte(packet[i++], packet[i++]);

      const bType = sysex2byte(packet[i++], packet[i++]);
      p.gain = (bType & 0xf0) >> 4;
      p.type = (bType & 1) !== 0;
      p.autoLevel = (bType & (1 << 1)) !== 0;
      p.dual = (bType & (1 << 2)) !== 0;
      p.threeWay = (bType & (1 << 3)) !== 0;

      const bXtalk = sysex2byte(packet[i++], packet[i++]);
      p.xtalkGroup = (bXtalk & 0x38) >> 3;
      p.xtalkLevel = bXtalk & 0x07;

      const bDyn = sysex2byte(packet[i++], packet[i++]);
      p.dynTime = bDyn & 0x0f;
      p.dynLevel = (bDyn & 0xf0) >> 4;

      const bComp = sysex2byte(packet[i++], packet[i++]);
      p.compression = bComp & 0x07;
      p.shift = (bComp & 0x38) >> 3;
      p.padFunction = (bComp & 0xc0) >> 6;

      p.customNameIndex = sysex2byte(packet[i++], packet[i++]);

      const bRoll = sysex2byte(packet[i++], packet[i++]);
      p.extraFalseSupp = (bRoll & 0x01) !== 0;
      p.rollSmoothLevel = (bRoll & 0x06) >> 1;

      p.pressrollNote = sysex2byte(packet[i++], packet[i++]);
      p.altNote = sysex2byte(packet[i++], packet[i++]);

      return {
        cmd,
        id: pointer,
        updated: next,
        description: `Input ${p.id} (${p.name}) synced from MegaDrum`,
      };
    }
  }

  if (cmd === MD_SYSEX_CMD.THIRD_ZONE && packet.length >= MD_SYSEX_SIZE.THIRD_ZONE) {
    if (pointer >= 0 && pointer < next.thirdZones.length) {
      const z = next.thirdZones[pointer];
      let i = 5;
      const bNote = sysex2byte(packet[i++], packet[i++]);
      z.note = bNote & 0x7f;
      z.disabled = (bNote & 0x80) > 0;
      z.threshold = sysex2byte(packet[i++], packet[i++]);
      z.pressrollNote = sysex2byte(packet[i++], packet[i++]);
      z.altNote = sysex2byte(packet[i++], packet[i++]);
      z.dampenedNote = sysex2byte(packet[i++], packet[i++]);
      return {
        cmd,
        id: pointer,
        updated: next,
        description: `3rd Zone (Pair ${pointer + 1}) synced from MegaDrum`,
      };
    }
  }

  if (cmd === MD_SYSEX_CMD.POS && packet.length >= MD_SYSEX_SIZE.POS) {
    let realIdx = pointer;
    if (next.mcuTypeId > 0 && next.mcuTypeId < 3) {
      realIdx = pointer * 2 + 3;
    }
    if (realIdx >= 0 && realIdx < next.positionals.length) {
      let i = 5;
      next.positionals[realIdx].level = sysex2byte(packet[i++], packet[i++]);
      next.positionals[realIdx].low = sysex2byte(packet[i++], packet[i++]);
      next.positionals[realIdx].high = sysex2byte(packet[i++], packet[i++]);
      return {
        cmd,
        id: pointer,
        updated: next,
        description: `Positional sensing (Input ${realIdx + 1}) synced`,
      };
    }
  }

  if (cmd === MD_SYSEX_CMD.CURVE && packet.length >= MD_SYSEX_SIZE.CURVE) {
    if (pointer >= 0 && pointer < next.curves.length) {
      const pts: number[] = [];
      let i = 5;
      for (let p = 0; p < 9; p++) {
        pts.push(sysex2byte(packet[i++], packet[i++]));
      }
      next.curves[pointer].points = pts;
      return {
        cmd,
        id: pointer,
        updated: next,
        description: `Curve ${pointer + 1} (${next.curves[pointer].name}) synced from MegaDrum`,
      };
    }
  }

  if (
    cmd === MD_SYSEX_CMD.PEDAL &&
    packet.length >=
      (next.mcuTypeId === MCU_TYPE_STM32F205TEST1
        ? MD_SYSEX_SIZE.PEDAL_OLD
        : MD_SYSEX_SIZE.PEDAL_OLD)
  ) {
    const isOld =
      next.mcuTypeId === MCU_TYPE_STM32F205TEST1 ||
      packet.length < MD_SYSEX_SIZE.PEDAL;
    const ped = next.pedal;
    let i = 4;
    const f1 = sysex2byte(packet[i++], packet[i++]);
    ped.type = (f1 & 1) !== 0 ? 'foot_controller' : 'potentiometer';
    ped.autoLevels = (f1 & (1 << 1)) !== 0;
    ped.altIn = (f1 & (1 << 2)) !== 0;
    ped.reverseLevels = (f1 & (1 << 3)) !== 0;
    ped.curve = (f1 & 0xf0) >> 4;

    ped.chickDelay = sysex2byte(packet[i++], packet[i++]);
    ped.cc = sysex2byte(packet[i++], packet[i++]);
    ped.lowLevel = sysex2short(packet[i++], packet[i++], packet[i++], packet[i++]);
    ped.highLevel = sysex2short(packet[i++], packet[i++], packet[i++], packet[i++]);
    ped.openLevel = sysex2byte(packet[i++], packet[i++]);
    ped.closedLevel = sysex2byte(packet[i++], packet[i++]);
    ped.shortThres = sysex2byte(packet[i++], packet[i++]);
    ped.longThres = sysex2byte(packet[i++], packet[i++]);
    ped.hhInput = sysex2byte(packet[i++], packet[i++]);

    const f2 = sysex2byte(packet[i++], packet[i++]);
    ped.softChicks = (f2 & 1) !== 0;
    ped.ccRdcLvl = (f2 & 0x06) >> 1;
    ped.newAlgorithm = ((f2 & 0x08) >> 3) !== 0;

    ped.semiOpenLevel = sysex2byte(packet[i++], packet[i++]);
    ped.halfOpenLevel = sysex2byte(packet[i++], packet[i++]);
    ped.chickThres = sysex2byte(packet[i++], packet[i++]);
    ped.chickParam1 = sysex2short(packet[i++], packet[i++], packet[i++], packet[i++]);
    ped.chickParam2 = sysex2short(packet[i++], packet[i++], packet[i++], packet[i++]);
    ped.chickParam3 = sysex2short(packet[i++], packet[i++], packet[i++], packet[i++]);
    ped.chickCurve = sysex2byte(packet[i++], packet[i++]) & 0x0f;

    if (!isOld) {
      ped.semiOpenLevel2 = sysex2byte(packet[i++], packet[i++]);
      ped.halfOpenLevel2 = sysex2byte(packet[i++], packet[i++]);
    }
    ped.bowSemiOpenNote = sysex2byte(packet[i++], packet[i++]);
    ped.edgeSemiOpenNote = sysex2byte(packet[i++], packet[i++]);
    ped.bellSemiOpenNote = sysex2byte(packet[i++], packet[i++]);
    if (!isOld) {
      ped.bowSemiOpen2Note = sysex2byte(packet[i++], packet[i++]);
      ped.edgeSemiOpen2Note = sysex2byte(packet[i++], packet[i++]);
      ped.bellSemiOpen2Note = sysex2byte(packet[i++], packet[i++]);
    }
    ped.bowHalfOpenNote = sysex2byte(packet[i++], packet[i++]);
    ped.edgeHalfOpenNote = sysex2byte(packet[i++], packet[i++]);
    ped.bellHalfOpenNote = sysex2byte(packet[i++], packet[i++]);
    if (!isOld) {
      ped.bowHalfOpen2Note = sysex2byte(packet[i++], packet[i++]);
      ped.edgeHalfOpen2Note = sysex2byte(packet[i++], packet[i++]);
      ped.bellHalfOpen2Note = sysex2byte(packet[i++], packet[i++]);
    }
    ped.bowSemiClosedNote = sysex2byte(packet[i++], packet[i++]);
    ped.edgeSemiClosedNote = sysex2byte(packet[i++], packet[i++]);
    ped.bellSemiClosedNote = sysex2byte(packet[i++], packet[i++]);
    ped.bowClosedNote = sysex2byte(packet[i++], packet[i++]);
    ped.edgeClosedNote = sysex2byte(packet[i++], packet[i++]);
    ped.bellClosedNote = sysex2byte(packet[i++], packet[i++]);
    ped.chickNote = sysex2byte(packet[i++], packet[i++]);
    ped.splashNote = sysex2byte(packet[i++], packet[i++]);

    return {
      cmd,
      updated: next,
      description: `Hi-Hat Pedal configuration synced (${packet.length}B)`,
    };
  }

  if (cmd === MD_SYSEX_CMD.VERSION && packet.length >= MD_SYSEX_SIZE.VERSION) {
    let ver = 0;
    for (let k = 0; k < 4; k++) {
      const b = ((packet[k * 2 + 4] & 0x0f) << 4) | (packet[k * 2 + 5] & 0x0f);
      ver += b * Math.pow(256, k);
    }
    next.version = String(ver);
    return {
      cmd,
      updated: next,
      description: `Firmware Version: ${ver}`,
    };
  }

  if (cmd === MD_SYSEX_CMD.MCU_TYPE && packet.length >= MD_SYSEX_SIZE.MCU_TYPE) {
    const mcu = ((packet[4] & 0x0f) << 4) | (packet[5] & 0x0f);
    next.mcuTypeId = mcu;
    const label = MD_MCU_TYPES[mcu] || `Unknown (${mcu})`;
    return {
      cmd,
      updated: next,
      description: `MegaDrum MCU: ${label}`,
    };
  }

  if (cmd === MD_SYSEX_CMD.CONFIG_COUNT && packet.length >= MD_SYSEX_SIZE.CONFIG_COUNT) {
    const count = packet[4] & 0x7f;
    next.global.maxConfigCount = Math.max(4, Math.min(16, count));
    return {
      cmd,
      updated: next,
      description: `EEPROM Config Count: ${next.global.maxConfigCount} slots`,
    };
  }

  if (cmd === MD_SYSEX_CMD.CONFIG_NAME && packet.length >= 6) {
    const slot = pointer;
    let nameStr = '';
    for (let i = 5; i + 1 < packet.length - 1; i += 2) {
      const code = sysex2byte(packet[i], packet[i + 1]);
      if (code === 0 || code === 0xff) break;
      nameStr += String.fromCharCode(code);
    }
    const cleaned = nameStr.trim();
    if (!next.global.configNames) {
      next.global.configNames = {};
    }
    next.global.configNames[slot + 1] = cleaned;
    if (slot + 1 === next.global.activeSlot && cleaned) {
      next.global.configName = cleaned;
    }
    return {
      cmd,
      id: slot + 1,
      updated: next,
      description: `EEPROM Slot ${slot + 1} Name: "${cleaned || 'Unnamed'}"`,
    };
  }

  if (cmd === MD_SYSEX_CMD.CONFIG_CURRENT && packet.length >= MD_SYSEX_SIZE.CONFIG_CURRENT) {
    next.global.activeSlot = (packet[4] & 0x7f) + 1;
    return {
      cmd,
      updated: next,
      description: `Active Hardware Slot: ${next.global.activeSlot}`,
    };
  }

  if (cmd === MD_SYSEX_CMD.PEDAL_LEVEL_RAW && packet.length >= MD_SYSEX_SIZE.PEDAL_LEVEL_RAW) {
    const raw = sysex2short(packet[4], packet[5], packet[6], packet[7]);
    return {
      cmd,
      updated: next,
      description: `Pedal Raw ADC Level: ${raw}`,
      pedalRawLevel: raw,
    };
  }

  return null;
}

// =========================================================================
// Official MegaDrum Manager FX .mds INI serializer & parser
// =========================================================================

export function serializeMds(config: MegaDrumConfig): string {
  const lines: string[] = [
    `# MegaDrum Config`,
    `# Exported by MegaDrum Studio (MegaDrum Manager FX compatible)`,
    ``,
    `# Global Misc settings`,
    `global_misc.lcd_contrast=${config.global.lcdContrast}`,
    `global_misc.inputs_count=${config.global.maxInputs}`,
    `global_misc.custom_names_en=${config.global.customPadNames}`,
    `global_misc.config_names_en=${config.global.customConfigNames}`,
    `global_misc.midi2_for_sysex=${config.global.midi2ForSysex}`,
    ``,
    `# Misc settings`,
    `misc.note_off=${config.misc.noteOff}`,
    `misc.latency=${config.misc.latency}`,
    `misc.pressroll=${config.misc.pressroll}`,
    `misc.octave_shift=${config.misc.octaveShift}`,
    `misc.noise_filter=${config.misc.noiseFilter}`,
    `misc.all_gains_low=${config.misc.allGainsLow}`,
    `misc.big_vu_meter=${config.misc.bigVuMeter}`,
    `misc.big_vu_split=${config.misc.bigVuSplit}`,
    `misc.quick_access=${config.misc.quickAccess}`,
    `misc.alt_false_tr_supp=${config.misc.altFalseTrSupp}`,
    `misc.inputs_priority=${config.misc.inputsPriority}`,
    `misc.midi_thru=${config.misc.midiThru}`,
    `misc.send_triggered_in=${config.misc.sendTriggeredIn}`,
    `misc.alt_note_choking=${config.misc.altNoteChoking}`,
    ``,
    `# Pedal settings`,
    `pedal.type=${config.pedal.type === 'foot_controller'}`,
    `pedal.new_algorithm=${config.pedal.newAlgorithm}`,
    `pedal.autoLevels=${config.pedal.autoLevels}`,
    `pedal.altIn=${config.pedal.altIn}`,
    `pedal.reverseLevels=${config.pedal.reverseLevels}`,
    `pedal.curve=${config.pedal.curve}`,
    `pedal.chickDelay=${config.pedal.chickDelay}`,
    `pedal.cc=${config.pedal.cc}`,
    `pedal.ccRdcLvl=${config.pedal.ccRdcLvl}`,
    `pedal.lowLevel=${config.pedal.lowLevel}`,
    `pedal.highLevel=${config.pedal.highLevel}`,
    `pedal.openLevel=${config.pedal.openLevel}`,
    `pedal.closedLevel=${config.pedal.closedLevel}`,
    `pedal.shortThres=${config.pedal.shortThres}`,
    `pedal.longThres=${config.pedal.longThres}`,
    `pedal.chickThres=${config.pedal.chickThres}`,
    `pedal.hhInput=${config.pedal.hhInput}`,
    `pedal.softChicks=${config.pedal.softChicks}`,
    `pedal.semiOpenLevel=${config.pedal.semiOpenLevel}`,
    `pedal.semiOpenLevel2=${config.pedal.semiOpenLevel2}`,
    `pedal.halfOpenLevel=${config.pedal.halfOpenLevel}`,
    `pedal.halfOpenLevel2=${config.pedal.halfOpenLevel2}`,
    `pedal.chickParam1=${config.pedal.chickParam1}`,
    `pedal.chickParam2=${config.pedal.chickParam2}`,
    `pedal.chickParam3=${config.pedal.chickParam3}`,
    `pedal.chickCurve=${config.pedal.chickCurve}`,
    `pedal.bowSemiOpenNote=${config.pedal.bowSemiOpenNote}`,
    `pedal.edgeSemiOpenNote=${config.pedal.edgeSemiOpenNote}`,
    `pedal.bellSemiOpenNote=${config.pedal.bellSemiOpenNote}`,
    `pedal.bowSemiOpen2Note=${config.pedal.bowSemiOpen2Note}`,
    `pedal.edgeSemiOpen2Note=${config.pedal.edgeSemiOpen2Note}`,
    `pedal.bellSemiOpen2Note=${config.pedal.bellSemiOpen2Note}`,
    `pedal.bowHalfOpenNote=${config.pedal.bowHalfOpenNote}`,
    `pedal.edgeHalfOpenNote=${config.pedal.edgeHalfOpenNote}`,
    `pedal.bellHalfOpenNote=${config.pedal.bellHalfOpenNote}`,
    `pedal.bowHalfOpen2Note=${config.pedal.bowHalfOpen2Note}`,
    `pedal.edgeHalfOpen2Note=${config.pedal.edgeHalfOpen2Note}`,
    `pedal.bellHalfOpen2Note=${config.pedal.bellHalfOpen2Note}`,
    `pedal.bowSemiClosedNote=${config.pedal.bowSemiClosedNote}`,
    `pedal.edgeSemiClosedNote=${config.pedal.edgeSemiClosedNote}`,
    `pedal.bellSemiClosedNote=${config.pedal.bellSemiClosedNote}`,
    `pedal.bowClosedNote=${config.pedal.bowClosedNote}`,
    `pedal.edgeClosedNote=${config.pedal.edgeClosedNote}`,
    `pedal.bellClosedNote=${config.pedal.bellClosedNote}`,
    `pedal.chickNote=${config.pedal.chickNote}`,
    `pedal.splashNote=${config.pedal.splashNote}`,
    ``,
  ];

  config.pads.forEach((pad, idx) => {
    const id1 = idx + 1;
    lines.push(`# Input ${id1} (${pad.name}) settings`);
    lines.push(`input[${id1}].disabled=${pad.disabled}`);
    lines.push(`input[${id1}].note=${pad.note}`);
    lines.push(`input[${id1}].channel=${pad.midiChannel - 1}`);
    lines.push(`input[${id1}].curve=${pad.curve}`);
    lines.push(`input[${id1}].threshold=${pad.threshold}`);
    lines.push(`input[${id1}].retrigger=${pad.retrigger}`);
    lines.push(`input[${id1}].levelMax=${pad.levelMax}`);
    lines.push(`input[${id1}].minScan=${pad.minScan}`);
    lines.push(`input[${id1}].type=${pad.type}`);
    lines.push(`input[${id1}].autoLevel=${pad.autoLevel}`);
    lines.push(`input[${id1}].dual=${pad.dual}`);
    lines.push(`input[${id1}].threeWay=${pad.threeWay}`);
    lines.push(`input[${id1}].function=${pad.padFunction}`);
    lines.push(`input[${id1}].gain=${pad.gain}`);
    lines.push(`input[${id1}].xtalkLevel=${pad.xtalkLevel}`);
    lines.push(`input[${id1}].xtalkGroup=${pad.xtalkGroup}`);
    lines.push(`input[${id1}].dynTime=${pad.dynTime}`);
    lines.push(`input[${id1}].dynLevel=${pad.dynLevel}`);
    lines.push(`input[${id1}].compression=${pad.compression}`);
    lines.push(`input[${id1}].shift=${pad.shift}`);
    lines.push(`input[${id1}].name=${pad.customNameIndex}`);
    lines.push(`input[${id1}].altNote=${pad.altNote}`);
    lines.push(`input[${id1}].pressrollNote=${pad.pressrollNote}`);
    lines.push(`input[${id1}].rollSmoothLevel=${pad.rollSmoothLevel}`);
    lines.push(`input[${id1}].extraFalseSupp=${pad.extraFalseSupp}`);
    lines.push(`input[${id1}].altNote_linked=${pad.altNoteLinked}`);
    lines.push(`input[${id1}].pressrollNote_linked=${pad.pressrollNoteLinked}`);
    const pos = config.positionals[idx];
    if (pos) {
      lines.push(`pos[${id1}].level=${pos.level}`);
      lines.push(`pos[${id1}].low=${pos.low}`);
      lines.push(`pos[${id1}].high=${pos.high}`);
    }
    lines.push(``);
  });

  config.thirdZones.forEach((z, idx) => {
    const leftId = idx * 2 + 2;
    const rightId = leftId + 1;
    lines.push(`# Input[${leftId}+${rightId}] 3rd zone settings`);
    lines.push(`input3rd[${leftId}+${rightId}].disabled=${z.disabled}`);
    lines.push(`input3rd[${leftId}+${rightId}].note=${z.note}`);
    lines.push(`input3rd[${leftId}+${rightId}].threshold=${z.threshold}`);
    lines.push(`input3rd[${leftId}+${rightId}].altNote=${z.altNote}`);
    lines.push(`input3rd[${leftId}+${rightId}].pressrollNote=${z.pressrollNote}`);
    lines.push(`input3rd[${leftId}+${rightId}].dampenedNote=${z.dampenedNote}`);
    lines.push(`input3rd[${leftId}+${rightId}].altNote_linked=${z.altNoteLinked}`);
    lines.push(`input3rd[${leftId}+${rightId}].pressrollNote_linked=${z.pressrollNoteLinked}`);
    lines.push(``);
  });

  config.curves.forEach((c, idx) => {
    const id1 = idx + 1;
    lines.push(`# Curve ${id1} settings`);
    c.points.forEach((pt, pi) => {
      lines.push(`curve[${id1}].P${pi + 1}=${pt}`);
    });
    lines.push(``);
  });

  return lines.join('\n');
}

export function parseMds(text: string, fallback: MegaDrumConfig): MegaDrumConfig {
  const next = cloneConfig(fallback);
  const lines = text.split(/\r?\n/);

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#') || line.startsWith(';') || line.startsWith('[')) continue;
    const eqIdx = line.indexOf('=');
    if (eqIdx === -1) continue;
    const key = line.slice(0, eqIdx).trim();
    const val = line.slice(eqIdx + 1).trim();
    const asBool = val.toLowerCase() === 'true' || val === '1';
    const asNum = Number(val);

    if (key.startsWith('global_misc.')) {
      const sub = key.slice('global_misc.'.length);
      if (sub === 'lcd_contrast' && !Number.isNaN(asNum)) next.global.lcdContrast = asNum;
      if (sub === 'inputs_count' && !Number.isNaN(asNum)) next.global.maxInputs = asNum;
      if (sub === 'custom_names_en') next.global.customPadNames = asBool;
      if (sub === 'config_names_en') next.global.customConfigNames = asBool;
      if (sub === 'midi2_for_sysex') next.global.midi2ForSysex = asBool;
    } else if (key.startsWith('misc.')) {
      const sub = key.slice('misc.'.length);
      if (sub === 'note_off' && !Number.isNaN(asNum)) next.misc.noteOff = asNum;
      if (sub === 'latency' && !Number.isNaN(asNum)) next.misc.latency = asNum;
      if (sub === 'pressroll' && !Number.isNaN(asNum)) next.misc.pressroll = asNum;
      if (sub === 'octave_shift' && !Number.isNaN(asNum)) next.misc.octaveShift = asNum;
      if (sub === 'noise_filter' && !Number.isNaN(asNum)) next.misc.noiseFilter = asNum;
      if (sub === 'all_gains_low') next.misc.allGainsLow = asBool;
      if (sub === 'big_vu_meter') next.misc.bigVuMeter = asBool;
      if (sub === 'big_vu_split') next.misc.bigVuSplit = asBool;
      if (sub === 'quick_access') next.misc.quickAccess = asBool;
      if (sub === 'alt_false_tr_supp') next.misc.altFalseTrSupp = asBool;
      if (sub === 'inputs_priority') next.misc.inputsPriority = asBool;
      if (sub === 'midi_thru') next.misc.midiThru = asBool;
      if (sub === 'send_triggered_in') next.misc.sendTriggeredIn = asBool;
      if (sub === 'alt_note_choking') next.misc.altNoteChoking = asBool;
    } else if (key.startsWith('pedal.')) {
      const sub = key.slice('pedal.'.length);
      if (sub === 'type') {
        next.pedal.type = asBool || val === 'foot_controller' ? 'foot_controller' : 'potentiometer';
      } else if (sub === 'new_algorithm') {
        next.pedal.newAlgorithm = asBool;
      } else if (sub in next.pedal) {
        const cur = next.pedal[sub as keyof typeof next.pedal];
        if (typeof cur === 'boolean') {
          (next.pedal as unknown as Record<string, unknown>)[sub] = asBool;
        } else if (typeof cur === 'number' && !Number.isNaN(asNum)) {
          (next.pedal as unknown as Record<string, unknown>)[sub] = asNum;
        }
      }
    } else {
      const inMatch = key.match(/^input\[(\d+)\]\.(.+)$/);
      if (inMatch) {
        const padIdx = Number(inMatch[1]) - 1;
        const sub = inMatch[2];
        const pad = next.pads[padIdx];
        if (pad) {
          if (sub === 'channel' && !Number.isNaN(asNum)) pad.midiChannel = Math.max(1, Math.min(16, asNum + 1));
          else if (sub === 'function' && !Number.isNaN(asNum)) pad.padFunction = asNum;
          else if (sub === 'name' && !Number.isNaN(asNum)) pad.customNameIndex = asNum;
          else if (sub === 'altNote_linked') pad.altNoteLinked = asBool;
          else if (sub === 'pressrollNote_linked') pad.pressrollNoteLinked = asBool;
          else if (sub in pad) {
            const cur = pad[sub as keyof PadConfig];
            if (typeof cur === 'boolean') (pad as unknown as Record<string, unknown>)[sub] = asBool;
            else if (typeof cur === 'number' && !Number.isNaN(asNum)) {
              (pad as unknown as Record<string, unknown>)[sub] = asNum;
            }
          }
        }
        continue;
      }

      const posMatch = key.match(/^pos\[(\d+)\]\.(.+)$/);
      if (posMatch) {
        const idx = Number(posMatch[1]) - 1;
        const sub = posMatch[2];
        const pos = next.positionals[idx];
        if (pos && !Number.isNaN(asNum) && (sub === 'level' || sub === 'low' || sub === 'high')) {
          pos[sub] = asNum;
        }
        continue;
      }

      const thirdMatch = key.match(/^input3rd\[(\d+)\+\d+\]\.(.+)$/);
      if (thirdMatch) {
        const leftId = Number(thirdMatch[1]);
        const zIdx = (leftId - 2) / 2;
        const sub = thirdMatch[2];
        const z = next.thirdZones[zIdx];
        if (z) {
          if (sub === 'altNote_linked') z.altNoteLinked = asBool;
          else if (sub === 'pressrollNote_linked') z.pressrollNoteLinked = asBool;
          else if (sub in z) {
            const cur = z[sub as keyof ThirdZoneConfig];
            if (typeof cur === 'boolean') (z as unknown as Record<string, unknown>)[sub] = asBool;
            else if (typeof cur === 'number' && !Number.isNaN(asNum)) {
              (z as unknown as Record<string, unknown>)[sub] = asNum;
            }
          }
        }
        continue;
      }

      const curveMatch = key.match(/^curve\[(\d+)\]\.P(\d+)$/);
      if (curveMatch) {
        const cIdx = Number(curveMatch[1]) - 1;
        const pIdx = Number(curveMatch[2]) - 1;
        if (next.curves[cIdx] && pIdx >= 0 && pIdx < 9 && !Number.isNaN(asNum)) {
          next.curves[cIdx].points[pIdx] = Math.max(2, Math.min(255, asNum));
        }
      }
    }
  }

  return next;
}

// =========================================================================
// Encrypted MegaDrum Firmware (*.bin) Loader & Handshake Encoder
// Matches MidiController.doFirmwareUpgrade + Midi_handler.write
// =========================================================================

export type MegaDrumMcuId =
  | 'STM32f'
  | 'GD32f'
  | 'STM32d'
  | 'STM32b'
  | 'STM32a'
  | 'ATmega1284'
  | 'ATmega644'
  | 'Unknown';

export interface FirmwareMetadata {
  filename: string;
  format: 'encrypted_bin';
  mcu: MegaDrumMcuId;
  inputs: number | null;
  buildDate: string | null;
  sizeBytes: number;
  crc32: string;
  frameCount: number;
  isAsciiHex: boolean;
}

export const MCU_TARGETS: {
  id: MegaDrumMcuId;
  label: string;
  arch: 'ARM' | 'AVR';
  flashKb: number;
}[] = [
  { id: 'STM32f', label: 'STM32f (STM32F446RE / RC)', arch: 'ARM', flashKb: 512 },
  { id: 'GD32f', label: 'GD32f (GD32F405)', arch: 'ARM', flashKb: 512 },
  { id: 'STM32d', label: 'STM32d (STM32F205RC)', arch: 'ARM', flashKb: 256 },
  { id: 'STM32b', label: 'STM32b (STM32F103RC)', arch: 'ARM', flashKb: 256 },
  { id: 'STM32a', label: 'STM32a (STM32F103RB)', arch: 'ARM', flashKb: 128 },
  { id: 'ATmega1284', label: 'ATmega1284p (AVR)', arch: 'AVR', flashKb: 128 },
  { id: 'ATmega644', label: 'ATmega644p (AVR)', arch: 'AVR', flashKb: 64 },
];

export function computeCrc32(bytes: Uint8Array): string {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc ^= bytes[i];
    for (let j = 0; j < 8; j++) {
      const mask = -(crc & 1);
      crc = (crc >>> 1) ^ (0xedb88320 & mask);
    }
  }
  return ((crc ^ 0xffffffff) >>> 0).toString(16).toUpperCase().padStart(8, '0');
}

// Parse ASCII-hex encrypted .bin file identically to MidiController.readHex()
export function decodeMegaDrumBinBuffer(rawBytes: Uint8Array): {
  buffer: Uint8Array;
  frames: Uint8Array[];
  isAsciiHex: boolean;
} {
  // Check if file is ASCII hex pairs (standard MegaDrum encrypted .bin format)
  const sampleLen = Math.min(rawBytes.length, 64);
  let hexCount = 0;
  for (let i = 0; i < sampleLen; i++) {
    const c = rawBytes[i];
    if (
      (c >= 0x30 && c <= 0x39) || // 0-9
      (c >= 0x41 && c <= 0x46) || // A-F
      (c >= 0x61 && c <= 0x66)    // a-f
    ) {
      hexCount++;
    }
  }
  const isAsciiHex = sampleLen >= 4 && hexCount === sampleLen;

  let decoded: Uint8Array;
  if (isAsciiHex) {
    const byteLen = Math.floor(rawBytes.length / 2);
    decoded = new Uint8Array(byteLen);
    for (let i = 0; i < byteLen; i++) {
      const hex = String.fromCharCode(rawBytes[i * 2], rawBytes[i * 2 + 1]);
      decoded[i] = parseInt(hex, 16) & 0xff;
    }
  } else {
    decoded = rawBytes;
  }

  // Extract frames: MidiController.java lines 534-547
  // frameSize = ((buffer[index] << 8) | buffer[index + 1]) + 2
  const frames: Uint8Array[] = [];
  let index = 0;
  while (index + 1 < decoded.length) {
    const payloadLen = (decoded[index] << 8) | decoded[index + 1];
    const frameSize = payloadLen + 2;
    if (payloadLen === 0 || index + frameSize > decoded.length || frameSize > 2048) {
      // Fallback chunking if raw non-framed file
      frames.length = 0;
      for (let off = 0; off < decoded.length; off += 64) {
        const slice = decoded.slice(off, off + 64);
        frames.push(encodeMidiWritePacket(slice));
      }
      return { buffer: decoded, frames, isAsciiHex };
    }
    const slice = decoded.slice(index, index + frameSize);
    frames.push(encodeMidiWritePacket(slice));
    index += frameSize;
  }

  return { buffer: decoded, frames, isAsciiHex };
}

// Matches Midi_handler.write(Receiver, buf, ind, size): F0 + 2 nibbles per byte + F7
export function encodeMidiWritePacket(frameBytes: Uint8Array): Uint8Array {
  const out = new Uint8Array(frameBytes.length * 2 + 2);
  let p = 0;
  out[p++] = SYSEX_START;
  for (let i = 0; i < frameBytes.length; i++) {
    const b = frameBytes[i];
    out[p++] = (b >> 4) & 0x0f;
    out[p++] = b & 0x0f;
  }
  out[p++] = SYSEX_END;
  return out;
}

export function parseFirmwareFilename(filename: string, rawBytes: Uint8Array): FirmwareMetadata {
  const lower = filename.toLowerCase();
  let mcu: MegaDrumMcuId = 'Unknown';
  if (lower.includes('stm32f')) mcu = 'STM32f';
  else if (lower.includes('gd32f')) mcu = 'GD32f';
  else if (lower.includes('stm32d')) mcu = 'STM32d';
  else if (lower.includes('stm32b')) mcu = 'STM32b';
  else if (lower.includes('stm32a')) mcu = 'STM32a';
  else if (lower.includes('1284')) mcu = 'ATmega1284';
  else if (lower.includes('644')) mcu = 'ATmega644';

  const inputsMatch = filename.match(/_(\d{2})_/);
  const inputs = inputsMatch ? Number(inputsMatch[1]) : null;
  const dateMatch = filename.match(/(\d{8})/);
  const buildDate = dateMatch
    ? `${dateMatch[1].slice(0, 4)}-${dateMatch[1].slice(4, 6)}-${dateMatch[1].slice(6, 8)}`
    : null;

  const { buffer, frames, isAsciiHex } = decodeMegaDrumBinBuffer(rawBytes);

  return {
    filename,
    format: 'encrypted_bin',
    mcu,
    inputs,
    buildDate,
    sizeBytes: buffer.length,
    crc32: computeCrc32(rawBytes),
    frameCount: frames.length,
    isAsciiHex,
  };
}
