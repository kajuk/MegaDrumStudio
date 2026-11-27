import React, { useRef } from 'react';
import {
  AlertCircle,
  ArrowDownToLine,
  ArrowUpFromLine,
  CheckCircle2,
  Download,
  FolderOpen,
  Loader2,
  Play,
  Unplug,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { MidiConnectionPhase, MidiPortInfo } from '../hooks/useWebMidi';
import { FACTORY_PRESETS } from '../data/presets';
import { SysexStatusState } from '../types/megadrum';
import { AppThemeId } from '../utils/theme';
import { PWAInstallButton } from './PWAInstallButton';
import { ThemePicker } from './ThemePicker';

interface WorkspaceToolbarProps {
  midiSupported: boolean;
  midiConnected: boolean;
  connectionPhase: MidiConnectionPhase;
  connectionMessage: string;
  sysexStatus: SysexStatusState;
  onDismissSysexStatus: () => void;
  inputs: MidiPortInfo[];
  outputs: MidiPortInfo[];
  selectedInputId: string;
  selectedOutputId: string;
  onSelectInput: (id: string) => void;
  onSelectOutput: (id: string) => void;
  onConnectMidi: () => void;
  onDisconnectMidi: () => void;
  onGetAll: () => void;
  onSendAll: () => void;
  unsyncedCount: number;
  selectedPresetId: string;
  onSelectPreset: (presetId: string) => void;
  onImportFile: (file: File) => void;
  onExportMds: () => void;
  onExportSyx: () => void;
  onTestHit: () => void;
  audioEnabled: boolean;
  onToggleAudio: () => void;
  theme: AppThemeId;
  effectiveTheme: Exclude<AppThemeId, 'system'>;
  onSelectTheme: (theme: AppThemeId) => void;
}

export const WorkspaceToolbar: React.FC<WorkspaceToolbarProps> = ({
  midiSupported,
  midiConnected,
  connectionPhase,
  connectionMessage,
  sysexStatus,
  onDismissSysexStatus,
  inputs,
  outputs,
  selectedInputId,
  selectedOutputId,
  onSelectInput,
  onSelectOutput,
  onConnectMidi,
  onDisconnectMidi,
  onGetAll,
  onSendAll,
  unsyncedCount,
  selectedPresetId,
  onSelectPreset,
  onImportFile,
  onExportMds,
  onExportSyx,
  onTestHit,
  audioEnabled,
  onToggleAudio,
  theme,
  effectiveTheme,
  onSelectTheme,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isBusy = sysexStatus.code === 'working';
  const hasAlert =
    sysexStatus.code === 'timeout' ||
    sysexStatus.code === 'midi_not_open' ||
    sysexStatus.code === 'error' ||
    sysexStatus.code === 'mismatch' ||
    connectionPhase === 'error' ||
    connectionPhase === 'sysex_blocked' ||
    connectionPhase === 'no_ports';

  const alertText =
    sysexStatus.code === 'timeout' ||
    sysexStatus.code === 'midi_not_open' ||
    sysexStatus.code === 'error' ||
    sysexStatus.code === 'mismatch'
      ? sysexStatus.message
      : connectionMessage;

  return (
    <div className="border-b border-[var(--md-border)] bg-[var(--md-toolbar)] shrink-0">
      <div className="px-6 py-2.5 flex flex-wrap items-center justify-between gap-3">
        {/* Left: MIDI Ports, Connection Indicator & Bulk Get All / Send All */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Connection Status & Ports */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {midiConnected ? (
              <>
                <span
                  className={`inline-flex items-center gap-1.5 font-medium whitespace-nowrap ${
                    connectionPhase === 'connected'
                      ? 'text-emerald-700 dark:text-emerald-400'
                      : 'text-amber-700 dark:text-amber-400'
                  }`}
                  title={connectionMessage}
                >
                  <span
                    className={`w-2 h-2 rounded-full shrink-0 ${
                      connectionPhase === 'connected' ? 'bg-emerald-500' : 'bg-amber-500'
                    }`}
                    aria-hidden="true"
                  />
                  {connectionPhase === 'connected'
                    ? 'MIDI Connected'
                    : connectionPhase === 'no_ports'
                    ? '0 MIDI Ports'
                    : connectionPhase === 'sysex_blocked'
                    ? 'SysEx Blocked'
                    : 'Select Ports'}
                </span>

                <select
                  aria-label="MIDI Input Port"
                  value={selectedInputId}
                  onChange={(e) => onSelectInput(e.target.value)}
                  className="bg-white dark:bg-[#171D29] border border-slate-200 dark:border-slate-700 rounded px-2 py-1 text-xs text-slate-900 dark:text-slate-100 max-w-[155px] truncate"
                >
                  {inputs.length === 0 ? (
                    <option value="">No MIDI In</option>
                  ) : (
                    inputs.map((i) => (
                      <option key={i.id} value={i.id}>
                        In: {i.name}
                      </option>
                    ))
                  )}
                </select>
                <select
                  aria-label="MIDI Output Port"
                  value={selectedOutputId}
                  onChange={(e) => onSelectOutput(e.target.value)}
                  className="bg-white dark:bg-[#171D29] border border-slate-200 dark:border-slate-700 rounded px-2 py-1 text-xs text-slate-900 dark:text-slate-100 max-w-[155px] truncate"
                >
                  {outputs.length === 0 ? (
                    <option value="">No MIDI Out</option>
                  ) : (
                    outputs.map((o) => (
                      <option key={o.id} value={o.id}>
                        Out: {o.name}
                      </option>
                    ))
                  )}
                </select>
                <button
                  type="button"
                  onClick={onDisconnectMidi}
                  title="Disconnect MIDI"
                  className="p-1.5 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white rounded hover:bg-slate-200/70 dark:hover:bg-slate-800 transition-colors"
                >
                  <Unplug className="w-3.5 h-3.5" />
                </button>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1.5 font-medium whitespace-nowrap ${
                    connectionPhase === 'error'
                      ? 'text-red-600 dark:text-red-400'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full shrink-0 ${
                      connectionPhase === 'error' ? 'bg-red-500' : 'bg-slate-400'
                    }`}
                    aria-hidden="true"
                  />
                  {midiSupported
                    ? connectionPhase === 'error'
                      ? 'MIDI Error'
                      : 'MIDI Disconnected'
                    : 'Web MIDI Unsupported'}
                </span>
                <button
                  type="button"
                  onClick={onConnectMidi}
                  className="px-2.5 py-1 text-xs font-medium rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#171D29] text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap"
                >
                  Connect
                </button>
              </div>
            )}
          </div>

          <span className="hidden sm:inline text-slate-300 dark:text-slate-700" aria-hidden="true">
            |
          </span>

          {/* Top-Level Get All & Send All from/to MegaDrum */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={isBusy}
              onClick={onGetAll}
              title="Read complete configuration from MegaDrum module via SysEx"
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#171D29] text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 whitespace-nowrap transition-colors"
            >
              <ArrowDownToLine className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              Get All
            </button>
            <button
              type="button"
              disabled={isBusy}
              onClick={onSendAll}
              title="Write complete configuration to MegaDrum module via SysEx"
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded text-white disabled:opacity-50 whitespace-nowrap transition-colors ${
                unsyncedCount > 0
                  ? 'bg-amber-600 hover:bg-amber-700'
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              <ArrowUpFromLine className="w-3.5 h-3.5" />
              {unsyncedCount > 0 ? `Send All (${unsyncedCount})` : 'Send All'}
            </button>

            {/* Compact Live SysEx Status Readout */}
            {sysexStatus.code !== 'idle' && (
              <span
                className={`inline-flex items-center gap-1.5 px-2 py-1 text-[11px] font-mono tabular-nums rounded border whitespace-nowrap ${
                  sysexStatus.code === 'working'
                    ? 'border-blue-300 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300'
                    : sysexStatus.code === 'ok'
                    ? 'border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300'
                    : 'border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-300'
                }`}
              >
                {sysexStatus.code === 'working' && (
                  <Loader2 className="w-3 h-3 animate-spin shrink-0" />
                )}
                {sysexStatus.code === 'ok' && (
                  <CheckCircle2 className="w-3 h-3 shrink-0" />
                )}
                {(sysexStatus.code === 'timeout' ||
                  sysexStatus.code === 'midi_not_open' ||
                  sysexStatus.code === 'error' ||
                  sysexStatus.code === 'mismatch') && (
                  <AlertCircle className="w-3 h-3 shrink-0" />
                )}
                <span>
                  {sysexStatus.code === 'working' && sysexStatus.total
                    ? `SysEx ${sysexStatus.completed ?? 0}/${sysexStatus.total}`
                    : sysexStatus.code === 'ok'
                    ? 'SysEx OK'
                    : sysexStatus.code === 'timeout'
                    ? 'SysEx Timeout'
                    : sysexStatus.code === 'midi_not_open'
                    ? 'MIDI Not Open'
                    : 'SysEx Error'}
                </span>
              </span>
            )}
          </div>

          <span className="hidden xl:inline text-slate-300 dark:text-slate-700" aria-hidden="true">
            |
          </span>

          {/* Preset Selector */}
          <div className="flex items-center gap-2">
            <label
              htmlFor="preset-select"
              className="text-xs font-medium text-slate-500 dark:text-slate-400 whitespace-nowrap"
            >
              Preset
            </label>
            <select
              id="preset-select"
              value={selectedPresetId}
              onChange={(e) => onSelectPreset(e.target.value)}
              className="bg-white dark:bg-[#171D29] border border-slate-200 dark:border-slate-700 rounded px-2 py-1 text-xs font-medium text-slate-900 dark:text-slate-100 max-w-[205px]"
            >
              {FACTORY_PRESETS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
              {selectedPresetId === 'custom' && (
                <option value="custom">Modified / Hardware Sync</option>
              )}
            </select>
          </div>
        </div>

        {/* Right: File Import/Export, Test Hit, PWA Install, Audio, Theme */}
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".mds,.syx,.json,.txt"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                onImportFile(file);
                e.target.value = '';
              }
            }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-[#171D29] border border-slate-200 dark:border-slate-700 rounded hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
          >
            <FolderOpen className="w-3.5 h-3.5" />
            Import .mds/.syx
          </button>

          <button
            type="button"
            onClick={onExportMds}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-[#171D29] border border-slate-200 dark:border-slate-700 rounded hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            .mds
          </button>

          <button
            type="button"
            onClick={onExportSyx}
            className="hidden xl:inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-[#171D29] border border-slate-200 dark:border-slate-700 rounded hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            .syx
          </button>

          <button
            type="button"
            onClick={onTestHit}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800/80 rounded hover:bg-blue-100 dark:hover:bg-blue-900/60 transition-colors whitespace-nowrap shrink-0"
          >
            <Play className="w-3 h-3 fill-current" />
            Test Hit
          </button>

          <PWAInstallButton />

          <button
            type="button"
            onClick={onToggleAudio}
            title={audioEnabled ? 'Mute drum preview audio' : 'Enable drum preview audio'}
            className="p-1.5 text-slate-600 dark:text-slate-300 bg-[var(--md-control)] border border-[var(--md-border-strong)] rounded hover:bg-[var(--md-hover)] transition-colors"
          >
            {audioEnabled ? (
              <Volume2 className="w-4 h-4" />
            ) : (
              <VolumeX className="w-4 h-4 text-slate-400" />
            )}
          </button>

          <ThemePicker
            theme={theme}
            effectiveTheme={effectiveTheme}
            onSelectTheme={onSelectTheme}
          />
        </div>
      </div>

      {/* Prominent Communication / Connection Error Strip */}
      {hasAlert && (
        <div
          role="alert"
          className="px-6 py-2 bg-red-50 dark:bg-red-950/60 border-t border-red-200 dark:border-red-900/80 flex items-center justify-between gap-3 text-xs text-red-800 dark:text-red-200"
        >
          <div className="flex items-center gap-2 min-w-0">
            <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />
            <span className="font-medium truncate">{alertText}</span>
          </div>
          <button
            type="button"
            onClick={onDismissSysexStatus}
            title="Dismiss alert"
            className="p-1 text-red-600 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/50 rounded shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
};
