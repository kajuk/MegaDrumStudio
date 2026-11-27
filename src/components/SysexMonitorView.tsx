import React, { useMemo, useState } from 'react';
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Check,
  Copy,
  Cpu,
  Download,
  HardDrive,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import { MD_MCU_TYPES, MegaDrumConfig, MidiEventLog } from '../types/megadrum';
import { decodeMidiLogDetails, normalizeHexBytes } from '../utils/midiLogFormat';
import { buildFullConfigSyxFile, formatBytesHex } from '../utils/sysex';
import { calculateMaxEEPROMSlots } from '../utils/sysex';
import { FirmwareUpgradePanel } from './FirmwareUpgradePanel';

interface SysexMonitorViewProps {
  config: MegaDrumConfig;
  midiConnected: boolean;
  detectedVersion?: string | null;
  detectedMcuTypeId?: number | null;
  logs: MidiEventLog[];
  onClearLogs: () => void;
  onGetAllFromModule: () => void;
  onSendAllToModule: () => void;
  onSaveToSlot: (slot: number) => void;
  onLoadFromSlot: (slot: number) => void;
  onQueryConfigCount: () => void;
  onQueryConfigCurrent: () => void;
  onReadConfigName: (slot: number) => void;
  onSaveConfigName: (slot: number, name: string) => void;
  onExportMds: () => void;
  onExportSyx: () => void;
  onExportJson: () => void;
  onQueryHardware: () => void;
  onSendBootloaderEnter: (packet: Uint8Array, label: string) => boolean;
  onSendFirmwareFrameWithAck: (
    packet: Uint8Array,
    label: string,
    timeoutMs?: number
  ) => Promise<'ok' | 'crc' | 'read' | 'timeout' | 'midi_not_open'>;
  onNotice: (msg: string) => void;
  onOpenMidiLog?: () => void;
}

export const SysexMonitorView: React.FC<SysexMonitorViewProps> = ({
  config,
  midiConnected,
  detectedVersion = null,
  detectedMcuTypeId = null,
  logs,
  onClearLogs,
  onGetAllFromModule,
  onSendAllToModule,
  onSaveToSlot,
  onLoadFromSlot,
  onQueryConfigCount,
  onQueryConfigCurrent,
  onReadConfigName,
  onSaveConfigName,
  onExportMds,
  onExportSyx,
  onExportJson,
  onQueryHardware,
  onSendBootloaderEnter,
  onSendFirmwareFrameWithAck,
  onNotice,
  onOpenMidiLog,
}) => {
  const [subTab, setSubTab] = useState<'sysex' | 'firmware'>('sysex');
  const [filterType, setFilterType] = useState<'all' | 'sysex' | 'note' | 'cc' | 'error'>('all');
  const [selectedSlot, setSelectedSlot] = useState<number>(config.global.activeSlot);
  const maxSlots = useMemo(() => {
    if (config.global.maxConfigCount && config.global.maxConfigCount >= 4) {
      return config.global.maxConfigCount;
    }
    return calculateMaxEEPROMSlots(
      config.global.maxInputs,
      config.global.customPadNames,
      config.global.customConfigNames
    );
  }, [
    config.global.maxConfigCount,
    config.global.maxInputs,
    config.global.customPadNames,
    config.global.customConfigNames,
  ]);

  const [slotNameInput, setSlotNameInput] = useState<string>(
    config.global.configNames?.[selectedSlot] || ''
  );

  React.useEffect(() => {
    setSlotNameInput(config.global.configNames?.[selectedSlot] || '');
  }, [selectedSlot, config.global.configNames]);

  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [copiedLogId, setCopiedLogId] = useState<string | null>(null);

  const handleCopyHex = (id: string, rawHex: string) => {
    void navigator.clipboard?.writeText(normalizeHexBytes(rawHex));
    setCopiedLogId(id);
    window.setTimeout(() => {
      setCopiedLogId((cur) => (cur === id ? null : cur));
    }, 1400);
  };
  const displayVersion = midiConnected && detectedVersion ? detectedVersion : 'Unknown';
  const displayMcuId =
    midiConnected && detectedMcuTypeId !== null ? detectedMcuTypeId : 0;
  const mcuName =
    displayMcuId === 0
      ? 'Unknown'
      : MD_MCU_TYPES[displayMcuId] || `Unknown (${displayMcuId})`;

  const filteredLogs = useMemo(() => {
    if (filterType === 'all') return logs;
    return logs.filter((l) => l.type === filterType);
  }, [logs, filterType]);

  const syxPreview = useMemo(() => {
    const bytes = buildFullConfigSyxFile(config);
    return {
      totalBytes: bytes.length,
      previewHex: formatBytesHex(bytes.slice(0, 48)) + ' ...',
    };
  }, [config]);

  return (
    <main className="flex-1 overflow-y-auto p-5 lg:p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-lg font-display font-semibold text-slate-900 dark:text-white">
              {subTab === 'firmware'
                ? 'Firmware Upgrade & Bootloader'
                : 'SysEx Sync, EEPROM Slots & MIDI Monitor'}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {subTab === 'firmware'
                ? 'Flash encrypted MegaDrum *.bin firmware images over USB MIDI bootloader'
                : 'Bulk transfer module memory, manage EEPROM slots 1–16, and inspect live MIDI/SysEx packets & errors'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1 p-1 bg-slate-200/70 dark:bg-[#141923] rounded-md">
              <button
                type="button"
                onClick={() => setSubTab('sysex')}
                className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                  subTab === 'sysex'
                    ? 'bg-white dark:bg-[#1E2533] text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                SysEx, Slots &amp; Monitor
              </button>
              <button
                type="button"
                onClick={() => setSubTab('firmware')}
                className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                  subTab === 'firmware'
                    ? 'bg-white dark:bg-[#1E2533] text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Firmware Upgrade
              </button>
            </div>

            {subTab === 'sysex' && (
              <>
                <button
                  type="button"
                  onClick={onGetAllFromModule}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#141923] text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap"
                >
                  <ArrowDownToLine className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                  Get All from Module
                </button>
                <button
                  type="button"
                  onClick={onSendAllToModule}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded bg-blue-600 text-white hover:bg-blue-700 whitespace-nowrap"
                >
                  <ArrowUpFromLine className="w-3.5 h-3.5" />
                  Send All to Module
                </button>
              </>
            )}
          </div>
        </div>

        {/* Always-Visible Firmware & Hardware Module Info */}
        <div className="px-4 py-2.5 rounded-lg border border-[var(--md-border)] bg-[var(--md-panel)] flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5">
            <div className="inline-flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
              <HardDrive className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
              <span>Firmware:</span>
              <strong
                className={`font-mono tabular-nums ${
                  displayVersion === 'Unknown'
                    ? 'text-slate-500 dark:text-slate-400'
                    : 'text-slate-900 dark:text-white'
                }`}
              >
                {displayVersion}
              </strong>
            </div>
            <span className="text-slate-300 dark:text-slate-700" aria-hidden="true">
              ·
            </span>
            <div className="inline-flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
              <Cpu className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
              <span>Hardware (MCU):</span>
              <strong
                className={`font-mono tabular-nums ${
                  mcuName === 'Unknown'
                    ? 'text-slate-500 dark:text-slate-400'
                    : 'text-slate-900 dark:text-white'
                }`}
              >
                {mcuName}
              </strong>
            </div>
            <span className="text-slate-300 dark:text-slate-700" aria-hidden="true">
              ·
            </span>
            <span className="font-mono tabular-nums text-slate-500 dark:text-slate-400">
              Chain ID {config.chainId}
            </span>
          </div>

          <button
            type="button"
            onClick={onQueryHardware}
            title="Query connected MegaDrum Firmware Version & Hardware MCU via SysEx"
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded border border-[var(--md-border-strong)] bg-[var(--md-control)] text-slate-700 dark:text-slate-200 hover:bg-[var(--md-hover)] whitespace-nowrap"
          >
            <RefreshCw className="w-3 h-3 text-blue-600 dark:text-blue-400 shrink-0" />
            Query FW &amp; MCU
          </button>
        </div>

        {subTab === 'firmware' ? (
          <FirmwareUpgradePanel
            midiConnected={midiConnected}
            chainId={config.chainId}
            mcuTypeId={displayMcuId}
            configuredInputs={config.global.maxInputs}
            currentVersion={displayVersion}
            onQueryHardware={onQueryHardware}
            onSendBootloaderEnter={onSendBootloaderEnter}
            onSendFirmwareFrameWithAck={onSendFirmwareFrameWithAck}
            onBackupMds={onExportMds}
            onNotice={onNotice}
          />
        ) : (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* EEPROM Slots & Hardware Slot Naming */}
              <section className="border border-[var(--md-border)] rounded-lg bg-[var(--md-panel)] p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                  <div>
                    <h2 className="text-sm font-display font-semibold text-slate-900 dark:text-white">
                      Module EEPROM Config Slots (1–{maxSlots})
                    </h2>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Capacity depends on inputs ({config.global.maxInputs}) &amp; custom names ({config.global.customPadNames ? 'On' : 'Off'})
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={onQueryConfigCount}
                      className="px-2 py-1 text-[11px] font-medium rounded border border-[var(--md-border-strong)] bg-[var(--md-control)] text-slate-700 dark:text-slate-200 hover:bg-[var(--md-hover)]"
                      title="Query Config Count (SysEx 0x0E)"
                    >
                      Query Count (0x0E)
                    </button>
                    <button
                      type="button"
                      onClick={onQueryConfigCurrent}
                      className="px-2 py-1 text-[11px] font-medium rounded border border-[var(--md-border-strong)] bg-[var(--md-control)] text-slate-700 dark:text-slate-200 hover:bg-[var(--md-hover)]"
                      title="Query Active Slot (SysEx 0x10)"
                    >
                      Query Active (0x10)
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5">
                  {Array.from({ length: maxSlots }, (_, i) => i + 1).map((slot) => {
                    const isActive = config.global.activeSlot === slot;
                    const isSelected = selectedSlot === slot;
                    return (
                      <button
                        key={slot}
                        type="button"
                        onClick={() => setSelectedSlot(slot)}
                        className={`p-2 text-xs font-mono tabular-nums rounded border transition-colors relative flex flex-col items-center justify-center ${
                          isSelected
                            ? 'bg-blue-600 text-white border-blue-600 font-semibold shadow-xs'
                            : 'bg-slate-50 dark:bg-[#0B0E14] border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-blue-400'
                        }`}
                      >
                        <span className="text-[11px] font-semibold">{String(slot).padStart(2, '0')}</span>
                        {isActive && (
                          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-[#0B0E14]" title="Active Slot on MegaDrum" />
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Selected Slot Configuration & Name Editor */}
                <div className="p-3 rounded-lg bg-[var(--md-inset)] border border-[var(--md-border)] space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                      Slot {selectedSlot} {config.global.activeSlot === selectedSlot ? '(Active)' : ''}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => onReadConfigName(selectedSlot)}
                        className="px-2 py-1 text-[11px] font-medium rounded border border-[var(--md-border-strong)] bg-[var(--md-control)] text-slate-700 dark:text-slate-200 hover:bg-[var(--md-hover)]"
                      >
                        Read Name (0x0D)
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={slotNameInput}
                      onChange={(e) => setSlotNameInput(e.target.value)}
                      placeholder={`Slot ${selectedSlot} custom name (max 16 chars)`}
                      maxLength={16}
                      className="flex-1 px-2.5 py-1 text-xs rounded border border-[var(--md-border-strong)] bg-[var(--md-control)] text-slate-900 dark:text-white"
                    />
                    <button
                      type="button"
                      onClick={() => onSaveConfigName(selectedSlot, slotNameInput)}
                      className="px-3 py-1 text-xs font-medium rounded bg-blue-600 text-white hover:bg-blue-700 whitespace-nowrap"
                    >
                      Save Name
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {midiConnected
                      ? `Target: Slot ${selectedSlot} on connected MegaDrum`
                      : `Not connected · Click Load/Save to test connection check`}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onLoadFromSlot(selectedSlot)}
                      className="px-3 py-1.5 text-xs font-medium rounded border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                    >
                      Load Slot {selectedSlot}
                    </button>
                    <button
                      type="button"
                      onClick={() => onSaveToSlot(selectedSlot)}
                      className="px-3 py-1.5 text-xs font-medium rounded bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:opacity-90"
                    >
                      Save to Slot {selectedSlot}
                    </button>
                  </div>
                </div>
              </section>

              {/* File Backup & SysEx Payload Summary */}
              <section className="border border-[var(--md-border)] rounded-lg bg-[var(--md-panel)] p-5 space-y-4">
                <h2 className="text-sm font-display font-semibold text-slate-900 dark:text-white border-b border-[var(--md-border)] pb-3">
                  Kit Backup &amp; SysEx Dump ({syxPreview.totalBytes} bytes)
                </h2>
                <div className="p-3 rounded bg-[var(--md-inset)] border border-[var(--md-border)] font-mono text-[11px] text-slate-600 dark:text-slate-400 break-all">
                  {syxPreview.previewHex}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={onExportMds}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#141923] text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    <Download className="w-3.5 h-3.5" /> Export .mds (MDMFX)
                  </button>
                  <button
                    type="button"
                    onClick={onExportSyx}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#141923] text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    <Download className="w-3.5 h-3.5" /> Export .syx (Binary)
                  </button>
                  <button
                    type="button"
                    onClick={onExportJson}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#141923] text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    <Download className="w-3.5 h-3.5" /> Export .json Snapshot
                  </button>
                </div>
              </section>
            </div>

            {/* Live MIDI & SysEx Event Monitor */}
            <section className="border border-[var(--md-border)] rounded-lg bg-[var(--md-panel)] overflow-hidden">
              <div className="px-5 py-3 border-b border-[var(--md-border)] flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-4">
                  <h2 className="text-sm font-display font-semibold text-slate-900 dark:text-white">
                    MIDI &amp; SysEx Activity Log
                  </h2>
                  <div className="flex items-center gap-1 p-0.5 bg-slate-100 dark:bg-[#0E121A] rounded-md">
                    {(['all', 'sysex', 'note', 'cc', 'error'] as const).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setFilterType(t)}
                        className={`px-2.5 py-1 text-[11px] font-medium rounded uppercase transition-colors ${
                          filterType === t
                            ? 'bg-white dark:bg-[#1E2533] text-slate-900 dark:text-white shadow-xs'
                            : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {onOpenMidiLog && (
                    <button
                      type="button"
                      onClick={onOpenMidiLog}
                      className="px-2.5 py-1 text-xs font-medium rounded border border-[var(--md-border-strong)] bg-[var(--md-control)] text-slate-700 dark:text-slate-200 hover:bg-[var(--md-hover)] whitespace-nowrap"
                    >
                      Open Visual &amp; RAW Log
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setExpandedLogId(null);
                      onClearLogs();
                    }}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Clear Log
                  </button>
                </div>
              </div>

              <div className="max-h-96 overflow-y-auto">
                {filteredLogs.length === 0 ? (
                  <div className="p-10 text-center text-xs text-slate-500 dark:text-slate-400">
                    No MIDI or SysEx events recorded yet. Connect a MegaDrum module, click Test Hit, or run a Get/Send SysEx command to inspect packets and errors.
                  </div>
                ) : (
                  <table className="w-full text-left text-xs border-collapse table-fixed">
                    <thead className="bg-[var(--md-control-alt)] text-slate-500 dark:text-slate-400 border-b border-[var(--md-border)] sticky top-0 z-10">
                      <tr>
                        <th className="w-[104px] px-3 py-2 font-medium whitespace-nowrap">Time</th>
                        <th className="w-[50px] px-2.5 py-2 font-medium whitespace-nowrap">Dir</th>
                        <th className="w-[74px] px-2.5 py-2 font-medium whitespace-nowrap">Type</th>
                        <th className="w-[215px] px-3 py-2 font-medium whitespace-nowrap">Event</th>
                        <th className="px-3 py-2 font-medium whitespace-nowrap">Hex Bytes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-mono text-[11px]">
                      {filteredLogs.map((log) => {
                        const isExpanded = expandedLogId === log.id;
                        const cleanHex = normalizeHexBytes(log.rawHex);
                        const details = isExpanded ? decodeMidiLogDetails(log) : [];

                        return (
                          <React.Fragment key={log.id}>
                            <tr
                              onClick={() =>
                                setExpandedLogId((cur) => (cur === log.id ? null : log.id))
                              }
                              className={`cursor-pointer transition-colors ${
                                log.type === 'error'
                                  ? 'bg-red-50/70 dark:bg-red-950/30 hover:bg-red-100/60 dark:hover:bg-red-950/50'
                                  : isExpanded
                                  ? 'bg-blue-50/50 dark:bg-blue-950/25'
                                  : 'hover:bg-slate-50/70 dark:hover:bg-[#151B27]'
                              }`}
                            >
                              <td className="px-3 py-2 text-slate-500 tabular-nums whitespace-nowrap">
                                {log.timestamp}
                              </td>
                              <td className="px-2.5 py-2 whitespace-nowrap">
                                <span
                                  className={
                                    log.type === 'error'
                                      ? 'text-red-600 dark:text-red-400 font-semibold'
                                      : log.direction === 'out'
                                      ? 'text-blue-600 dark:text-blue-400 font-semibold'
                                      : 'text-emerald-600 dark:text-emerald-400 font-semibold'
                                  }
                                >
                                  {log.direction.toUpperCase()}
                                </span>
                              </td>
                              <td
                                className={`px-2.5 py-2 uppercase whitespace-nowrap ${
                                  log.type === 'error'
                                    ? 'text-red-600 dark:text-red-400 font-semibold'
                                    : log.type === 'sysex'
                                    ? 'text-violet-600 dark:text-violet-400'
                                    : log.type === 'cc'
                                    ? 'text-indigo-600 dark:text-indigo-400'
                                    : 'text-slate-600 dark:text-slate-300'
                                }`}
                              >
                                {log.type}
                              </td>
                              <td
                                title={log.summary}
                                className={`px-3 py-2 font-sans text-xs truncate ${
                                  log.type === 'error'
                                    ? 'text-red-700 dark:text-red-300 font-medium'
                                    : 'text-slate-900 dark:text-slate-100'
                                }`}
                              >
                                {log.summary}
                              </td>
                              <td className="px-3 py-2 text-slate-500 dark:text-slate-400 truncate">
                                {cleanHex || '--'}
                              </td>
                            </tr>

                            {isExpanded && (
                              <tr className="bg-[var(--md-inset)]">
                                <td colSpan={5} className="px-4 py-3 space-y-2.5">
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-sans text-xs text-slate-600 dark:text-slate-300">
                                      <span className="font-medium text-slate-900 dark:text-slate-100">
                                        {log.summary}
                                      </span>
                                      {details.map((line, i) => (
                                        <span key={i}>{line}</span>
                                      ))}
                                    </div>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleCopyHex(log.id, log.rawHex);
                                      }}
                                      className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-sans font-medium rounded border border-[var(--md-border-strong)] bg-[var(--md-control)] text-slate-700 dark:text-slate-200 hover:bg-[var(--md-hover)] whitespace-nowrap shrink-0"
                                    >
                                      {copiedLogId === log.id ? (
                                        <>
                                          <Check className="w-3 h-3 text-emerald-500" />
                                          Copied
                                        </>
                                      ) : (
                                        <>
                                          <Copy className="w-3 h-3" />
                                          Copy Hex
                                        </>
                                      )}
                                    </button>
                                  </div>
                                  <pre className="p-2.5 rounded border border-[var(--md-border)] bg-[var(--md-panel)] text-[11px] font-mono text-slate-700 dark:text-slate-300 whitespace-pre-wrap break-words leading-relaxed select-all">
                                    {cleanHex || '--'}
                                  </pre>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
};
