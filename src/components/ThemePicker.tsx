import React, { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Monitor, Moon, Sun } from 'lucide-react';
import { AppThemeId, THEME_OPTIONS } from '../utils/theme';

interface ThemePickerProps {
  theme: AppThemeId;
  effectiveTheme: Exclude<AppThemeId, 'system'>;
  onSelectTheme: (theme: AppThemeId) => void;
}

export const ThemePicker: React.FC<ThemePickerProps> = ({
  theme,
  effectiveTheme,
  onSelectTheme,
}) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const activeOpt = THEME_OPTIONS.find((t) => t.id === theme) || THEME_OPTIONS[2];
  const isDarkEffective = effectiveTheme === 'dark' || effectiveTheme === 'midnight';

  const ActiveIcon =
    theme === 'system' ? Monitor : isDarkEffective ? Moon : Sun;

  return (
    <div ref={containerRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        title="Choose UI theme (Light, Warm, Dark, Midnight, or System)"
        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 bg-[var(--md-control)] border border-[var(--md-border-strong)] rounded hover:bg-[var(--md-hover)] transition-colors whitespace-nowrap shrink-0"
      >
        <ActiveIcon className="w-3.5 h-3.5 text-slate-600 dark:text-slate-300 shrink-0" />
        <span>{activeOpt.shortLabel}</span>
        <ChevronDown
          className={`w-3 h-3 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div
          role="menu"
          aria-label="UI Theme Selector"
          className="absolute right-0 mt-1.5 w-64 rounded-lg border border-[var(--md-border-strong)] bg-[var(--md-panel)] shadow-lg z-50 overflow-hidden"
        >
          {/* Quick Light / Dark / System Mode Strip */}
          <div className="p-2 border-b border-[var(--md-border)] bg-[var(--md-inset)]">
            <div className="grid grid-cols-3 gap-1 p-0.5 rounded-md bg-[var(--md-toolbar)] border border-[var(--md-border)]">
              {(
                [
                  { id: 'light' as AppThemeId, label: 'Light', icon: Sun },
                  { id: 'dark' as AppThemeId, label: 'Dark', icon: Moon },
                  { id: 'system' as AppThemeId, label: 'Auto', icon: Monitor },
                ] as const
              ).map((item) => {
                const Icon = item.icon;
                const active =
                  item.id === 'light'
                    ? theme === 'light' || theme === 'warm'
                    : item.id === 'dark'
                    ? theme === 'dark' || theme === 'midnight'
                    : theme === 'system';
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      onSelectTheme(item.id);
                      setOpen(false);
                    }}
                    className={`inline-flex items-center justify-center gap-1 py-1 text-[11px] font-medium rounded transition-colors ${
                      active
                        ? 'bg-[var(--md-panel)] text-slate-900 dark:text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <Icon className="w-3 h-3" />
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* All Studio Theme Presets */}
          <div className="py-1 divide-y divide-[var(--md-border)]">
            {THEME_OPTIONS.map((opt) => {
              const selected = theme === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  role="menuitemradio"
                  aria-checked={selected}
                  onClick={() => {
                    onSelectTheme(opt.id);
                    setOpen(false);
                  }}
                  className={`w-full px-3 py-2 text-left flex items-center gap-2.5 transition-colors ${
                    selected
                      ? 'bg-blue-50/70 dark:bg-blue-950/35'
                      : 'hover:bg-[var(--md-hover)]'
                  }`}
                >
                  {/* Dual-tone Swatch Preview */}
                  <span
                    className="w-6 h-6 rounded border shrink-0 overflow-hidden grid grid-cols-2"
                    style={{ borderColor: opt.swatchBorder }}
                    aria-hidden="true"
                  >
                    {opt.id === 'system' ? (
                      <>
                        <span className="h-full bg-slate-100" />
                        <span className="h-full bg-[#0b0e14]" />
                      </>
                    ) : (
                      <>
                        <span
                          className="h-full"
                          style={{ backgroundColor: opt.swatchCanvas }}
                        />
                        <span
                          className="h-full flex items-end justify-end p-0.5"
                          style={{ backgroundColor: opt.swatchPanel }}
                        >
                          <span
                            className="w-1.5 h-1.5 rounded-xs"
                            style={{ backgroundColor: opt.swatchAccent }}
                          />
                        </span>
                      </>
                    )}
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-medium text-slate-900 dark:text-slate-100 truncate">
                      {opt.label}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                      {opt.id === 'system'
                        ? `Currently ${effectiveTheme === 'dark' ? 'Dark' : 'Light'}`
                        : opt.description}
                    </div>
                  </div>

                  {selected && (
                    <Check className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
