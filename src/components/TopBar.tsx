import React from 'react';
import { MidiConnectionPhase } from '../hooks/useWebMidi';

export type WorkspaceTab = 'pads' | 'pedal' | 'curves' | 'global' | 'sysex';

interface TopBarProps {
  activeTab: WorkspaceTab;
  onSelectTab: (tab: WorkspaceTab) => void;
  connectionPhase: MidiConnectionPhase;
  onPrimaryAction: () => void;
  syncFlash: boolean;
  isBusy: boolean;
}

const NAV_ITEMS: { id: WorkspaceTab; label: string }[] = [
  { id: 'pads', label: 'Kit & Pads' },
  { id: 'pedal', label: 'Hi-Hat Pedal' },
  { id: 'curves', label: 'Curves' },
  { id: 'global', label: 'Global & Misc' },
  { id: 'sysex', label: 'SysEx & Firmware' },
];

export const TopBar: React.FC<TopBarProps> = ({
  activeTab,
  onSelectTab,
  connectionPhase,
  onPrimaryAction,
  syncFlash,
  isBusy,
}) => {
  const isReady = connectionPhase === 'connected';

  const ctaLabel = isBusy
    ? 'Syncing...'
    : isReady
    ? syncFlash
      ? 'Sent All to MegaDrum'
      : 'Send All'
    : connectionPhase === 'no_ports' || connectionPhase === 'partial'
    ? 'Retry MIDI Ports'
    : 'Connect MIDI';

  const ctaClass = syncFlash
    ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
    : connectionPhase === 'error' || connectionPhase === 'sysex_blocked'
    ? 'bg-red-600 hover:bg-red-700 text-white'
    : 'bg-blue-600 hover:bg-blue-700 text-white';

  return (
    <header className="h-14 px-6 border-b border-[var(--md-border)] bg-[var(--md-header)] flex items-center justify-between gap-8 shrink-0">
      {/* Zone 1: Brand wordmark */}
      <button
        type="button"
        onClick={() => onSelectTab('pads')}
        className="text-base font-display font-bold tracking-tight text-slate-900 dark:text-slate-100 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
      >
        MegaDrum Studio
      </button>

      {/* Zone 2: Primary navigation links */}
      <nav aria-label="Primary Workspace" className="hidden md:flex items-center gap-6 h-full">
        {NAV_ITEMS.map((item) => {
          const active = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectTab(item.id)}
              className={`relative h-full px-1 text-sm font-medium transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                active
                  ? 'text-slate-900 dark:text-white'
                  : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              {item.label}
              {active && (
                <span className="absolute inset-x-0 bottom-0 h-0.5 bg-blue-600 dark:bg-blue-500" />
              )}
            </button>
          );
        })}
      </nav>

      {/* Mobile compact nav */}
      <div className="flex md:hidden items-center overflow-x-auto gap-3">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelectTab(item.id)}
            className={`text-xs font-medium whitespace-nowrap shrink-0 px-2 py-1 rounded ${
              activeTab === item.id
                ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Zone 3: Primary Action */}
      <div className="shrink-0">
        <button
          type="button"
          disabled={isBusy}
          onClick={onPrimaryAction}
          className={`px-4 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${ctaClass}`}
        >
          {ctaLabel}
        </button>
      </div>
    </header>
  );
};
