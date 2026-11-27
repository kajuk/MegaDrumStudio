import React, { useMemo, useState } from 'react';
import { ArrowDownToLine, ArrowUpFromLine, Download, Trash2 } from 'lucide-react';
import { MegaDrumConfig, MidiEventLog } from '../types/megadrum';
import { buildFullConfigSyxFile, formatBytesHex } from '../utils/sysex';
import { FirmwareUpgradePanel } from './FirmwareUpgradePanel';

interface SysexMonitorViewProps {
  config: MegaDrumConfig;
  midiConnected: boolean;
  logs: MidiEventLog[];
  onClearLogs: () => void;
  onGetAllFromModule: () => void;
  onSendAllToModule: () => void;
  onSaveToSlot: (slot: number) => void;
  onLoadFromSlot: (slot: number) => void;
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
}

export const SysexMonitorView: React.FC<SysexMonitorViewProps> = ({
  config,
  midiConnected,
  logs,
  onClearLogs,
  onGetAllFromModule,
  onSendAllToModule,
  onSaveToSlot,
  onLoadFromSlot,
  onExportMds,
  onExportSyx,
  onExportJson,
  onQueryHardware,
  onSendBootloaderEnter,
  onSendFirmwareFrameWithAck,
  onNotice,
}) => {
  const [subTab, setSubTab] = useState<'sysex' | 'firmware'>('sysex');
  const [filterType, setFilterType] = useState<'all' | 'sysex' | 'note' | 'cc' | 'error'>('all');
  const [selectedSlot, setSelectedSlot] = useState<number>(config.global.activeSlot);

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

        {subTab === 'firmware' ? (
          <FirmwareUpgradePanel
            midiConnected={midiConnected}
            chainId={config.chainId}
            mcuTypeId={config.mcuTypeId}
            configuredInputs={config.global.maxInputs}
            currentVersion={config.version}
            onQueryHardware={onQueryHardware}
            onSendBootloaderEnter={onSendBootloaderEnter}
            onSendFirmwareFrameWithAck={onSendFirmwareFrameWithAck}
            onBackupMds={onExportMds}
            onNotice={onNotice}
          />
        ) : (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* EEPROM Slots */}
              <section className="border border-[var(--md-border)] rounded-lg bg-[var(--md-panel)] p-5 space-y-4">
                <h2 className="text-sm font-display font-semibold text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-3">
                  Module EEPROM Config Slots (1–16)
                </h2>
                <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5">
                  {Array.from({ length: 16 }, (_, i) => i + 1).map((slot) => (
                    <button
                      key={slot}
                      type="button"
                      onClick={() => setSelectedSlot(slot)}
                      className={`py-2 text-xs font-mono tabular-nums rounded border transition-colors ${
                        selectedSlot === slot
                          ? 'bg-blue-600 text-white border-blue-600 font-semibold'
                          : 'bg-slate-50 dark:bg-[#0B0E14] border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-blue-400'
                      }`}
                    >
                      {String(slot).padStart(2, '0')}
                    </button>
                  ))}
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

                <button
                  type="button"
                  onClick={onClearLogs}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Clear Log
                </button>
              </div>

              <div className="max-h-96 overflow-y-auto">
                {filteredLogs.length === 0 ? (
                  <div className="p-10 text-center text-xs text-slate-500 dark:text-slate-400">
                    No MIDI or SysEx events recorded yet. Connect a MegaDrum module, click Test Hit, or run a Get/Send SysEx command to inspect packets and errors.
                  </div>
                ) : (
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[var(--md-control-alt)] text-slate-500 dark:text-slate-400 border-b border-[var(--md-border)] sticky top-0">
                      <tr>
                        <th className="px-4 py-2 font-medium">Time</th>
                        <th className="px-4 py-2 font-medium">Dir</th>
                        <th className="px-4 py-2 font-medium">Type</th>
                        <th className="px-4 py-2 font-medium">Event</th>
                        <th className="px-4 py-2 font-medium">Hex Bytes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-mono text-[11px]">
                      {filteredLogs.map((log) => (
                        <tr
                          key={log.id}
                          className={
                            log.type === 'error'
                              ? 'bg-red-50/70 dark:bg-red-950/30'
                              : 'hover:bg-slate-50/70 dark:hover:bg-[#151B27]'
                          }
                        >
                          <td className="px-4 py-2 text-slate-500 tabular-nums whitespace-nowrap">
                            {log.timestamp}
                          </td>
                          <td className="px-4 py-2 whitespace-nowrap">
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
                            className={`px-4 py-2 uppercase whitespace-nowrap ${
                              log.type === 'error'
                                ? 'text-red-600 dark:text-red-400 font-semibold'
                                : 'text-slate-600 dark:text-slate-300'
                            }`}
                          >
                            {log.type}
                          </td>
                          <td
                            className={`px-4 py-2 font-sans text-xs ${
                              log.type === 'error'
                                ? 'text-red-700 dark:text-red-300 font-medium'
                                : 'text-slate-900 dark:text-slate-100'
                            }`}
                          >
                            {log.summary}
                          </td>
                          <td className="px-4 py-2 text-slate-500 dark:text-slate-400 truncate max-w-xs">
                            {log.rawHex}
                          </td>
                        </tr>
                      ))}
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
