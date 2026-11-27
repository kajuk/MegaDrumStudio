import {
  CurveConfig,
  FieldSyncInfo,
  GlobalConfig,
  MegaDrumConfig,
  MiscConfig,
  ModuleSyncSnapshot,
  PadConfig,
  ParamSyncState,
  PedalConfig,
  PositionalConfig,
  ThirdZoneConfig,
} from '../types/megadrum';
import { DecodedSysexResult, MD_SYSEX_CMD } from './sysex';

export function createEmptySyncSnapshot(): ModuleSyncSnapshot {
  return {
    global: null,
    misc: null,
    pedal: null,
    pads: Array.from({ length: 55 }, () => null),
    thirdZones: Array.from({ length: 27 }, () => null),
    positionals: Array.from({ length: 55 }, () => null),
    curves: Array.from({ length: 16 }, () => null),
  };
}

export function cloneSnapshot(snap: ModuleSyncSnapshot): ModuleSyncSnapshot {
  return JSON.parse(JSON.stringify(snap)) as ModuleSyncSnapshot;
}

export function updateSnapshotFromDecodedSysex(
  prevSnapshot: ModuleSyncSnapshot,
  decoded: DecodedSysexResult,
  packet: Uint8Array
): ModuleSyncSnapshot {
  const next = cloneSnapshot(prevSnapshot);
  const pointer = packet[4] ?? 0;
  const u = decoded.updated;

  switch (decoded.cmd) {
    case MD_SYSEX_CMD.GLOBAL_MISC:
      next.global = { ...u.global };
      break;
    case MD_SYSEX_CMD.MISC:
      next.misc = { ...u.misc };
      break;
    case MD_SYSEX_CMD.PEDAL:
      next.pedal = { ...u.pedal };
      break;
    case MD_SYSEX_CMD.PAD: {
      const idx = pointer - 1;
      if (idx >= 0 && idx < next.pads.length && u.pads[idx]) {
        next.pads[idx] = { ...u.pads[idx] };
      }
      break;
    }
    case MD_SYSEX_CMD.THIRD_ZONE: {
      if (pointer >= 0 && pointer < next.thirdZones.length && u.thirdZones[pointer]) {
        next.thirdZones[pointer] = { ...u.thirdZones[pointer] };
      }
      break;
    }
    case MD_SYSEX_CMD.POS: {
      let realIdx = pointer;
      if (u.mcuTypeId > 0 && u.mcuTypeId < 3) {
        realIdx = pointer * 2 + 3;
      }
      if (realIdx >= 0 && realIdx < next.positionals.length && u.positionals[realIdx]) {
        next.positionals[realIdx] = { ...u.positionals[realIdx] };
      }
      break;
    }
    case MD_SYSEX_CMD.CURVE: {
      if (pointer >= 0 && pointer < next.curves.length && u.curves[pointer]) {
        next.curves[pointer] = {
          ...u.curves[pointer],
          points: [...u.curves[pointer].points],
        };
      }
      break;
    }
  }

  return next;
}

export function getFieldSync<T extends object, K extends keyof T>(
  current: T,
  snapshot: T | null | undefined,
  key: K
): FieldSyncInfo<T[K]> {
  if (!snapshot) {
    return { state: 'unknown' };
  }
  const curVal = current[key];
  const modVal = snapshot[key];
  if (curVal === modVal) {
    return { state: 'in_sync', moduleValue: modVal };
  }
  return { state: 'modified', moduleValue: modVal };
}

export const PAD_WIRE_KEYS: (keyof PadConfig)[] = [
  'note',
  'altNote',
  'pressrollNote',
  'disabled',
  'midiChannel',
  'curve',
  'threshold',
  'retrigger',
  'levelMax',
  'minScan',
  'type',
  'autoLevel',
  'dual',
  'threeWay',
  'gain',
  'xtalkLevel',
  'xtalkGroup',
  'dynTime',
  'dynLevel',
  'compression',
  'shift',
  'rollSmoothLevel',
  'extraFalseSupp',
  'padFunction',
  'customNameIndex',
];

export const THIRD_ZONE_WIRE_KEYS: (keyof ThirdZoneConfig)[] = [
  'disabled',
  'note',
  'threshold',
  'altNote',
  'pressrollNote',
  'dampenedNote',
];

export const POSITIONAL_WIRE_KEYS: (keyof PositionalConfig)[] = ['level', 'low', 'high'];

export const GLOBAL_WIRE_KEYS: (keyof GlobalConfig)[] = [
  'maxInputs',
  'lcdContrast',
  'customPadNames',
  'customConfigNames',
  'midi2ForSysex',
];

export const MISC_WIRE_KEYS: (keyof MiscConfig)[] = [
  'noteOff',
  'latency',
  'pressroll',
  'octaveShift',
  'noiseFilter',
  'allGainsLow',
  'bigVuMeter',
  'bigVuSplit',
  'quickAccess',
  'altFalseTrSupp',
  'inputsPriority',
  'midiThru',
  'sendTriggeredIn',
  'altNoteChoking',
];

export const PEDAL_WIRE_KEYS: (keyof PedalConfig)[] = [
  'type',
  'newAlgorithm',
  'autoLevels',
  'altIn',
  'reverseLevels',
  'softChicks',
  'curve',
  'chickDelay',
  'cc',
  'ccRdcLvl',
  'lowLevel',
  'highLevel',
  'openLevel',
  'semiOpenLevel',
  'semiOpenLevel2',
  'halfOpenLevel',
  'halfOpenLevel2',
  'closedLevel',
  'shortThres',
  'longThres',
  'chickThres',
  'hhInput',
  'chickParam1',
  'chickParam2',
  'chickParam3',
  'chickCurve',
  'bowSemiOpenNote',
  'edgeSemiOpenNote',
  'bellSemiOpenNote',
  'bowSemiOpen2Note',
  'edgeSemiOpen2Note',
  'bellSemiOpen2Note',
  'bowHalfOpenNote',
  'edgeHalfOpenNote',
  'bellHalfOpenNote',
  'bowHalfOpen2Note',
  'edgeHalfOpen2Note',
  'bellHalfOpen2Note',
  'bowSemiClosedNote',
  'edgeSemiClosedNote',
  'bellSemiClosedNote',
  'bowClosedNote',
  'edgeClosedNote',
  'bellClosedNote',
  'chickNote',
  'splashNote',
];

export interface SectionSyncSummary {
  state: ParamSyncState;
  diffCount: number;
}

function countDiffs<T extends object>(
  cur: T,
  snap: T | null | undefined,
  keys: (keyof T)[]
): SectionSyncSummary {
  if (!snap) return { state: 'unknown', diffCount: 0 };
  let diffCount = 0;
  for (const k of keys) {
    if (cur[k] !== snap[k]) diffCount++;
  }
  return {
    state: diffCount > 0 ? 'modified' : 'in_sync',
    diffCount,
  };
}

export function getPadSyncSummary(
  pad: PadConfig,
  snapPad: PadConfig | null | undefined,
  pos?: PositionalConfig,
  snapPos?: PositionalConfig | null
): SectionSyncSummary {
  const padSum = countDiffs(pad, snapPad, PAD_WIRE_KEYS);
  if (padSum.state === 'unknown') return padSum;
  let diffCount = padSum.diffCount;
  if (pos && snapPos) {
    const posSum = countDiffs(pos, snapPos, POSITIONAL_WIRE_KEYS);
    diffCount += posSum.diffCount;
  }
  return {
    state: diffCount > 0 ? 'modified' : 'in_sync',
    diffCount,
  };
}

export function getThirdZoneSyncSummary(
  zone: ThirdZoneConfig,
  snapZone: ThirdZoneConfig | null | undefined
): SectionSyncSummary {
  return countDiffs(zone, snapZone, THIRD_ZONE_WIRE_KEYS);
}

export function getPairSyncSummary(
  pairIdx: number,
  config: MegaDrumConfig,
  snapshot: ModuleSyncSnapshot
): SectionSyncSummary {
  if (pairIdx === 0) {
    return getPadSyncSummary(
      config.pads[0],
      snapshot.pads[0],
      config.positionals[0],
      snapshot.positionals[0]
    );
  }
  const lIdx = pairIdx * 2 - 1;
  const rIdx = pairIdx * 2;
  const zIdx = pairIdx - 1;
  const leftSum = getPadSyncSummary(
    config.pads[lIdx],
    snapshot.pads[lIdx],
    config.positionals[lIdx],
    snapshot.positionals[lIdx]
  );
  const rightSum = config.pads[rIdx]
    ? getPadSyncSummary(
        config.pads[rIdx],
        snapshot.pads[rIdx],
        config.positionals[rIdx],
        snapshot.positionals[rIdx]
      )
    : { state: 'in_sync' as ParamSyncState, diffCount: 0 };
  const thirdSum = config.thirdZones[zIdx]
    ? getThirdZoneSyncSummary(config.thirdZones[zIdx], snapshot.thirdZones[zIdx])
    : { state: 'in_sync' as ParamSyncState, diffCount: 0 };

  if (
    leftSum.state === 'unknown' ||
    rightSum.state === 'unknown' ||
    thirdSum.state === 'unknown'
  ) {
    const totalDiffs = leftSum.diffCount + rightSum.diffCount + thirdSum.diffCount;
    if (totalDiffs > 0) {
      return { state: 'modified', diffCount: totalDiffs };
    }
    return { state: 'unknown', diffCount: 0 };
  }

  const diffCount = leftSum.diffCount + rightSum.diffCount + thirdSum.diffCount;
  return {
    state: diffCount > 0 ? 'modified' : 'in_sync',
    diffCount,
  };
}

export function getPedalSyncSummary(
  pedal: PedalConfig,
  snapPedal: PedalConfig | null | undefined
): SectionSyncSummary {
  return countDiffs(pedal, snapPedal, PEDAL_WIRE_KEYS);
}

export function getCurvePointSync(
  points: number[],
  snapCurve: CurveConfig | null | undefined,
  pointIndex: number
): FieldSyncInfo<number> {
  if (!snapCurve) return { state: 'unknown' };
  const cur = points[pointIndex];
  const mod = snapCurve.points[pointIndex];
  if (cur === mod) return { state: 'in_sync', moduleValue: mod };
  return { state: 'modified', moduleValue: mod };
}

export function getCurveSyncSummary(
  curve: CurveConfig,
  snapCurve: CurveConfig | null | undefined
): SectionSyncSummary {
  if (!snapCurve) return { state: 'unknown', diffCount: 0 };
  let diffCount = 0;
  for (let i = 0; i < 9; i++) {
    if (curve.points[i] !== snapCurve.points[i]) diffCount++;
  }
  return {
    state: diffCount > 0 ? 'modified' : 'in_sync',
    diffCount,
  };
}

export function getGlobalSyncSummary(
  globalCfg: GlobalConfig,
  snapGlobal: GlobalConfig | null | undefined
): SectionSyncSummary {
  return countDiffs(globalCfg, snapGlobal, GLOBAL_WIRE_KEYS);
}

export function getMiscSyncSummary(
  miscCfg: MiscConfig,
  snapMisc: MiscConfig | null | undefined
): SectionSyncSummary {
  return countDiffs(miscCfg, snapMisc, MISC_WIRE_KEYS);
}

export function getTotalModifiedCount(
  config: MegaDrumConfig,
  snapshot: ModuleSyncSnapshot
): { modifiedFields: number; modifiedSections: number; anySynced: boolean } {
  let modifiedFields = 0;
  let modifiedSections = 0;
  let anySynced = Boolean(snapshot.global || snapshot.misc || snapshot.pedal);

  const g = getGlobalSyncSummary(config.global, snapshot.global);
  if (g.diffCount > 0) {
    modifiedFields += g.diffCount;
    modifiedSections++;
  }
  const m = getMiscSyncSummary(config.misc, snapshot.misc);
  if (m.diffCount > 0) {
    modifiedFields += m.diffCount;
    modifiedSections++;
  }
  const p = getPedalSyncSummary(config.pedal, snapshot.pedal);
  if (p.diffCount > 0) {
    modifiedFields += p.diffCount;
    modifiedSections++;
  }

  const pairCount = Math.floor(config.global.maxInputs / 2);
  for (let i = 0; i < pairCount; i++) {
    if (i === 0 ? snapshot.pads[0] : snapshot.pads[i * 2 - 1]) anySynced = true;
    const ps = getPairSyncSummary(i, config, snapshot);
    if (ps.diffCount > 0) {
      modifiedFields += ps.diffCount;
      modifiedSections++;
    }
  }

  for (let c = 0; c < config.curves.length; c++) {
    if (snapshot.curves[c]) anySynced = true;
    const cs = getCurveSyncSummary(config.curves[c], snapshot.curves[c]);
    if (cs.diffCount > 0) {
      modifiedFields += cs.diffCount;
      modifiedSections++;
    }
  }

  return { modifiedFields, modifiedSections, anySynced };
}
