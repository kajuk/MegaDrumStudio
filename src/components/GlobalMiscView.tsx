import React from 'react';
import { ArrowDownToLine, ArrowUpFromLine, Check, Cpu, Monitor, Moon, Sun } from 'lucide-react';
import { GlobalConfig, MD_MCU_TYPES, MiscConfig, ModuleSyncSnapshot } from '../types/megadrum';
import { getFieldSync, getGlobalSyncSummary, getMiscSyncSummary } from '../utils/syncStatus';
import { AppThemeId, THEME_OPTIONS } from '../utils/theme';
import { SliderParam } from './KitPadsView';
import { ParamLabelRow, SectionSyncBanner, syncInputClass, syncLabelClass } from './SyncIndicator';
import { CustomPadNamesManager } from './CustomPadNamesManager';

interface GlobalMiscViewProps {
  globalConfig: GlobalConfig;
  miscConfig: MiscConfig;
  syncSnapshot: ModuleSyncSnapshot;
  customNames: string[];
  snapCustomNames?: (string | null)[];
  midiConnected: boolean;
  chainId: number;
  version: string;
  mcuTypeId: number;
  theme: AppThemeId;
  effectiveTheme: Exclude<AppThemeId, 'system'>;
  onSelectTheme: (theme: AppThemeId) => void;
  onUpdateGlobal: (patch: Partial<GlobalConfig>) => void;
  onUpdateMisc: (patch: Partial<MiscConfig>) => void;
  onUpdateChainId: (chainId: number) => void;
  onUpdateCustomName: (index0Based: number, name: string) => void;
  onGetCustomName: (index0Based: number) => void;
  onSendCustomName: (index0Based: number, name: string) => void;
  onGetAllCustomNames: () => void;
  onSendAllCustomNames: () => void;
  onRevertGlobalToModule: () => void;
  onRevertMiscToModule: () => void;
  onGetGlobal: () => void;
  onSendGlobal: () => void;
  onGetMisc: () => void;
  onSendMisc: () => void;
  onQueryHardware: () => void;
}

export const GlobalMiscView: React.FC<GlobalMiscViewProps> = ({
  globalConfig,
  miscConfig,
  syncSnapshot,
  customNames,
  snapCustomNames,
  midiConnected,
  chainId,
  version,
  mcuTypeId,
  theme,
  effectiveTheme,
  onSelectTheme,
  onUpdateGlobal,
  onUpdateMisc,
  onUpdateChainId,
  onUpdateCustomName,
  onGetCustomName,
  onSendCustomName,
  onGetAllCustomNames,
  onSendAllCustomNames,
  onRevertGlobalToModule,
  onRevertMiscToModule,
  onGetGlobal,
  onSendGlobal,
  onGetMisc,
  onSendMisc,
  onQueryHardware,
}) => {
  const mcuName = MD_MCU_TYPES[mcuTypeId] || `Unknown (${mcuTypeId})`;
  const snapGlobal = syncSnapshot.global;
  const snapMisc = syncSnapshot.misc;
  const globalSummary = getGlobalSyncSummary(globalConfig, snapGlobal);
  const miscSummary = getMiscSyncSummary(miscConfig, snapMisc);

  const fMaxInputs = getFieldSync(globalConfig, snapGlobal, 'maxInputs');
  const fLcdContrast = getFieldSync(globalConfig, snapGlobal, 'lcdContrast');

  const fLatency = getFieldSync(miscConfig, snapMisc, 'latency');
  const fNoteOff = getFieldSync(miscConfig, snapMisc, 'noteOff');
  const fPressroll = getFieldSync(miscConfig, snapMisc, 'pressroll');
  const fOctave = getFieldSync(miscConfig, snapMisc, 'octaveShift');
  const fNoise = getFieldSync(miscConfig, snapMisc, 'noiseFilter');

  return (
    <main className="flex-1 overflow-y-auto p-5 lg:p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-lg font-display font-semibold text-slate-900 dark:text-white">
              Global Hardware &amp; Trigger Engine
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Configure input count, Chain ID, EEPROM naming, scan latency, and false trigger suppression
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="px-3 py-1.5 rounded border border-[var(--md-border)] bg-[var(--md-panel)] text-xs font-mono tabular-nums text-slate-700 dark:text-slate-300">
              FW: <strong className="text-slate-900 dark:text-white">{version}</strong> · MCU:{' '}
              <strong className="text-slate-900 dark:text-white">{mcuName}</strong>
            </div>
            <button
              type="button"
              onClick={onQueryHardware}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded border border-[var(--md-border-strong)] bg-[var(--md-control)] text-slate-700 dark:text-slate-200 hover:bg-[var(--md-hover)] transition-colors"
            >
              <Cpu className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              Query Version &amp; MCU
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Global Misc (0x09) */}
          <section className="border border-[var(--md-border)] rounded-lg bg-[var(--md-panel)] p-5 space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="space-y-1">
                <h2 className="text-sm font-display font-semibold text-slate-900 dark:text-white">
                  Global Module Settings (SysEx 0x09)
                </h2>
                <SectionSyncBanner
                  state={globalSummary.state}
                  diffCount={globalSummary.diffCount}
                  unknownLabel="Not fetched · Click Get Global"
                  onRevert={snapGlobal ? onRevertGlobalToModule : undefined}
                />
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={onGetGlobal}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#171D29] text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <ArrowDownToLine className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                  Get Global
                </button>
                <button
                  type="button"
                  onClick={onSendGlobal}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded text-white ${
                    globalSummary.state === 'modified'
                      ? 'bg-amber-600 hover:bg-amber-700'
                      : 'bg-blue-600 hover:bg-blue-700'
                  }`}
                >
                  <ArrowUpFromLine className="w-3 h-3" />
                  {globalSummary.state === 'modified'
                    ? `Send Global (${globalSummary.diffCount})`
                    : 'Send Global'}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <ParamLabelRow
                  label="Active Module Inputs"
                  sync={fMaxInputs}
                  onRevert={
                    snapGlobal
                      ? () => onUpdateGlobal({ maxInputs: snapGlobal.maxInputs })
                      : undefined
                  }
                />
                <select
                  value={globalConfig.maxInputs}
                  onChange={(e) => onUpdateGlobal({ maxInputs: Number(e.target.value) })}
                  className={`w-full px-2.5 py-1.5 text-xs bg-white dark:bg-[#0E121A] border rounded ${syncInputClass(
                    fMaxInputs.state
                  )}`}
                >
                  {Array.from({ length: 20 }, (_, idx) => 18 + idx * 2).map((n) => (
                    <option key={n} value={n}>
                      {n} Inputs ({Math.floor(n / 2)} Kick/Pairs)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  MegaDrum Chain ID (0–3)
                </label>
                <select
                  value={chainId}
                  onChange={(e) => onUpdateChainId(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 text-xs font-mono tabular-nums bg-white dark:bg-[#0E121A] border border-slate-200 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100"
                >
                  {[0, 1, 2, 3].map((id) => (
                    <option key={id} value={id}>
                      Chain ID {id}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Config Name (Local Label)
                </label>
                <input
                  type="text"
                  maxLength={12}
                  value={globalConfig.configName}
                  onChange={(e) => onUpdateGlobal({ configName: e.target.value })}
                  className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-[#0E121A] border border-slate-200 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Active Hardware Slot (1–16)
                </label>
                <input
                  type="number"
                  min={1}
                  max={16}
                  value={globalConfig.activeSlot}
                  onChange={(e) =>
                    onUpdateGlobal({
                      activeSlot: Math.max(1, Math.min(16, Number(e.target.value) || 1)),
                    })
                  }
                  className="w-full px-2.5 py-1.5 text-xs font-mono tabular-nums bg-white dark:bg-[#0E121A] border border-slate-200 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <SliderParam
                label="LCD Contrast"
                value={globalConfig.lcdContrast}
                min={1}
                max={100}
                unit="%"
                sync={fLcdContrast}
                onRevert={
                  snapGlobal
                    ? () => onUpdateGlobal({ lcdContrast: snapGlobal.lcdContrast })
                    : undefined
                }
                onChange={(v) => onUpdateGlobal({ lcdContrast: v })}
              />
              <SliderParam
                label="Default MIDI Channel"
                value={globalConfig.globalMidiChannel}
                min={1}
                max={16}
                onChange={(v) => onUpdateGlobal({ globalMidiChannel: v })}
              />
            </div>

            <div className="space-y-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
              {[
                { key: 'customPadNames', label: 'Enable Custom Pad Names in Module EEPROM' },
                { key: 'customConfigNames', label: 'Enable Custom Config Slot Names' },
                { key: 'midi2ForSysex', label: 'Route SysEx Traffic via Dedicated MIDI2 Port' },
              ].map((item) => {
                const fSync = getFieldSync(
                  globalConfig,
                  snapGlobal,
                  item.key as keyof GlobalConfig
                );
                return (
                  <label
                    key={item.key}
                    className="flex items-center justify-between text-xs cursor-pointer gap-2"
                  >
                    <span className={syncLabelClass(fSync.state)}>{item.label}</span>
                    <div className="flex items-center gap-2 shrink-0">
                      {fSync.state === 'modified' && (
                        <span className="text-[11px] font-mono text-amber-700 dark:text-amber-400">
                          MD:{fSync.moduleValue ? 'On' : 'Off'}
                        </span>
                      )}
                      <input
                        type="checkbox"
                        checked={Boolean(globalConfig[item.key as keyof GlobalConfig])}
                        onChange={(e) =>
                          onUpdateGlobal({
                            [item.key]: e.target.checked,
                          } as Partial<GlobalConfig>)
                        }
                        className="rounded border-slate-300 dark:border-slate-600 text-blue-600"
                      />
                    </div>
                  </label>
                );
              })}
            </div>
          </section>

          {/* Misc / Trigger Engine (0x01) */}
          <section className="border border-[var(--md-border)] rounded-lg bg-[var(--md-panel)] p-5 space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="space-y-1">
                <h2 className="text-sm font-display font-semibold text-slate-900 dark:text-white">
                  Trigger Engine &amp; Latency (SysEx 0x01)
                </h2>
                <SectionSyncBanner
                  state={miscSummary.state}
                  diffCount={miscSummary.diffCount}
                  unknownLabel="Not fetched · Click Get Misc"
                  onRevert={snapMisc ? onRevertMiscToModule : undefined}
                />
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={onGetMisc}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#171D29] text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <ArrowDownToLine className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                  Get Misc
                </button>
                <button
                  type="button"
                  onClick={onSendMisc}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded text-white ${
                    miscSummary.state === 'modified'
                      ? 'bg-amber-600 hover:bg-amber-700'
                      : 'bg-blue-600 hover:bg-blue-700'
                  }`}
                >
                  <ArrowUpFromLine className="w-3 h-3" />
                  {miscSummary.state === 'modified'
                    ? `Send Misc (${miscSummary.diffCount})`
                    : 'Send Misc'}
                </button>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className={`text-xs font-medium ${syncLabelClass(fLatency.state)}`}>
                    Scan Latency
                  </span>
                  <div className="flex items-center gap-2">
                    {fLatency.state === 'modified' && fLatency.moduleValue !== undefined && (
                      <button
                        type="button"
                        onClick={() => onUpdateMisc({ latency: fLatency.moduleValue! })}
                        className="text-[11px] font-mono tabular-nums text-amber-700 dark:text-amber-400 hover:underline"
                      >
                        MD:{(fLatency.moduleValue / 10).toFixed(1)}ms
                      </button>
                    )}
                    <span className="text-xs font-mono tabular-nums text-slate-900 dark:text-slate-100">
                      {(miscConfig.latency / 10).toFixed(1)} ms
                    </span>
                  </div>
                </div>
                <input
                  type="range"
                  min={10}
                  max={100}
                  step={5}
                  value={miscConfig.latency}
                  onChange={(e) => onUpdateMisc({ latency: Number(e.target.value) })}
                  className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-lg cursor-pointer"
                />
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Hardware value 10–100 (1.0–10.0 ms). Lower values tighten response; 2.0–3.0 ms gives balanced dynamic resolution.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <SliderParam
                  label="Note Off Delay"
                  value={miscConfig.noteOff}
                  min={2}
                  max={200}
                  unit="ms"
                  sync={fNoteOff}
                  onRevert={
                    snapMisc ? () => onUpdateMisc({ noteOff: snapMisc.noteOff }) : undefined
                  }
                  onChange={(v) =>
                    onUpdateMisc({
                      noteOff: v,
                      pressroll: Math.min(miscConfig.pressroll, v),
                    })
                  }
                />
                <SliderParam
                  label="Pressroll Timeout"
                  value={miscConfig.pressroll}
                  min={0}
                  max={miscConfig.noteOff}
                  unit="ms"
                  sync={fPressroll}
                  onRevert={
                    snapMisc ? () => onUpdateMisc({ pressroll: snapMisc.pressroll }) : undefined
                  }
                  onChange={(v) => onUpdateMisc({ pressroll: v })}
                />
                <SliderParam
                  label="Octave Shift"
                  value={miscConfig.octaveShift}
                  min={0}
                  max={4}
                  sync={fOctave}
                  onRevert={
                    snapMisc ? () => onUpdateMisc({ octaveShift: snapMisc.octaveShift }) : undefined
                  }
                  onChange={(v) => onUpdateMisc({ octaveShift: v })}
                />
                <SliderParam
                  label="Noise Filter Level"
                  value={miscConfig.noiseFilter}
                  min={0}
                  max={9}
                  sync={fNoise}
                  onRevert={
                    snapMisc ? () => onUpdateMisc({ noiseFilter: snapMisc.noiseFilter }) : undefined
                  }
                  onChange={(v) => onUpdateMisc({ noiseFilter: v })}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                {[
                  { key: 'allGainsLow', label: 'All Gains Low' },
                  { key: 'altFalseTrSupp', label: 'Alt False Trigger Supp' },
                  { key: 'inputsPriority', label: 'Inputs Priority' },
                  { key: 'altNoteChoking', label: 'Alt Note Choking' },
                  { key: 'midiThru', label: 'MIDI Thru Enabled' },
                  { key: 'sendTriggeredIn', label: 'Send Triggered Input in Sysex' },
                  { key: 'bigVuMeter', label: 'Big VU Meter on LCD' },
                  { key: 'bigVuSplit', label: 'Split Big VU Meter' },
                  { key: 'quickAccess', label: 'Quick Access Navigation' },
                ].map((item) => {
                  const fSync = getFieldSync(miscConfig, snapMisc, item.key as keyof MiscConfig);
                  return (
                    <label
                      key={item.key}
                      className="flex items-center justify-between text-xs cursor-pointer gap-2"
                    >
                      <span className={syncLabelClass(fSync.state)}>{item.label}</span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {fSync.state === 'modified' && (
                          <span className="text-[11px] font-mono text-amber-700 dark:text-amber-400">
                            MD:{fSync.moduleValue ? 'On' : 'Off'}
                          </span>
                        )}
                        <input
                          type="checkbox"
                          checked={Boolean(miscConfig[item.key as keyof MiscConfig])}
                          onChange={(e) =>
                            onUpdateMisc({
                              [item.key]: e.target.checked,
                            } as Partial<MiscConfig>)
                          }
                          className="rounded border-slate-300 dark:border-slate-600 text-blue-600"
                        />
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          </section>
        </div>

        {/* Custom EEPROM Pad Names (SysEx 0x08) */}
        <section className="border border-[var(--md-border)] rounded-lg bg-[var(--md-panel)] p-5">
          <CustomPadNamesManager
            customNames={customNames}
            snapCustomNames={snapCustomNames}
            mcuTypeId={mcuTypeId}
            customPadNamesEnabled={globalConfig.customPadNames}
            midiConnected={midiConnected}
            onUpdateCustomName={onUpdateCustomName}
            onGetCustomName={onGetCustomName}
            onSendCustomName={onSendCustomName}
            onGetAllCustomNames={onGetAllCustomNames}
            onSendAllCustomNames={onSendAllCustomNames}
            onEnableCustomPadNames={() => onUpdateGlobal({ customPadNames: true })}
          />
        </section>

        {/* UI Appearance & Theme */}
        <section className="border border-[var(--md-border)] rounded-lg bg-[var(--md-panel)] p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--md-border)] pb-3">
            <div>
              <h2 className="text-sm font-display font-semibold text-slate-900 dark:text-white">
                Interface Appearance &amp; Theme
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Choose Light, Warm Light, Dark, Midnight OLED, or follow your operating system setting automatically
              </p>
            </div>
            <div className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-300">
              {theme === 'system' ? (
                <Monitor className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              ) : effectiveTheme === 'dark' || effectiveTheme === 'midnight' ? (
                <Moon className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              ) : (
                <Sun className="w-3.5 h-3.5 text-amber-600" />
              )}
              <span>
                Active: {THEME_OPTIONS.find((t) => t.id === theme)?.label}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {THEME_OPTIONS.map((opt) => {
              const selected = theme === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => onSelectTheme(opt.id)}
                  aria-pressed={selected}
                  className={`p-3 rounded-lg border text-left transition-colors flex flex-col gap-2.5 ${
                    selected
                      ? 'border-blue-600 bg-blue-50/60 dark:bg-blue-950/35'
                      : 'border-[var(--md-border)] bg-[var(--md-inset)] hover:border-blue-400'
                  }`}
                >
                  {/* Visual Preview Bar */}
                  <div
                    className="h-12 w-full rounded border overflow-hidden grid grid-cols-[1fr_2fr]"
                    style={{ borderColor: opt.swatchBorder }}
                    aria-hidden="true"
                  >
                    {opt.id === 'system' ? (
                      <>
                        <div className="bg-slate-100 p-1.5 flex flex-col justify-between">
                          <span className="w-4 h-1 rounded-xs bg-slate-300" />
                          <span className="w-6 h-1.5 rounded-xs bg-blue-600" />
                        </div>
                        <div className="bg-[#0b0e14] p-1.5 flex flex-col justify-between">
                          <span className="w-10 h-1 rounded-xs bg-slate-700" />
                          <span className="w-8 h-1.5 rounded-xs bg-blue-500" />
                        </div>
                      </>
                    ) : (
                      <>
                        <div
                          className="p-1.5 flex flex-col gap-1 border-r"
                          style={{
                            backgroundColor: opt.swatchCanvas,
                            borderColor: opt.swatchBorder,
                          }}
                        >
                          <span
                            className="w-full h-1.5 rounded-xs opacity-60"
                            style={{ backgroundColor: opt.swatchBorder }}
                          />
                          <span
                            className="w-3/4 h-1.5 rounded-xs opacity-45"
                            style={{ backgroundColor: opt.swatchBorder }}
                          />
                        </div>
                        <div
                          className="p-1.5 flex flex-col justify-between"
                          style={{ backgroundColor: opt.swatchPanel }}
                        >
                          <span
                            className="w-10 h-1.5 rounded-xs opacity-60"
                            style={{ backgroundColor: opt.swatchBorder }}
                          />
                          <div className="flex items-center justify-end gap-1">
                            <span
                              className="w-5 h-2 rounded-xs"
                              style={{ backgroundColor: opt.swatchAccent }}
                            />
                          </div>
                        </div>
                      </>
                    )}
                  </div>

                  <div className="space-y-0.5">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs font-semibold text-slate-900 dark:text-white">
                        {opt.label}
                      </span>
                      {selected && (
                        <Check className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                      {opt.description}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      </div>
    </main>
  );
};
