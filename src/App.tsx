import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { TopBar, WorkspaceTab } from './components/TopBar';
import { WorkspaceToolbar } from './components/WorkspaceToolbar';
import { KitPadsView } from './components/KitPadsView';
import { PedalView } from './components/PedalView';
import { CurvesView } from './components/CurvesView';
import { GlobalMiscView } from './components/GlobalMiscView';
import { MidiLogView } from './components/MidiLogView';
import { SysexMonitorView } from './components/SysexMonitorView';
import {
  ConnectionPopupData,
  ConnectionStatusPopup,
} from './components/ConnectionStatusPopup';
import { MidiAlertModal } from './components/MidiAlertModal';
import { CustomPadNamesModal } from './components/CustomPadNamesModal';
import { cloneConfig, FACTORY_PRESETS } from './data/presets';
import { SysexBatchResult, SysexTaskItem, useWebMidi } from './hooks/useWebMidi';
import {
  ActiveHit,
  getMaxCustomPadNames,
  GlobalConfig,
  MD_MCU_TYPES,
  MegaDrumConfig,
  MiscConfig,
  ModuleSyncSnapshot,
  PadConfig,
  PedalConfig,
  PositionalConfig,
  ThirdZoneConfig,
  ZoneMode,
} from './types/megadrum';
import {
  createEmptySyncSnapshot,
  getTotalModifiedCount,
  updateSnapshotFromDecodedSysex,
} from './utils/syncStatus';
import { playDrumSound } from './utils/drumAudio';
import {
  applyIncomingSysexPacket,
  buildFullConfigSyxFile,
  buildLoadSlotSysex,
  buildRequest3rdSysex,
  buildRequestConfigCountSysex,
  buildRequestConfigCurrentSysex,
  buildRequestConfigNameSysex,
  buildRequestCurveSysex,
  buildRequestCustomNameSysex,
  buildRequestGlobalMiscSysex,
  buildRequestMcuSysex,
  buildRequestMiscSysex,
  buildRequestPadSysex,
  buildRequestPedalRawSysex,
  buildRequestPedalSysex,
  buildRequestPosSysex,
  buildRequestVersionSysex,
  buildSaveConfigNameSysex,
  buildSaveCustomNameSysex,
  buildSaveSlotSysex,
  encode3rdSysex,
  encodeCurveSysex,
  encodeGlobalMiscSysex,
  encodeMiscSysex,
  encodePadSysex,
  encodePedalSysex,
  encodePositionalSysex,
  formatBytesHex,
  getSysexPosIdForInput,
  MD_SYSEX_CMD,
  parseMds,
  serializeMds,
  splitSysexStream,
} from './utils/sysex';

import {
  AppThemeId,
  applyThemeToDocument,
  getSavedTheme,
  resolveEffectiveTheme,
} from './utils/theme';

const STORAGE_KEY = 'megadrum_studio_config_v2';
const LIVE_UPDATES_STORAGE_KEY = 'megadrum_studio_live_updates_v1';

function downloadBlob(data: BlobPart, filename: string, mime: string) {
  const blob = new Blob([data], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function isValidConfigV2(obj: unknown): obj is MegaDrumConfig {
  if (!obj || typeof obj !== 'object') return false;
  const c = obj as Partial<MegaDrumConfig>;
  return (
    Array.isArray(c.pads) &&
    c.pads.length === 55 &&
    Array.isArray(c.thirdZones) &&
    c.thirdZones.length === 27 &&
    Array.isArray(c.positionals) &&
    c.positionals.length === 55 &&
    Array.isArray(c.curves) &&
    c.curves.length === 16 &&
    typeof c.global?.maxInputs === 'number' &&
    typeof c.pedal?.hhInput === 'number'
  );
}

function normalizeConfig(c: MegaDrumConfig): MegaDrumConfig {
  const customNames = Array.from({ length: 32 }, (_, i) =>
    typeof c.customNames?.[i] === 'string' ? c.customNames[i].slice(0, 8) : `Custom${i + 1}`
  );
  return {
    ...c,
    customNames,
  };
}

export default function App() {
  const [theme, setTheme] = useState<AppThemeId>(() => getSavedTheme());
  const [effectiveTheme, setEffectiveTheme] = useState<Exclude<AppThemeId, 'system'>>(() =>
    resolveEffectiveTheme(getSavedTheme())
  );

  const [config, setConfig] = useState<MegaDrumConfig>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (isValidConfigV2(parsed)) return normalizeConfig(parsed);
      }
    } catch {
      // Ignore corrupt storage
    }
    return cloneConfig(FACTORY_PRESETS[0].config);
  });

  const [moduleSnapshot, setModuleSnapshot] = useState<ModuleSyncSnapshot>(() =>
    createEmptySyncSnapshot()
  );

  const configRef = useRef(config);
  configRef.current = config;

  const [selectedPresetId, setSelectedPresetId] = useState<string>(FACTORY_PRESETS[0].id);
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('pads');
  const [selectedPairIndex, setSelectedPairIndex] = useState<number>(2); // Snare (In 4+5)
  const [audioEnabled, setAudioEnabled] = useState<boolean>(true);
  const [activeHit, setActiveHit] = useState<ActiveHit | null>(null);
  const [livePedalPosition, setLivePedalPosition] = useState<number>(24);
  const [lastRawAdc, setLastRawAdc] = useState<number | null>(null);
  const [syncFlash, setSyncFlash] = useState<boolean>(false);
  const [notice, setNotice] = useState<{ text: string; isError?: boolean } | null>(null);
  const [connectionPopup, setConnectionPopup] = useState<ConnectionPopupData | null>(null);
  const [alertModalOpen, setAlertModalOpen] = useState<boolean>(false);
  const [customNamesModalOpen, setCustomNamesModalOpen] = useState<boolean>(false);
  const lastAlertKeyRef = useRef<string>('');
  const [connectTriggerId, setConnectTriggerId] = useState<number>(0);
  const [detectedHardware, setDetectedHardware] = useState<{
    version: string | null;
    mcuTypeId: number | null;
  }>({ version: null, mcuTypeId: null });
  const [liveUpdates, setLiveUpdates] = useState<boolean>(() => {
    try {
      return localStorage.getItem(LIVE_UPDATES_STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  });
  const inBatchRef = useRef<boolean>(false);
  const pendingIdentifyPopupRef = useRef<boolean>(false);
  const liveUpdatesRef = useRef<boolean>(liveUpdates);
  liveUpdatesRef.current = liveUpdates;
  const dirtyBlocksRef = useRef<Set<string>>(new Set());
  const liveFlushTimerRef = useRef<number | null>(null);
  const liveSendInFlightRef = useRef<boolean>(false);
  const connectionPhaseRef = useRef<string>('disconnected');
  const flushLiveUpdatesRef = useRef<() => void>(() => {});

  const showNotice = useCallback((text: string, isError = false) => {
    setNotice({ text, isError });
  }, []);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 4200);
    return () => clearTimeout(t);
  }, [notice]);

  useEffect(() => {
    setEffectiveTheme(applyThemeToDocument(theme));

    if (theme !== 'system' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      setEffectiveTheme(applyThemeToDocument('system'));
    };
    mq.addEventListener('change', handleChange);
    return () => mq.removeEventListener('change', handleChange);
  }, [theme]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    } catch {
      // Ignore quota errors
    }
  }, [config]);

  useEffect(() => {
    try {
      localStorage.setItem(LIVE_UPDATES_STORAGE_KEY, liveUpdates ? 'true' : 'false');
    } catch {
      // Ignore quota errors
    }
  }, [liveUpdates]);

  const handleIncomingSysex = useCallback(
    (packet: Uint8Array) => {
      const current = configRef.current;
      const res = applyIncomingSysexPacket(packet, current);
      if (res) {
        if (res.pedalRawLevel !== undefined) {
          setLastRawAdc(res.pedalRawLevel);
        }
        if (res.cmd === MD_SYSEX_CMD.VERSION) {
          setDetectedHardware((prev) => ({ ...prev, version: res.updated.version }));
        } else if (res.cmd === MD_SYSEX_CMD.MCU_TYPE) {
          setDetectedHardware((prev) => ({ ...prev, mcuTypeId: res.updated.mcuTypeId }));
        }
        if (!liveSendInFlightRef.current) {
          setConfig(res.updated);
        }
        setModuleSnapshot((prevSnap) => updateSnapshotFromDecodedSysex(prevSnap, res, packet));
        if (!inBatchRef.current) {
          showNotice(res.description);
        }
      }
    },
    [showNotice]
  );

  const handleIncomingNote = useCallback(
    (channel: number, note: number, velocity: number) => {
      const activePads = config.pads.slice(0, Math.min(55, config.global.maxInputs - 1));
      const matchingPad = activePads.find(
        (p) =>
          !p.disabled &&
          (p.note === note || p.altNote === note || p.pressrollNote === note) &&
          p.midiChannel === channel
      );
      if (matchingPad) {
        const zone = matchingPad.id > 1 && (matchingPad.id & 1) === 1 ? 'rim' : 'head';
        setActiveHit({ padId: matchingPad.id, zone, velocity, timestamp: Date.now() });
      } else {
        const matching3rdIdx = config.thirdZones.findIndex(
          (z) => !z.disabled && (z.note === note || z.dampenedNote === note)
        );
        if (matching3rdIdx >= 0) {
          const leftPadId = matching3rdIdx * 2 + 2;
          setActiveHit({ padId: leftPadId, zone: 'bell', velocity, timestamp: Date.now() });
        }
      }
      if (audioEnabled) {
        playDrumSound(note, velocity);
      }
    },
    [audioEnabled, config.global.maxInputs, config.pads, config.thirdZones]
  );

  const handleIncomingCC = useCallback(
    (_channel: number, cc: number, value: number) => {
      if (cc === config.pedal.cc) {
        setLivePedalPosition(value);
      }
    },
    [config.pedal.cc]
  );

  const midi = useWebMidi({
    onIncomingSysex: handleIncomingSysex,
    onIncomingNote: handleIncomingNote,
    onIncomingCC: handleIncomingCC,
  });

  connectionPhaseRef.current = midi.connectionPhase;

  const flushLiveUpdates = useCallback(async () => {
    if (liveFlushTimerRef.current !== null) {
      window.clearTimeout(liveFlushTimerRef.current);
      liveFlushTimerRef.current = null;
    }
    if (!liveUpdatesRef.current || connectionPhaseRef.current !== 'connected') {
      dirtyBlocksRef.current.clear();
      return;
    }
    if (inBatchRef.current || liveSendInFlightRef.current) {
      liveFlushTimerRef.current = window.setTimeout(() => {
        flushLiveUpdatesRef.current();
      }, 140);
      return;
    }
    if (dirtyBlocksRef.current.size === 0) return;

    const keys = Array.from(dirtyBlocksRef.current);
    dirtyBlocksRef.current.clear();

    const cfg = configRef.current;
    const ch = cfg.chainId;
    const tasks: SysexTaskItem[] = [];

    for (const key of keys) {
      if (key === 'global') {
        tasks.push({
          kind: 'send',
          packet: encodeGlobalMiscSysex(cfg),
          verifyRequest: buildRequestGlobalMiscSysex(ch),
          expectedCmd: MD_SYSEX_CMD.GLOBAL_MISC,
          label: 'Global Misc',
        });
      } else if (key === 'misc') {
        tasks.push({
          kind: 'send',
          packet: encodeMiscSysex(cfg),
          verifyRequest: buildRequestMiscSysex(ch),
          expectedCmd: MD_SYSEX_CMD.MISC,
          label: 'Misc',
        });
      } else if (key === 'pedal') {
        tasks.push({
          kind: 'send',
          packet: encodePedalSysex(cfg),
          verifyRequest: buildRequestPedalSysex(ch),
          expectedCmd: MD_SYSEX_CMD.PEDAL,
          label: 'Hi-Hat Pedal',
        });
      } else if (key.startsWith('pad:')) {
        const idx = Number(key.slice(4));
        const pad = cfg.pads[idx];
        if (pad) {
          tasks.push({
            kind: 'send',
            packet: encodePadSysex(pad, ch),
            verifyRequest: buildRequestPadSysex(idx, ch),
            expectedCmd: MD_SYSEX_CMD.PAD,
            expectedId: idx + 1,
            label: `Input ${idx + 1}`,
          });
        }
      } else if (key.startsWith('third:')) {
        const zIdx = Number(key.slice(6));
        const zone = cfg.thirdZones[zIdx];
        if (zone) {
          tasks.push({
            kind: 'send',
            packet: encode3rdSysex(zone, ch),
            verifyRequest: buildRequest3rdSysex(zIdx, ch),
            expectedCmd: MD_SYSEX_CMD.THIRD_ZONE,
            expectedId: zIdx,
            label: `3rd Zone (Pair ${zIdx + 1})`,
          });
        }
      } else if (key.startsWith('pos:')) {
        const idx = Number(key.slice(4));
        const posId = getSysexPosIdForInput(idx, cfg.mcuTypeId);
        if (posId !== null && cfg.positionals[idx]) {
          tasks.push({
            kind: 'send',
            packet: encodePositionalSysex(cfg.positionals[idx], posId, ch),
            verifyRequest: buildRequestPosSysex(posId, ch),
            expectedCmd: MD_SYSEX_CMD.POS,
            expectedId: posId,
            label: `Positional ${idx + 1}`,
          });
        }
      } else if (key.startsWith('curve:')) {
        const cIdx = Number(key.slice(6));
        const curve = cfg.curves[cIdx];
        if (curve) {
          tasks.push({
            kind: 'send',
            packet: encodeCurveSysex(cIdx, curve.points, ch),
            verifyRequest: buildRequestCurveSysex(cIdx, ch),
            expectedCmd: MD_SYSEX_CMD.CURVE,
            expectedId: cIdx,
            label: `Curve ${cIdx + 1}`,
          });
        }
      }
    }

    if (tasks.length === 0) return;

    liveSendInFlightRef.current = true;
    inBatchRef.current = true;
    const res = await midi.runSysexQueue(tasks, {
      maxRetries: 2,
      timeoutMs: 650,
      abortOnFirstTimeout: true,
    });
    inBatchRef.current = false;
    liveSendInFlightRef.current = false;

    if (res.ok) {
      setSyncFlash(true);
      window.setTimeout(() => setSyncFlash(false), 900);
    } else {
      const errMsg =
        res.reason === 'midi_not_open'
          ? 'Live Update paused: MIDI ports are not open.'
          : res.reason === 'timeout'
          ? `Live Update timeout for "${res.failedLabel || 'parameter'}". Check USB cable, MIDI ports, and Chain ID.`
          : `Live Update stopped (${res.completed}/${res.total} sent).`;
      showNotice(errMsg, true);
    }

    if (
      dirtyBlocksRef.current.size > 0 &&
      liveUpdatesRef.current &&
      connectionPhaseRef.current === 'connected'
    ) {
      liveFlushTimerRef.current = window.setTimeout(() => {
        flushLiveUpdatesRef.current();
      }, 80);
    }
  }, [midi, showNotice]);

  flushLiveUpdatesRef.current = flushLiveUpdates;

  const enqueueLiveBlocks = useCallback((keys: string[]) => {
    if (!liveUpdatesRef.current || connectionPhaseRef.current !== 'connected') return;
    for (const key of keys) {
      dirtyBlocksRef.current.add(key);
    }
    if (liveFlushTimerRef.current !== null) {
      window.clearTimeout(liveFlushTimerRef.current);
    }
    liveFlushTimerRef.current = window.setTimeout(() => {
      flushLiveUpdatesRef.current();
    }, 140);
  }, []);

  const handleToggleLiveUpdates = useCallback(() => {
    setLiveUpdates((prev) => {
      const next = !prev;
      if (!next) {
        if (liveFlushTimerRef.current !== null) {
          window.clearTimeout(liveFlushTimerRef.current);
          liveFlushTimerRef.current = null;
        }
        dirtyBlocksRef.current.clear();
        showNotice('Live Updates disabled');
      } else if (midi.connectionPhase !== 'connected') {
        showNotice('Live Updates enabled — connect MegaDrum MIDI ports to auto-send changes');
      } else {
        showNotice('Live Updates enabled — parameter edits will auto-send to MegaDrum');
      }
      return next;
    });
  }, [midi.connectionPhase, showNotice]);

  useEffect(() => {
    if (!liveUpdates || midi.connectionPhase !== 'connected') {
      if (liveFlushTimerRef.current !== null) {
        window.clearTimeout(liveFlushTimerRef.current);
        liveFlushTimerRef.current = null;
      }
      dirtyBlocksRef.current.clear();
    }
  }, [liveUpdates, midi.connectionPhase]);

  useEffect(() => {
    return () => {
      if (liveFlushTimerRef.current !== null) {
        window.clearTimeout(liveFlushTimerRef.current);
      }
    };
  }, []);

  const executeQueue = useCallback(
    async (
      tasks: SysexTaskItem[],
      successMessage: (res: SysexBatchResult) => string,
      options?: { maxRetries?: number; timeoutMs?: number; abortOnFirstTimeout?: boolean }
    ): Promise<SysexBatchResult> => {
      inBatchRef.current = true;
      const res = await midi.runSysexQueue(tasks, options);
      inBatchRef.current = false;

      if (res.ok) {
        setSyncFlash(true);
        setTimeout(() => setSyncFlash(false), 1600);
        showNotice(successMessage(res));
      } else {
        const errMsg =
          res.reason === 'midi_not_open'
            ? 'MIDI ports are NOT open. Click Connect MIDI and select your MegaDrum In/Out ports.'
            : res.reason === 'timeout'
            ? `No SysEx response from MegaDrum for "${res.failedLabel || 'request'}". Check USB cable, MIDI In/Out ports, and Chain ID.`
            : `SysEx operation stopped (${res.completed}/${res.total} completed).`;
        showNotice(errMsg, true);
      }
      return res;
    },
    [midi, showNotice]
  );

  const midiRef = useRef(midi);
  midiRef.current = midi;

  const handleDismissConnectionPopup = useCallback(() => {
    setConnectionPopup(null);
  }, []);

  const handleDisconnectMidi = useCallback(() => {
    pendingIdentifyPopupRef.current = false;
    setConnectionPopup(null);
    setDetectedHardware({ version: null, mcuTypeId: null });
    midiRef.current.disconnect();
  }, []);

  useEffect(() => {
    if (!midi.connected) {
      setDetectedHardware({ version: null, mcuTypeId: null });
    }
  }, [midi.connected]);

  const handleConnectMidi = useCallback(async () => {
    setConnectionPopup(null);
    const result = await midi.connect();
    showNotice(result.message, !result.ok);
    if (!result.ok) {
      pendingIdentifyPopupRef.current = false;
      setConnectionPopup({
        id: Date.now(),
        status: 'error',
        title: 'Failed to Connect to MegaDrum',
        message: result.message,
        canRequestPermission: !midiRef.current.sysexAllowed || !midiRef.current.hasMidiAccess,
      });
    } else {
      pendingIdentifyPopupRef.current = true;
      setConnectTriggerId((c) => c + 1);
    }
    return result;
  }, [midi, showNotice]);

  const handleRequestMidiPermission = useCallback(async () => {
    const result = await midi.scanPorts({ userTriggered: true });
    showNotice(result.message, !result.ok);
    if (result.ok) {
      setConnectionPopup(null);
    }
    return result;
  }, [midi, showNotice]);

  useEffect(() => {
    if (!pendingIdentifyPopupRef.current || connectTriggerId === 0) return;

    if (midi.connectionPhase === 'connected') {
      pendingIdentifyPopupRef.current = false;

      const identifyConnectedMegaDrum = async () => {
        const currentMidi = midiRef.current;
        const ch = configRef.current.chainId;
        inBatchRef.current = true;
        const res = await currentMidi.runSysexQueue(
          [
            {
              kind: 'request',
              packet: buildRequestVersionSysex(ch),
              expectedCmd: MD_SYSEX_CMD.VERSION,
              label: 'Firmware Version',
            },
            {
              kind: 'request',
              packet: buildRequestMcuSysex(ch),
              expectedCmd: MD_SYSEX_CMD.MCU_TYPE,
              label: 'MCU Type',
            },
            {
              kind: 'request',
              packet: buildRequestConfigCountSysex(ch),
              expectedCmd: MD_SYSEX_CMD.CONFIG_COUNT,
              label: 'EEPROM Config Count',
            },
          ],
          { maxRetries: 2, timeoutMs: 650, abortOnFirstTimeout: true }
        );
        inBatchRef.current = false;

        if (midiRef.current.connectionPhase !== 'connected') return;

        if (res.ok) {
          let fwVersion = 'Unknown';
          let mcuId = 0;
          let updatedCfg = configRef.current;
          for (const pkt of res.responses) {
            const decoded = applyIncomingSysexPacket(pkt, updatedCfg);
            if (decoded?.cmd === MD_SYSEX_CMD.VERSION) {
              fwVersion = decoded.updated.version;
              updatedCfg = decoded.updated;
            } else if (decoded?.cmd === MD_SYSEX_CMD.MCU_TYPE) {
              mcuId = decoded.updated.mcuTypeId;
              updatedCfg = decoded.updated;
            } else if (decoded?.cmd === MD_SYSEX_CMD.CONFIG_COUNT) {
              updatedCfg = decoded.updated;
            }
          }
          setConfig(updatedCfg);
          const latestMidi = midiRef.current;
          const inName = latestMidi.inputs.find((i) => i.id === latestMidi.selectedInputId)?.name;
          const outName = latestMidi.outputs.find((o) => o.id === latestMidi.selectedOutputId)?.name;
          const portsLabel =
            inName && outName ? `${inName} / ${outName}` : inName || outName || undefined;

          setConnectionPopup({
            id: Date.now(),
            status: 'success',
            firmwareVersion: fwVersion,
            hardwareName: MD_MCU_TYPES[mcuId] || `Unknown (${mcuId})`,
            chainId: ch,
            portsLabel,
          });
        } else {
          const errMsg =
            res.reason === 'timeout'
              ? `MIDI ports opened, but MegaDrum did not respond to Firmware/Hardware identification (${res.failedLabel || 'Version'}). Check USB/MIDI ports, power, and Chain ID (${ch}).`
              : 'MIDI ports opened, but could not verify MegaDrum Firmware and Hardware version.';
          setConnectionPopup({
            id: Date.now(),
            status: 'error',
            title: 'MegaDrum Not Responding',
            message: errMsg,
          });
        }
      };

      void identifyConnectedMegaDrum();
      return;
    }

    if (
      midi.connectionPhase === 'partial' ||
      midi.connectionPhase === 'sysex_blocked' ||
      midi.connectionPhase === 'no_ports' ||
      midi.connectionPhase === 'error'
    ) {
      pendingIdentifyPopupRef.current = false;
      setConnectionPopup({
        id: Date.now(),
        status: 'error',
        title: 'Failed to Connect to MegaDrum',
        message: midiRef.current.connectionMessage,
        canRequestPermission:
          midi.connectionPhase === 'sysex_blocked' || midi.connectionPhase === 'error',
      });
    }
  }, [connectTriggerId, midi.connectionPhase]);

  // Trigger pad audition sound
  const handleTriggerPad = useCallback(
    (padId: number, zone: 'head' | 'rim' | 'bell' = 'head') => {
      const pad = config.pads[padId - 1];
      if (!pad) return;

      let note = pad.note;
      if (zone === 'bell' && padId >= 2) {
        const pairIdx = Math.floor(padId / 2);
        const z = config.thirdZones[pairIdx - 1];
        if (z && z.note > 0) note = z.note;
      }

      const velocity = 98 + Math.floor(Math.random() * 24);
      setActiveHit({ padId, zone, velocity, timestamp: Date.now() });
      if (audioEnabled && note > 0) {
        playDrumSound(note, velocity);
      }
      midi.logSimulatedEvent({
        direction: 'out',
        type: 'note',
        channel: pad.midiChannel,
        note,
        velocity,
        summary: `Audition ${pad.name} (${zone}) · Note #${note} Vel ${velocity}`,
        rawHex: formatBytesHex([0x90 | ((pad.midiChannel - 1) & 0x0f), note & 0x7f, velocity & 0x7f]),
      });
    },
    [audioEnabled, config.pads, config.thirdZones, midi]
  );

  // Config mutators
  const handleUpdatePad = useCallback(
    (padId: number, patch: Partial<PadConfig>) => {
      setSelectedPresetId('custom');
      setConfig((prev) => ({
        ...prev,
        pads: prev.pads.map((p) => (p.id === padId ? { ...p, ...patch } : p)),
      }));
      const changedKeys = Object.keys(patch);
      if (changedKeys.some((k) => k !== 'name')) {
        enqueueLiveBlocks([`pad:${padId - 1}`]);
      }
    },
    [enqueueLiveBlocks]
  );

  const handleUpdate3rdZone = useCallback(
    (pairIndex: number, patch: Partial<ThirdZoneConfig>) => {
      const zIdx = pairIndex - 1;
      setSelectedPresetId('custom');
      setConfig((prev) => ({
        ...prev,
        thirdZones: prev.thirdZones.map((z, idx) => (idx === zIdx ? { ...z, ...patch } : z)),
      }));
      enqueueLiveBlocks([`third:${zIdx}`]);
    },
    [enqueueLiveBlocks]
  );

  const handleUpdatePositional = useCallback(
    (padId: number, patch: Partial<PositionalConfig>) => {
      const pIdx = padId - 1;
      setSelectedPresetId('custom');
      setConfig((prev) => ({
        ...prev,
        positionals: prev.positionals.map((pos, idx) => (idx === pIdx ? { ...pos, ...patch } : pos)),
      }));
      enqueueLiveBlocks([`pos:${pIdx}`]);
    },
    [enqueueLiveBlocks]
  );

  const handleApplyZoneTemplate = useCallback(
    (pairIndex: number, template: ZoneMode) => {
      if (pairIndex <= 0) return;
      const leftIdx = pairIndex * 2 - 1;
      const rightIdx = pairIndex * 2;
      const zIdx = pairIndex - 1;
      setSelectedPresetId('custom');

      setConfig((prev) => {
        const next = cloneConfig(prev);
        const left = next.pads[leftIdx];
        const right = next.pads[rightIdx];
        const third = next.thirdZones[zIdx];
        if (!left || !right || !third) return prev;

        if (template === 'single') {
          left.dual = false;
          left.threeWay = false;
          right.type = false;
          right.disabled = true;
          third.disabled = true;
        } else if (template === 'dual_piezo') {
          left.dual = true;
          left.threeWay = false;
          left.disabled = false;
          right.type = false; // Piezo
          right.disabled = false;
          third.disabled = false;
        } else if (template === 'piezo_switch') {
          left.dual = true;
          left.threeWay = false;
          left.disabled = false;
          right.type = true; // Switch
          right.disabled = false;
          third.disabled = true;
        } else if (template === 'three_way_roland') {
          left.dual = false;
          left.threeWay = true;
          left.disabled = false;
          right.type = true; // Switch
          right.disabled = false;
          third.disabled = false;
          if (third.note === 0) third.note = 53; // Ride Bell fallback
          if (third.dampenedNote === 0) third.dampenedNote = left.note;
        } else if (template === 'three_way_yamaha') {
          left.dual = true;
          left.threeWay = false;
          left.disabled = false;
          right.type = true; // Switch
          right.disabled = false;
          third.disabled = false;
          if (third.note === 0) third.note = 53;
          if (third.dampenedNote === 0) third.dampenedNote = left.note;
        }
        return next;
      });
      enqueueLiveBlocks([`pad:${leftIdx}`, `pad:${rightIdx}`, `third:${zIdx}`]);
      showNotice(`Applied ${template.replace(/_/g, ' ')} template to Pair ${pairIndex}`);
    },
    [enqueueLiveBlocks, showNotice]
  );

  const handleResetPair = useCallback(
    (pairIndex: number) => {
      const def = FACTORY_PRESETS[0].config;
      setConfig((prev) => {
        const next = cloneConfig(prev);
        if (pairIndex === 0) {
          next.pads[0] = { ...def.pads[0] };
          next.positionals[0] = { ...def.positionals[0] };
        } else {
          const lIdx = pairIndex * 2 - 1;
          const rIdx = pairIndex * 2;
          const zIdx = pairIndex - 1;
          if (def.pads[lIdx]) next.pads[lIdx] = { ...def.pads[lIdx] };
          if (def.pads[rIdx]) next.pads[rIdx] = { ...def.pads[rIdx] };
          if (def.thirdZones[zIdx]) next.thirdZones[zIdx] = { ...def.thirdZones[zIdx] };
          if (def.positionals[lIdx]) next.positionals[lIdx] = { ...def.positionals[lIdx] };
          if (def.positionals[rIdx]) next.positionals[rIdx] = { ...def.positionals[rIdx] };
        }
        return next;
      });
      if (pairIndex === 0) {
        enqueueLiveBlocks(['pad:0', 'pos:0']);
      } else {
        const lIdx = pairIndex * 2 - 1;
        const rIdx = pairIndex * 2;
        const zIdx = pairIndex - 1;
        enqueueLiveBlocks([`pad:${lIdx}`, `pad:${rIdx}`, `third:${zIdx}`, `pos:${lIdx}`, `pos:${rIdx}`]);
      }
      showNotice(
        pairIndex === 0
          ? 'Input 1 (Kick) reset to factory defaults'
          : `Pair ${pairIndex} reset to factory defaults`
      );
    },
    [enqueueLiveBlocks, showNotice]
  );

  const handleUpdatePedal = useCallback(
    (patch: Partial<PedalConfig>) => {
      setSelectedPresetId('custom');
      setConfig((prev) => ({ ...prev, pedal: { ...prev.pedal, ...patch } }));
      enqueueLiveBlocks(['pedal']);
    },
    [enqueueLiveBlocks]
  );

  const handleUpdateCurve = useCallback(
    (curveIdx: number, points: number[]) => {
      setSelectedPresetId('custom');
      setConfig((prev) => ({
        ...prev,
        curves: prev.curves.map((c, idx) => (idx === curveIdx ? { ...c, points } : c)),
      }));
      enqueueLiveBlocks([`curve:${curveIdx}`]);
    },
    [enqueueLiveBlocks]
  );

  const handleQueryConfigCount = useCallback(async () => {
    const ch = configRef.current.chainId;
    await executeQueue(
      [
        {
          kind: 'request',
          packet: buildRequestConfigCountSysex(ch),
          expectedCmd: MD_SYSEX_CMD.CONFIG_COUNT,
          label: 'EEPROM Config Count',
        },
      ],
      () => `Synced EEPROM Config Count from MegaDrum`
    );
  }, [executeQueue]);

  const handleUpdateGlobal = useCallback(
    (patch: Partial<GlobalConfig>) => {
      setSelectedPresetId('custom');
      setConfig((prev) => ({ ...prev, global: { ...prev.global, ...patch } }));
      enqueueLiveBlocks(['global']);

      if (
        (patch.maxInputs !== undefined ||
          patch.customPadNames !== undefined ||
          patch.customConfigNames !== undefined) &&
        midiRef.current.connectionPhase === 'connected'
      ) {
        setTimeout(() => {
          void handleQueryConfigCount();
        }, 300);
      }
    },
    [enqueueLiveBlocks, handleQueryConfigCount]
  );

  const handleUpdateMisc = useCallback(
    (patch: Partial<MiscConfig>) => {
      setSelectedPresetId('custom');
      setConfig((prev) => ({ ...prev, misc: { ...prev.misc, ...patch } }));
      enqueueLiveBlocks(['misc']);
    },
    [enqueueLiveBlocks]
  );

  const handleUpdateChainId = useCallback((chainId: number) => {
    setConfig((prev) => ({ ...prev, chainId: Math.max(0, Math.min(3, chainId)) }));
    setModuleSnapshot(createEmptySyncSnapshot());
    setDetectedHardware({ version: null, mcuTypeId: null });
  }, []);

  const handleRevertPairToModule = useCallback(
    (pairIdx: number) => {
      setConfig((prev) => {
        const next = cloneConfig(prev);
        if (pairIdx === 0) {
          if (moduleSnapshot.pads[0]) next.pads[0] = { ...moduleSnapshot.pads[0] };
          if (moduleSnapshot.positionals[0])
            next.positionals[0] = { ...moduleSnapshot.positionals[0] };
        } else {
          const lIdx = pairIdx * 2 - 1;
          const rIdx = pairIdx * 2;
          const zIdx = pairIdx - 1;
          if (moduleSnapshot.pads[lIdx]) next.pads[lIdx] = { ...moduleSnapshot.pads[lIdx]! };
          if (moduleSnapshot.pads[rIdx]) next.pads[rIdx] = { ...moduleSnapshot.pads[rIdx]! };
          if (moduleSnapshot.thirdZones[zIdx])
            next.thirdZones[zIdx] = { ...moduleSnapshot.thirdZones[zIdx]! };
          if (moduleSnapshot.positionals[lIdx])
            next.positionals[lIdx] = { ...moduleSnapshot.positionals[lIdx]! };
          if (moduleSnapshot.positionals[rIdx])
            next.positionals[rIdx] = { ...moduleSnapshot.positionals[rIdx]! };
        }
        return next;
      });
      showNotice(
        pairIdx === 0
          ? 'Reverted Input 1 (Kick) to MegaDrum module state'
          : `Reverted Pair ${pairIdx} to MegaDrum module state`
      );
    },
    [moduleSnapshot, showNotice]
  );

  const handleRevertPedalToModule = useCallback(() => {
    if (!moduleSnapshot.pedal) return;
    setConfig((prev) => ({ ...prev, pedal: { ...moduleSnapshot.pedal! } }));
    showNotice('Reverted Hi-Hat Pedal settings to MegaDrum module state');
  }, [moduleSnapshot.pedal, showNotice]);

  const handleRevertCurveToModule = useCallback(
    (curveIdx: number) => {
      const snapCurve = moduleSnapshot.curves[curveIdx];
      if (!snapCurve) return;
      setConfig((prev) => ({
        ...prev,
        curves: prev.curves.map((c, idx) =>
          idx === curveIdx ? { ...c, points: [...snapCurve.points] } : c
        ),
      }));
      showNotice(`Reverted Curve ${curveIdx + 1} to MegaDrum module state`);
    },
    [moduleSnapshot.curves, showNotice]
  );

  const handleRevertGlobalToModule = useCallback(() => {
    if (!moduleSnapshot.global) return;
    setConfig((prev) => ({ ...prev, global: { ...moduleSnapshot.global! } }));
    showNotice('Reverted Global settings to MegaDrum module state');
  }, [moduleSnapshot.global, showNotice]);

  const handleRevertMiscToModule = useCallback(() => {
    if (!moduleSnapshot.misc) return;
    setConfig((prev) => ({ ...prev, misc: { ...moduleSnapshot.misc! } }));
    showNotice('Reverted Misc settings to MegaDrum module state');
  }, [moduleSnapshot.misc, showNotice]);

  const handleSelectPreset = useCallback(
    (presetId: string) => {
      const found = FACTORY_PRESETS.find((p) => p.id === presetId);
      if (!found) return;
      setSelectedPresetId(found.id);
      setConfig(cloneConfig(found.config));
      showNotice(`Loaded preset: ${found.name}`);
    },
    [showNotice]
  );

  // =========================================================================
  // Real Queued SysEx Transactions (with response matching & timeout errors)
  // =========================================================================

  const handleGetAllFromModule = useCallback(async () => {
    const cfg = configRef.current;
    const ch = cfg.chainId;
    const tasks: SysexTaskItem[] = [
      {
        kind: 'request',
        packet: buildRequestVersionSysex(ch),
        expectedCmd: MD_SYSEX_CMD.VERSION,
        label: 'Version',
      },
      {
        kind: 'request',
        packet: buildRequestMcuSysex(ch),
        expectedCmd: MD_SYSEX_CMD.MCU_TYPE,
        label: 'MCU Type',
      },
      {
        kind: 'request',
        packet: buildRequestGlobalMiscSysex(ch),
        expectedCmd: MD_SYSEX_CMD.GLOBAL_MISC,
        label: 'Global Misc',
      },
      {
        kind: 'request',
        packet: buildRequestMiscSysex(ch),
        expectedCmd: MD_SYSEX_CMD.MISC,
        label: 'Misc',
      },
      {
        kind: 'request',
        packet: buildRequestPedalSysex(ch),
        expectedCmd: MD_SYSEX_CMD.PEDAL,
        label: 'Hi-Hat Pedal',
      },
    ];

    const count = Math.min(cfg.pads.length, Math.max(17, cfg.global.maxInputs - 1));
    for (let i = 0; i < count; i++) {
      tasks.push({
        kind: 'request',
        packet: buildRequestPadSysex(i, ch),
        expectedCmd: MD_SYSEX_CMD.PAD,
        expectedId: i + 1,
        label: `Input ${i + 1}`,
      });
      const posId = getSysexPosIdForInput(i, cfg.mcuTypeId);
      if (posId !== null) {
        tasks.push({
          kind: 'request',
          packet: buildRequestPosSysex(posId, ch),
          expectedCmd: MD_SYSEX_CMD.POS,
          expectedId: posId,
          label: `Positional ${i + 1}`,
        });
      }
      if ((i & 1) > 0) {
        const zIdx = (i - 1) / 2;
        tasks.push({
          kind: 'request',
          packet: buildRequest3rdSysex(zIdx, ch),
          expectedCmd: MD_SYSEX_CMD.THIRD_ZONE,
          expectedId: zIdx,
          label: `3rd Zone (Pair ${zIdx + 1})`,
        });
      }
    }

    for (let c = 0; c < 16; c++) {
      tasks.push({
        kind: 'request',
        packet: buildRequestCurveSysex(c, ch),
        expectedCmd: MD_SYSEX_CMD.CURVE,
        expectedId: c,
        label: `Curve ${c + 1}`,
      });
    }

    if (cfg.global.customPadNames) {
      const customCount = getMaxCustomPadNames(
        detectedHardware.mcuTypeId ?? cfg.mcuTypeId
      );
      for (let idx = 0; idx < customCount; idx++) {
        tasks.push({
          kind: 'request',
          packet: buildRequestCustomNameSysex(idx, ch),
          expectedCmd: MD_SYSEX_CMD.CUSTOM_NAME,
          expectedId: idx,
          label: `Custom Pad Name ${idx + 1}`,
        });
      }
    }

    const res = await executeQueue(
      tasks,
      (r) => `Get All complete: synced ${r.completed} blocks from MegaDrum`
    );
    if (res.ok) setSelectedPresetId('custom');
  }, [detectedHardware.mcuTypeId, executeQueue]);

  const handleSendAllToModule = useCallback(async () => {
    const cfg = configRef.current;
    const ch = cfg.chainId;
    const tasks: SysexTaskItem[] = [
      {
        kind: 'send',
        packet: encodeGlobalMiscSysex(cfg),
        verifyRequest: buildRequestGlobalMiscSysex(ch),
        expectedCmd: MD_SYSEX_CMD.GLOBAL_MISC,
        label: 'Global Misc',
      },
      {
        kind: 'send',
        packet: encodeMiscSysex(cfg),
        verifyRequest: buildRequestMiscSysex(ch),
        expectedCmd: MD_SYSEX_CMD.MISC,
        label: 'Misc',
      },
      {
        kind: 'send',
        packet: encodePedalSysex(cfg),
        verifyRequest: buildRequestPedalSysex(ch),
        expectedCmd: MD_SYSEX_CMD.PEDAL,
        label: 'Hi-Hat Pedal',
      },
    ];

    const count = Math.min(cfg.pads.length, Math.max(17, cfg.global.maxInputs - 1));
    for (let i = 0; i < count; i++) {
      tasks.push({
        kind: 'send',
        packet: encodePadSysex(cfg.pads[i], ch),
        verifyRequest: buildRequestPadSysex(i, ch),
        expectedCmd: MD_SYSEX_CMD.PAD,
        expectedId: i + 1,
        label: `Input ${i + 1}`,
      });
      const posId = getSysexPosIdForInput(i, cfg.mcuTypeId);
      if (posId !== null && cfg.positionals[i]) {
        tasks.push({
          kind: 'send',
          packet: encodePositionalSysex(cfg.positionals[i], posId, ch),
          verifyRequest: buildRequestPosSysex(posId, ch),
          expectedCmd: MD_SYSEX_CMD.POS,
          expectedId: posId,
          label: `Positional ${i + 1}`,
        });
      }
      if ((i & 1) > 0) {
        const zIdx = (i - 1) / 2;
        if (cfg.thirdZones[zIdx]) {
          tasks.push({
            kind: 'send',
            packet: encode3rdSysex(cfg.thirdZones[zIdx], ch),
            verifyRequest: buildRequest3rdSysex(zIdx, ch),
            expectedCmd: MD_SYSEX_CMD.THIRD_ZONE,
            expectedId: zIdx,
            label: `3rd Zone (Pair ${zIdx + 1})`,
          });
        }
      }
    }

    for (let c = 0; c < 16; c++) {
      tasks.push({
        kind: 'send',
        packet: encodeCurveSysex(c, cfg.curves[c].points, ch),
        verifyRequest: buildRequestCurveSysex(c, ch),
        expectedCmd: MD_SYSEX_CMD.CURVE,
        expectedId: c,
        label: `Curve ${c + 1}`,
      });
    }

    if (cfg.global.customPadNames && cfg.customNames) {
      const customCount = getMaxCustomPadNames(
        detectedHardware.mcuTypeId ?? cfg.mcuTypeId
      );
      for (let idx = 0; idx < customCount; idx++) {
        const name = cfg.customNames[idx] || `Custom${idx + 1}`;
        tasks.push({
          kind: 'send',
          packet: buildSaveCustomNameSysex(idx, name, ch),
          verifyRequest: buildRequestCustomNameSysex(idx, ch),
          expectedCmd: MD_SYSEX_CMD.CUSTOM_NAME,
          expectedId: idx,
          label: `Custom Pad Name ${idx + 1}`,
        });
      }
    }

    tasks.push({
      kind: 'request',
      packet: buildRequestConfigCountSysex(ch),
      expectedCmd: MD_SYSEX_CMD.CONFIG_COUNT,
      label: 'EEPROM Config Count',
    });

    await executeQueue(
      tasks,
      (r) => `Send All complete: verified ${r.completed} blocks on MegaDrum`
    );
  }, [detectedHardware.mcuTypeId, executeQueue]);

  const handleRequestPairSysex = useCallback(
    async (pairIdx: number) => {
      const cfg = configRef.current;
      const ch = cfg.chainId;
      const tasks: SysexTaskItem[] = [];
      if (pairIdx === 0) {
        tasks.push({
          kind: 'request',
          packet: buildRequestPadSysex(0, ch),
          expectedCmd: MD_SYSEX_CMD.PAD,
          expectedId: 1,
          label: 'Input 1 (Kick)',
        });
      } else {
        const lIdx = pairIdx * 2 - 1;
        const rIdx = pairIdx * 2;
        const zIdx = pairIdx - 1;
        tasks.push({
          kind: 'request',
          packet: buildRequestPadSysex(lIdx, ch),
          expectedCmd: MD_SYSEX_CMD.PAD,
          expectedId: lIdx + 1,
          label: `Input ${lIdx + 1}`,
        });
        tasks.push({
          kind: 'request',
          packet: buildRequestPadSysex(rIdx, ch),
          expectedCmd: MD_SYSEX_CMD.PAD,
          expectedId: rIdx + 1,
          label: `Input ${rIdx + 1}`,
        });
        tasks.push({
          kind: 'request',
          packet: buildRequest3rdSysex(zIdx, ch),
          expectedCmd: MD_SYSEX_CMD.THIRD_ZONE,
          expectedId: zIdx,
          label: `3rd Zone (Pair ${pairIdx})`,
        });
        const posL = getSysexPosIdForInput(lIdx, cfg.mcuTypeId);
        if (posL !== null) {
          tasks.push({
            kind: 'request',
            packet: buildRequestPosSysex(posL, ch),
            expectedCmd: MD_SYSEX_CMD.POS,
            expectedId: posL,
            label: `Positional ${lIdx + 1}`,
          });
        }
      }
      await executeQueue(
        tasks,
        () =>
          pairIdx === 0
            ? 'Synced Input 1 (Kick) from MegaDrum'
            : `Synced Pair ${pairIdx} (Head, Rim, 3rd Zone) from MegaDrum`
      );
    },
    [executeQueue]
  );

  const handleSendPairSysex = useCallback(
    async (pairIdx: number) => {
      const cfg = configRef.current;
      const ch = cfg.chainId;
      const tasks: SysexTaskItem[] = [];
      if (pairIdx === 0) {
        tasks.push({
          kind: 'send',
          packet: encodePadSysex(cfg.pads[0], ch),
          verifyRequest: buildRequestPadSysex(0, ch),
          expectedCmd: MD_SYSEX_CMD.PAD,
          expectedId: 1,
          label: 'Input 1 (Kick)',
        });
      } else {
        const lIdx = pairIdx * 2 - 1;
        const rIdx = pairIdx * 2;
        const zIdx = pairIdx - 1;
        tasks.push({
          kind: 'send',
          packet: encodePadSysex(cfg.pads[lIdx], ch),
          verifyRequest: buildRequestPadSysex(lIdx, ch),
          expectedCmd: MD_SYSEX_CMD.PAD,
          expectedId: lIdx + 1,
          label: `Input ${lIdx + 1}`,
        });
        tasks.push({
          kind: 'send',
          packet: encodePadSysex(cfg.pads[rIdx], ch),
          verifyRequest: buildRequestPadSysex(rIdx, ch),
          expectedCmd: MD_SYSEX_CMD.PAD,
          expectedId: rIdx + 1,
          label: `Input ${rIdx + 1}`,
        });
        tasks.push({
          kind: 'send',
          packet: encode3rdSysex(cfg.thirdZones[zIdx], ch),
          verifyRequest: buildRequest3rdSysex(zIdx, ch),
          expectedCmd: MD_SYSEX_CMD.THIRD_ZONE,
          expectedId: zIdx,
          label: `3rd Zone (Pair ${pairIdx})`,
        });
        const posL = getSysexPosIdForInput(lIdx, cfg.mcuTypeId);
        if (posL !== null && cfg.positionals[lIdx]) {
          tasks.push({
            kind: 'send',
            packet: encodePositionalSysex(cfg.positionals[lIdx], posL, ch),
            verifyRequest: buildRequestPosSysex(posL, ch),
            expectedCmd: MD_SYSEX_CMD.POS,
            expectedId: posL,
            label: `Positional ${lIdx + 1}`,
          });
        }
      }
      await executeQueue(
        tasks,
        () =>
          pairIdx === 0
            ? 'Sent & verified Input 1 (Kick) on MegaDrum'
            : `Sent & verified Pair ${pairIdx} (Head, Rim, 3rd Zone) on MegaDrum`
      );
    },
    [executeQueue]
  );

  const handleRequestPedalSysex = useCallback(async () => {
    const ch = configRef.current.chainId;
    await executeQueue(
      [
        {
          kind: 'request',
          packet: buildRequestPedalSysex(ch),
          expectedCmd: MD_SYSEX_CMD.PEDAL,
          label: 'Get Pedal',
        },
      ],
      () => 'Hi-Hat Pedal settings synced from MegaDrum'
    );
  }, [executeQueue]);

  const handleSendPedalSysex = useCallback(async () => {
    const cfg = configRef.current;
    await executeQueue(
      [
        {
          kind: 'send',
          packet: encodePedalSysex(cfg),
          verifyRequest: buildRequestPedalSysex(cfg.chainId),
          expectedCmd: MD_SYSEX_CMD.PEDAL,
          label: 'Send Pedal',
        },
      ],
      () => 'Sent & verified Hi-Hat Pedal settings on MegaDrum'
    );
  }, [executeQueue]);

  const handleRequestPedalRawLevel = useCallback(
    async (assignTo?: 'low' | 'high') => {
      const ch = configRef.current.chainId;
      const res = await executeQueue(
        [
          {
            kind: 'request',
            packet: buildRequestPedalRawSysex(ch),
            expectedCmd: MD_SYSEX_CMD.PEDAL_LEVEL_RAW,
            label: 'Read Pedal Raw ADC',
          },
        ],
        () => 'Read Pedal Raw ADC from MegaDrum'
      );

      if (res.ok && res.responses[0]) {
        const decoded = applyIncomingSysexPacket(res.responses[0], configRef.current);
        if (decoded?.pedalRawLevel !== undefined) {
          const raw = decoded.pedalRawLevel;
          setLastRawAdc(raw);
          if (assignTo === 'low') {
            handleUpdatePedal({ lowLevel: raw });
            showNotice(`Captured Pedal Low Level = ${raw}`);
          } else if (assignTo === 'high') {
            handleUpdatePedal({ highLevel: raw });
            showNotice(`Captured Pedal High Level = ${raw}`);
          }
        }
      }
    },
    [executeQueue, handleUpdatePedal, showNotice]
  );

  const handleGetCurveSysex = useCallback(
    async (curveIdx: number) => {
      const ch = configRef.current.chainId;
      await executeQueue(
        [
          {
            kind: 'request',
            packet: buildRequestCurveSysex(curveIdx, ch),
            expectedCmd: MD_SYSEX_CMD.CURVE,
            expectedId: curveIdx,
            label: `Get Curve ${curveIdx + 1}`,
          },
        ],
        () => `Synced Curve ${curveIdx + 1} from MegaDrum`
      );
    },
    [executeQueue]
  );

  const handleSendCurveSysex = useCallback(
    async (curveIdx: number, points: number[]) => {
      const ch = configRef.current.chainId;
      await executeQueue(
        [
          {
            kind: 'send',
            packet: encodeCurveSysex(curveIdx, points, ch),
            verifyRequest: buildRequestCurveSysex(curveIdx, ch),
            expectedCmd: MD_SYSEX_CMD.CURVE,
            expectedId: curveIdx,
            label: `Send Curve ${curveIdx + 1}`,
          },
        ],
        () => `Sent & verified Curve ${curveIdx + 1} on MegaDrum`
      );
    },
    [executeQueue]
  );

  const handleGetAllCurvesSysex = useCallback(async () => {
    const ch = configRef.current.chainId;
    const tasks: SysexTaskItem[] = Array.from({ length: 16 }, (_, idx) => ({
      kind: 'request',
      packet: buildRequestCurveSysex(idx, ch),
      expectedCmd: MD_SYSEX_CMD.CURVE,
      expectedId: idx,
      label: `Curve ${idx + 1}`,
    }));
    await executeQueue(tasks, () => 'Synced all 16 velocity curves from MegaDrum');
  }, [executeQueue]);

  const handleSendAllCurvesSysex = useCallback(async () => {
    const cfg = configRef.current;
    const ch = cfg.chainId;
    const tasks: SysexTaskItem[] = cfg.curves.map((c, idx) => ({
      kind: 'send',
      packet: encodeCurveSysex(idx, c.points, ch),
      verifyRequest: buildRequestCurveSysex(idx, ch),
      expectedCmd: MD_SYSEX_CMD.CURVE,
      expectedId: idx,
      label: `Curve ${idx + 1}`,
    }));
    await executeQueue(tasks, () => 'Sent & verified all 16 velocity curves on MegaDrum');
  }, [executeQueue]);

  const handleGetGlobal = useCallback(async () => {
    const ch = configRef.current.chainId;
    await executeQueue(
      [
        {
          kind: 'request',
          packet: buildRequestGlobalMiscSysex(ch),
          expectedCmd: MD_SYSEX_CMD.GLOBAL_MISC,
          label: 'Get Global Misc',
        },
      ],
      () => 'Global Misc settings synced from MegaDrum'
    );
  }, [executeQueue]);

  const handleSendGlobal = useCallback(async () => {
    const cfg = configRef.current;
    const ch = cfg.chainId;
    await executeQueue(
      [
        {
          kind: 'send',
          packet: encodeGlobalMiscSysex(cfg),
          verifyRequest: buildRequestGlobalMiscSysex(ch),
          expectedCmd: MD_SYSEX_CMD.GLOBAL_MISC,
          label: 'Send Global Misc',
        },
        {
          kind: 'request',
          packet: buildRequestConfigCountSysex(ch),
          expectedCmd: MD_SYSEX_CMD.CONFIG_COUNT,
          label: 'EEPROM Config Count',
        },
      ],
      () => 'Sent & verified Global Misc settings & synced EEPROM Config Count on MegaDrum'
    );
  }, [executeQueue]);

  const handleGetMisc = useCallback(async () => {
    const ch = configRef.current.chainId;
    await executeQueue(
      [
        {
          kind: 'request',
          packet: buildRequestMiscSysex(ch),
          expectedCmd: MD_SYSEX_CMD.MISC,
          label: 'Get Misc',
        },
      ],
      () => 'Misc trigger engine settings synced from MegaDrum'
    );
  }, [executeQueue]);

  const handleSendMisc = useCallback(async () => {
    const cfg = configRef.current;
    await executeQueue(
      [
        {
          kind: 'send',
          packet: encodeMiscSysex(cfg),
          verifyRequest: buildRequestMiscSysex(cfg.chainId),
          expectedCmd: MD_SYSEX_CMD.MISC,
          label: 'Send Misc',
        },
      ],
      () => 'Sent & verified Misc trigger settings on MegaDrum'
    );
  }, [executeQueue]);

  const handleQueryHardware = useCallback(async () => {
    const ch = configRef.current.chainId;
    await executeQueue(
      [
        {
          kind: 'request',
          packet: buildRequestVersionSysex(ch),
          expectedCmd: MD_SYSEX_CMD.VERSION,
          label: 'Firmware Version',
        },
        {
          kind: 'request',
          packet: buildRequestMcuSysex(ch),
          expectedCmd: MD_SYSEX_CMD.MCU_TYPE,
          label: 'MCU Type',
        },
      ],
      () => 'Identified connected MegaDrum Firmware Version & MCU'
    );
  }, [executeQueue]);

  const handleQueryConfigCurrent = useCallback(async () => {
    const ch = configRef.current.chainId;
    await executeQueue(
      [
        {
          kind: 'request',
          packet: buildRequestConfigCurrentSysex(ch),
          expectedCmd: MD_SYSEX_CMD.CONFIG_CURRENT,
          label: 'Active EEPROM Slot',
        },
      ],
      () => `Synced Active EEPROM Slot from MegaDrum`
    );
  }, [executeQueue]);

  const handleReadConfigName = useCallback(async (slot: number) => {
    const ch = configRef.current.chainId;
    await executeQueue(
      [
        {
          kind: 'request',
          packet: buildRequestConfigNameSysex(slot - 1, ch),
          expectedCmd: MD_SYSEX_CMD.CONFIG_NAME,
          label: `Read Slot ${slot} Name`,
        },
      ],
      () => `Read Name for EEPROM Slot ${slot}`
    );
  }, [executeQueue]);

  const handleSaveConfigName = useCallback(async (slot: number, name: string) => {
    const ch = configRef.current.chainId;
    await executeQueue(
      [
        {
          kind: 'fire_and_forget',
          packet: buildSaveConfigNameSysex(slot - 1, name, ch),
          expectedCmd: MD_SYSEX_CMD.CONFIG_NAME,
          label: `Save Slot ${slot} Name`,
        },
      ],
      () => `Saved Name for EEPROM Slot ${slot}`
    );
  }, [executeQueue]);

  const handleUpdateCustomName = useCallback((index0Based: number, name: string) => {
    setSelectedPresetId('custom');
    setConfig((prev) => {
      const nextNames = [...(prev.customNames || Array.from({ length: 32 }, (_, i) => `Custom${i + 1}`))];
      nextNames[index0Based] = name.slice(0, 8);
      return { ...prev, customNames: nextNames };
    });
  }, []);

  const handleGetCustomName = useCallback(
    async (index0Based: number) => {
      const ch = configRef.current.chainId;
      await executeQueue(
        [
          {
            kind: 'request',
            packet: buildRequestCustomNameSysex(index0Based, ch),
            expectedCmd: MD_SYSEX_CMD.CUSTOM_NAME,
            expectedId: index0Based,
            label: `Read Custom Pad Name ${index0Based + 1}`,
          },
        ],
        () => `Read Custom Pad Name ${index0Based + 1} from MegaDrum EEPROM`
      );
    },
    [executeQueue]
  );

  const handleSendCustomName = useCallback(
    async (index0Based: number, name: string) => {
      const ch = configRef.current.chainId;
      await executeQueue(
        [
          {
            kind: 'send',
            packet: buildSaveCustomNameSysex(index0Based, name, ch),
            verifyRequest: buildRequestCustomNameSysex(index0Based, ch),
            expectedCmd: MD_SYSEX_CMD.CUSTOM_NAME,
            expectedId: index0Based,
            label: `Send Custom Pad Name ${index0Based + 1}`,
          },
        ],
        () => `Saved & verified Custom Pad Name ${index0Based + 1} in MegaDrum EEPROM`
      );
    },
    [executeQueue]
  );

  const handleGetAllCustomNames = useCallback(async () => {
    const cfg = configRef.current;
    const ch = cfg.chainId;
    const count = getMaxCustomPadNames(detectedHardware.mcuTypeId ?? cfg.mcuTypeId);
    const tasks: SysexTaskItem[] = Array.from({ length: count }, (_, idx) => ({
      kind: 'request',
      packet: buildRequestCustomNameSysex(idx, ch),
      expectedCmd: MD_SYSEX_CMD.CUSTOM_NAME,
      expectedId: idx,
      label: `Custom Pad Name ${idx + 1}`,
    }));
    await executeQueue(tasks, () => `Synced all ${count} custom pad names from MegaDrum EEPROM`);
  }, [detectedHardware.mcuTypeId, executeQueue]);

  const handleSendAllCustomNames = useCallback(async () => {
    const cfg = configRef.current;
    const ch = cfg.chainId;
    const count = getMaxCustomPadNames(detectedHardware.mcuTypeId ?? cfg.mcuTypeId);
    const tasks: SysexTaskItem[] = Array.from({ length: count }, (_, idx) => {
      const name = cfg.customNames?.[idx] || `Custom${idx + 1}`;
      return {
        kind: 'send',
        packet: buildSaveCustomNameSysex(idx, name, ch),
        verifyRequest: buildRequestCustomNameSysex(idx, ch),
        expectedCmd: MD_SYSEX_CMD.CUSTOM_NAME,
        expectedId: idx,
        label: `Custom Pad Name ${idx + 1}`,
      };
    });
    await executeQueue(tasks, () => `Saved & verified all ${count} custom pad names in MegaDrum EEPROM`);
  }, [detectedHardware.mcuTypeId, executeQueue]);

  const handlePrimaryTopBarAction = useCallback(async () => {
    if (midi.connectionPhase === 'connected') {
      handleDisconnectMidi();
      showNotice('MIDI disconnected');
    } else {
      await handleConnectMidi();
    }
  }, [handleConnectMidi, handleDisconnectMidi, midi.connectionPhase, showNotice]);

  const handleImportFile = useCallback(
    async (file: File) => {
      const lower = file.name.toLowerCase();
      if (lower.endsWith('.syx')) {
        const buf = new Uint8Array(await file.arrayBuffer());
        const packets = splitSysexStream(buf);
        let updated = cloneConfig(config);
        let appliedCount = 0;
        for (const pkt of packets) {
          const res = applyIncomingSysexPacket(pkt, updated);
          if (res) {
            updated = res.updated;
            appliedCount++;
          }
        }
        if (appliedCount > 0) {
          setConfig(updated);
          setSelectedPresetId('custom');
          showNotice(`Imported ${appliedCount} SysEx blocks from ${file.name}`);
        } else {
          showNotice(`No MegaDrum SysEx packets found in ${file.name}`, true);
        }
        return;
      }

      const text = await file.text();
      if (lower.endsWith('.json')) {
        try {
          const parsed = JSON.parse(text);
          if (isValidConfigV2(parsed)) {
            setConfig(normalizeConfig(parsed));
            setSelectedPresetId('custom');
            showNotice(`Imported JSON kit snapshot: ${file.name}`);
            return;
          }
        } catch {
          showNotice(`Invalid JSON file: ${file.name}`, true);
          return;
        }
      }

      const parsedMds = parseMds(text, config);
      setConfig(parsedMds);
      setSelectedPresetId('custom');
      showNotice(`Imported .mds configuration: ${file.name}`);
    },
    [config, showNotice]
  );

  const handleExportMds = useCallback(() => {
    const slug = (config.kitName || 'megadrum-kit').toLowerCase().replace(/[^a-z0-9]+/g, '-');
    downloadBlob(serializeMds(config), `${slug}.mds`, 'text/plain;charset=utf-8');
    showNotice(`Exported ${slug}.mds`);
  }, [config, showNotice]);

  const handleExportSyx = useCallback(() => {
    const slug = (config.kitName || 'megadrum-kit').toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const bytes = buildFullConfigSyxFile(config);
    downloadBlob(bytes.buffer as ArrayBuffer, `${slug}.syx`, 'application/octet-stream');
    showNotice(`Exported ${slug}.syx (${bytes.length} bytes)`);
  }, [config, showNotice]);

  const handleExportJson = useCallback(() => {
    const slug = (config.kitName || 'megadrum-kit').toLowerCase().replace(/[^a-z0-9]+/g, '-');
    downloadBlob(JSON.stringify(config, null, 2), `${slug}.json`, 'application/json');
    showNotice(`Exported ${slug}.json`);
  }, [config, showNotice]);

  const testHitPadId = selectedPairIndex === 0 ? 1 : selectedPairIndex * 2;
  const syncTotals = useMemo(
    () => getTotalModifiedCount(config, moduleSnapshot),
    [config, moduleSnapshot]
  );

  const isPermissionAlert =
    (midi.connectionPhase === 'error' ||
      midi.connectionPhase === 'sysex_blocked' ||
      midi.permissionIssue !== 'none') &&
    midi.connectionPhase !== 'no_ports';

  const hasAlert =
    midi.sysexStatus.code === 'timeout' ||
    midi.sysexStatus.code === 'midi_not_open' ||
    midi.sysexStatus.code === 'error' ||
    midi.sysexStatus.code === 'mismatch' ||
    isPermissionAlert ||
    midi.connectionPhase === 'no_ports';

  const alertText =
    midi.connectionPhase === 'no_ports'
      ? 'WebMIDI permission was successfully granted, but 0 MIDI input or output devices were detected. Please ensure your MegaDrum module is powered on and connected via a working USB cable, then click Scan MIDI ports.'
      : midi.sysexStatus.code === 'timeout' ||
        midi.sysexStatus.code === 'midi_not_open' ||
        midi.sysexStatus.code === 'error' ||
        midi.sysexStatus.code === 'mismatch'
      ? midi.sysexStatus.message
      : midi.connectionMessage;

  const alertTitle =
    midi.connectionPhase === 'no_ports'
      ? 'WebMIDI Granted — No MIDI Devices Detected'
      : midi.permissionIssue === 'addon_required'
      ? 'WebMIDI Permission / Device Check'
      : midi.permissionIssue === 'prompt_required'
      ? 'WebMIDI Permission / Device Check'
      : midi.permissionIssue === 'sysex_blocked'
      ? 'WebMIDI SysEx Permission Required'
      : midi.permissionIssue === 'denied'
      ? 'WebMIDI Permission Blocked'
      : midi.permissionIssue === 'backend_error'
      ? 'No MIDI Devices or Access Error'
      : midi.permissionIssue === 'unsupported'
      ? 'WebMIDI Not Supported'
      : midi.sysexStatus.code === 'timeout'
      ? 'MegaDrum SysEx Timeout'
      : midi.sysexStatus.code === 'midi_not_open'
      ? 'MIDI Ports Not Open'
      : 'MIDI / SysEx Alert';

  const alertKey = hasAlert
    ? `${midi.permissionIssue}|${midi.connectionPhase}|${midi.sysexStatus.code}|${alertText}`
    : '';

  useEffect(() => {
    if (!hasAlert) {
      lastAlertKeyRef.current = '';
      setAlertModalOpen(false);
      return;
    }
    if (connectionPopup) {
      lastAlertKeyRef.current = alertKey;
      setAlertModalOpen(false);
      return;
    }
    if (alertKey && alertKey !== lastAlertKeyRef.current) {
      lastAlertKeyRef.current = alertKey;
      setAlertModalOpen(true);
    }
  }, [alertKey, connectionPopup, hasAlert]);

  const handleDismissAlertModal = useCallback(() => {
    setAlertModalOpen(false);
    if (!isPermissionAlert) {
      midi.clearSysexStatus();
    }
  }, [isPermissionAlert, midi]);

  return (
    <div className="h-screen flex flex-col bg-[var(--md-canvas)] text-slate-900 dark:text-slate-100 overflow-hidden">
      <TopBar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        connectionPhase={midi.connectionPhase}
        canConnectMidi={midi.midiPermissionGranted}
        permissionState={midi.permissionState}
        onPrimaryAction={handlePrimaryTopBarAction}
        syncFlash={syncFlash}
        isBusy={midi.sysexStatus.code === 'working'}
      />

      <WorkspaceToolbar
        midiSupported={midi.supported}
        midiConnected={midi.connected}
        hasMidiAccess={midi.hasMidiAccess}
        midiPermissionGranted={midi.midiPermissionGranted}
        permissionState={midi.permissionState}
        connectionPhase={midi.connectionPhase}
        connectionMessage={midi.connectionMessage}
        hasAlert={hasAlert}
        onOpenAlertModal={() => setAlertModalOpen(true)}
        sysexStatus={midi.sysexStatus}
        inputs={midi.inputs}
        outputs={midi.outputs}
        selectedInputId={midi.selectedInputId}
        selectedOutputId={midi.selectedOutputId}
        onSelectInput={midi.setSelectedInputId}
        onSelectOutput={midi.setSelectedOutputId}
        onScanPorts={() => void midi.scanPorts({ userTriggered: true })}
        onConnectMidi={handleConnectMidi}
        onDisconnectMidi={handleDisconnectMidi}
        onGetAll={handleGetAllFromModule}
        onSendAll={handleSendAllToModule}
        liveUpdates={liveUpdates}
        onToggleLiveUpdates={handleToggleLiveUpdates}
        unsyncedCount={syncTotals.modifiedFields}
        selectedPresetId={selectedPresetId}
        onSelectPreset={handleSelectPreset}
        onImportFile={handleImportFile}
        onExportMds={handleExportMds}
        onExportSyx={handleExportSyx}
        onTestHit={() => handleTriggerPad(testHitPadId, 'head')}
        audioEnabled={audioEnabled}
        onToggleAudio={() => setAudioEnabled((a) => !a)}
        theme={theme}
        effectiveTheme={effectiveTheme}
        onSelectTheme={setTheme}
      />

      {activeTab === 'pads' && (
        <KitPadsView
          pads={config.pads}
          thirdZones={config.thirdZones}
          positionals={config.positionals}
          curves={config.curves}
          syncSnapshot={moduleSnapshot}
          maxInputs={config.global.maxInputs}
          mcuTypeId={
            midi.connected && detectedHardware.mcuTypeId !== null
              ? detectedHardware.mcuTypeId
              : config.mcuTypeId
          }
          customNames={config.customNames || []}
          customPadNamesEnabled={config.global.customPadNames}
          selectedPairIndex={selectedPairIndex}
          activeHit={activeHit}
          audioEnabled={audioEnabled}
          onSelectPair={setSelectedPairIndex}
          onUpdatePad={handleUpdatePad}
          onUpdate3rdZone={handleUpdate3rdZone}
          onUpdatePositional={handleUpdatePositional}
          onApplyZoneTemplate={handleApplyZoneTemplate}
          onResetPair={handleResetPair}
          onRevertPairToModule={handleRevertPairToModule}
          onTriggerPad={handleTriggerPad}
          onSendPairSysex={handleSendPairSysex}
          onRequestPairSysex={handleRequestPairSysex}
          onOpenCustomNamesManager={() => setCustomNamesModalOpen(true)}
        />
      )}

      {activeTab === 'pedal' && (
        <PedalView
          pedal={config.pedal}
          curves={config.curves}
          syncSnapshot={moduleSnapshot}
          livePedalPosition={livePedalPosition}
          lastRawAdc={lastRawAdc}
          audioEnabled={audioEnabled}
          onUpdatePedal={handleUpdatePedal}
          onRevertPedalToModule={handleRevertPedalToModule}
          onSimulatePedalMove={(ccVal) => {
            setLivePedalPosition(ccVal);
            midi.logSimulatedEvent({
              direction: 'in',
              type: 'cc',
              channel: config.global.globalMidiChannel,
              cc: config.pedal.cc,
              ccValue: ccVal,
              summary: `CC #${config.pedal.cc} (Hi-Hat Pedal) = ${ccVal}`,
              rawHex: formatBytesHex([
                0xb0 | ((config.global.globalMidiChannel - 1) & 0x0f),
                config.pedal.cc & 0x7f,
                ccVal & 0x7f,
              ]),
            });
          }}
          onSendPedalSysex={handleSendPedalSysex}
          onRequestPedalSysex={handleRequestPedalSysex}
          onRequestPedalRawLevel={handleRequestPedalRawLevel}
        />
      )}

      {activeTab === 'curves' && (
        <CurvesView
          curves={config.curves}
          syncSnapshot={moduleSnapshot}
          onUpdateCurve={handleUpdateCurve}
          onRevertCurveToModule={handleRevertCurveToModule}
          onGetCurveSysex={handleGetCurveSysex}
          onSendCurveSysex={handleSendCurveSysex}
          onGetAllCurvesSysex={handleGetAllCurvesSysex}
          onSendAllCurvesSysex={handleSendAllCurvesSysex}
        />
      )}

      {activeTab === 'global' && (
        <GlobalMiscView
          globalConfig={config.global}
          miscConfig={config.misc}
          syncSnapshot={moduleSnapshot}
          customNames={config.customNames || []}
          snapCustomNames={moduleSnapshot.customNames}
          midiConnected={midi.connected}
          chainId={config.chainId}
          version={
            midi.connected && detectedHardware.version
              ? detectedHardware.version
              : 'Unknown'
          }
          mcuTypeId={
            midi.connected && detectedHardware.mcuTypeId !== null
              ? detectedHardware.mcuTypeId
              : 0
          }
          theme={theme}
          effectiveTheme={effectiveTheme}
          onSelectTheme={setTheme}
          onUpdateGlobal={handleUpdateGlobal}
          onUpdateMisc={handleUpdateMisc}
          onUpdateChainId={handleUpdateChainId}
          onUpdateCustomName={handleUpdateCustomName}
          onGetCustomName={handleGetCustomName}
          onSendCustomName={handleSendCustomName}
          onGetAllCustomNames={handleGetAllCustomNames}
          onSendAllCustomNames={handleSendAllCustomNames}
          onRevertGlobalToModule={handleRevertGlobalToModule}
          onRevertMiscToModule={handleRevertMiscToModule}
          onGetGlobal={handleGetGlobal}
          onSendGlobal={handleSendGlobal}
          onGetMisc={handleGetMisc}
          onSendMisc={handleSendMisc}
          onQueryHardware={handleQueryHardware}
        />
      )}

      {activeTab === 'log' && (
        <MidiLogView
          logs={midi.midiLogs}
          config={config}
          midiConnected={midi.connected}
          livePedalPosition={livePedalPosition}
          onClearLogs={midi.clearLogs}
          onTestHit={() => handleTriggerPad(testHitPadId, 'head')}
          onJumpToPadPair={(pairIdx) => {
            setSelectedPairIndex(pairIdx);
            setActiveTab('pads');
          }}
        />
      )}

      {activeTab === 'sysex' && (
        <SysexMonitorView
          config={config}
          midiConnected={midi.connected}
          detectedVersion={detectedHardware.version}
          detectedMcuTypeId={detectedHardware.mcuTypeId}
          logs={midi.midiLogs}
          onClearLogs={midi.clearLogs}
          onOpenMidiLog={() => setActiveTab('log')}
          onGetAllFromModule={handleGetAllFromModule}
          onSendAllToModule={handleSendAllToModule}
          onSaveToSlot={async (slot) => {
            await executeQueue(
              [
                {
                  kind: 'fire_and_forget',
                  packet: buildSaveSlotSysex(slot - 1, configRef.current.chainId),
                  expectedCmd: MD_SYSEX_CMD.CONFIG_SAVE,
                  label: `Save to Slot ${slot}`,
                },
              ],
              () => `Saved config to EEPROM Slot ${slot}`
            );
          }}
          onLoadFromSlot={async (slot) => {
            const res = await executeQueue(
              [
                {
                  kind: 'fire_and_forget',
                  packet: buildLoadSlotSysex(slot - 1, configRef.current.chainId),
                  expectedCmd: MD_SYSEX_CMD.CONFIG_LOAD,
                  label: `Load Slot ${slot}`,
                },
              ],
              () => `Loaded EEPROM Slot ${slot} on MegaDrum — click Get All to sync parameters`
            );
            if (res.ok) {
              setModuleSnapshot(createEmptySyncSnapshot());
            }
          }}
          onQueryConfigCount={handleQueryConfigCount}
          onQueryConfigCurrent={handleQueryConfigCurrent}
          onReadConfigName={handleReadConfigName}
          onSaveConfigName={handleSaveConfigName}
          onExportMds={handleExportMds}
          onExportSyx={handleExportSyx}
          onExportJson={handleExportJson}
          onQueryHardware={handleQueryHardware}
          onSendBootloaderEnter={midi.sendSysex}
          onSendFirmwareFrameWithAck={midi.sendFirmwareFrameWithAck}
          onNotice={(msg) => showNotice(msg)}
        />
      )}

      <ConnectionStatusPopup
        popup={connectionPopup}
        onDismiss={handleDismissConnectionPopup}
        onRequestPermission={handleRequestMidiPermission}
        isInIframe={midi.isInIframe}
        isFirefox={midi.isFirefox}
        permissionRequesting={midi.permissionRequesting}
      />

      <MidiAlertModal
        open={alertModalOpen && !connectionPopup}
        title={alertTitle}
        alertText={alertText}
        isPermissionAlert={isPermissionAlert}
        isNoPortsAlert={midi.connectionPhase === 'no_ports'}
        permissionIssue={midi.permissionIssue}
        permissionRequesting={midi.permissionRequesting}
        permissionAttemptCount={midi.permissionAttemptCount}
        midiSupported={midi.supported}
        isInIframe={midi.isInIframe}
        isFirefox={midi.isFirefox}
        onRequestPermission={handleRequestMidiPermission}
        onScanPorts={() => void midi.scanPorts({ userTriggered: true })}
        onDismiss={handleDismissAlertModal}
      />

      <CustomPadNamesModal
        open={customNamesModalOpen}
        onDismiss={() => setCustomNamesModalOpen(false)}
        customNames={config.customNames || []}
        snapCustomNames={moduleSnapshot.customNames}
        mcuTypeId={
          midi.connected && detectedHardware.mcuTypeId !== null
            ? detectedHardware.mcuTypeId
            : config.mcuTypeId
        }
        customPadNamesEnabled={config.global.customPadNames}
        midiConnected={midi.connected}
        onUpdateCustomName={handleUpdateCustomName}
        onGetCustomName={handleGetCustomName}
        onSendCustomName={handleSendCustomName}
        onGetAllCustomNames={handleGetAllCustomNames}
        onSendAllCustomNames={handleSendAllCustomNames}
        onEnableCustomPadNames={() => handleUpdateGlobal({ customPadNames: true })}
        compact
      />

      {notice && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed bottom-4 right-4 z-50 px-4 py-2.5 rounded-md text-xs font-medium shadow-lg border ${
            notice.isError
              ? 'bg-red-600 text-white border-red-500'
              : 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 border-slate-700 dark:border-slate-300'
          }`}
        >
          {notice.text}
        </div>
      )}
    </div>
  );
}
