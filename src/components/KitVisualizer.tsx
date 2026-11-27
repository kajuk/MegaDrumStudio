import React from 'react';
import { ActiveHit, PadConfig } from '../types/megadrum';

interface KitVisualizerProps {
  pads: PadConfig[];
  selectedPairIndex: number; // 0 = Kick (In 1), 1..27 = Stereo Pairs
  activeHit: ActiveHit | null;
  onSelectPair: (pairIdx: number) => void;
  onTriggerPad: (padId: number, zone?: 'head' | 'rim' | 'bell') => void;
}

interface KitPiece {
  pairIdx: number;
  padId: number; // 1-based even input (or 1 for Kick)
  label: string;
  shape: 'circle' | 'cymbal' | 'kick' | 'hihat';
  cx: number;
  cy: number;
  r: number;
}

// Aligned with MegaDrum stereo pair jack layout:
// Pair 0 = In 1 (Kick), Pair 1 = In 2+3 (HiHat), Pair 2 = In 4+5 (Snare),
// Pair 3 = In 6+7 (Ride), Pair 4 = In 8+9 (Crash 1), Pair 5..7 = Tom 1..3, Pair 8 = Crash 2
const KIT_LAYOUT: KitPiece[] = [
  { pairIdx: 4, padId: 8, label: 'Crash 1', shape: 'cymbal', cx: 112, cy: 62, r: 40 },
  { pairIdx: 8, padId: 16, label: 'Crash 2', shape: 'cymbal', cx: 438, cy: 62, r: 40 },
  { pairIdx: 3, padId: 6, label: 'Ride', shape: 'cymbal', cx: 512, cy: 138, r: 46 },
  { pairIdx: 1, padId: 2, label: 'Hi-Hat', shape: 'hihat', cx: 82, cy: 146, r: 34 },
  { pairIdx: 5, padId: 10, label: 'Tom 1', shape: 'circle', cx: 215, cy: 96, r: 32 },
  { pairIdx: 6, padId: 12, label: 'Tom 2', shape: 'circle', cx: 315, cy: 96, r: 34 },
  { pairIdx: 0, padId: 1, label: 'Kick', shape: 'kick', cx: 265, cy: 168, r: 30 },
  { pairIdx: 2, padId: 4, label: 'Snare', shape: 'circle', cx: 175, cy: 178, r: 40 },
  { pairIdx: 7, padId: 14, label: 'Tom 3', shape: 'circle', cx: 382, cy: 176, r: 38 },
  { pairIdx: 9, padId: 18, label: 'Aux 1', shape: 'cymbal', cx: 530, cy: 66, r: 30 },
  { pairIdx: 10, padId: 20, label: 'Aux 2', shape: 'circle', cx: 64, cy: 222, r: 22 },
  { pairIdx: 11, padId: 22, label: 'Aux 3', shape: 'circle', cx: 468, cy: 224, r: 22 },
];

export const KitVisualizer: React.FC<KitVisualizerProps> = ({
  pads,
  selectedPairIndex,
  activeHit,
  onSelectPair,
  onTriggerPad,
}) => {
  const isRecentlyHit = (padId: number, pairIdx: number) => {
    if (!activeHit || Date.now() - activeHit.timestamp >= 240) return false;
    if (pairIdx === 0) return activeHit.padId === 1;
    return activeHit.padId === padId || activeHit.padId === padId + 1;
  };

  return (
    <div className="border border-[var(--md-border)] rounded-lg bg-[var(--md-panel)] p-4">
      <div className="flex items-center justify-between gap-4 mb-2">
        <div>
          <h3 className="text-sm font-display font-semibold text-slate-900 dark:text-slate-100">
            Interactive Kit Map
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Click a pad/cymbal to configure Head/Rim/Bell zones · Double-click to audition
          </p>
        </div>
        <div className="text-xs font-mono text-slate-500 dark:text-slate-400 tabular-nums">
          {activeHit && Date.now() - activeHit.timestamp < 1500
            ? `Last Hit: In ${activeHit.padId} (${activeHit.zone}) · Vel ${activeHit.velocity}`
            : selectedPairIndex === 0
            ? 'Selected: In 1 (Kick)'
            : `Selected: Pair ${selectedPairIndex} (In ${selectedPairIndex * 2}+${selectedPairIndex * 2 + 1})`}
        </div>
      </div>

      <svg
        viewBox="0 0 600 264"
        className="w-full h-52 sm:h-60 select-none"
        role="img"
        aria-label="Interactive electronic drum kit layout"
      >
        <rect
          x="8"
          y="8"
          width="584"
          height="248"
          rx="10"
          className="fill-[var(--md-inset)] stroke-[var(--md-border)]"
          strokeWidth="1"
        />

        <path
          d="M 96 135 Q 265 55 465 135"
          fill="none"
          className="stroke-slate-300 dark:stroke-slate-700/70"
          strokeWidth="4"
          strokeLinecap="round"
        />

        {KIT_LAYOUT.map((piece) => {
          const pad = pads[piece.padId - 1];
          const selected = selectedPairIndex === piece.pairIdx;
          const hit = isRecentlyHit(piece.padId, piece.pairIdx);
          const displayLabel = pad?.name
            ? pad.name.replace(/\s+(Head|Bow)$/i, '').slice(0, 11)
            : piece.label;
          const noteNum = pad?.note ?? 0;
          const jackLabel =
            piece.pairIdx === 0 ? `In 1` : `In ${piece.padId}+${piece.padId + 1}`;

          if (piece.shape === 'kick') {
            return (
              <g
                key={piece.pairIdx}
                onClick={() => onSelectPair(piece.pairIdx)}
                onDoubleClick={() => onTriggerPad(piece.padId, 'head')}
                className="cursor-pointer group"
              >
                <rect
                  x={piece.cx - 32}
                  y={piece.cy - 22}
                  width="64"
                  height="44"
                  rx="8"
                  className={`transition-colors ${
                    hit
                      ? 'fill-emerald-500/25 stroke-emerald-500'
                      : selected
                      ? 'fill-blue-600/15 stroke-blue-500'
                      : 'fill-slate-200/80 dark:fill-slate-800 stroke-slate-400 dark:stroke-slate-600 group-hover:stroke-blue-400'
                  }`}
                  strokeWidth={selected || hit ? 2 : 1.5}
                />
                <text
                  x={piece.cx}
                  y={piece.cy - 2}
                  textAnchor="middle"
                  className="fill-slate-900 dark:fill-slate-100 text-[10px] font-semibold"
                >
                  {displayLabel}
                </text>
                <text
                  x={piece.cx}
                  y={piece.cy + 11}
                  textAnchor="middle"
                  className="fill-slate-500 dark:fill-slate-400 text-[9px] font-mono"
                >
                  {jackLabel} · #{noteNum}
                </text>
              </g>
            );
          }

          return (
            <g
              key={piece.pairIdx}
              onClick={() => onSelectPair(piece.pairIdx)}
              onDoubleClick={() => onTriggerPad(piece.padId, 'head')}
              className="cursor-pointer group"
            >
              <circle
                cx={piece.cx}
                cy={piece.cy}
                r={piece.r}
                className={`transition-colors ${
                  hit
                    ? 'fill-emerald-500/25 stroke-emerald-500'
                    : selected
                    ? 'fill-blue-600/15 stroke-blue-500'
                    : piece.shape === 'cymbal' || piece.shape === 'hihat'
                    ? 'fill-amber-500/10 dark:fill-amber-400/10 stroke-amber-500/50 dark:stroke-amber-400/40 group-hover:stroke-blue-400'
                    : 'fill-white dark:fill-[#161C28] stroke-slate-300 dark:stroke-slate-600 group-hover:stroke-blue-400'
                }`}
                strokeWidth={selected || hit ? 2.2 : 1.4}
              />

              <circle
                cx={piece.cx}
                cy={piece.cy}
                r={piece.shape === 'cymbal' || piece.shape === 'hihat' ? piece.r * 0.34 : piece.r * 0.74}
                className={`pointer-events-none ${
                  selected
                    ? 'fill-blue-500/10 stroke-blue-500/50'
                    : 'fill-transparent stroke-slate-300/80 dark:stroke-slate-700'
                }`}
                strokeWidth="1"
              />

              <text
                x={piece.cx}
                y={piece.cy - 2}
                textAnchor="middle"
                className="fill-slate-900 dark:fill-slate-100 text-[10px] font-semibold pointer-events-none"
              >
                {displayLabel}
              </text>
              <text
                x={piece.cx}
                y={piece.cy + 10}
                textAnchor="middle"
                className="fill-slate-500 dark:fill-slate-400 text-[9px] font-mono pointer-events-none"
              >
                {jackLabel} · #{noteNum}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};
