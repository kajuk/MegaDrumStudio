import React, { useMemo, useState } from 'react';
import { Copy, Eye, EyeOff, RotateCcw, Search, Zap } from 'lucide-react';
import {
  ActiveHit,
  CurveConfig,
  FieldSyncInfo,
  formatMidiNote,
  getPairZoneMode,
  InputCategory,
  MD_CURVES_LIST,
  ModuleSyncSnapshot,
  PAD_DYN_TIME_VALUES,
  PAD_FUNCTION_LABELS,
  PAD_LEVEL_SHIFT_VALUES,
  PadConfig,
  PositionalConfig,
  ThirdZoneConfig,
  ZoneMode,
} from '../types/megadrum';
import {
  getFieldSync,
  getPadSyncSummary,
  getPairSyncSummary,
  getThirdZoneSyncSummary,
} from '../utils/syncStatus';
import { KitVisualizer } from './KitVisualizer';
import { MidiNoteSelect } from './MidiNoteSelect';
import {
  ParamLabelRow,
  SectionSyncBanner,
  syncInputClass,
  syncLabelClass,
} from './SyncIndicator';
import { TriggerDynamicsVisualizer } from './TriggerDynamicsVisualizer';

interface KitPadsViewProps {
  pads: PadConfig[];
  thirdZones: ThirdZoneConfig[];
  positionals: PositionalConfig[];
  curves: CurveConfig[];
  syncSnapshot: ModuleSyncSnapshot;
  maxInputs: number;
  selectedPairIndex: number; // 0 = Kick (In 1), 1..27 = Stereo Pair (In 2+3 .. In 54+55)
  activeHit: ActiveHit | null;
  audioEnabled: boolean;
  onSelectPair: (pairIdx: number) => void;
  onUpdatePad: (padId: number, patch: Partial<PadConfig>) => void;
  onUpdate3rdZone: (pairIndex: number, patch: Partial<ThirdZoneConfig>) => void;
  onUpdatePositional: (padId: number, patch: Partial<PositionalConfig>) => void;
  onApplyZoneTemplate: (pairIndex: number, template: ZoneMode) => void;
  onResetPair: (pairIndex: number) => void;
  onRevertPairToModule: (pairIndex: number) => void;
  onTriggerPad: (padId: number, zone?: 'head' | 'rim' | 'bell') => void;
  onSendPairSysex: (pairIndex: number) => void;
  onRequestPairSysex: (pairIndex: number) => void;
}

const ZONE_TEMPLATES: {
  id: ZoneMode;
  label: string;
  hint: string;
}[] = [
  {
    id: 'single',
    label: 'Single Piezo',
    hint: 'Head/Bow only (Dual=Off, 3-Way=Off). Odd input stays disabled or independent.',
  },
  {
    id: 'dual_piezo',
    label: 'Dual Pad (Piezo + Piezo)',
    hint: 'Mesh pad with Head piezo (Even) + Rim piezo (Odd). Dual=On, Rim Type=Piezo.',
  },
  {
    id: 'piezo_switch',
    label: 'Dual Cymbal (Piezo + Switch)',
    hint: '2-zone cymbal with Bow piezo + Edge switch & choke. Dual=On, Edge Type=Switch.',
  },
  {
    id: 'three_way_roland',
    label: '3-Way Roland Cymbal',
    hint: 'Roland CY-13R/15R (dual TRS). 3Way=On, Edge Type=Switch, Bell via 3rd Zone threshold.',
  },
  {
    id: 'three_way_yamaha',
    label: '3-Way Yamaha Cymbal',
    hint: 'Yamaha PCY135/155 (single TRS resistor mux). Dual=On, Edge Type=Switch, Bell via 3rd Zone.',
  },
];

export const KitPadsView: React.FC<KitPadsViewProps> = ({
  pads,
  thirdZones,
  positionals,
  curves,
  syncSnapshot,
  maxInputs,
  selectedPairIndex,
  activeHit,
  audioEnabled,
  onSelectPair,
  onUpdatePad,
  onUpdate3rdZone,
  onUpdatePositional,
  onApplyZoneTemplate,
  onResetPair,
  onRevertPairToModule,
  onTriggerPad,
  onSendPairSysex,
  onRequestPairSysex,
}) => {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<InputCategory>('all');
  const [showKitMap, setShowKitMap] = useState(true);

  const pairCount = Math.floor(maxInputs / 2);

  const currentConfigView = useMemo(
    () => ({
      pads,
      thirdZones,
      positionals,
      curves,
      global: { maxInputs },
    }),
    [pads, thirdZones, positionals, curves, maxInputs]
  );

  const pairItems = useMemo(() => {
    const items: {
      pairIdx: number;
      leftPad: PadConfig;
      rightPad?: PadConfig;
      thirdZone?: ThirdZoneConfig;
      mode: ZoneMode;
      title: string;
      jackText: string;
      syncState: 'in_sync' | 'modified' | 'unknown';
      diffCount: number;
    }[] = [];

    if (pads[0]) {
      const s0 = getPadSyncSummary(
        pads[0],
        syncSnapshot.pads[0],
        positionals[0],
        syncSnapshot.positionals[0]
      );
      items.push({
        pairIdx: 0,
        leftPad: pads[0],
        mode: 'single',
        title: pads[0].name.replace(/\s+(Head|Bow)$/i, ''),
        jackText: 'In 01',
        syncState: s0.state,
        diffCount: s0.diffCount,
      });
    }

    for (let p = 1; p < pairCount; p++) {
      const leftPad = pads[p * 2 - 1];
      const rightPad = pads[p * 2];
      const thirdZone = thirdZones[p - 1];
      if (!leftPad) continue;
      const mode = getPairZoneMode(leftPad, rightPad);
      const cleanName = leftPad.name.replace(/\s+(Head|Bow)$/i, '');
      const sum = getPairSyncSummary(
        p,
        currentConfigView as Parameters<typeof getPairSyncSummary>[1],
        syncSnapshot
      );
      items.push({
        pairIdx: p,
        leftPad,
        rightPad,
        thirdZone,
        mode,
        title: cleanName,
        jackText: `In ${String(leftPad.id).padStart(2, '0')}+${String(rightPad?.id ?? leftPad.id + 1).padStart(2, '0')}`,
        syncState: sum.state,
        diffCount: sum.diffCount,
      });
    }

    const q = search.trim().toLowerCase();
    return items.filter((item) => {
      if (categoryFilter !== 'all' && item.leftPad.category !== categoryFilter) return false;
      if (!q) return true;
      return (
        item.title.toLowerCase().includes(q) ||
        item.jackText.toLowerCase().includes(q) ||
        String(item.leftPad.note).includes(q) ||
        String(item.rightPad?.note ?? '').includes(q) ||
        formatMidiNote(item.leftPad.note).label.toLowerCase().includes(q)
      );
    });
  }, [pads, thirdZones, positionals, syncSnapshot, pairCount, categoryFilter, search, currentConfigView]);

  const isKick = selectedPairIndex === 0;
  const leftPad = isKick ? pads[0] : pads[selectedPairIndex * 2 - 1] || pads[0];
  const rightPad = isKick ? undefined : pads[selectedPairIndex * 2];
  const thirdZone = isKick ? undefined : thirdZones[selectedPairIndex - 1];
  const leftPos = positionals[leftPad.id - 1];
  const rightPos = rightPad ? positionals[rightPad.id - 1] : undefined;

  const snapLeftPad = syncSnapshot.pads[leftPad.id - 1];
  const snapRightPad = rightPad ? syncSnapshot.pads[rightPad.id - 1] : null;
  const snapThirdZone = thirdZone ? syncSnapshot.thirdZones[thirdZone.id] : null;
  const snapLeftPos = syncSnapshot.positionals[leftPad.id - 1];
  const snapRightPos = rightPad ? syncSnapshot.positionals[rightPad.id - 1] : null;

  const pairSyncSummary = getPairSyncSummary(
    selectedPairIndex,
    currentConfigView as Parameters<typeof getPairSyncSummary>[1],
    syncSnapshot
  );

  const thirdSyncSummary = thirdZone
    ? getThirdZoneSyncSummary(thirdZone, snapThirdZone)
    : { state: 'in_sync' as const, diffCount: 0 };

  const currentMode = getPairZoneMode(leftPad, rightPad);
  const currentTemplateMeta =
    ZONE_TEMPLATES.find((t) => t.id === currentMode) || ZONE_TEMPLATES[0];

  const leftCurvePoints =
    curves[leftPad.curve]?.points || MD_CURVES_LIST[leftPad.curve]?.defaultPoints || MD_CURVES_LIST[0].defaultPoints;

  return (
    <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden">
      {/* Left Sidebar: Kick + Paired Drums & Cymbals */}
      <aside className="w-full lg:w-76 border-b lg:border-b-0 lg:border-r border-[var(--md-border)] bg-[var(--md-header)] flex flex-col shrink-0 max-h-72 lg:max-h-none">
        <div className="p-3 border-b border-[var(--md-border)] space-y-2.5">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`Search ${pairCount} pads / cymbals or notes...`}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-[var(--md-control-alt)] border border-[var(--md-border-strong)] rounded text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center gap-1 p-0.5 bg-[var(--md-toolbar)] rounded-md">
            {(['all', 'drums', 'cymbals', 'aux'] as InputCategory[]).map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategoryFilter(cat)}
                className={`flex-1 py-1 text-[11px] font-medium rounded capitalize transition-colors whitespace-nowrap ${
                  categoryFilter === cat
                    ? 'bg-white dark:bg-[#1E2533] text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60">
          {pairItems.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-500 dark:text-slate-400">
              No pads or cymbals match "{search}".
            </div>
          ) : (
            pairItems.map((item) => {
              const selected = item.pairIdx === selectedPairIndex;
              const isHit =
                activeHit &&
                Date.now() - activeHit.timestamp < 300 &&
                (activeHit.padId === item.leftPad.id ||
                  activeHit.padId === item.rightPad?.id);

              const modeShort =
                item.mode === 'single'
                  ? 'Single'
                  : item.mode === 'dual_piezo'
                  ? 'Dual Piezo'
                  : item.mode === 'piezo_switch'
                  ? 'Piezo+Sw'
                  : item.mode === 'three_way_roland'
                  ? '3-Way Roland'
                  : '3-Way Yamaha';

              const noteChain =
                item.pairIdx === 0
                  ? `#${item.leftPad.note}`
                  : item.mode === 'single'
                  ? `#${item.leftPad.note}`
                  : item.thirdZone && !item.thirdZone.disabled
                  ? `#${item.leftPad.note}/${item.rightPad?.note ?? 0}/${item.thirdZone.note}`
                  : `#${item.leftPad.note}/${item.rightPad?.note ?? 0}`;

              return (
                <button
                  key={item.pairIdx}
                  type="button"
                  onClick={() => onSelectPair(item.pairIdx)}
                  className={`w-full px-3 py-2 text-left flex items-center justify-between gap-2 transition-colors ${
                    selected
                      ? 'bg-blue-50/80 dark:bg-blue-950/40 text-slate-900 dark:text-white'
                      : 'hover:bg-slate-50 dark:hover:bg-[#141923] text-slate-700 dark:text-slate-300'
                  } ${item.leftPad.disabled ? 'opacity-50' : ''}`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400 shrink-0 tabular-nums">
                        {item.jackText}
                      </span>
                      <span className="text-xs font-medium truncate">{item.title}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                      <span>{modeShort}</span>
                      <span aria-hidden="true">·</span>
                      <span>Ch {item.leftPad.midiChannel}</span>
                      {item.syncState === 'modified' && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono text-amber-700 dark:text-amber-400 tabular-nums">
                            {item.diffCount} diff
                          </span>
                        </>
                      )}
                      {item.syncState === 'in_sync' && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="text-emerald-700 dark:text-emerald-400">Synced</span>
                        </>
                      )}
                      {item.syncState === 'unknown' && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="text-sky-700/85 dark:text-sky-400/85">Unsynced</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {isHit && (
                      <span
                        className="w-2 h-2 rounded-full bg-emerald-500"
                        title={`Velocity ${activeHit?.velocity}`}
                      />
                    )}
                    <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400 tabular-nums">
                      {noteChain}
                    </span>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto scrollbar-stable p-5 lg:p-6 space-y-5">
        {/* Header & Actions */}
        <div className="space-y-3">
          <div className="space-y-1.5">
            <div className="flex flex-wrap lg:flex-nowrap items-center justify-between gap-3">
              <h1 className="text-lg font-display font-semibold text-slate-900 dark:text-white truncate min-w-0">
                {isKick
                  ? `Input 01 — ${leftPad.name}`
                  : `Pair ${String(selectedPairIndex).padStart(2, '0')} (In ${leftPad.id} + In ${rightPad?.id ?? leftPad.id + 1}) — ${leftPad.name.replace(/\s+(Head|Bow)$/i, '')}`}
              </h1>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowKitMap((v) => !v)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded border border-[var(--md-border-strong)] bg-[var(--md-control)] text-slate-700 dark:text-slate-200 hover:bg-[var(--md-hover)] transition-colors whitespace-nowrap"
                >
                  {showKitMap ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  {showKitMap ? 'Hide Kit Map' : 'Show Kit Map'}
                </button>

                <button
                  type="button"
                  onClick={() => onRequestPairSysex(selectedPairIndex)}
                  className="px-3 py-1.5 text-xs font-medium rounded border border-[var(--md-border-strong)] bg-[var(--md-control)] text-slate-700 dark:text-slate-200 hover:bg-[var(--md-hover)] transition-colors whitespace-nowrap"
                >
                  {isKick ? 'Get Input' : 'Get Pair'}
                </button>
                <button
                  type="button"
                  onClick={() => onSendPairSysex(selectedPairIndex)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded text-white transition-colors whitespace-nowrap ${
                    pairSyncSummary.state === 'modified'
                      ? 'bg-amber-600 hover:bg-amber-700'
                      : 'bg-blue-600 hover:bg-blue-700'
                  }`}
                >
                  {pairSyncSummary.state === 'modified'
                    ? `${isKick ? 'Send Input' : 'Send Pair'} (${pairSyncSummary.diffCount})`
                    : isKick
                    ? 'Send Input'
                    : 'Send Pair'}
                </button>

                <button
                  type="button"
                  onClick={() => onTriggerPad(leftPad.id, 'head')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded border border-[var(--md-border-strong)] bg-[var(--md-control)] text-slate-700 dark:text-slate-200 hover:bg-[var(--md-hover)] transition-colors whitespace-nowrap"
                >
                  <Zap className="w-3.5 h-3.5 text-amber-500" />
                  {isKick ? 'Audition' : 'Head/Bow'}
                </button>

                {!isKick && rightPad && currentMode !== 'single' && (
                  <button
                    type="button"
                    onClick={() => onTriggerPad(rightPad.id, 'rim')}
                    className="px-3 py-1.5 text-xs font-medium rounded border border-[var(--md-border-strong)] bg-[var(--md-control)] text-slate-700 dark:text-slate-200 hover:bg-[var(--md-hover)] transition-colors whitespace-nowrap"
                  >
                    Rim/Edge
                  </button>
                )}

                {!isKick && thirdZone && !thirdZone.disabled && (
                  <button
                    type="button"
                    onClick={() => onTriggerPad(leftPad.id, 'bell')}
                    className="px-3 py-1.5 text-xs font-medium rounded border border-[var(--md-border-strong)] bg-[var(--md-control)] text-slate-700 dark:text-slate-200 hover:bg-[var(--md-hover)] transition-colors whitespace-nowrap"
                  >
                    Bell (3rd)
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => onResetPair(selectedPairIndex)}
                  title="Reset pair to factory defaults"
                  className="p-1.5 rounded border border-[var(--md-border-strong)] bg-[var(--md-control)] text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 min-h-5">
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate min-w-0">
                {isKick
                  ? `Channel ${leftPad.midiChannel} · Note #${leftPad.note} (${formatMidiNote(leftPad.note).label})`
                  : `${currentTemplateMeta.label} · Ch ${leftPad.midiChannel} · Head/Bow #${leftPad.note} · Rim/Edge #${rightPad?.note ?? 0}${
                      thirdZone && !thirdZone.disabled ? ` · Bell #${thirdZone.note}` : ''
                    }`}
              </p>
              <SectionSyncBanner
                state={pairSyncSummary.state}
                diffCount={pairSyncSummary.diffCount}
                unknownLabel={
                  isKick
                    ? 'Sync unknown · Click Get Input to read from MegaDrum'
                    : 'Sync unknown · Click Get Pair to read from MegaDrum'
                }
                onRevert={
                  snapLeftPad ? () => onRevertPairToModule(selectedPairIndex) : undefined
                }
              />
            </div>
          </div>

          {showKitMap && (
            <KitVisualizer
              pads={pads}
              selectedPairIndex={selectedPairIndex}
              activeHit={activeHit}
              onSelectPair={onSelectPair}
              onTriggerPad={onTriggerPad}
            />
          )}
        </div>

        {/* Easy One-Click Dual / Triple Zone Setup Strip */}
        {!isKick && rightPad && (
          <section className="border border-[var(--md-border)] rounded-lg bg-[var(--md-panel)] p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-display font-semibold text-slate-900 dark:text-white">
                  Pad / Cymbal Zone Configuration (In {leftPad.id} + In {rightPad.id})
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {currentTemplateMeta.hint}
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  onUpdatePad(rightPad.id, {
                    threshold: leftPad.threshold,
                    gain: leftPad.gain,
                    levelMax: leftPad.levelMax,
                    autoLevel: leftPad.autoLevel,
                    retrigger: leftPad.retrigger,
                    minScan: leftPad.minScan,
                    dynLevel: leftPad.dynLevel,
                    dynTime: leftPad.dynTime,
                    curve: leftPad.curve,
                    midiChannel: leftPad.midiChannel,
                    xtalkGroup: leftPad.xtalkGroup,
                    xtalkLevel: leftPad.xtalkLevel,
                  })
                }
                className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline whitespace-nowrap"
              >
                <Copy className="w-3.5 h-3.5" /> Copy Head Dynamics → Rim/Edge
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {ZONE_TEMPLATES.map((tpl) => {
                const active = currentMode === tpl.id;
                return (
                  <button
                    key={tpl.id}
                    type="button"
                    onClick={() => onApplyZoneTemplate(selectedPairIndex, tpl.id)}
                    className={`px-3 py-2 text-left rounded-md border text-xs font-medium transition-colors ${
                      active
                        ? 'border-blue-600 bg-blue-600 text-white'
                        : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0E121A] text-slate-700 dark:text-slate-300 hover:border-blue-400'
                    }`}
                  >
                    {tpl.label}
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* Side-by-Side Head/Bow (Left Input) + Rim/Edge (Right Input) */}
        <div className={`grid grid-cols-1 ${!isKick && rightPad ? 'xl:grid-cols-2' : ''} gap-6`}>
          <InputColumnSection
            title={isKick ? `Input 01 — ${leftPad.name}` : `Head / Bow (Input ${leftPad.id})`}
            isLeftInput={true}
            pad={leftPad}
            snapPad={snapLeftPad}
            pos={leftPos}
            snapPos={snapLeftPos}
            curves={curves}
            activeCurvePoints={leftCurvePoints}
            audioEnabled={audioEnabled}
            lastVelocity={
              activeHit && activeHit.padId === leftPad.id ? activeHit.velocity : undefined
            }
            onUpdatePad={(patch) => onUpdatePad(leftPad.id, patch)}
            onUpdatePos={
              leftPos ? (patch) => onUpdatePositional(leftPad.id, patch) : undefined
            }
          />

          {!isKick && rightPad && (
            <InputColumnSection
              title={`Rim / Edge (Input ${rightPad.id})`}
              isLeftInput={false}
              pad={rightPad}
              snapPad={snapRightPad}
              pos={rightPos}
              snapPos={snapRightPos}
              curves={curves}
              activeCurvePoints={
                curves[rightPad.curve]?.points ||
                MD_CURVES_LIST[rightPad.curve]?.defaultPoints ||
                MD_CURVES_LIST[0].defaultPoints
              }
              audioEnabled={audioEnabled}
              lastVelocity={
                activeHit && activeHit.padId === rightPad.id ? activeHit.velocity : undefined
              }
              onUpdatePad={(patch) => onUpdatePad(rightPad.id, patch)}
              onUpdatePos={
                rightPos ? (patch) => onUpdatePositional(rightPad.id, patch) : undefined
              }
            />
          )}
        </div>

        {/* 3rd Zone (Bell / Mid / Dampened Choke) for Stereo Pairs */}
        {!isKick && thirdZone && (
          <section className="border border-[var(--md-border)] rounded-lg bg-[var(--md-panel)] p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="text-sm font-display font-semibold text-slate-900 dark:text-white">
                    3rd Zone — Bell / Rimshot / Dampened Choke (In {leftPad.id}+{rightPad?.id ?? leftPad.id + 1})
                  </h2>
                  <SectionSyncBanner
                    state={thirdSyncSummary.state}
                    diffCount={thirdSyncSummary.diffCount}
                    unknownLabel="3rd Zone not synced"
                  />
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Used on 3-way cymbals (Bell + Choke) or dual-piezo pads for middle-zone / side-stick separation
                </p>
              </div>
              <label className="inline-flex items-center gap-2 text-xs font-medium cursor-pointer">
                <input
                  type="checkbox"
                  checked={!thirdZone.disabled}
                  onChange={(e) =>
                    onUpdate3rdZone(selectedPairIndex, { disabled: !e.target.checked })
                  }
                  className="rounded border-slate-300 dark:border-slate-600 text-blue-600"
                />
                <span className={syncLabelClass(getFieldSync(thirdZone, snapThirdZone, 'disabled').state)}>
                  3rd Zone Enabled
                </span>
              </label>
            </div>

            <div
              className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 ${
                thirdZone.disabled ? 'opacity-50 pointer-events-none' : ''
              }`}
            >
              <MidiNoteSelect
                label="3rd Zone / Bell Note"
                value={thirdZone.note}
                sync={getFieldSync(thirdZone, snapThirdZone, 'note')}
                onRevert={
                  snapThirdZone
                    ? () => onUpdate3rdZone(selectedPairIndex, { note: snapThirdZone.note })
                    : undefined
                }
                onChange={(note) => onUpdate3rdZone(selectedPairIndex, { note })}
                audioEnabled={audioEnabled}
              />
              <MidiNoteSelect
                label="Dampened / Choke Note"
                value={thirdZone.dampenedNote}
                sync={getFieldSync(thirdZone, snapThirdZone, 'dampenedNote')}
                onRevert={
                  snapThirdZone
                    ? () =>
                        onUpdate3rdZone(selectedPairIndex, {
                          dampenedNote: snapThirdZone.dampenedNote,
                        })
                    : undefined
                }
                onChange={(dampenedNote) =>
                  onUpdate3rdZone(selectedPairIndex, { dampenedNote })
                }
                audioEnabled={audioEnabled}
              />
              <MidiNoteSelect
                label="3rd Alt Note"
                value={thirdZone.altNote}
                sync={getFieldSync(thirdZone, snapThirdZone, 'altNote')}
                onRevert={
                  snapThirdZone
                    ? () => onUpdate3rdZone(selectedPairIndex, { altNote: snapThirdZone.altNote })
                    : undefined
                }
                onChange={(altNote) => onUpdate3rdZone(selectedPairIndex, { altNote })}
                audioEnabled={audioEnabled}
              />
              <MidiNoteSelect
                label="3rd Pressroll Note"
                value={thirdZone.pressrollNote}
                sync={getFieldSync(thirdZone, snapThirdZone, 'pressrollNote')}
                onRevert={
                  snapThirdZone
                    ? () =>
                        onUpdate3rdZone(selectedPairIndex, {
                          pressrollNote: snapThirdZone.pressrollNote,
                        })
                    : undefined
                }
                onChange={(pressrollNote) =>
                  onUpdate3rdZone(selectedPairIndex, { pressrollNote })
                }
                audioEnabled={audioEnabled}
              />
              <SliderParam
                label="3rd Zone Threshold"
                value={thirdZone.threshold}
                min={0}
                max={255}
                sync={getFieldSync(thirdZone, snapThirdZone, 'threshold')}
                onRevert={
                  snapThirdZone
                    ? () =>
                        onUpdate3rdZone(selectedPairIndex, { threshold: snapThirdZone.threshold })
                    : undefined
                }
                onChange={(threshold) => onUpdate3rdZone(selectedPairIndex, { threshold })}
              />
            </div>
          </section>
        )}
      </main>
    </div>
  );
};

interface InputColumnSectionProps {
  title: string;
  isLeftInput: boolean;
  pad: PadConfig;
  snapPad: PadConfig | null;
  pos?: PositionalConfig;
  snapPos?: PositionalConfig | null;
  curves: CurveConfig[];
  activeCurvePoints: number[];
  audioEnabled: boolean;
  lastVelocity?: number;
  onUpdatePad: (patch: Partial<PadConfig>) => void;
  onUpdatePos?: (patch: Partial<PositionalConfig>) => void;
}

const InputColumnSection: React.FC<InputColumnSectionProps> = ({
  title,
  isLeftInput,
  pad,
  snapPad,
  pos,
  snapPos,
  curves,
  activeCurvePoints,
  audioEnabled,
  lastVelocity,
  onUpdatePad,
  onUpdatePos,
}) => {
  const padSummary = getPadSyncSummary(pad, snapPad, pos, snapPos);

  const fNote = getFieldSync(pad, snapPad, 'note');
  const fAltNote = getFieldSync(pad, snapPad, 'altNote');
  const fPressNote = getFieldSync(pad, snapPad, 'pressrollNote');
  const fDisabled = getFieldSync(pad, snapPad, 'disabled');
  const fAutoLevel = getFieldSync(pad, snapPad, 'autoLevel');
  const fChannel = getFieldSync(pad, snapPad, 'midiChannel');
  const fFunction = getFieldSync(pad, snapPad, 'padFunction');
  const fThreshold = getFieldSync(pad, snapPad, 'threshold');
  const fGain = getFieldSync(pad, snapPad, 'gain');
  const fLevelMax = getFieldSync(pad, snapPad, 'levelMax');
  const fRetrigger = getFieldSync(pad, snapPad, 'retrigger');
  const fMinScan = getFieldSync(pad, snapPad, 'minScan');
  const fDynLevel = getFieldSync(pad, snapPad, 'dynLevel');
  const fDynTime = getFieldSync(pad, snapPad, 'dynTime');
  const fCompression = getFieldSync(pad, snapPad, 'compression');
  const fCurve = getFieldSync(pad, snapPad, 'curve');
  const fShift = getFieldSync(pad, snapPad, 'shift');
  const fXtalkGroup = getFieldSync(pad, snapPad, 'xtalkGroup');
  const fXtalkLevel = getFieldSync(pad, snapPad, 'xtalkLevel');
  const fRollSmooth = getFieldSync(pad, snapPad, 'rollSmoothLevel');
  const fExtraSupp = getFieldSync(pad, snapPad, 'extraFalseSupp');

  const inputTypeSyncState = (() => {
    if (!snapPad) return 'unknown' as const;
    if (isLeftInput) {
      return snapPad.dual === pad.dual && snapPad.threeWay === pad.threeWay
        ? ('in_sync' as const)
        : ('modified' as const);
    }
    return snapPad.type === pad.type ? ('in_sync' as const) : ('modified' as const);
  })();

  return (
    <section className="border border-[var(--md-border)] rounded-lg bg-[var(--md-panel)] p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <h2 className="text-sm font-display font-semibold text-slate-900 dark:text-white">
            {title}
          </h2>
          {padSummary.state === 'modified' && (
            <span className="text-[11px] font-mono text-amber-700 dark:text-amber-400">
              {padSummary.diffCount} modified
            </span>
          )}
          {padSummary.state === 'unknown' && (
            <span className="text-[11px] text-sky-700 dark:text-sky-400">Unsynced</span>
          )}
        </div>
        <div className="flex items-center gap-4">
          <label className="inline-flex items-center gap-1.5 text-xs cursor-pointer">
            <input
              type="checkbox"
              checked={pad.autoLevel}
              onChange={(e) => onUpdatePad({ autoLevel: e.target.checked })}
              className="rounded border-slate-300 dark:border-slate-600 text-blue-600"
            />
            <span className={syncLabelClass(fAutoLevel.state)}>Auto HighLvl</span>
          </label>
          <label className="inline-flex items-center gap-1.5 text-xs cursor-pointer">
            <input
              type="checkbox"
              checked={!pad.disabled}
              onChange={(e) => onUpdatePad({ disabled: !e.target.checked })}
              className="rounded border-slate-300 dark:border-slate-600 text-blue-600"
            />
            <span className={syncLabelClass(fDisabled.state)}>Enabled</span>
          </label>
        </div>
      </div>

      {/* Name, Wiring Mode, Channel, Function */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="col-span-2 sm:col-span-1">
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
            Label
          </label>
          <input
            type="text"
            maxLength={18}
            value={pad.name}
            onChange={(e) => onUpdatePad({ name: e.target.value })}
            className="w-full px-2 py-1.5 text-xs bg-white dark:bg-[#0E121A] border border-slate-200 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100"
          />
        </div>

        <div>
          <label className={`block text-xs font-medium mb-1 ${syncLabelClass(inputTypeSyncState)}`}>
            Input Type
          </label>
          {isLeftInput ? (
            <select
              value={pad.threeWay ? 2 : pad.dual ? 1 : 0}
              onChange={(e) => {
                const v = Number(e.target.value);
                onUpdatePad({ dual: v === 1, threeWay: v === 2, type: false });
              }}
              className={`w-full px-2 py-1.5 text-xs bg-white dark:bg-[#0E121A] border rounded ${syncInputClass(
                inputTypeSyncState
              )}`}
            >
              <option value={0}>Single Piezo</option>
              <option value={1}>Dual / 3way Yamaha</option>
              <option value={2}>3way Roland</option>
            </select>
          ) : (
            <select
              value={pad.type ? 1 : 0}
              onChange={(e) => onUpdatePad({ type: Number(e.target.value) === 1 })}
              className={`w-full px-2 py-1.5 text-xs bg-white dark:bg-[#0E121A] border rounded ${syncInputClass(
                inputTypeSyncState
              )}`}
            >
              <option value={0}>Piezo</option>
              <option value={1}>Switch</option>
            </select>
          )}
        </div>

        <div className="space-y-1">
          <ParamLabelRow
            label="MIDI Ch"
            sync={fChannel}
            onRevert={
              snapPad ? () => onUpdatePad({ midiChannel: snapPad.midiChannel }) : undefined
            }
          />
          <input
            type="number"
            min={1}
            max={16}
            value={pad.midiChannel}
            onChange={(e) =>
              onUpdatePad({
                midiChannel: Math.max(1, Math.min(16, Number(e.target.value) || 10)),
              })
            }
            className={`w-full px-2 py-1.5 text-xs font-mono tabular-nums bg-white dark:bg-[#0E121A] border rounded ${syncInputClass(
              fChannel.state
            )}`}
          />
        </div>

        <div className="space-y-1">
          <ParamLabelRow
            label="Function"
            sync={fFunction}
            formatModuleValue={(v) => PAD_FUNCTION_LABELS[Number(v)] || String(v)}
            onRevert={
              snapPad ? () => onUpdatePad({ padFunction: snapPad.padFunction }) : undefined
            }
          />
          <select
            value={pad.padFunction}
            onChange={(e) => onUpdatePad({ padFunction: Number(e.target.value) })}
            className={`w-full px-2 py-1.5 text-xs bg-white dark:bg-[#0E121A] border rounded ${syncInputClass(
              fFunction.state
            )}`}
          >
            {PAD_FUNCTION_LABELS.map((lbl, idx) => (
              <option key={lbl} value={idx}>
                {lbl}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* MIDI Notes */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <MidiNoteSelect
          label={isLeftInput ? 'Main Note' : 'Rim / Edge Note'}
          value={pad.note}
          sync={fNote}
          onRevert={snapPad ? () => onUpdatePad({ note: snapPad.note }) : undefined}
          onChange={(note) => onUpdatePad({ note })}
          audioEnabled={audioEnabled}
        />
        <MidiNoteSelect
          label="Alt Note"
          value={pad.altNote}
          sync={fAltNote}
          onRevert={snapPad ? () => onUpdatePad({ altNote: snapPad.altNote }) : undefined}
          onChange={(altNote) => onUpdatePad({ altNote })}
          audioEnabled={audioEnabled}
        />
        <MidiNoteSelect
          label="Pressroll Note"
          value={pad.pressrollNote}
          sync={fPressNote}
          onRevert={
            snapPad ? () => onUpdatePad({ pressrollNote: snapPad.pressrollNote }) : undefined
          }
          onChange={(pressrollNote) => onUpdatePad({ pressrollNote })}
          audioEnabled={audioEnabled}
        />
      </div>

      <TriggerDynamicsVisualizer pad={pad} lastVelocity={lastVelocity} />

      {/* Sensitivity & Dynamics Sliders */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-3">
        <SliderParam
          label="Threshold"
          value={pad.threshold}
          min={0}
          max={127}
          sync={fThreshold}
          onRevert={snapPad ? () => onUpdatePad({ threshold: snapPad.threshold }) : undefined}
          onChange={(v) => onUpdatePad({ threshold: v })}
        />
        <SliderParam
          label="Gain"
          value={pad.gain}
          min={0}
          max={8}
          sync={fGain}
          onRevert={snapPad ? () => onUpdatePad({ gain: snapPad.gain }) : undefined}
          onChange={(v) => onUpdatePad({ gain: v })}
        />
        <SliderParam
          label="HighLevel"
          value={pad.levelMax}
          min={64}
          max={1023}
          disabled={pad.autoLevel}
          sync={fLevelMax}
          onRevert={snapPad ? () => onUpdatePad({ levelMax: snapPad.levelMax }) : undefined}
          onChange={(v) => onUpdatePad({ levelMax: v })}
        />
        <SliderParam
          label="Retrigger Mask"
          value={pad.retrigger}
          min={1}
          max={127}
          sync={fRetrigger}
          onRevert={snapPad ? () => onUpdatePad({ retrigger: snapPad.retrigger }) : undefined}
          onChange={(v) => onUpdatePad({ retrigger: v })}
        />
        <SliderParam
          label="MinScan"
          value={pad.minScan}
          min={10}
          max={100}
          sync={fMinScan}
          onRevert={snapPad ? () => onUpdatePad({ minScan: snapPad.minScan }) : undefined}
          onChange={(v) => onUpdatePad({ minScan: v })}
        />
        <SliderParam
          label="DynLevel"
          value={pad.dynLevel}
          min={0}
          max={15}
          sync={fDynLevel}
          onRevert={snapPad ? () => onUpdatePad({ dynLevel: snapPad.dynLevel }) : undefined}
          onChange={(v) => onUpdatePad({ dynLevel: v })}
        />
        <div className="space-y-1">
          <ParamLabelRow
            label="DynTime (ms)"
            sync={fDynTime}
            formatModuleValue={(v) => `${PAD_DYN_TIME_VALUES[Number(v)] ?? 0}ms`}
            onRevert={snapPad ? () => onUpdatePad({ dynTime: snapPad.dynTime }) : undefined}
          />
          <select
            value={pad.dynTime}
            onChange={(e) => onUpdatePad({ dynTime: Number(e.target.value) })}
            className={`w-full px-2 py-1.5 text-xs font-mono tabular-nums bg-white dark:bg-[#0E121A] border rounded ${syncInputClass(
              fDynTime.state
            )}`}
          >
            {PAD_DYN_TIME_VALUES.map((ms, idx) => (
              <option key={ms} value={idx}>
                {ms} ms
              </option>
            ))}
          </select>
        </div>
        <SliderParam
          label="Compression"
          value={pad.compression}
          min={0}
          max={7}
          sync={fCompression}
          onRevert={
            snapPad ? () => onUpdatePad({ compression: snapPad.compression }) : undefined
          }
          onChange={(v) => onUpdatePad({ compression: v })}
        />
      </div>

      {/* Curve, Shift, XTalk, Roll Smooth */}
      <div className="pt-2 border-t border-[var(--md-border)] flex flex-col sm:flex-row gap-4 items-start">
        <div className="w-full sm:w-28 h-24 border border-[var(--md-border)] rounded bg-[var(--md-inset)] p-1.5 shrink-0">
          <svg viewBox="0 0 100 100" className="w-full h-full">
            <line
              x1="6"
              y1="94"
              x2="94"
              y2="6"
              stroke="currentColor"
              className="text-slate-300 dark:text-slate-800"
              strokeDasharray="3 3"
              strokeWidth="1"
            />
            <polyline
              fill="none"
              stroke="#2563eb"
              strokeWidth="2.2"
              strokeLinejoin="round"
              points={activeCurvePoints
                .map((pt, idx) => {
                  const x = 6 + (idx / 8) * 88;
                  const y = 94 - (pt / 255) * 88;
                  return `${x.toFixed(1)},${y.toFixed(1)}`;
                })
                .join(' ')}
            />
          </svg>
        </div>

        <div className="flex-1 w-full grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="col-span-2 sm:col-span-3 space-y-1">
            <ParamLabelRow
              label="Velocity Curve"
              sync={fCurve}
              formatModuleValue={(v) => curves[Number(v)]?.name || `#${Number(v) + 1}`}
              onRevert={snapPad ? () => onUpdatePad({ curve: snapPad.curve }) : undefined}
            />
            <select
              value={pad.curve}
              onChange={(e) => onUpdatePad({ curve: Number(e.target.value) })}
              className={`w-full px-2 py-1.5 text-xs bg-white dark:bg-[#0E121A] border rounded ${syncInputClass(
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

          <div className="space-y-1">
            <ParamLabelRow
              label="Level Shift"
              sync={fShift}
              formatModuleValue={(v) => String(PAD_LEVEL_SHIFT_VALUES[Number(v)] ?? 0)}
              onRevert={snapPad ? () => onUpdatePad({ shift: snapPad.shift }) : undefined}
            />
            <select
              value={pad.shift}
              onChange={(e) => onUpdatePad({ shift: Number(e.target.value) })}
              className={`w-full px-2 py-1.5 text-xs font-mono tabular-nums bg-white dark:bg-[#0E121A] border rounded ${syncInputClass(
                fShift.state
              )}`}
            >
              {PAD_LEVEL_SHIFT_VALUES.map((v, idx) => (
                <option key={v} value={idx}>
                  {v}
                </option>
              ))}
            </select>
          </div>

          <SliderParam
            label="XTalk Group"
            value={pad.xtalkGroup}
            min={0}
            max={7}
            sync={fXtalkGroup}
            onRevert={snapPad ? () => onUpdatePad({ xtalkGroup: snapPad.xtalkGroup }) : undefined}
            onChange={(v) => onUpdatePad({ xtalkGroup: v })}
          />
          <SliderParam
            label="XTalk Level"
            value={pad.xtalkLevel}
            min={0}
            max={7}
            sync={fXtalkLevel}
            onRevert={snapPad ? () => onUpdatePad({ xtalkLevel: snapPad.xtalkLevel }) : undefined}
            onChange={(v) => onUpdatePad({ xtalkLevel: v })}
          />
        </div>
      </div>

      {/* Positional Sensing & Roll Smoothing */}
      <div className="pt-2 border-t border-slate-100 dark:border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-3 items-end">
        <div className="space-y-1">
          <ParamLabelRow
            label="Roll Smooth"
            sync={fRollSmooth}
            onRevert={
              snapPad ? () => onUpdatePad({ rollSmoothLevel: snapPad.rollSmoothLevel }) : undefined
            }
          />
          <select
            value={pad.rollSmoothLevel}
            onChange={(e) => onUpdatePad({ rollSmoothLevel: Number(e.target.value) })}
            className={`w-full px-2 py-1.5 text-xs bg-white dark:bg-[#0E121A] border rounded ${syncInputClass(
              fRollSmooth.state
            )}`}
          >
            <option value={0}>Disabled</option>
            <option value={1}>Level 1</option>
            <option value={2}>Level 2</option>
            <option value={3}>Level 3</option>
          </select>
        </div>

        {pos && onUpdatePos && (
          <>
            <div className="space-y-1">
              <ParamLabelRow
                label="Positional"
                sync={getFieldSync(pos, snapPos, 'level')}
                onRevert={snapPos ? () => onUpdatePos({ level: snapPos.level }) : undefined}
              />
              <select
                value={pos.level}
                onChange={(e) => onUpdatePos({ level: Number(e.target.value) })}
                className={`w-full px-2 py-1.5 text-xs bg-white dark:bg-[#0E121A] border rounded ${syncInputClass(
                  getFieldSync(pos, snapPos, 'level').state
                )}`}
              >
                <option value={0}>Disabled</option>
                <option value={1}>Level 1</option>
                <option value={2}>Level 2</option>
                <option value={3}>Level 3</option>
              </select>
            </div>
            <SliderParam
              label="Pos Low"
              value={pos.low}
              min={0}
              max={100}
              disabled={pos.level === 0}
              sync={getFieldSync(pos, snapPos, 'low')}
              onRevert={snapPos ? () => onUpdatePos({ low: snapPos.low }) : undefined}
              onChange={(v) => onUpdatePos({ low: v })}
            />
            <SliderParam
              label="Pos High"
              value={pos.high}
              min={0}
              max={100}
              disabled={pos.level === 0}
              sync={getFieldSync(pos, snapPos, 'high')}
              onRevert={snapPos ? () => onUpdatePos({ high: snapPos.high }) : undefined}
              onChange={(v) => onUpdatePos({ high: v })}
            />
          </>
        )}
      </div>

      <label className="inline-flex items-center gap-2 text-xs cursor-pointer">
        <input
          type="checkbox"
          checked={pad.extraFalseSupp}
          onChange={(e) => onUpdatePad({ extraFalseSupp: e.target.checked })}
          className="rounded border-slate-300 dark:border-slate-600 text-blue-600"
        />
        <span className={syncLabelClass(fExtraSupp.state)}>Extra False Trigger Suppression</span>
        {fExtraSupp.state === 'modified' && (
          <span className="text-[11px] font-mono text-amber-700 dark:text-amber-400">
            MD:{fExtraSupp.moduleValue ? 'On' : 'Off'}
          </span>
        )}
      </label>
    </section>
  );
};

interface SliderParamProps {
  label: string;
  value: number;
  min: number;
  max: number;
  unit?: string;
  disabled?: boolean;
  sync?: FieldSyncInfo<number>;
  onRevert?: () => void;
  onChange: (value: number) => void;
}

export const SliderParam: React.FC<SliderParamProps> = ({
  label,
  value,
  min,
  max,
  unit,
  disabled,
  sync,
  onRevert,
  onChange,
}) => {
  const state = sync?.state ?? 'in_sync';
  return (
    <div className={`space-y-1 ${disabled ? 'opacity-45 pointer-events-none' : ''}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <label className={`text-xs font-medium truncate ${syncLabelClass(state)}`}>
            {label}
          </label>
          {state === 'modified' && sync?.moduleValue !== undefined && (
            <button
              type="button"
              onClick={onRevert}
              disabled={!onRevert}
              title={
                onRevert
                  ? `Revert to MegaDrum value (${sync.moduleValue})`
                  : `MegaDrum value: ${sync.moduleValue}`
              }
              className="text-[10px] font-mono tabular-nums text-amber-700 dark:text-amber-400 hover:underline shrink-0 disabled:no-underline"
            >
              MD:{sync.moduleValue}
            </button>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <input
            type="number"
            min={min}
            max={max}
            value={value}
            onChange={(e) =>
              onChange(Math.max(min, Math.min(max, Number(e.target.value) || min)))
            }
            className={`w-14 px-1.5 py-0.5 text-right text-xs font-mono tabular-nums bg-slate-50 dark:bg-[#0E121A] border rounded ${syncInputClass(
              state
            )}`}
          />
          {unit && <span className="text-[11px] font-mono text-slate-400">{unit}</span>}
        </div>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className={`w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-lg cursor-pointer ${
          state === 'modified' ? 'accent-amber-600' : ''
        }`}
      />
    </div>
  );
};
