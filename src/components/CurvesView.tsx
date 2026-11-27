import React, { useRef, useState } from 'react';
import { ArrowDownToLine, ArrowUpFromLine, RotateCcw } from 'lucide-react';
import { CurveConfig, MD_CURVES_LIST, ModuleSyncSnapshot } from '../types/megadrum';
import { getCurvePointSync, getCurveSyncSummary } from '../utils/syncStatus';
import { SectionSyncBanner, syncInputClass, syncLabelClass } from './SyncIndicator';

interface CurvesViewProps {
  curves: CurveConfig[];
  syncSnapshot: ModuleSyncSnapshot;
  onUpdateCurve: (curveIdx: number, points: number[]) => void;
  onRevertCurveToModule: (curveIdx: number) => void;
  onGetCurveSysex: (curveIdx: number) => void;
  onSendCurveSysex: (curveIdx: number, points: number[]) => void;
  onGetAllCurvesSysex: () => void;
  onSendAllCurvesSysex: () => void;
}

export const CurvesView: React.FC<CurvesViewProps> = ({
  curves,
  syncSnapshot,
  onUpdateCurve,
  onRevertCurveToModule,
  onGetCurveSysex,
  onSendCurveSysex,
  onGetAllCurvesSysex,
  onSendAllCurvesSysex,
}) => {
  const [selectedCurveId, setSelectedCurveId] = useState<number>(0);
  const [draggingPointIdx, setDraggingPointIdx] = useState<number | null>(null);
  const [testInputForce, setTestInputForce] = useState<number>(72);
  const svgRef = useRef<SVGSVGElement>(null);

  const activeCurve = curves[selectedCurveId] || curves[0];
  const snapCurve = syncSnapshot.curves[selectedCurveId];
  const activeSummary = getCurveSyncSummary(activeCurve, snapCurve);
  const activeMeta = MD_CURVES_LIST[selectedCurveId] || MD_CURVES_LIST[0];
  const points = activeCurve?.points || activeMeta.defaultPoints;

  const totalModifiedCurves = curves.filter(
    (c, idx) => getCurveSyncSummary(c, syncSnapshot.curves[idx]).state === 'modified'
  ).length;

  const padLeft = 44;
  const padRight = 22;
  const padTop = 20;
  const padBottom = 38;
  const width = 620;
  const height = 380;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  const pointToSvg = (idx: number, val: number) => ({
    x: padLeft + (idx / 8) * plotW,
    y: padTop + (1 - val / 255) * plotH,
  });

  const evaluateCurveMidi = (forcePct: number) => {
    const scaled = (forcePct / 100) * 8;
    const i0 = Math.min(7, Math.max(0, Math.floor(scaled)));
    const frac = scaled - i0;
    const val255 = points[i0] + (points[i0 + 1] - points[i0]) * frac;
    return Math.max(1, Math.min(127, Math.round((val255 / 255) * 127)));
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (draggingPointIdx === null || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const relY = ((e.clientY - rect.top) / rect.height) * height;
    const norm = 1 - (relY - padTop) / plotH;
    const val = Math.max(2, Math.min(255, Math.round(norm * 255)));
    const next = [...points];
    next[draggingPointIdx] = val;
    onUpdateCurve(selectedCurveId, next);
  };

  const applyPresetShape = (shape: 'default' | 'linear' | 'boost' | 'tame') => {
    if (shape === 'default') {
      onUpdateCurve(selectedCurveId, [...activeMeta.defaultPoints]);
    } else if (shape === 'linear') {
      onUpdateCurve(selectedCurveId, [2, 32, 64, 96, 128, 160, 192, 224, 255]);
    } else if (shape === 'boost') {
      onUpdateCurve(
        selectedCurveId,
        points.map((p, idx) => (idx === 8 ? 255 : Math.min(255, Math.round(p * 1.15 + 10))))
      );
    } else if (shape === 'tame') {
      onUpdateCurve(
        selectedCurveId,
        points.map((p, idx) => (idx === 0 ? 2 : Math.max(2, Math.round(p * 0.85))))
      );
    }
  };

  const testSvgPos = (() => {
    const x = padLeft + (testInputForce / 100) * plotW;
    const outVel = evaluateCurveMidi(testInputForce);
    const y = padTop + (1 - outVel / 127) * plotH;
    return { x, y, outVel };
  })();

  return (
    <main className="flex-1 overflow-y-auto p-5 lg:p-6">
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-[270px_1fr] gap-6">
        {/* Left List: All 16 Editable MegaDrum Curves */}
        <aside className="border border-[var(--md-border)] rounded-lg bg-[var(--md-panel)] overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-[var(--md-border)] flex items-center justify-between gap-2">
            <h2 className="text-sm font-display font-semibold text-slate-900 dark:text-white">
              16 Curves
            </h2>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={onGetAllCurvesSysex}
                title="Get All 16 Curves from MegaDrum"
                className="px-2 py-1 text-[11px] font-medium rounded border border-[var(--md-border-strong)] bg-[var(--md-control)] text-slate-700 dark:text-slate-200 hover:bg-[var(--md-hover)] whitespace-nowrap"
              >
                Get All
              </button>
              <button
                type="button"
                onClick={onSendAllCurvesSysex}
                title="Send All 16 Curves to MegaDrum"
                className={`px-2 py-1 text-[11px] font-medium rounded whitespace-nowrap ${
                  totalModifiedCurves > 0
                    ? 'bg-amber-600 hover:bg-amber-700 text-white'
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                }`}
              >
                {totalModifiedCurves > 0 ? `Send (${totalModifiedCurves})` : 'Send All'}
              </button>
            </div>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800/70 overflow-y-auto max-h-[560px]">
            {curves.map((c) => {
              const active = selectedCurveId === c.id;
              const sum = getCurveSyncSummary(c, syncSnapshot.curves[c.id]);
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSelectedCurveId(c.id)}
                  className={`w-full px-4 py-2.5 text-left flex items-center justify-between gap-2 transition-colors ${
                    active
                      ? 'bg-blue-50/80 dark:bg-blue-950/40 text-slate-900 dark:text-white'
                      : 'hover:bg-slate-50 dark:hover:bg-[#151B27] text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <span className="text-xs font-medium truncate">{c.name}</span>
                  <div className="flex items-center gap-2 shrink-0">
                    {sum.state === 'modified' && (
                      <span className="text-[11px] font-mono tabular-nums text-amber-700 dark:text-amber-400">
                        {sum.diffCount} diff
                      </span>
                    )}
                    {sum.state === 'unknown' && (
                      <span className="text-[11px] font-mono text-sky-600/80 dark:text-sky-400/80">
                        ?
                      </span>
                    )}
                    {sum.state === 'in_sync' && (
                      <span className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400">
                        Sync
                      </span>
                    )}
                    <span className="text-[11px] font-mono text-slate-400 tabular-nums">
                      #{String(c.id + 1).padStart(2, '0')}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        {/* Right Canvas: Interactive Curve Graph + Get / Send Curve */}
        <section className="border border-[var(--md-border)] rounded-lg bg-[var(--md-panel)] p-5 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--md-border)] pb-3">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-sm font-display font-semibold text-slate-900 dark:text-white">
                  Curve {selectedCurveId + 1}: {activeCurve.name}
                </h1>
                <SectionSyncBanner
                  state={activeSummary.state}
                  diffCount={activeSummary.diffCount}
                  unknownLabel="Not synced · Click Get Curve to compare"
                  onRevert={
                    snapCurve ? () => onRevertCurveToModule(selectedCurveId) : undefined
                  }
                />
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {activeMeta.description} · Drag nodes P1–P9 vertically or edit numeric values (2–255)
                {activeSummary.state === 'modified' &&
                  ' · Dashed amber line shows current MegaDrum curve'}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => applyPresetShape('boost')}
                className="px-2.5 py-1 text-xs font-medium rounded border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200"
              >
                Boost Low
              </button>
              <button
                type="button"
                onClick={() => applyPresetShape('tame')}
                className="px-2.5 py-1 text-xs font-medium rounded border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200"
              >
                Tame
              </button>
              <button
                type="button"
                onClick={() => applyPresetShape('default')}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200"
              >
                <RotateCcw className="w-3 h-3" /> Default
              </button>

              <span className="hidden sm:inline text-slate-300 dark:text-slate-700 mx-1">|</span>

              <button
                type="button"
                onClick={() => onGetCurveSysex(selectedCurveId)}
                className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#141923] text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                <ArrowDownToLine className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                Get Curve
              </button>
              <button
                type="button"
                onClick={() => onSendCurveSysex(selectedCurveId, points)}
                className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded text-white ${
                  activeSummary.state === 'modified'
                    ? 'bg-amber-600 hover:bg-amber-700'
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                <ArrowUpFromLine className="w-3.5 h-3.5" />
                {activeSummary.state === 'modified'
                  ? `Send Curve (${activeSummary.diffCount})`
                  : 'Send Curve'}
              </button>
            </div>
          </div>

          <div className="border border-[var(--md-border)] rounded-md bg-[var(--md-inset)] p-2">
            <svg
              ref={svgRef}
              viewBox={`0 0 ${width} ${height}`}
              onPointerMove={handlePointerMove}
              onPointerUp={() => setDraggingPointIdx(null)}
              onPointerLeave={() => setDraggingPointIdx(null)}
              className="w-full h-72 sm:h-80 select-none touch-none"
            >
              {[0, 32, 64, 96, 127].map((vel) => {
                const y = padTop + (1 - vel / 127) * plotH;
                return (
                  <g key={vel}>
                    <line
                      x1={padLeft}
                      y1={y}
                      x2={padLeft + plotW}
                      y2={y}
                      stroke="currentColor"
                      className="text-slate-200 dark:text-slate-800"
                      strokeWidth="1"
                    />
                    <text
                      x={padLeft - 8}
                      y={y + 3}
                      textAnchor="end"
                      className="fill-slate-500 dark:fill-slate-400 text-[10px] font-mono"
                    >
                      {vel}
                    </text>
                  </g>
                );
              })}

              {points.map((_, idx) => {
                const x = padLeft + (idx / 8) * plotW;
                return (
                  <g key={idx}>
                    <line
                      x1={x}
                      y1={padTop}
                      x2={x}
                      y2={padTop + plotH}
                      stroke="currentColor"
                      className="text-slate-200 dark:text-slate-800"
                      strokeWidth="1"
                    />
                    <text
                      x={x}
                      y={padTop + plotH + 18}
                      textAnchor="middle"
                      className="fill-slate-500 dark:fill-slate-400 text-[10px] font-mono"
                    >
                      P{idx + 1}
                    </text>
                  </g>
                );
              })}

              <line
                x1={padLeft}
                y1={padTop + plotH}
                x2={padLeft + plotW}
                y2={padTop}
                stroke="currentColor"
                className="text-slate-300 dark:text-slate-700"
                strokeDasharray="4 4"
                strokeWidth="1"
              />

              {/* MegaDrum module snapshot ghost curve when modified */}
              {snapCurve && activeSummary.state === 'modified' && (
                <polyline
                  fill="none"
                  stroke="#d97706"
                  strokeWidth="2"
                  strokeDasharray="5 4"
                  strokeLinejoin="round"
                  points={snapCurve.points
                    .map((val, idx) => {
                      const { x, y } = pointToSvg(idx, val);
                      return `${x.toFixed(1)},${y.toFixed(1)}`;
                    })
                    .join(' ')}
                />
              )}

              <polyline
                fill="none"
                stroke="#2563eb"
                strokeWidth="2.5"
                strokeLinejoin="round"
                points={points
                  .map((val, idx) => {
                    const { x, y } = pointToSvg(idx, val);
                    return `${x.toFixed(1)},${y.toFixed(1)}`;
                  })
                  .join(' ')}
              />

              <line
                x1={testSvgPos.x}
                y1={padTop}
                x2={testSvgPos.x}
                y2={padTop + plotH}
                stroke="#16a34a"
                strokeWidth="1"
                strokeDasharray="2 2"
              />
              <circle
                cx={testSvgPos.x}
                cy={testSvgPos.y}
                r="5"
                className="fill-emerald-500 stroke-white dark:stroke-slate-900"
                strokeWidth="1.5"
              />

              {points.map((val, idx) => {
                const { x, y } = pointToSvg(idx, val);
                const ptSync = getCurvePointSync(points, snapCurve, idx);
                return (
                  <g
                    key={idx}
                    onPointerDown={(e) => {
                      e.currentTarget.setPointerCapture(e.pointerId);
                      setDraggingPointIdx(idx);
                    }}
                    className="cursor-ns-resize"
                  >
                    <circle
                      cx={x}
                      cy={y}
                      r={draggingPointIdx === idx ? 7 : 5.5}
                      className={`${
                        ptSync.state === 'modified' ? 'fill-amber-600' : 'fill-blue-600'
                      } stroke-white dark:stroke-[#0B0E14]`}
                      strokeWidth="2"
                    />
                  </g>
                );
              })}
            </svg>
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-9 gap-2">
            {points.map((val, idx) => {
              const ptSync = getCurvePointSync(points, snapCurve, idx);
              return (
                <div key={idx} className="space-y-1">
                  <div className="flex items-center justify-between px-0.5">
                    <label
                      className={`text-[11px] font-mono ${syncLabelClass(ptSync.state)}`}
                    >
                      P{idx + 1}
                    </label>
                    {ptSync.state === 'modified' && ptSync.moduleValue !== undefined && (
                      <button
                        type="button"
                        onClick={() => {
                          const next = [...points];
                          next[idx] = ptSync.moduleValue!;
                          onUpdateCurve(selectedCurveId, next);
                        }}
                        title={`Revert P${idx + 1} to MegaDrum value (${ptSync.moduleValue})`}
                        className="text-[10px] font-mono tabular-nums text-amber-700 dark:text-amber-400 hover:underline"
                      >
                        {ptSync.moduleValue}
                      </button>
                    )}
                  </div>
                  <input
                    type="number"
                    min={2}
                    max={255}
                    value={val}
                    onChange={(e) => {
                      const next = [...points];
                      next[idx] = Math.max(2, Math.min(255, Number(e.target.value) || 2));
                      onUpdateCurve(selectedCurveId, next);
                    }}
                    className={`w-full px-1 py-1 text-center text-xs font-mono tabular-nums bg-slate-50 dark:bg-[#0E121A] border rounded ${syncInputClass(
                      ptSync.state
                    )}`}
                  />
                </div>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-3 flex-1 min-w-[220px]">
              <span className="text-xs font-medium text-slate-600 dark:text-slate-400 whitespace-nowrap">
                Simulate Strike Force
              </span>
              <input
                type="range"
                min={0}
                max={100}
                value={testInputForce}
                onChange={(e) => setTestInputForce(Number(e.target.value))}
                className="flex-1 h-1.5 bg-slate-200 dark:bg-slate-800 rounded-lg cursor-pointer"
              />
            </div>
            <div className="text-xs font-mono tabular-nums text-slate-600 dark:text-slate-300">
              Input {testInputForce}% → Output MIDI Velocity{' '}
              <strong className="text-emerald-600 dark:text-emerald-400">
                {testSvgPos.outVel}
              </strong>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
};
