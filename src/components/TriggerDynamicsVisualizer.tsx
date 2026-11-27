import React, { useMemo } from 'react';
import { PAD_DYN_TIME_VALUES, PadConfig } from '../types/megadrum';

interface TriggerDynamicsVisualizerProps {
  pad: PadConfig;
  lastVelocity?: number;
}

export const TriggerDynamicsVisualizer: React.FC<TriggerDynamicsVisualizerProps> = ({
  pad,
  lastVelocity,
}) => {
  const dynTimeMs = PAD_DYN_TIME_VALUES[pad.dynTime] ?? pad.dynTime * 4;

  const { wavePath, dynEnvelopePath, thresholdY, minScanX, retriggerX, highLevelY } =
    useMemo(() => {
      const width = 460;
      const padBottom = 114;
      const padTop = 14;
      const usableH = padBottom - padTop;

      const threshRatio = Math.min(0.85, pad.threshold / 127);
      const threshY = padBottom - threshRatio * usableH * 0.72;

      const highRatio = Math.max(0.25, Math.min(1, pad.levelMax / 1023));
      const hlY = padBottom - highRatio * usableH;

      const msToX = (ms: number) => 28 + (ms / 80) * (width - 42);
      const minScanMs = Math.max(2, pad.minScan * 0.2);
      const retrigMs = Math.max(minScanMs + 2, pad.retrigger * 0.5);

      const pts: string[] = [];
      const peakAmp = (lastVelocity ? lastVelocity / 127 : 0.82) * usableH * highRatio;
      for (let ms = 0; ms <= 80; ms += 0.8) {
        const x = msToX(ms);
        let env = 0;
        if (ms < 3.5) {
          env = Math.sin((ms / 3.5) * (Math.PI / 2));
        } else {
          env = Math.exp(-(ms - 3.5) / 14);
        }
        const ripple = ms > 18 && ms < 34 ? Math.exp(-Math.pow(ms - 24, 2) / 18) * 0.22 : 0;
        const osc = Math.abs(Math.cos(ms * 0.85)) * env + ripple;
        const y = Math.max(padTop, padBottom - osc * peakAmp);
        pts.push(`${ms === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`);
      }

      const dynPts: string[] = [];
      const dynJump = (pad.dynLevel / 15) * usableH * 0.65;
      const dynDecay = Math.max(4, dynTimeMs);
      for (let ms = 0; ms <= 80; ms += 1) {
        const x = msToX(ms);
        let y = threshY;
        if (ms >= minScanMs) {
          const dt = ms - minScanMs;
          const boost = dynJump * Math.exp(-dt / (dynDecay * 0.45));
          y = Math.max(padTop, threshY - boost);
        }
        dynPts.push(`${ms === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`);
      }

      return {
        wavePath: pts.join(' '),
        dynEnvelopePath: dynPts.join(' '),
        thresholdY: threshY,
        minScanX: msToX(minScanMs),
        retriggerX: msToX(retrigMs),
        highLevelY: hlY,
      };
    }, [pad.threshold, pad.levelMax, pad.minScan, pad.retrigger, pad.dynLevel, dynTimeMs, lastVelocity]);

  return (
    <div className="border border-[var(--md-border)] rounded-lg bg-[var(--md-inset)] p-3">
      <div className="flex items-center justify-between gap-4 mb-2">
        <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
          Piezo Transient &amp; Dynamic Masking Preview
        </span>
        <div className="flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
          <span>MinScan {(pad.minScan * 0.2).toFixed(1)}ms</span>
          <span aria-hidden="true">·</span>
          <span>Mask {(pad.retrigger * 0.5).toFixed(1)}ms</span>
          <span aria-hidden="true">·</span>
          <span>Dyn {dynTimeMs}ms</span>
        </div>
      </div>

      <svg
        viewBox="0 0 460 132"
        className="w-full h-32 block select-none"
        role="img"
        aria-label="Piezo waveform and dynamic threshold visualization"
      >
        <line x1="28" y1="14" x2="28" y2="114" stroke="currentColor" className="text-slate-300 dark:text-slate-800" strokeWidth="1" />
        <line x1="28" y1="114" x2="446" y2="114" stroke="currentColor" className="text-slate-300 dark:text-slate-800" strokeWidth="1" />

        <rect
          x="28"
          y="14"
          width={Math.max(4, minScanX - 28)}
          height="100"
          className="fill-blue-500/12"
        />

        <rect
          x={minScanX}
          y="14"
          width={Math.max(2, retriggerX - minScanX)}
          height="100"
          className="fill-amber-500/10"
        />

        <line
          x1="28"
          y1={highLevelY}
          x2="446"
          y2={highLevelY}
          stroke="#64748b"
          strokeDasharray="3 3"
          strokeWidth="1"
        />
        <text x="32" y={Math.max(12, highLevelY - 3)} className="fill-slate-500 text-[9px] font-mono">
          HighLevel {pad.levelMax}
        </text>

        <line
          x1="28"
          y1={thresholdY}
          x2="446"
          y2={thresholdY}
          stroke="#dc2626"
          strokeDasharray="4 3"
          strokeWidth="1"
          opacity="0.7"
        />

        <path
          d={wavePath}
          fill="none"
          stroke="#2563eb"
          strokeWidth="1.75"
          strokeLinejoin="round"
        />

        <path
          d={dynEnvelopePath}
          fill="none"
          stroke="#d97706"
          strokeWidth="1.5"
          strokeDasharray="2 2"
        />

        <text x="28" y="126" className="fill-slate-500 dark:fill-slate-400 text-[9px] font-mono">
          0ms
        </text>
        <text x="225" y="126" className="fill-slate-500 dark:fill-slate-400 text-[9px] font-mono">
          40ms
        </text>
        <text x="424" y="126" className="fill-slate-500 dark:fill-slate-400 text-[9px] font-mono">
          80ms
        </text>
      </svg>

      <div className="mt-1.5 flex flex-wrap items-center gap-4 text-[11px] text-slate-500 dark:text-slate-400">
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2.5 h-0.5 bg-blue-600 inline-block" /> Piezo Signal
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2.5 h-0.5 bg-amber-600 inline-block" /> Dynamic Threshold
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2.5 h-0.5 bg-red-600 inline-block" /> Noise Floor ({pad.threshold})
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2.5 h-2 bg-blue-500/20 inline-block" /> MinScan Peak Window
        </span>
      </div>
    </div>
  );
};
