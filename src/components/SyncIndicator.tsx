import React from 'react';
import { Check, HelpCircle, RotateCcw } from 'lucide-react';
import { FieldSyncInfo, ParamSyncState } from '../types/megadrum';

export function syncInputClass(state?: ParamSyncState): string {
  if (state === 'modified') {
    return 'border-amber-500 dark:border-amber-500/80 bg-amber-50/40 dark:bg-amber-950/20 text-amber-950 dark:text-amber-100';
  }
  if (state === 'unknown') {
    return 'border-sky-300/80 dark:border-sky-800/80 border-dashed text-sky-950 dark:text-sky-100';
  }
  return 'border-[var(--md-border-strong)] text-slate-900 dark:text-slate-100';
}

export function syncLabelClass(state?: ParamSyncState): string {
  if (state === 'modified') {
    return 'text-amber-700 dark:text-amber-400 font-semibold';
  }
  if (state === 'unknown') {
    return 'text-sky-700 dark:text-sky-400';
  }
  return 'text-slate-600 dark:text-slate-400';
}

interface ParamLabelRowProps {
  label: string;
  sync?: FieldSyncInfo<number | boolean | string>;
  formatModuleValue?: (val: number | boolean | string) => string;
  onRevert?: () => void;
}

export const ParamLabelRow: React.FC<ParamLabelRowProps> = ({
  label,
  sync,
  formatModuleValue,
  onRevert,
}) => {
  const state = sync?.state ?? 'in_sync';
  const modText =
    state === 'modified' && sync?.moduleValue !== undefined
      ? formatModuleValue
        ? formatModuleValue(sync.moduleValue)
        : String(sync.moduleValue)
      : null;

  return (
    <div className="flex items-center justify-between gap-2 min-w-0">
      <span className={`text-xs font-medium truncate ${syncLabelClass(state)}`}>
        {label}
      </span>
      {state === 'modified' && modText !== null && (
        <button
          type="button"
          onClick={onRevert}
          disabled={!onRevert}
          title={onRevert ? `Click to revert to MegaDrum value (${modText})` : `MegaDrum value: ${modText}`}
          className="text-[11px] font-mono tabular-nums text-amber-700 dark:text-amber-400 hover:underline shrink-0 disabled:no-underline disabled:cursor-default"
        >
          MD:{modText}
        </button>
      )}
    </div>
  );
};

interface SectionSyncBannerProps {
  state: ParamSyncState;
  diffCount?: number;
  unknownLabel?: string;
  onRevert?: () => void;
}

export const SectionSyncBanner: React.FC<SectionSyncBannerProps> = ({
  state,
  diffCount = 0,
  unknownLabel = 'Sync unknown · Get or Send to verify against MegaDrum',
  onRevert,
}) => {
  if (state === 'in_sync') {
    return (
      <div className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400 whitespace-nowrap">
        <Check className="w-3.5 h-3.5 shrink-0" />
        <span>In sync with MegaDrum</span>
      </div>
    );
  }

  if (state === 'modified') {
    return (
      <div className="inline-flex items-center gap-2.5 text-xs whitespace-nowrap">
        <span className="font-medium text-amber-700 dark:text-amber-400 tabular-nums">
          Not in sync · {diffCount} modified
        </span>
        {onRevert && (
          <button
            type="button"
            onClick={onRevert}
            className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white underline-offset-2 hover:underline"
          >
            <RotateCcw className="w-3 h-3" />
            Revert to MD
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="inline-flex items-center gap-1.5 text-xs font-medium text-sky-700 dark:text-sky-400 whitespace-nowrap">
      <HelpCircle className="w-3.5 h-3.5 shrink-0" />
      <span>{unknownLabel}</span>
    </div>
  );
};
