import React, { useEffect } from 'react';
import { Tag, X } from 'lucide-react';
import { CustomPadNamesManager, CustomPadNamesManagerProps } from './CustomPadNamesManager';

interface CustomPadNamesModalProps extends CustomPadNamesManagerProps {
  open: boolean;
  onDismiss: () => void;
}

export const CustomPadNamesModal: React.FC<CustomPadNamesModalProps> = ({
  open,
  onDismiss,
  ...managerProps
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

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="custom-pad-names-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-[2px]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) {
          onDismiss();
        }
      }}
    >
      <div className="relative w-full max-w-4xl max-h-[85vh] rounded-xl border border-[var(--md-border)] bg-[var(--md-panel)] shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="px-5 py-4 border-b border-[var(--md-border)] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <Tag className="w-4 h-4" />
            </div>
            <div>
              <h2
                id="custom-pad-names-modal-title"
                className="text-sm font-display font-semibold text-slate-900 dark:text-white"
              >
                Custom EEPROM Pad Names Manager (SysEx 0x08)
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Configure, read, and write 8-character hardware names stored in MegaDrum non-volatile EEPROM
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onDismiss}
            className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto max-h-[calc(85vh-120px)]">
          <CustomPadNamesManager {...managerProps} />
        </div>

        <div className="px-5 py-3 border-t border-[var(--md-border)] bg-[var(--md-control-alt)] flex items-center justify-end">
          <button
            type="button"
            onClick={onDismiss}
            className="px-4 py-1.5 text-xs font-semibold rounded bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:opacity-90 transition-opacity"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
