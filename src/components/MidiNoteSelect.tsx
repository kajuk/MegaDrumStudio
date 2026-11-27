import React from 'react';
import { Link2, Volume2 } from 'lucide-react';
import { FieldSyncInfo, formatMidiNote, GM_DRUM_MAP } from '../types/megadrum';
import { playDrumSound } from '../utils/drumAudio';
import { syncInputClass, syncLabelClass } from './SyncIndicator';

interface MidiNoteSelectProps {
  label: string;
  value: number;
  onChange: (note: number) => void;
  audioEnabled?: boolean;
  onPreview?: (note: number) => void;
  sync?: FieldSyncInfo<number>;
  onRevert?: () => void;
  disabled?: boolean;
  linked?: boolean;
  onToggleLinked?: (linked: boolean) => void;
  linkTitle?: string;
}

const COMMON_NOTES = Object.keys(GM_DRUM_MAP)
  .map(Number)
  .sort((a, b) => a - b);

export const MidiNoteSelect: React.FC<MidiNoteSelectProps> = ({
  label,
  value,
  onChange,
  audioEnabled = true,
  onPreview,
  sync,
  onRevert,
  disabled = false,
  linked = false,
  onToggleLinked,
  linkTitle = 'Lock to Main Note',
}) => {
  const { pitch, label: gmLabel } = formatMidiNote(value);
  const state = sync?.state ?? 'in_sync';
  const isLocked = disabled || linked;

  const handlePreview = () => {
    if (audioEnabled && value > 0) {
      playDrumSound(value, 108);
    }
    onPreview?.(value);
  };

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className={`text-xs font-medium truncate ${syncLabelClass(state)}`}>
            {label}
          </span>
          {onToggleLinked && (
            <label
              title={linkTitle}
              className={`inline-flex items-center gap-1 text-[10px] font-medium cursor-pointer select-none px-1 py-0.2 rounded transition-colors shrink-0 ${
                linked
                  ? 'text-blue-600 dark:text-blue-400 bg-blue-500/10'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <input
                type="checkbox"
                checked={linked}
                onChange={(e) => onToggleLinked(e.target.checked)}
                className="w-3 h-3 rounded border-slate-300 dark:border-slate-600 text-blue-600 cursor-pointer"
              />
              <Link2 className="w-2.5 h-2.5" />
              <span>Link</span>
            </label>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {state === 'modified' && sync?.moduleValue !== undefined && (
            <button
              type="button"
              onClick={onRevert}
              disabled={!onRevert}
              title={
                onRevert
                  ? `Revert to MegaDrum note #${sync.moduleValue}`
                  : `MegaDrum note #${sync.moduleValue}`
              }
              className="text-[11px] font-mono tabular-nums text-amber-700 dark:text-amber-400 hover:underline disabled:no-underline"
            >
              MD:{sync.moduleValue}
            </button>
          )}
          <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400 tabular-nums">
            {pitch}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-1.5">
        <input
          type="number"
          min={0}
          max={127}
          disabled={isLocked}
          value={value}
          onChange={(e) => {
            const n = Math.max(0, Math.min(127, Number(e.target.value) || 0));
            onChange(n);
          }}
          className={`w-14 px-2 py-1.5 text-xs font-mono tabular-nums bg-[var(--md-control)] border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60 disabled:cursor-not-allowed ${syncInputClass(
            state
          )}`}
        />
        <select
          aria-label={`${label} preset`}
          disabled={isLocked}
          value={GM_DRUM_MAP[value] ? value : -1}
          onChange={(e) => {
            const v = Number(e.target.value);
            if (v >= 0) onChange(v);
          }}
          className={`flex-1 min-w-0 px-2 py-1.5 text-xs bg-[var(--md-control)] border rounded truncate focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60 disabled:cursor-not-allowed ${syncInputClass(
            state
          )}`}
        >
          {!GM_DRUM_MAP[value] && <option value={-1}>{gmLabel}</option>}
          {COMMON_NOTES.map((n) => (
            <option key={n} value={n}>
              {n} · {GM_DRUM_MAP[n]}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={handlePreview}
          disabled={value === 0}
          title="Audition MIDI note"
          className="p-1.5 rounded border border-[var(--md-border-strong)] bg-[var(--md-control)] text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 disabled:opacity-40 transition-colors shrink-0"
        >
          <Volume2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
