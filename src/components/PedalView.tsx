import React, { useMemo, useState } from 'react';
import { Volume2 } from 'lucide-react';
import {
  CurveConfig,
  ModuleSyncSnapshot,
  PedalConfig,
  PedalType,
} from '../types/megadrum';
import { playDrumSound } from '../utils/drumAudio';
import { getFieldSync, getPedalSyncSummary } from '../utils/syncStatus';
import { SliderParam } from './KitPadsView';
import { MidiNoteSelect } from './MidiNoteSelect';
import {
  ParamLabelRow,
  SectionSyncBanner,
  syncInputClass,
  syncLabelClass,
} from './SyncIndicator';

interface PedalViewProps {
  pedal: PedalConfig;
  curves: CurveConfig[];
  syncSnapshot: ModuleSyncSnapshot;
  livePedalPosition: number; // 0..127 CC
  lastRawAdc: number | null;
  audioEnabled: boolean;
  onUpdatePedal: (patch: Partial<PedalConfig>) => void;
  onRevertPedalToModule: () => void;
  onSimulatePedalMove: (ccValue: number) => void;
  onSendPedalSysex: () => void;
  onRequestPedalSysex: () => void;
  onRequestPedalRawLevel: (assignTo?: 'low' | 'high') => void;
}

const HH_INPUT_OPTIONS = Array.from({ length: 27 }, (_, i) => (i + 1) * 2); // 2, 4 .. 54

export const PedalView: React.FC<PedalViewProps> = ({
  pedal,
  curves,
  syncSnapshot,
  livePedalPosition,
  lastRawAdc,
  audioEnabled,
  onUpdatePedal,
  onRevertPedalToModule,
  onSimulatePedalMove,
  onSendPedalSysex,
  onRequestPedalSysex,
  onRequestPedalRawLevel,
}) => {
  const [, setSimulatedRawAdc] = useState<number>(() =>
    Math.round(pedal.lowLevel + (pedal.highLevel - pedal.lowLevel) * 0.5)
  );

  const snapPedal = syncSnapshot.pedal;
  const pedalSummary = getPedalSyncSummary(pedal, snapPedal);

  const fType = getFieldSync(pedal, snapPedal, 'type');
  const fHhInput = getFieldSync(pedal, snapPedal, 'hhInput');
  const fCurve = getFieldSync(pedal, snapPedal, 'curve');
  const fChickCurve = getFieldSync(pedal, snapPedal, 'chickCurve');

  const { normalizedPos, activeZoneLabel, rawAdcDisplay } = useMemo(() => {
    const pos = livePedalPosition;
    let zone = 'Open';
    if (pos <= pedal.closedLevel) zone = 'Closed';
    else if (pos <= pedal.semiOpenLevel) zone = 'Semi-Open 1';
    else if (pos <= pedal.semiOpenLevel2) zone = 'Semi-Open 2';
    else if (pos <= pedal.halfOpenLevel) zone = 'Half-Open 1';
    else if (pos <= pedal.halfOpenLevel2) zone = 'Half-Open 2';

    const span = Math.max(1, pedal.highLevel - pedal.lowLevel);
    const adc = lastRawAdc ?? Math.round(pedal.lowLevel + (pos / 127) * span);
    return {
      normalizedPos: pos,
      activeZoneLabel: zone,
      rawAdcDisplay: adc,
    };
  }, [livePedalPosition, lastRawAdc, pedal]);

  const handleAuditionState = (note: number) => {
    if (audioEnabled && note > 0) {
      playDrumSound(note, 106);
    }
  };

  return (
    <main className="flex-1 overflow-y-auto p-5 lg:p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header with always-visible Get Pedal / Send Pedal / Read Raw ADC + Sync Banner */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-lg font-display font-semibold text-slate-900 dark:text-white">
                Hi-Hat Pedal Calibration &amp; Zones
              </h1>
              <SectionSyncBanner
                state={pedalSummary.state}
                diffCount={pedalSummary.diffCount}
                unknownLabel="Sync unknown · Click Get Pedal to read from MegaDrum"
                onRevert={snapPedal ? onRevertPedalToModule : undefined}
              />
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Calibrate ADC travel boundaries, chick/splash timing, and Bow/Edge/Bell zone notes (MD SysEx 0x02 / 0x12)
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onRequestPedalRawLevel()}
              className="px-3 py-1.5 text-xs font-medium rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#141923] text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              Read Raw ADC
            </button>
            <button
              type="button"
              onClick={onRequestPedalSysex}
              className="px-3 py-1.5 text-xs font-medium rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#141923] text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              Get Pedal
            </button>
            <button
              type="button"
              onClick={onSendPedalSysex}
              className={`px-3 py-1.5 text-xs font-semibold rounded text-white transition-colors ${
                pedalSummary.state === 'modified'
                  ? 'bg-amber-600 hover:bg-amber-700'
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {pedalSummary.state === 'modified'
                ? `Send Pedal (${pedalSummary.diffCount})`
                : 'Send Pedal'}
            </button>
          </div>
        </div>

        {/* Live Pedal Travel & Calibration Meter */}
        <section className="border border-[var(--md-border)] rounded-lg bg-[var(--md-panel)] p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-sm font-display font-semibold text-slate-900 dark:text-white">
                Live Pedal Travel &amp; Zone Visualizer
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Move your physical hi-hat pedal, capture Low/High directly from MegaDrum, or scrub slider
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs font-mono tabular-nums">
              <span className="text-slate-500 dark:text-slate-400">
                Raw ADC: <strong className="text-slate-900 dark:text-white">{rawAdcDisplay}</strong>
              </span>
              <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">|</span>
              <span className="text-slate-500 dark:text-slate-400">
                CC #{pedal.cc}: <strong className="text-slate-900 dark:text-white">{normalizedPos}</strong>
              </span>
              <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">|</span>
              <span className="font-sans font-semibold text-blue-600 dark:text-blue-400">
                {activeZoneLabel}
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <div className="relative h-8 rounded-md overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-[#0B0E14] flex text-[11px] font-medium">
              <div
                style={{ width: `${(pedal.closedLevel / 127) * 100}%` }}
                className="h-full bg-emerald-500/20 border-r border-emerald-500/40 flex items-center justify-center text-emerald-700 dark:text-emerald-300 truncate px-1"
              >
                Closed
              </div>
              <div
                style={{
                  width: `${Math.max(4, ((pedal.semiOpenLevel - pedal.closedLevel) / 127) * 100)}%`,
                }}
                className="h-full bg-blue-500/15 border-r border-blue-500/40 flex items-center justify-center text-blue-700 dark:text-blue-300 truncate px-1"
              >
                Semi
              </div>
              <div
                style={{
                  width: `${Math.max(4, ((pedal.halfOpenLevel - pedal.semiOpenLevel) / 127) * 100)}%`,
                }}
                className="h-full bg-amber-500/15 border-r border-amber-500/40 flex items-center justify-center text-amber-700 dark:text-amber-300 truncate px-1"
              >
                Half
              </div>
              <div className="flex-1 h-full bg-slate-200/50 dark:bg-slate-800/40 flex items-center justify-center text-slate-600 dark:text-slate-300 truncate px-1">
                Open
              </div>

              <div
                style={{ left: `${(normalizedPos / 127) * 100}%` }}
                className="absolute top-0 bottom-0 w-0.5 bg-slate-900 dark:bg-white shadow-sm transition-[left] duration-75"
              />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <input
                type="range"
                aria-label="Test Pedal Position"
                min={0}
                max={127}
                value={normalizedPos}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  onSimulatePedalMove(val);
                  const span = Math.max(1, pedal.highLevel - pedal.lowLevel);
                  setSimulatedRawAdc(Math.round(pedal.lowLevel + (val / 127) * span));
                }}
                className="flex-1 min-w-[180px] h-1.5 bg-slate-200 dark:bg-slate-800 rounded-lg cursor-pointer"
              />
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => onRequestPedalRawLevel('low')}
                  title="Request current pedal raw ADC from MegaDrum for Low Level"
                  className="px-2.5 py-1 text-xs font-medium rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#171D29] text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap"
                >
                  Set Low from Pedal
                </button>
                <button
                  type="button"
                  onClick={() => onRequestPedalRawLevel('high')}
                  title="Request current pedal raw ADC from MegaDrum for High Level"
                  className="px-2.5 py-1 text-xs font-medium rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#171D29] text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap"
                >
                  Set High from Pedal
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Parameters Split */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Hardware & Chick Calibration */}
          <section className="border border-[var(--md-border)] rounded-lg bg-[var(--md-panel)] p-5 space-y-4">
            <h2 className="text-sm font-display font-semibold text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-3">
              Hardware &amp; Chick Calibration
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <ParamLabelRow
                  label="Pedal Type"
                  sync={fType}
                  formatModuleValue={(v) => (v === 'foot_controller' ? 'FootContr' : 'Pot')}
                  onRevert={snapPedal ? () => onUpdatePedal({ type: snapPedal.type }) : undefined}
                />
                <select
                  value={pedal.type}
                  onChange={(e) => onUpdatePedal({ type: e.target.value as PedalType })}
                  className={`w-full px-2.5 py-1.5 text-xs bg-white dark:bg-[#0E121A] border rounded ${syncInputClass(
                    fType.state
                  )}`}
                >
                  <option value="potentiometer">Pot (Variable)</option>
                  <option value="foot_controller">FootContr (VH-11)</option>
                </select>
              </div>

              <div className="space-y-1">
                <ParamLabelRow
                  label="Hi-Hat Input"
                  sync={fHhInput}
                  onRevert={
                    snapPedal ? () => onUpdatePedal({ hhInput: snapPedal.hhInput }) : undefined
                  }
                />
                <select
                  value={pedal.hhInput}
                  onChange={(e) => onUpdatePedal({ hhInput: Number(e.target.value) })}
                  className={`w-full px-2.5 py-1.5 text-xs font-mono tabular-nums bg-white dark:bg-[#0E121A] border rounded ${syncInputClass(
                    fHhInput.state
                  )}`}
                >
                  {HH_INPUT_OPTIONS.map((inNum) => (
                    <option key={inNum} value={inNum}>
                      Input {inNum}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <ParamLabelRow
                  label="CC Curve"
                  sync={fCurve}
                  formatModuleValue={(v) => curves[Number(v)]?.name || `#${Number(v) + 1}`}
                  onRevert={
                    snapPedal ? () => onUpdatePedal({ curve: snapPedal.curve }) : undefined
                  }
                />
                <select
                  value={pedal.curve}
                  onChange={(e) => onUpdatePedal({ curve: Number(e.target.value) })}
                  className={`w-full px-2.5 py-1.5 text-xs bg-white dark:bg-[#0E121A] border rounded ${syncInputClass(
                    fCurve.state
                  )}`}
                >
                  {curves.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex flex-wrap gap-x-5 gap-y-2 py-1">
              {[
                { key: 'newAlgorithm', label: 'New Algorithm' },
                { key: 'autoLevels', label: 'Auto Levels' },
                { key: 'reverseLevels', label: 'Reverse Levels' },
                { key: 'softChicks', label: 'Soft Chicks' },
                { key: 'altIn', label: 'Alt Input' },
              ].map((item) => {
                const fSync = getFieldSync(pedal, snapPedal, item.key as keyof PedalConfig);
                return (
                  <label
                    key={item.key}
                    className="inline-flex items-center gap-1.5 text-xs cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={Boolean(pedal[item.key as keyof PedalConfig])}
                      onChange={(e) =>
                        onUpdatePedal({ [item.key]: e.target.checked } as Partial<PedalConfig>)
                      }
                      className="rounded border-slate-300 dark:border-slate-600 text-blue-600"
                    />
                    <span className={syncLabelClass(fSync.state)}>{item.label}</span>
                    {fSync.state === 'modified' && (
                      <span className="text-[10px] font-mono text-amber-700 dark:text-amber-400">
                        ({fSync.moduleValue ? 'On' : 'Off'})
                      </span>
                    )}
                  </label>
                );
              })}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-3">
              <SliderParam
                label="Low Level (ADC Min)"
                value={pedal.lowLevel}
                min={0}
                max={1023}
                sync={getFieldSync(pedal, snapPedal, 'lowLevel')}
                onRevert={
                  snapPedal ? () => onUpdatePedal({ lowLevel: snapPedal.lowLevel }) : undefined
                }
                onChange={(v) => onUpdatePedal({ lowLevel: v })}
              />
              <SliderParam
                label="High Level (ADC Max)"
                value={pedal.highLevel}
                min={0}
                max={1023}
                sync={getFieldSync(pedal, snapPedal, 'highLevel')}
                onRevert={
                  snapPedal ? () => onUpdatePedal({ highLevel: snapPedal.highLevel }) : undefined
                }
                onChange={(v) => onUpdatePedal({ highLevel: v })}
              />
              <SliderParam
                label="Chick Threshold"
                value={pedal.chickThres}
                min={0}
                max={127}
                sync={getFieldSync(pedal, snapPedal, 'chickThres')}
                onRevert={
                  snapPedal ? () => onUpdatePedal({ chickThres: snapPedal.chickThres }) : undefined
                }
                onChange={(v) => onUpdatePedal({ chickThres: v })}
              />
              <SliderParam
                label="Chick Delay"
                value={pedal.chickDelay}
                min={0}
                max={127}
                unit="ms"
                sync={getFieldSync(pedal, snapPedal, 'chickDelay')}
                onRevert={
                  snapPedal ? () => onUpdatePedal({ chickDelay: snapPedal.chickDelay }) : undefined
                }
                onChange={(v) => onUpdatePedal({ chickDelay: v })}
              />
              <SliderParam
                label="Short Chick Threshold"
                value={pedal.shortThres}
                min={0}
                max={127}
                sync={getFieldSync(pedal, snapPedal, 'shortThres')}
                onRevert={
                  snapPedal ? () => onUpdatePedal({ shortThres: snapPedal.shortThres }) : undefined
                }
                onChange={(v) => onUpdatePedal({ shortThres: v })}
              />
              <SliderParam
                label="Long Chick Threshold"
                value={pedal.longThres}
                min={0}
                max={127}
                sync={getFieldSync(pedal, snapPedal, 'longThres')}
                onRevert={
                  snapPedal ? () => onUpdatePedal({ longThres: snapPedal.longThres }) : undefined
                }
                onChange={(v) => onUpdatePedal({ longThres: v })}
              />
              <SliderParam
                label="MIDI CC Number"
                value={pedal.cc}
                min={0}
                max={127}
                sync={getFieldSync(pedal, snapPedal, 'cc')}
                onRevert={snapPedal ? () => onUpdatePedal({ cc: snapPedal.cc }) : undefined}
                onChange={(v) => onUpdatePedal({ cc: v })}
              />
              <SliderParam
                label="CC Reduction Level"
                value={pedal.ccRdcLvl}
                min={0}
                max={3}
                sync={getFieldSync(pedal, snapPedal, 'ccRdcLvl')}
                onRevert={
                  snapPedal ? () => onUpdatePedal({ ccRdcLvl: snapPedal.ccRdcLvl }) : undefined
                }
                onChange={(v) => onUpdatePedal({ ccRdcLvl: v })}
              />
              <SliderParam
                label="Chick Min Velocity"
                value={pedal.chickParam1}
                min={0}
                max={1023}
                sync={getFieldSync(pedal, snapPedal, 'chickParam1')}
                onRevert={
                  snapPedal
                    ? () => onUpdatePedal({ chickParam1: snapPedal.chickParam1 })
                    : undefined
                }
                onChange={(v) => onUpdatePedal({ chickParam1: v })}
              />
              <SliderParam
                label="Chick Max Velocity"
                value={pedal.chickParam2}
                min={0}
                max={1023}
                sync={getFieldSync(pedal, snapPedal, 'chickParam2')}
                onRevert={
                  snapPedal
                    ? () => onUpdatePedal({ chickParam2: snapPedal.chickParam2 })
                    : undefined
                }
                onChange={(v) => onUpdatePedal({ chickParam2: v })}
              />
              <SliderParam
                label="Chick Dead Time"
                value={pedal.chickParam3}
                min={0}
                max={1023}
                sync={getFieldSync(pedal, snapPedal, 'chickParam3')}
                onRevert={
                  snapPedal
                    ? () => onUpdatePedal({ chickParam3: snapPedal.chickParam3 })
                    : undefined
                }
                onChange={(v) => onUpdatePedal({ chickParam3: v })}
              />
              <div className="space-y-1">
                <ParamLabelRow
                  label="Chick Curve"
                  sync={fChickCurve}
                  formatModuleValue={(v) => curves[Number(v)]?.name || `#${Number(v) + 1}`}
                  onRevert={
                    snapPedal ? () => onUpdatePedal({ chickCurve: snapPedal.chickCurve }) : undefined
                  }
                />
                <select
                  value={pedal.chickCurve}
                  onChange={(e) => onUpdatePedal({ chickCurve: Number(e.target.value) })}
                  className={`w-full px-2.5 py-1.5 text-xs bg-white dark:bg-[#0E121A] border rounded ${syncInputClass(
                    fChickCurve.state
                  )}`}
                >
                  {curves.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </section>

          {/* Zone Thresholds & Foot Notes */}
          <section className="border border-[var(--md-border)] rounded-lg bg-[var(--md-panel)] p-5 space-y-4">
            <h2 className="text-sm font-display font-semibold text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-3">
              Zone Boundaries &amp; Foot Articulations
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-3">
              <SliderParam
                label="Closed Level"
                value={pedal.closedLevel}
                min={0}
                max={127}
                sync={getFieldSync(pedal, snapPedal, 'closedLevel')}
                onRevert={
                  snapPedal
                    ? () => onUpdatePedal({ closedLevel: snapPedal.closedLevel })
                    : undefined
                }
                onChange={(v) => onUpdatePedal({ closedLevel: v })}
              />
              <SliderParam
                label="Semi-Open Level"
                value={pedal.semiOpenLevel}
                min={0}
                max={127}
                sync={getFieldSync(pedal, snapPedal, 'semiOpenLevel')}
                onRevert={
                  snapPedal
                    ? () => onUpdatePedal({ semiOpenLevel: snapPedal.semiOpenLevel })
                    : undefined
                }
                onChange={(v) => onUpdatePedal({ semiOpenLevel: v })}
              />
              <SliderParam
                label="Semi-Open 2 Level"
                value={pedal.semiOpenLevel2}
                min={0}
                max={127}
                sync={getFieldSync(pedal, snapPedal, 'semiOpenLevel2')}
                onRevert={
                  snapPedal
                    ? () => onUpdatePedal({ semiOpenLevel2: snapPedal.semiOpenLevel2 })
                    : undefined
                }
                onChange={(v) => onUpdatePedal({ semiOpenLevel2: v })}
              />
              <SliderParam
                label="Half-Open Level"
                value={pedal.halfOpenLevel}
                min={0}
                max={127}
                sync={getFieldSync(pedal, snapPedal, 'halfOpenLevel')}
                onRevert={
                  snapPedal
                    ? () => onUpdatePedal({ halfOpenLevel: snapPedal.halfOpenLevel })
                    : undefined
                }
                onChange={(v) => onUpdatePedal({ halfOpenLevel: v })}
              />
              <SliderParam
                label="Half-Open 2 Level"
                value={pedal.halfOpenLevel2}
                min={0}
                max={127}
                sync={getFieldSync(pedal, snapPedal, 'halfOpenLevel2')}
                onRevert={
                  snapPedal
                    ? () => onUpdatePedal({ halfOpenLevel2: snapPedal.halfOpenLevel2 })
                    : undefined
                }
                onChange={(v) => onUpdatePedal({ halfOpenLevel2: v })}
              />
              <SliderParam
                label="Open Level"
                value={pedal.openLevel}
                min={0}
                max={127}
                sync={getFieldSync(pedal, snapPedal, 'openLevel')}
                onRevert={
                  snapPedal ? () => onUpdatePedal({ openLevel: snapPedal.openLevel }) : undefined
                }
                onChange={(v) => onUpdatePedal({ openLevel: v })}
              />
            </div>

            <div className="pt-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <MidiNoteSelect
                label="Pedal Chick Note"
                value={pedal.chickNote}
                sync={getFieldSync(pedal, snapPedal, 'chickNote')}
                onRevert={
                  snapPedal ? () => onUpdatePedal({ chickNote: snapPedal.chickNote }) : undefined
                }
                onChange={(chickNote) => onUpdatePedal({ chickNote })}
                audioEnabled={audioEnabled}
              />
              <MidiNoteSelect
                label="Pedal Splash Note"
                value={pedal.splashNote}
                sync={getFieldSync(pedal, snapPedal, 'splashNote')}
                onRevert={
                  snapPedal
                    ? () => onUpdatePedal({ splashNote: snapPedal.splashNote })
                    : undefined
                }
                onChange={(splashNote) => onUpdatePedal({ splashNote })}
                audioEnabled={audioEnabled}
              />
            </div>

            <div className="pt-2 flex flex-wrap gap-2">
              {[
                { label: 'Audition Closed', note: pedal.bowClosedNote },
                { label: 'Audition Semi-Closed', note: pedal.bowSemiClosedNote },
                { label: 'Audition Half', note: pedal.bowHalfOpenNote },
                { label: 'Audition Open', note: pedal.bowOpenNote },
                { label: 'Audition Chick', note: pedal.chickNote },
                { label: 'Audition Splash', note: pedal.splashNote },
              ].map((btn) => (
                <button
                  key={btn.label}
                  type="button"
                  onClick={() => handleAuditionState(btn.note)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#161C28] text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap"
                >
                  <Volume2 className="w-3 h-3 text-blue-500" />
                  {btn.label}
                </button>
              ))}
            </div>
          </section>
        </div>

        {/* Hi-Hat Note Matrix Table (Full MegaDrum Zones) */}
        <section className="border border-[var(--md-border)] rounded-lg bg-[var(--md-panel)] overflow-hidden">
          <div className="px-5 py-3.5 border-b border-[var(--md-border)]">
            <h2 className="text-sm font-display font-semibold text-slate-900 dark:text-white">
              Hi-Hat Articulation Note Matrix
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[var(--md-control-alt)] text-slate-500 dark:text-slate-400 border-b border-[var(--md-border)]">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Zone</th>
                  <th className="px-3 py-2.5 font-medium">Closed</th>
                  <th className="px-3 py-2.5 font-medium">Semi-Closed</th>
                  <th className="px-3 py-2.5 font-medium">Semi-Open 1</th>
                  <th className="px-3 py-2.5 font-medium">Semi-Open 2</th>
                  <th className="px-3 py-2.5 font-medium">Half-Open 1</th>
                  <th className="px-3 py-2.5 font-medium">Half-Open 2</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
                {(
                  [
                    {
                      zone: 'Bow',
                      keys: [
                        'bowClosedNote',
                        'bowSemiClosedNote',
                        'bowSemiOpenNote',
                        'bowSemiOpen2Note',
                        'bowHalfOpenNote',
                        'bowHalfOpen2Note',
                      ] as const,
                    },
                    {
                      zone: 'Edge',
                      keys: [
                        'edgeClosedNote',
                        'edgeSemiClosedNote',
                        'edgeSemiOpenNote',
                        'edgeSemiOpen2Note',
                        'edgeHalfOpenNote',
                        'edgeHalfOpen2Note',
                      ] as const,
                    },
                    {
                      zone: 'Bell',
                      keys: [
                        'bellClosedNote',
                        'bellSemiClosedNote',
                        'bellSemiOpenNote',
                        'bellSemiOpen2Note',
                        'bellHalfOpenNote',
                        'bellHalfOpen2Note',
                      ] as const,
                    },
                  ] as const
                ).map((row) => (
                  <tr key={row.zone} className="hover:bg-slate-50/70 dark:hover:bg-[#151B27]">
                    <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100 whitespace-nowrap">
                      {row.zone}
                    </td>
                    {row.keys.map((k) => {
                      const fSync = getFieldSync(pedal, snapPedal, k);
                      return (
                        <td key={k} className="px-3 py-2.5">
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              min={0}
                              max={127}
                              title={
                                fSync.state === 'modified'
                                  ? `Modified — MegaDrum note #${fSync.moduleValue}`
                                  : fSync.state === 'unknown'
                                  ? 'Sync unknown'
                                  : 'In sync with MegaDrum'
                              }
                              value={pedal[k]}
                              onChange={(e) =>
                                onUpdatePedal({
                                  [k]: Math.max(0, Math.min(127, Number(e.target.value) || 0)),
                                } as Partial<PedalConfig>)
                              }
                              className={`w-14 px-1.5 py-1 text-xs font-mono tabular-nums bg-white dark:bg-[#0B0E14] border rounded ${syncInputClass(
                                fSync.state
                              )}`}
                            />
                            <button
                              type="button"
                              onClick={() => handleAuditionState(pedal[k])}
                              title="Play note"
                              className="p-1 text-slate-400 hover:text-blue-500 transition-colors"
                            >
                              <Volume2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
};
