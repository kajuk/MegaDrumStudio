import React, { useEffect, useMemo, useState } from 'react';
import { Check, Copy, Layers, SlidersHorizontal, X } from 'lucide-react';
import {
  getPadDisplayName,
  InputCategory,
  PadConfig,
  PositionalConfig,
  ThirdZoneConfig,
} from '../types/megadrum';

export type CrossPadCopyMode = 'pair' | 'input';

export interface CrossPadCopyRequest {
  mode: CrossPadCopyMode;
  sourcePairIndex: number; // 0 = Kick, 1..27 = Stereo Pair
  sourcePadId: number; // 1..55 (used when mode === 'input')
  targetPairIndices: number[]; // used when mode === 'pair'
  targetPadIds: number[]; // used when mode === 'input'
  // Pair block toggles
  includeHead: boolean;
  includeRim: boolean;
  includeThirdZone: boolean;
  includePositional: boolean;
  // Parameter group toggles
  includeDynamics: boolean;
  includeWiringAndXtalk: boolean;
  includeNotes: boolean;
  includeHardwareName: boolean;
}

interface CrossPadCopyModalProps {
  open: boolean;
  onDismiss: () => void;
  pads: PadConfig[];
  thirdZones: ThirdZoneConfig[];
  positionals: PositionalConfig[];
  customNames: string[];
  maxInputs: number;
  initialPairIndex: number;
  initialPadId?: number;
  initialMode?: CrossPadCopyMode;
  onApplyCopy: (req: CrossPadCopyRequest) => void;
}

export const CrossPadCopyModal: React.FC<CrossPadCopyModalProps> = ({
  open,
  onDismiss,
  pads,
  customNames,
  maxInputs,
  initialPairIndex,
  initialPadId,
  initialMode = 'pair',
  onApplyCopy,
}) => {
  const pairCount = Math.floor(maxInputs / 2);
  const activeInputCount = Math.min(pads.length, Math.max(17, maxInputs - 1));

  const [mode, setMode] = useState<CrossPadCopyMode>(initialMode);
  const [sourcePairIndex, setSourcePairIndex] = useState<number>(initialPairIndex);
  const [sourcePadId, setSourcePadId] = useState<number>(
    initialPadId ?? (initialPairIndex === 0 ? 1 : initialPairIndex * 2)
  );
  const [targetPairs, setTargetPairs] = useState<number[]>([]);
  const [targetPads, setTargetPads] = useState<number[]>([]);

  // Block toggles
  const [includeHead, setIncludeHead] = useState<boolean>(true);
  const [includeRim, setIncludeRim] = useState<boolean>(true);
  const [includeThirdZone, setIncludeThirdZone] = useState<boolean>(true);
  const [includePositional, setIncludePositional] = useState<boolean>(true);

  // Parameter group toggles
  const [includeDynamics, setIncludeDynamics] = useState<boolean>(true);
  const [includeWiringAndXtalk, setIncludeWiringAndXtalk] = useState<boolean>(true);
  const [includeNotes, setIncludeNotes] = useState<boolean>(false);
  const [includeHardwareName, setIncludeHardwareName] = useState<boolean>(false);

  // Reset source & selections whenever modal opens
  useEffect(() => {
    if (!open) return;
    const defaultMode: CrossPadCopyMode =
      initialMode === 'input' || initialPairIndex === 0 ? initialMode : 'pair';
    setMode(defaultMode);
    setSourcePairIndex(initialPairIndex);
    setSourcePadId(initialPadId ?? (initialPairIndex === 0 ? 1 : initialPairIndex * 2));
    setTargetPairs([]);
    setTargetPads([]);
  }, [open, initialMode, initialPairIndex, initialPadId]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDismiss();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onDismiss]);

  const pairList = useMemo(() => {
    const list: {
      pairIdx: number;
      label: string;
      jackText: string;
      category: PadConfig['category'];
      lcdName: string;
    }[] = [];

    if (pads[0]) {
      list.push({
        pairIdx: 0,
        label: pads[0].name.replace(/\s+(Head|Bow)$/i, ''),
        jackText: 'In 01',
        category: pads[0].category,
        lcdName: getPadDisplayName(pads[0], customNames),
      });
    }

    for (let p = 1; p < pairCount; p++) {
      const left = pads[p * 2 - 1];
      const right = pads[p * 2];
      if (!left) continue;
      list.push({
        pairIdx: p,
        label: left.name.replace(/\s+(Head|Bow)$/i, ''),
        jackText: `In ${String(left.id).padStart(2, '0')}+${String(right?.id ?? left.id + 1).padStart(2, '0')}`,
        category: left.category,
        lcdName: getPadDisplayName(left, customNames),
      });
    }
    return list;
  }, [pads, customNames, pairCount]);

  const inputList = useMemo(() => {
    return pads.slice(0, activeInputCount).map((p) => {
      const isRight = p.id > 1 && (p.id & 1) === 1;
      const role = p.id === 1 ? 'Kick' : isRight ? 'Rim/Edge' : 'Head/Bow';
      return {
        padId: p.id,
        label: p.name,
        role,
        category: p.category,
        lcdName: getPadDisplayName(p, customNames),
      };
    });
  }, [pads, activeInputCount, customNames]);

  if (!open) return null;

  const isSourceKick = sourcePairIndex === 0;

  const toggleTargetPair = (pairIdx: number) => {
    if (pairIdx === sourcePairIndex) return;
    setTargetPairs((prev) =>
      prev.includes(pairIdx) ? prev.filter((x) => x !== pairIdx) : [...prev, pairIdx]
    );
  };

  const toggleTargetPad = (padId: number) => {
    if (padId === sourcePadId) return;
    setTargetPads((prev) =>
      prev.includes(padId) ? prev.filter((x) => x !== padId) : [...prev, padId]
    );
  };

  const selectPairsByCategory = (cat: InputCategory | 'none') => {
    if (cat === 'none') {
      setTargetPairs([]);
      return;
    }
    setTargetPairs(
      pairList
        .filter((p) => p.pairIdx !== sourcePairIndex && (cat === 'all' || p.category === cat))
        .map((p) => p.pairIdx)
    );
  };

  const selectInputsByFilter = (filter: 'all' | 'heads' | 'rims' | 'drums' | 'cymbals' | 'none') => {
    if (filter === 'none') {
      setTargetPads([]);
      return;
    }
    setTargetPads(
      inputList
        .filter((inp) => {
          if (inp.padId === sourcePadId) return false;
          if (filter === 'all') return true;
          if (filter === 'heads') return inp.padId === 1 || (inp.padId & 1) === 0;
          if (filter === 'rims') return inp.padId > 1 && (inp.padId & 1) === 1;
          return inp.category === filter;
        })
        .map((inp) => inp.padId)
    );
  };

  const selectedTargetCount = mode === 'pair' ? targetPairs.length : targetPads.length;
  const hasAnyParamGroup =
    includeDynamics || includeWiringAndXtalk || includeNotes || includeHardwareName;
  const hasAnyBlock =
    mode === 'input'
      ? hasAnyParamGroup || includePositional
      : (includeHead && hasAnyParamGroup) ||
        (!isSourceKick && includeRim && hasAnyParamGroup) ||
        (!isSourceKick && includeThirdZone) ||
        includePositional;

  const canApply = selectedTargetCount > 0 && hasAnyBlock;

  const handleApply = () => {
    if (!canApply) return;
    onApplyCopy({
      mode,
      sourcePairIndex,
      sourcePadId,
      targetPairIndices: targetPairs,
      targetPadIds: targetPads,
      includeHead,
      includeRim: !isSourceKick && includeRim,
      includeThirdZone: !isSourceKick && includeThirdZone,
      includePositional,
      includeDynamics,
      includeWiringAndXtalk,
      includeNotes,
      includeHardwareName,
    });
    onDismiss();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="cross-pad-copy-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-[2px]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onDismiss();
      }}
    >
      <div className="relative w-full max-w-4xl max-h-[88vh] rounded-xl border border-[var(--md-border)] bg-[var(--md-panel)] shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[var(--md-border)] flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <Copy className="w-4 h-4" />
            </div>
            <div>
              <h2
                id="cross-pad-copy-title"
                className="text-sm font-display font-semibold text-slate-900 dark:text-white"
              >
                Cross-Pad &amp; Block Copy Tool
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Copy Head/Rim/3rd Zone/Positional blocks or trigger parameters across one or multiple inputs
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onDismiss}
            className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1">
          {/* Mode & Source Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">
                Copy Mode
              </label>
              <div className="grid grid-cols-2 gap-1.5 p-1 bg-[var(--md-toolbar)] rounded-md border border-[var(--md-border)]">
                <button
                  type="button"
                  onClick={() => setMode('pair')}
                  className={`inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                    mode === 'pair'
                      ? 'bg-white dark:bg-[#1E2533] text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  Pair → Pairs
                </button>
                <button
                  type="button"
                  onClick={() => setMode('input')}
                  className={`inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                    mode === 'input'
                      ? 'bg-white dark:bg-[#1E2533] text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  Single Input → Inputs
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">
                {mode === 'pair' ? 'Source Pair' : 'Source Physical Input'}
              </label>
              {mode === 'pair' ? (
                <select
                  value={sourcePairIndex}
                  onChange={(e) => {
                    const nextSrc = Number(e.target.value);
                    setSourcePairIndex(nextSrc);
                    setTargetPairs((prev) => prev.filter((x) => x !== nextSrc));
                  }}
                  className="w-full px-2.5 py-2 text-xs bg-[var(--md-control)] border border-[var(--md-border-strong)] rounded text-slate-900 dark:text-white"
                >
                  {pairList.map((p) => (
                    <option key={p.pairIdx} value={p.pairIdx}>
                      {p.pairIdx === 0
                        ? `Input 01 — ${p.label} (LCD: ${p.lcdName})`
                        : `Pair ${String(p.pairIdx).padStart(2, '0')} (${p.jackText}) — ${p.label} (LCD: ${p.lcdName})`}
                    </option>
                  ))}
                </select>
              ) : (
                <select
                  value={sourcePadId}
                  onChange={(e) => {
                    const nextSrc = Number(e.target.value);
                    setSourcePadId(nextSrc);
                    setTargetPads((prev) => prev.filter((x) => x !== nextSrc));
                  }}
                  className="w-full px-2.5 py-2 text-xs bg-[var(--md-control)] border border-[var(--md-border-strong)] rounded text-slate-900 dark:text-white"
                >
                  {inputList.map((inp) => (
                    <option key={inp.padId} value={inp.padId}>
                      In {String(inp.padId).padStart(2, '0')} ({inp.role}) — {inp.label} (LCD: {inp.lcdName})
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {/* What to Copy */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-3.5 rounded-lg border border-[var(--md-border)] bg-[var(--md-control-alt)] space-y-2.5">
              <h3 className="text-xs font-semibold text-slate-900 dark:text-white">
                {mode === 'pair' ? 'Blocks to Copy' : 'Input Blocks'}
              </h3>
              <div className="space-y-2 text-xs">
                {mode === 'pair' ? (
                  <>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={includeHead}
                        onChange={(e) => setIncludeHead(e.target.checked)}
                        className="rounded border-slate-300 dark:border-slate-600 text-blue-600"
                      />
                      <span className="text-slate-700 dark:text-slate-200">
                        Head / Bow (Even Input)
                      </span>
                    </label>
                    <label
                      className={`flex items-center gap-2 ${
                        isSourceKick ? 'opacity-45 cursor-not-allowed' : 'cursor-pointer'
                      }`}
                    >
                      <input
                        type="checkbox"
                        disabled={isSourceKick}
                        checked={!isSourceKick && includeRim}
                        onChange={(e) => setIncludeRim(e.target.checked)}
                        className="rounded border-slate-300 dark:border-slate-600 text-blue-600"
                      />
                      <span className="text-slate-700 dark:text-slate-200">
                        Rim / Edge (Odd Input)
                      </span>
                    </label>
                    <label
                      className={`flex items-center gap-2 ${
                        isSourceKick ? 'opacity-45 cursor-not-allowed' : 'cursor-pointer'
                      }`}
                    >
                      <input
                        type="checkbox"
                        disabled={isSourceKick}
                        checked={!isSourceKick && includeThirdZone}
                        onChange={(e) => setIncludeThirdZone(e.target.checked)}
                        className="rounded border-slate-300 dark:border-slate-600 text-blue-600"
                      />
                      <span className="text-slate-700 dark:text-slate-200">
                        3rd Zone (Bell / Choke threshold &amp; enable)
                      </span>
                    </label>
                  </>
                ) : (
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Copies selected parameter groups from Input {String(sourcePadId).padStart(2, '0')} to every checked destination input.
                  </p>
                )}
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includePositional}
                    onChange={(e) => setIncludePositional(e.target.checked)}
                    className="rounded border-slate-300 dark:border-slate-600 text-blue-600"
                  />
                  <span className="text-slate-700 dark:text-slate-200">
                    Positional Sensing (Level, Low, High)
                  </span>
                </label>
              </div>
            </div>

            <div className="p-3.5 rounded-lg border border-[var(--md-border)] bg-[var(--md-control-alt)] space-y-2.5">
              <h3 className="text-xs font-semibold text-slate-900 dark:text-white">
                Parameter Groups
              </h3>
              <div className="space-y-2 text-xs">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeDynamics}
                    onChange={(e) => setIncludeDynamics(e.target.checked)}
                    className="rounded border-slate-300 dark:border-slate-600 text-blue-600"
                  />
                  <span className="text-slate-700 dark:text-slate-200">
                    Trigger &amp; Dynamics (Threshold, Gain, HighLvl, Retrigger, MinScan, Dyn, Curve, Shift, Roll)
                  </span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeWiringAndXtalk}
                    onChange={(e) => setIncludeWiringAndXtalk(e.target.checked)}
                    className="rounded border-slate-300 dark:border-slate-600 text-blue-600"
                  />
                  <span className="text-slate-700 dark:text-slate-200">
                    Wiring Mode, XTalk Group/Level, MIDI Channel &amp; Function
                  </span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeNotes}
                    onChange={(e) => setIncludeNotes(e.target.checked)}
                    className="rounded border-slate-300 dark:border-slate-600 text-blue-600"
                  />
                  <span className="text-slate-700 dark:text-slate-200">
                    MIDI Notes (Main, Alt, Pressroll, 3rd Zone notes &amp; Link flags)
                  </span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeHardwareName}
                    onChange={(e) => setIncludeHardwareName(e.target.checked)}
                    className="rounded border-slate-300 dark:border-slate-600 text-blue-600"
                  />
                  <span className="text-slate-700 dark:text-slate-200">
                    Hardware LCD Name Index
                  </span>
                </label>
              </div>
            </div>
          </div>

          {/* Destination Targets */}
          <div className="space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs font-semibold text-slate-900 dark:text-white">
                Destination {mode === 'pair' ? 'Pairs' : 'Inputs'} ({selectedTargetCount} selected)
              </div>
              <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                {mode === 'pair' ? (
                  <>
                    {(['all', 'drums', 'cymbals', 'aux', 'none'] as const).map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => selectPairsByCategory(cat)}
                        className="px-2 py-0.5 rounded border border-[var(--md-border-strong)] bg-[var(--md-control)] text-slate-600 dark:text-slate-300 hover:bg-[var(--md-hover)] capitalize"
                      >
                        {cat === 'all' ? 'Select All' : cat === 'none' ? 'Clear' : cat}
                      </button>
                    ))}
                  </>
                ) : (
                  <>
                    {(
                      [
                        { id: 'all', label: 'All' },
                        { id: 'heads', label: 'Head/Bow' },
                        { id: 'rims', label: 'Rim/Edge' },
                        { id: 'drums', label: 'Drums' },
                        { id: 'cymbals', label: 'Cymbals' },
                        { id: 'none', label: 'Clear' },
                      ] as const
                    ).map((btn) => (
                      <button
                        key={btn.id}
                        type="button"
                        onClick={() => selectInputsByFilter(btn.id)}
                        className="px-2 py-0.5 rounded border border-[var(--md-border-strong)] bg-[var(--md-control)] text-slate-600 dark:text-slate-300 hover:bg-[var(--md-hover)]"
                      >
                        {btn.label}
                      </button>
                    ))}
                  </>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-60 overflow-y-auto p-1">
              {mode === 'pair'
                ? pairList.map((p) => {
                    const isSource = p.pairIdx === sourcePairIndex;
                    const checked = targetPairs.includes(p.pairIdx);
                    return (
                      <button
                        key={p.pairIdx}
                        type="button"
                        disabled={isSource}
                        onClick={() => toggleTargetPair(p.pairIdx)}
                        className={`px-2.5 py-2 rounded-md border text-left transition-colors flex items-center justify-between gap-2 ${
                          isSource
                            ? 'opacity-50 cursor-not-allowed border-dashed border-[var(--md-border)] bg-[var(--md-inset)]'
                            : checked
                            ? 'border-blue-600 bg-blue-50/70 dark:bg-blue-950/35 text-slate-900 dark:text-white'
                            : 'border-[var(--md-border)] bg-[var(--md-control)] hover:border-blue-400 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 text-xs font-medium truncate">
                            <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400 tabular-nums shrink-0">
                              {p.jackText}
                            </span>
                            <span className="truncate">{p.label}</span>
                          </div>
                          <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                            {isSource ? 'Source Pair' : `LCD: ${p.lcdName} · ${p.category}`}
                          </div>
                        </div>
                        {checked && <Check className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />}
                      </button>
                    );
                  })
                : inputList.map((inp) => {
                    const isSource = inp.padId === sourcePadId;
                    const checked = targetPads.includes(inp.padId);
                    return (
                      <button
                        key={inp.padId}
                        type="button"
                        disabled={isSource}
                        onClick={() => toggleTargetPad(inp.padId)}
                        className={`px-2.5 py-2 rounded-md border text-left transition-colors flex items-center justify-between gap-2 ${
                          isSource
                            ? 'opacity-50 cursor-not-allowed border-dashed border-[var(--md-border)] bg-[var(--md-inset)]'
                            : checked
                            ? 'border-blue-600 bg-blue-50/70 dark:bg-blue-950/35 text-slate-900 dark:text-white'
                            : 'border-[var(--md-border)] bg-[var(--md-control)] hover:border-blue-400 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 text-xs font-medium truncate">
                            <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400 tabular-nums shrink-0">
                              In {String(inp.padId).padStart(2, '0')}
                            </span>
                            <span className="truncate">{inp.label}</span>
                          </div>
                          <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                            {isSource ? 'Source Input' : `${inp.role} · LCD: ${inp.lcdName}`}
                          </div>
                        </div>
                        {checked && <Check className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />}
                      </button>
                    );
                  })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[var(--md-border)] bg-[var(--md-control-alt)] flex items-center justify-between gap-3 shrink-0">
          <span className="text-[11px] text-slate-500 dark:text-slate-400">
            Copied changes are marked as modified until sent to MegaDrum (or auto-sent with Live Updates).
          </span>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onDismiss}
              className="px-3.5 py-1.5 text-xs font-medium rounded border border-[var(--md-border-strong)] bg-[var(--md-control)] text-slate-700 dark:text-slate-200 hover:bg-[var(--md-hover)]"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!canApply}
              onClick={handleApply}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-45 disabled:cursor-not-allowed transition-colors"
            >
              <Copy className="w-3.5 h-3.5" />
              Copy to {selectedTargetCount} {mode === 'pair' ? (selectedTargetCount === 1 ? 'Pair' : 'Pairs') : selectedTargetCount === 1 ? 'Input' : 'Inputs'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
