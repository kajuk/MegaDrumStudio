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
  Volume2,
  VolumeX,
} from 'lucide-react';
import {
  MidiConnectionPhase,
  MidiPermissionState,
  MidiPortInfo,
} from '../hooks/useWebMidi';
import { FACTORY_PRESETS } from '../data/presets';
import { SysexStatusState } from '../types/megadrum';
import { AppThemeId } from '../utils/theme';
import { PWAInstallButton } from './PWAInstallButton';
import { ThemePicker } from './ThemePicker';

interface WorkspaceToolbarProps {
  midiSupported: boolean;
  midiConnected: boolean;
  hasMidiAccess: boolean;
  midiPermissionGranted: boolean;
  permissionState: MidiPermissionState;
  connectionPhase: MidiConnectionPhase;
  connectionMessage: string;
  hasAlert: boolean;
  onOpenAlertModal: () => void;
  sysexStatus: SysexStatusState;
  inputs: MidiPortInfo[];
  outputs: MidiPortInfo[];
  selectedInputId: string;
  selectedOutputId: string;
  onSelectInput: (id: string) => void;
  onSelectOutput: (id: string) => void;
  onScanPorts: () => void;
  onConnectMidi: () => void;
  onDisconnectMidi: () => void;
  onGetAll: () => void;
  onSendAll: () => void;
  liveUpdates: boolean;
  onToggleLiveUpdates: () => void;
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
  hasMidiAccess,
  midiPermissionGranted,
  permissionState,
  connectionPhase,
  connectionMessage,
  hasAlert,
  onOpenAlertModal,
  sysexStatus,
  inputs,
  outputs,
  selectedInputId,
  selectedOutputId,
  onSelectInput,
  onSelectOutput,
  onScanPorts,
  onConnectMidi,
  onDisconnectMidi,
  onGetAll,
  onSendAll,
  liveUpdates,
  onToggleLiveUpdates,
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
  const canUseMidiControls = midiSupported && (midiPermissionGranted || midiConnected);

  return (
    <div className="border-b border-[var(--md-border)] bg-[var(--md-toolbar)] shrink-0">
      <div className="px-6 py-2.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        {/* Left: MIDI Ports, Connection Indicator & Bulk Get All / Send All */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Connection Status & Fixed-Slot Ports */}
          <div className="flex items-center gap-1.5 text-xs shrink-0">
            {hasAlert ? (
              <button
                type="button"
                onClick={onOpenAlertModal}
                title={`${connectionMessage} — Click to view details`}
                className={`w-[120px] inline-flex items-center gap-1.5 font-medium whitespace-nowrap shrink-0 text-left hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded ${
                  midiConnected
                    ? 'text-amber-700 dark:text-amber-400'
                    : !midiPermissionGranted || connectionPhase === 'error'
                    ? 'text-red-600 dark:text-red-400'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full shrink-0 ${
                    midiConnected
                      ? 'bg-amber-500'
                      : !midiPermissionGranted || connectionPhase === 'error'
                      ? 'bg-red-500'
                      : 'bg-slate-400'
                  }`}
                  aria-hidden="true"
                />
                <span className="truncate">
                  {midiConnected
                    ? connectionPhase === 'no_ports'
                      ? '0 MIDI Ports'
                      : connectionPhase === 'sysex_blocked'
                      ? 'SysEx Blocked'
                      : 'Select Ports'
                    : !midiSupported
                    ? 'Web MIDI Unsupp.'
                    : permissionState === 'checking'
                    ? 'Checking MIDI...'
                    : !midiPermissionGranted
                    ? 'MIDI Perm. Req.'
                    : connectionPhase === 'error'
                    ? 'MIDI Error'
                    : 'MIDI Alert'}
                </span>
              </button>
            ) : (
              <span
                className={`w-[120px] inline-flex items-center gap-1.5 font-medium whitespace-nowrap shrink-0 ${
                  midiConnected
                    ? connectionPhase === 'connected'
                      ? 'text-emerald-700 dark:text-emerald-400'
                      : 'text-amber-700 dark:text-amber-400'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
                title={connectionMessage}
              >
                <span
                  className={`w-2 h-2 rounded-full shrink-0 ${
                    midiConnected
                      ? connectionPhase === 'connected'
                        ? 'bg-emerald-500'
                        : 'bg-amber-500'
                      : 'bg-slate-400'
                  }`}
                  aria-hidden="true"
                />
                <span className="truncate">
                  {midiConnected
                    ? connectionPhase === 'connected'
                      ? 'MIDI Connected'
                      : 'Select Ports'
                    : permissionState === 'checking'
                    ? 'Checking MIDI...'
                    : 'MIDI Disconnected'}
                </span>
              </span>
            )}

            <select
              aria-label="MIDI Input Port"
              disabled={!canUseMidiControls}
              value={selectedInputId}
              title={
                !canUseMidiControls
                  ? 'Grant WebMIDI permission first before selecting ports'
                  : hasMidiAccess
                  ? 'Select MIDI Input port'
                  : 'Click to scan available MIDI Input ports before connecting'
              }
              onMouseDown={(e) => {
                if (canUseMidiControls && !hasMidiAccess && inputs.length === 0) {
                  e.preventDefault();
                  void onScanPorts();
                }
              }}
              onChange={(e) => {
                if (e.target.value === '__scan__') {
                  void onScanPorts();
                } else {
                  onSelectInput(e.target.value);
                }
              }}
              className="w-[114px] bg-[var(--md-control)] border border-[var(--md-border-strong)] rounded px-2 py-1 text-xs text-slate-900 dark:text-slate-100 truncate disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
            >
              {!hasMidiAccess && inputs.length === 0 ? (
                <>
                  <option value="">In: Select...</option>
                  <option value="__scan__">Scan MIDI ports...</option>
                </>
              ) : inputs.length === 0 ? (
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
              disabled={!canUseMidiControls}
              value={selectedOutputId}
              title={
                !canUseMidiControls
                  ? 'Grant WebMIDI permission first before selecting ports'
                  : hasMidiAccess
                  ? 'Select MIDI Output port'
                  : 'Click to scan available MIDI Output ports before connecting'
              }
              onMouseDown={(e) => {
                if (canUseMidiControls && !hasMidiAccess && outputs.length === 0) {
                  e.preventDefault();
                  void onScanPorts();
                }
              }}
              onChange={(e) => {
                if (e.target.value === '__scan__') {
                  void onScanPorts();
                } else {
                  onSelectOutput(e.target.value);
                }
              }}
              className="w-[114px] bg-[var(--md-control)] border border-[var(--md-border-strong)] rounded px-2 py-1 text-xs text-slate-900 dark:text-slate-100 truncate disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
            >
              {!hasMidiAccess && outputs.length === 0 ? (
                <>
                  <option value="">Out: Select...</option>
                  <option value="__scan__">Scan MIDI ports...</option>
                </>
              ) : outputs.length === 0 ? (
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
              disabled={!canUseMidiControls}
              onClick={midiConnected ? onDisconnectMidi : onConnectMidi}
              title={
                !canUseMidiControls
                  ? 'Grant WebMIDI permission first before connecting'
                  : midiConnected
                  ? 'Disconnect MIDI ports'
                  : 'Connect Web MIDI ports'
              }
              className="w-[86px] inline-flex items-center justify-center px-2.5 py-1 text-xs font-medium rounded border border-[var(--md-border-strong)] bg-[var(--md-control)] text-slate-800 dark:text-slate-100 hover:bg-[var(--md-hover)] disabled:opacity-45 disabled:cursor-not-allowed whitespace-nowrap shrink-0 transition-colors"
            >
              {midiConnected ? 'Disconnect' : 'Connect'}
            </button>
          </div>

          <span className="hidden sm:inline text-slate-300 dark:text-slate-700" aria-hidden="true">
            |
          </span>

          {/* Top-Level Get All, Send All, Live Updates & Fixed-Width SysEx Readout */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              disabled={isBusy}
              onClick={onGetAll}
              title="Read complete configuration from MegaDrum module via SysEx"
              className="w-[78px] inline-flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs font-semibold rounded border border-[var(--md-border-strong)] bg-[var(--md-control)] text-slate-800 dark:text-slate-100 hover:bg-[var(--md-hover)] disabled:opacity-50 whitespace-nowrap shrink-0 transition-colors"
            >
              <ArrowDownToLine className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
              Get All
            </button>
            <button
              type="button"
              disabled={isBusy}
              onClick={onSendAll}
              title="Write complete configuration to MegaDrum module via SysEx"
              className={`w-[104px] inline-flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs font-semibold rounded text-white disabled:opacity-50 whitespace-nowrap shrink-0 tabular-nums transition-colors ${
                unsyncedCount > 0
                  ? 'bg-amber-600 hover:bg-amber-700'
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              <ArrowUpFromLine className="w-3.5 h-3.5 shrink-0" />
              {unsyncedCount > 0 ? `Send (${unsyncedCount})` : 'Send All'}
            </button>

            <label
              title={
                liveUpdates
                  ? connectionPhase === 'connected'
                    ? 'Live Updates ON: parameter edits are automatically sent and verified via SysEx'
                    : 'Live Updates armed: connect MegaDrum MIDI ports to auto-send parameter edits'
                  : 'Live Updates: automatically send each parameter edit to MegaDrum over SysEx'
              }
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded border cursor-pointer select-none whitespace-nowrap shrink-0 transition-colors focus-within:ring-2 focus-within:ring-blue-500/40 ${
                liveUpdates
                  ? connectionPhase === 'connected'
                    ? 'border-emerald-500/60 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-200'
                    : 'border-amber-400/70 dark:border-amber-700/80 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-200'
                  : 'border-[var(--md-border-strong)] bg-[var(--md-control)] text-slate-700 dark:text-slate-200 hover:bg-[var(--md-hover)]'
              }`}
            >
              <input
                type="checkbox"
                checked={liveUpdates}
                onChange={onToggleLiveUpdates}
                aria-label="Live Updates"
                className="w-3.5 h-3.5 rounded border-slate-300 dark:border-slate-600 accent-emerald-600 cursor-pointer shrink-0"
              />
              <span>Live Updates</span>
            </label>

            {/* Fixed-width Live SysEx Status Readout */}
            {hasAlert ? (
              <button
                type="button"
                onClick={onOpenAlertModal}
                title={`${sysexStatus.message} — Click to open details`}
                className={`w-[92px] inline-flex items-center justify-center gap-1 px-2 py-1 text-[11px] font-mono tabular-nums rounded border whitespace-nowrap shrink-0 cursor-pointer hover:brightness-95 dark:hover:brightness-110 transition-colors ${
                  sysexStatus.code === 'working'
                    ? 'border-blue-300 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300'
                    : sysexStatus.code === 'ok'
                    ? 'border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300'
                    : sysexStatus.code === 'idle'
                    ? 'border-red-300/70 dark:border-red-800/70 bg-red-50/70 dark:bg-red-950/40 text-red-700 dark:text-red-300'
                    : 'border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-300'
                }`}
              >
                {sysexStatus.code === 'working' && (
                  <Loader2 className="w-3 h-3 animate-spin shrink-0" />
                )}
                {sysexStatus.code === 'ok' && (
                  <CheckCircle2 className="w-3 h-3 shrink-0" />
                )}
                {sysexStatus.code !== 'working' && sysexStatus.code !== 'ok' && (
                  <AlertCircle className="w-3 h-3 shrink-0" />
                )}
                <span className="truncate">
                  {sysexStatus.code === 'working' && sysexStatus.total
                    ? `${sysexStatus.completed ?? 0}/${sysexStatus.total}`
                    : sysexStatus.code === 'ok'
                    ? 'SysEx OK'
                    : sysexStatus.code === 'idle'
                    ? 'MIDI Info'
                    : sysexStatus.code === 'timeout'
                    ? 'Timeout'
                    : sysexStatus.code === 'midi_not_open'
                    ? 'No MIDI'
                    : 'SysEx Err'}
                </span>
              </button>
            ) : (
              <span
                title={sysexStatus.message}
                className={`w-[92px] inline-flex items-center justify-center gap-1 px-2 py-1 text-[11px] font-mono tabular-nums rounded border whitespace-nowrap shrink-0 ${
                  sysexStatus.code === 'working'
                    ? 'border-blue-300 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300'
                    : sysexStatus.code === 'ok'
                    ? 'border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300'
                    : 'border-[var(--md-border)] bg-[var(--md-inset)] text-slate-500 dark:text-slate-400'
                }`}
              >
                {sysexStatus.code === 'working' && (
                  <Loader2 className="w-3 h-3 animate-spin shrink-0" />
                )}
                {sysexStatus.code === 'ok' && (
                  <CheckCircle2 className="w-3 h-3 shrink-0" />
                )}
                <span className="truncate">
                  {sysexStatus.code === 'working' && sysexStatus.total
                    ? `${sysexStatus.completed ?? 0}/${sysexStatus.total}`
                    : sysexStatus.code === 'ok'
                    ? 'SysEx OK'
                    : 'SysEx Idle'}
                </span>
              </span>
            )}
          </div>

          <span className="hidden xl:inline text-slate-300 dark:text-slate-700" aria-hidden="true">
            |
          </span>

          {/* Preset Selector */}
          <div className="flex items-center gap-1.5 shrink-0">
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
              className="w-[156px] bg-[var(--md-control)] border border-[var(--md-border-strong)] rounded px-2 py-1 text-xs font-medium text-slate-900 dark:text-slate-100 truncate"
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
    </div>
  );
};
