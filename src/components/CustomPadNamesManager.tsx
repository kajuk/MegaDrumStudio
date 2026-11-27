import React from 'react';
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Check,
  HelpCircle,
  RefreshCw,
  Send,
  Tag,
} from 'lucide-react';
import { getMaxCustomPadNames } from '../types/megadrum';

export interface CustomPadNamesManagerProps {
  customNames: string[];
  snapCustomNames?: (string | null)[];
  mcuTypeId: number;
  customPadNamesEnabled: boolean;
  midiConnected: boolean;
  onUpdateCustomName: (index0Based: number, name: string) => void;
  onGetCustomName: (index0Based: number) => void;
  onSendCustomName: (index0Based: number, name: string) => void;
  onGetAllCustomNames: () => void;
  onSendAllCustomNames: () => void;
  onEnableCustomPadNames?: () => void;
  compact?: boolean;
}

export const CustomPadNamesManager: React.FC<CustomPadNamesManagerProps> = ({
  customNames,
  snapCustomNames,
  mcuTypeId,
  customPadNamesEnabled,
  midiConnected,
  onUpdateCustomName,
  onGetCustomName,
  onSendCustomName,
  onGetAllCustomNames,
  onSendAllCustomNames,
  onEnableCustomPadNames,
  compact = false,
}) => {
  const maxSlots = getMaxCustomPadNames(mcuTypeId);

  return (
    <div className="space-y-4">
      {/* Informational header banner */}
      {!customPadNamesEnabled && (
        <div className="p-3 rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 text-xs flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <HelpCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <span>
              <strong>Custom Pad Names are disabled</strong> in Global Module Settings (SysEx 0x09). Enable it so MegaDrum assigns and displays these EEPROM names.
            </span>
          </div>
          {onEnableCustomPadNames && (
            <button
              type="button"
              onClick={onEnableCustomPadNames}
              className="px-2.5 py-1 text-xs font-semibold rounded bg-amber-600 text-white hover:bg-amber-700 whitespace-nowrap"
            >
              Enable Custom Pad Names
            </button>
          )}
        </div>
      )}

      {/* Action Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-slate-100 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <Tag className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <h3 className="text-sm font-display font-semibold text-slate-900 dark:text-white">
              Custom EEPROM Pad Names ({maxSlots} Slots)
            </h3>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Slots 1–{maxSlots} map to Pad Name Index 73–{72 + maxSlots} (max 8 characters per name)
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onGetAllCustomNames}
            title={
              midiConnected
                ? `Query all ${maxSlots} custom pad names from MegaDrum via SysEx 0x08`
                : 'Connect MIDI to fetch custom names from hardware'
            }
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#141923] text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap"
          >
            <ArrowDownToLine className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            Get All (0x08)
          </button>
          <button
            type="button"
            onClick={onSendAllCustomNames}
            title={
              midiConnected
                ? `Send and verify all ${maxSlots} custom pad names to MegaDrum EEPROM via SysEx 0x08`
                : 'Connect MIDI to upload custom names to hardware'
            }
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded bg-blue-600 text-white hover:bg-blue-700 whitespace-nowrap"
          >
            <ArrowUpFromLine className="w-3.5 h-3.5" />
            Send All (0x08)
          </button>
        </div>
      </div>

      {/* Grid of Custom Name Slots */}
      <div
        className={`grid gap-2.5 ${
          compact
            ? 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3'
            : 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4'
        }`}
      >
        {Array.from({ length: maxSlots }, (_, idx) => {
          const slotNum = idx + 1;
          const padNameIndex = 73 + idx;
          const currentVal = customNames[idx] || '';
          const snapVal = snapCustomNames?.[idx];
          const isModified = snapVal !== null && snapVal !== undefined && snapVal !== currentVal;
          const isSynced = snapVal !== null && snapVal !== undefined && snapVal === currentVal;

          return (
            <div
              key={idx}
              className={`p-2.5 rounded-lg border transition-colors ${
                isModified
                  ? 'bg-amber-50/50 dark:bg-amber-950/20 border-amber-300 dark:border-amber-800'
                  : 'bg-[var(--md-control-alt)] border-[var(--md-border)]'
              }`}
            >
              <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 dark:text-slate-400 mb-1.5">
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  Custom {slotNum}
                </span>
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-200/60 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                  Idx {padNameIndex}
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  maxLength={8}
                  value={currentVal}
                  placeholder={`Custom${slotNum}`}
                  onChange={(e) => onUpdateCustomName(idx, e.target.value.slice(0, 8))}
                  className="flex-1 min-w-0 px-2 py-1 text-xs font-mono rounded border border-[var(--md-border-strong)] bg-white dark:bg-[#0B0E14] text-slate-900 dark:text-white uppercase placeholder:normal-case placeholder:text-slate-400"
                />

                <button
                  type="button"
                  onClick={() => onGetCustomName(idx)}
                  title={`Read Slot ${slotNum} (0x08) from MegaDrum`}
                  className="p-1 rounded border border-[var(--md-border)] hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 shrink-0"
                >
                  <RefreshCw className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  onClick={() => onSendCustomName(idx, currentVal)}
                  title={`Send Slot ${slotNum} "${currentVal}" (0x08) to MegaDrum`}
                  className="p-1 rounded bg-blue-600 hover:bg-blue-700 text-white shrink-0"
                >
                  <Send className="w-3 h-3" />
                </button>
              </div>

              {/* Status and Diff hint */}
              <div className="flex items-center justify-between mt-1 text-[10px]">
                {isModified ? (
                  <span className="text-amber-700 dark:text-amber-400 font-mono truncate" title={`Hardware: "${snapVal}"`}>
                    MD: &quot;{snapVal}&quot;
                  </span>
                ) : isSynced ? (
                  <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                    <Check className="w-2.5 h-2.5" /> Synced
                  </span>
                ) : (
                  <span className="text-slate-400 dark:text-slate-500 italic">Not read</span>
                )}
                <span className="text-slate-400 dark:text-slate-500 font-mono tabular-nums">
                  {currentVal.length}/8
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
