import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Cpu,
  ExternalLink,
  HardDrive,
  KeyRound,
  Loader2,
  X,
} from 'lucide-react';

export type ConnectionPopupData =
  | {
      id: number;
      status: 'success';
      firmwareVersion: string;
      hardwareName: string;
      chainId: number;
      portsLabel?: string;
    }
  | {
      id: number;
      status: 'error';
      title: string;
      message: string;
      canRequestPermission?: boolean;
    };

interface ConnectionStatusPopupProps {
  popup: ConnectionPopupData | null;
  onDismiss: () => void;
  onRequestPermission?: () => void;
  isInIframe?: boolean;
  isFirefox?: boolean;
  permissionRequesting?: boolean;
}

const HOLD_VISIBLE_MS = 5000;
const FADE_DURATION_MS = 3000;

export const ConnectionStatusPopup: React.FC<ConnectionStatusPopupProps> = ({
  popup,
  onDismiss,
  onRequestPermission,
  isInIframe = false,
  isFirefox = false,
  permissionRequesting = false,
}) => {
  const [phase, setPhase] = useState<'entering' | 'visible' | 'fading'>('entering');

  useEffect(() => {
    if (!popup) return;

    setPhase('entering');
    let fadeTimer = 0;
    let removeTimer = 0;

    const rafId = window.requestAnimationFrame(() => {
      setPhase('visible');
      fadeTimer = window.setTimeout(() => {
        setPhase('fading');
      }, HOLD_VISIBLE_MS);
      removeTimer = window.setTimeout(() => {
        onDismiss();
      }, HOLD_VISIBLE_MS + FADE_DURATION_MS);
    });

    return () => {
      window.cancelAnimationFrame(rafId);
      window.clearTimeout(fadeTimer);
      window.clearTimeout(removeTimer);
    };
  }, [popup, onDismiss]);

  if (!popup) return null;

  const isSuccess = popup.status === 'success';
  const motionClass =
    phase === 'entering'
      ? 'opacity-0 translate-y-2 scale-95 transition-all duration-200 ease-out'
      : phase === 'visible'
      ? 'opacity-100 translate-y-0 scale-100 transition-all duration-200 ease-out'
      : 'opacity-0 -translate-y-1 scale-[0.98] transition-all duration-[3000ms] ease-out';

  return (
    <div
      role={isSuccess ? 'status' : 'alert'}
      aria-live={isSuccess ? 'polite' : 'assertive'}
      className="fixed inset-0 z-50 flex items-center justify-center px-4 pointer-events-none"
    >
      <div
        style={{
          backgroundColor: 'color-mix(in srgb, var(--md-panel) 84%, transparent)',
        }}
        className={`pointer-events-auto w-full max-w-md rounded-xl border backdrop-blur-md shadow-2xl p-5 ${
          isSuccess
            ? 'border-emerald-500/45 dark:border-emerald-400/35'
            : 'border-red-500/50 dark:border-red-400/40'
        } ${motionClass}`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            {isSuccess ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0" />
            )}
            <h2 className="text-sm font-display font-semibold text-slate-900 dark:text-white truncate">
              {isSuccess ? 'MegaDrum Connected' : popup.title}
            </h2>
          </div>

          <button
            type="button"
            onClick={onDismiss}
            title="Dismiss"
            aria-label="Dismiss connection status"
            className="p-1 rounded text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-[var(--md-hover)] transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {isSuccess ? (
          <div className="mt-4 space-y-2.5">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-[var(--md-border)] bg-[var(--md-inset)]/80 px-3 py-2.5">
                <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  <HardDrive className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                  <span>Firmware Version</span>
                </div>
                <div className="mt-1 text-sm font-mono font-semibold tabular-nums text-slate-900 dark:text-white truncate">
                  {popup.firmwareVersion}
                </div>
              </div>

              <div className="rounded-lg border border-[var(--md-border)] bg-[var(--md-inset)]/80 px-3 py-2.5">
                <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  <Cpu className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                  <span>Hardware / MCU</span>
                </div>
                <div className="mt-1 text-sm font-mono font-semibold tabular-nums text-slate-900 dark:text-white truncate">
                  {popup.hardwareName}
                </div>
              </div>
            </div>

            <div className="pt-1 flex items-center justify-between gap-3">
              <div className="text-[11px] text-slate-500 dark:text-slate-400 flex flex-wrap items-center gap-1.5 min-w-0">
                <span>Chain ID {popup.chainId}</span>
                {popup.portsLabel && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="truncate">{popup.portsLabel}</span>
                  </>
                )}
              </div>
              <button
                type="button"
                onClick={onDismiss}
                className="px-2.5 py-1 text-xs font-medium rounded border border-[var(--md-border-strong)] bg-[var(--md-control)] text-slate-700 dark:text-slate-200 hover:bg-[var(--md-hover)] whitespace-nowrap shrink-0 transition-colors"
              >
                Dismiss
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-3 space-y-3">
            <p className="text-xs leading-relaxed text-slate-700 dark:text-slate-300">
              {popup.message}
            </p>
            {popup.canRequestPermission && (
              <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                {isInIframe
                  ? 'If your browser blocks WebMIDI prompts inside this embedded frame, open the studio in a standalone tab first.'
                  : isFirefox
                  ? 'Click Request WebMIDI Permission and accept Firefox’s address bar add-on prompt (or enable Site Permissions via the lock/puzzle icon).'
                  : 'Click Request WebMIDI Permission or enable MIDI devices (SysEx) in your browser’s address bar settings.'}
              </p>
            )}
            <div className="flex flex-wrap items-center justify-end gap-2">
              {popup.canRequestPermission && onRequestPermission && (
                <button
                  type="button"
                  disabled={permissionRequesting}
                  onClick={onRequestPermission}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60 whitespace-nowrap transition-colors"
                >
                  {permissionRequesting ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                  ) : (
                    <KeyRound className="w-3.5 h-3.5 shrink-0" />
                  )}
                  {permissionRequesting ? 'Waiting...' : 'Request WebMIDI Permission'}
                </button>
              )}
              {popup.canRequestPermission && isInIframe && (
                <a
                  href={typeof window !== 'undefined' ? window.location.href : '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded border border-[var(--md-border-strong)] bg-[var(--md-control)] text-slate-700 dark:text-slate-200 hover:bg-[var(--md-hover)] whitespace-nowrap transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                  Open Standalone Tab
                </a>
              )}
              <button
                type="button"
                onClick={onDismiss}
                className="px-2.5 py-1 text-xs font-medium rounded border border-[var(--md-border-strong)] bg-[var(--md-control)] text-slate-700 dark:text-slate-200 hover:bg-[var(--md-hover)] whitespace-nowrap transition-colors"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
