import React, { useEffect } from 'react';
import { AlertCircle, ExternalLink, KeyRound, Loader2, X } from 'lucide-react';
import { MidiPermissionIssue } from '../hooks/useWebMidi';

interface MidiAlertModalProps {
  open: boolean;
  title: string;
  alertText: string;
  isPermissionAlert: boolean;
  permissionIssue: MidiPermissionIssue;
  permissionRequesting: boolean;
  permissionAttemptCount: number;
  midiSupported: boolean;
  isInIframe: boolean;
  isFirefox: boolean;
  onRequestPermission: () => void;
  onDismiss: () => void;
}

export const MidiAlertModal: React.FC<MidiAlertModalProps> = ({
  open,
  title,
  alertText,
  isPermissionAlert,
  permissionIssue,
  permissionRequesting,
  permissionAttemptCount,
  midiSupported,
  isInIframe,
  isFirefox,
  onRequestPermission,
  onDismiss,
}) => {
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onDismiss();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onDismiss]);

  if (!open) return null;

  const standaloneUrl = typeof window !== 'undefined' ? window.location.href : '#';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="midi-alert-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-[2px]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) {
          onDismiss();
        }
      }}
    >
      <div className="w-full max-w-lg rounded-xl border border-red-500/45 dark:border-red-400/35 bg-[var(--md-panel)] text-slate-900 dark:text-slate-100 shadow-2xl p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5 min-w-0">
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <h2
                id="midi-alert-modal-title"
                className="text-sm font-display font-semibold text-slate-900 dark:text-white leading-snug"
              >
                {title}
              </h2>
              {permissionIssue !== 'none' && (
                <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                  {permissionIssue === 'backend_error'
                    ? 'Unable to open WebMIDI access or detect active MIDI devices'
                    : 'This alert can appear if WebMIDI permission is not granted yet or if no MIDI devices are detected'}
                </p>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={onDismiss}
            title="Dismiss"
            aria-label="Close modal"
            className="p-1 rounded text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-[var(--md-hover)] transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="rounded-lg border border-[var(--md-border)] bg-[var(--md-inset)] p-3.5 space-y-2 text-xs leading-relaxed text-slate-700 dark:text-slate-200">
          <p>{alertText}</p>

          {isPermissionAlert && (
            <>
              <p className="text-[11px] text-slate-600 dark:text-slate-300">
                <strong className="text-slate-900 dark:text-white">Note:</strong> Browsers block
                hardware enumeration until WebMIDI permission is granted, and in some setups
                (especially Firefox on Windows) a missing prompt or permission error can also happen
                when{' '}
                <strong className="text-slate-900 dark:text-white">
                  no MIDI devices are connected or detected
                </strong>
                . Make sure your MegaDrum is powered on and plugged in via USB before requesting
                permission.
              </p>

              {isInIframe ? (
                <p className="text-[11px] text-slate-600 dark:text-slate-300">
                  Embedded preview frames block browser WebMIDI prompts and Firefox&apos;s site
                  permission add-on installer. Open this studio in a{' '}
                  <strong className="text-slate-900 dark:text-white">Standalone Tab</strong>, allow
                  the WebMIDI prompt, then click{' '}
                  <strong className="text-slate-900 dark:text-white">Connect MIDI</strong>.
                </p>
              ) : isFirefox ? (
                <p className="text-[11px] text-slate-600 dark:text-slate-300">
                  In Firefox on Windows: click{' '}
                  <strong className="text-slate-900 dark:text-white">
                    Request WebMIDI Permission
                  </strong>
                  , then accept{' '}
                  <strong className="text-slate-900 dark:text-white">
                    Continue to Installation → Add
                  </strong>{' '}
                  in the address bar. If no popup appears, check the{' '}
                  <strong className="text-slate-900 dark:text-white">puzzle / lock icon</strong> in
                  the address bar, verify this is not a Private Browsing window, or check{' '}
                  <code className="px-1 py-0.5 rounded bg-[var(--md-panel)] border border-[var(--md-border)] font-mono">
                    about:addons
                  </code>{' '}
                  → <strong className="text-slate-900 dark:text-white">Site Permissions</strong>.
                </p>
              ) : (
                <p className="text-[11px] text-slate-600 dark:text-slate-300">
                  Click{' '}
                  <strong className="text-slate-900 dark:text-white">
                    Request WebMIDI Permission
                  </strong>
                  , or click the site-settings icon in your browser&apos;s address bar to allow{' '}
                  <strong className="text-slate-900 dark:text-white">MIDI devices (SysEx)</strong>.
                </p>
              )}

              {permissionAttemptCount > 0 && !permissionRequesting && (
                <p className="font-mono tabular-nums text-[11px] text-red-600 dark:text-red-400">
                  Browser declined without opening a dialog (attempt #{permissionAttemptCount}).{' '}
                  {isInIframe
                    ? 'Use Open in Standalone Tab.'
                    : 'Verify a MIDI device is connected and check the address-bar permissions/puzzle icon or about:addons → Site Permissions.'}
                </p>
              )}
            </>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onDismiss}
            className="px-3 py-1.5 text-xs font-medium rounded border border-[var(--md-border-strong)] bg-[var(--md-control)] text-slate-700 dark:text-slate-200 hover:bg-[var(--md-hover)] whitespace-nowrap shrink-0 transition-colors"
          >
            Dismiss
          </button>

          {isPermissionAlert && midiSupported && (
            <button
              type="button"
              disabled={permissionRequesting}
              onClick={onRequestPermission}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded border border-[var(--md-border-strong)] bg-[var(--md-control)] text-slate-900 dark:text-white hover:bg-[var(--md-hover)] disabled:opacity-60 whitespace-nowrap shrink-0 transition-colors"
            >
              {permissionRequesting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
              ) : (
                <KeyRound className="w-3.5 h-3.5 shrink-0" />
              )}
              {permissionRequesting ? 'Waiting for prompt...' : 'Request WebMIDI Permission'}
            </button>
          )}

          {isPermissionAlert && isInIframe && (
            <a
              href={standaloneUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded bg-red-600 text-white hover:bg-red-700 whitespace-nowrap shrink-0 transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5 shrink-0" />
              Open in Standalone Tab
            </a>
          )}
        </div>
      </div>
    </div>
  );
};
