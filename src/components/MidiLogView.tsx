import React, { useMemo, useState } from 'react';
import {
  Activity,
  ArrowRight,
  Check,
  Copy,
  Download,
  Pause,
  Play,
  Search,
  Terminal,
  Trash2,
} from 'lucide-react';
import {
  formatMidiNote,
  MegaDrumConfig,
  MidiEventLog,
  MidiLogEventType,
} from '../types/megadrum';
import { decodeMidiLogDetails, normalizeHexBytes } from '../utils/midiLogFormat';

interface MidiLogViewProps {
  logs: MidiEventLog[];
  config: MegaDrumConfig;
  midiConnected: boolean;
  livePedalPosition: number;
  onClearLogs: () => void;
  onTestHit: () => void;
  onJumpToPadPair?: (pairIndex: number) => void;
}

type LogViewMode = 'split' | 'visual' | 'raw';
type DirectionFilter = 'all' | 'in' | 'out';
type RawTypeFilter = 'all' | 'note' | 'note_off' | 'cc' | 'aftertouch' | 'sysex' | 'program' | 'error';

interface ResolvedPadContext {
  padLabel: string;
  zoneLabel: string;
  pairIndex: number | null;
  notePitch: string;
  gmLabel: string;
}

function getPairIndexForPadId(padId: number): number {
  if (padId <= 1) return 0;
  return Math.floor(padId / 2);
}

function resolveMidiNoteContext(
  note: number,
  channel: number | undefined,
  config: MegaDrumConfig
): ResolvedPadContext {
  const { pitch, label: gmLabel } = formatMidiNote(note);
  const activeCount = Math.min(config.pads.length, Math.max(17, config.global.maxInputs - 1));
  const activePads = config.pads.slice(0, activeCount);

  // Check pedal-specific articulated notes first so Hi-Hat Chick/Splash/Closed stand out clearly
  const p = config.pedal;
  const hhPair = Math.max(1, Math.floor(p.hhInput / 2));
  if (note > 0) {
    if (p.chickNote === note) {
      return { padLabel: 'Hi-Hat Pedal', zoneLabel: 'Chick', pairIndex: hhPair, notePitch: pitch, gmLabel };
    }
    if (p.splashNote === note) {
      return { padLabel: 'Hi-Hat Pedal', zoneLabel: 'Splash', pairIndex: hhPair, notePitch: pitch, gmLabel };
    }
    if (p.bowClosedNote === note) {
      return { padLabel: 'HiHat', zoneLabel: 'Closed Bow', pairIndex: hhPair, notePitch: pitch, gmLabel };
    }
    if (p.edgeClosedNote === note) {
      return { padLabel: 'HiHat', zoneLabel: 'Closed Edge', pairIndex: hhPair, notePitch: pitch, gmLabel };
    }
    if (p.bellClosedNote === note) {
      return { padLabel: 'HiHat', zoneLabel: 'Closed Bell', pairIndex: hhPair, notePitch: pitch, gmLabel };
    }
    if (p.bowHalfOpenNote === note || p.bowHalfOpen2Note === note) {
      return { padLabel: 'HiHat', zoneLabel: 'Half-Open Bow', pairIndex: hhPair, notePitch: pitch, gmLabel };
    }
    if (p.edgeHalfOpenNote === note || p.edgeHalfOpen2Note === note) {
      return { padLabel: 'HiHat', zoneLabel: 'Half-Open Edge', pairIndex: hhPair, notePitch: pitch, gmLabel };
    }
    if (p.bowSemiOpenNote === note || p.bowSemiOpen2Note === note) {
      return { padLabel: 'HiHat', zoneLabel: 'Semi-Open Bow', pairIndex: hhPair, notePitch: pitch, gmLabel };
    }
    if (p.edgeSemiOpenNote === note || p.edgeSemiOpen2Note === note) {
      return { padLabel: 'HiHat', zoneLabel: 'Semi-Open Edge', pairIndex: hhPair, notePitch: pitch, gmLabel };
    }
    if (p.bowSemiClosedNote === note) {
      return { padLabel: 'HiHat', zoneLabel: 'Semi-Closed Bow', pairIndex: hhPair, notePitch: pitch, gmLabel };
    }
    if (p.edgeSemiClosedNote === note) {
      return { padLabel: 'HiHat', zoneLabel: 'Semi-Closed Edge', pairIndex: hhPair, notePitch: pitch, gmLabel };
    }
  }

  const findPad = (matchChannel: boolean) =>
    activePads.find(
      (pad) =>
        !pad.disabled &&
        (!matchChannel || channel === undefined || pad.midiChannel === channel) &&
        (pad.note === note || pad.altNote === note || pad.pressrollNote === note)
    );

  const matchedPad = findPad(true) || findPad(false);
  if (matchedPad) {
    const isRim = matchedPad.id > 1 && (matchedPad.id & 1) === 1;
    const isAlt = matchedPad.note !== note && matchedPad.altNote === note;
    const isPressroll = matchedPad.note !== note && matchedPad.pressrollNote === note;
    const zoneBase = matchedPad.id === 1 ? 'Head' : isRim ? 'Rim/Edge' : 'Head/Bow';
    const zoneLabel = isPressroll ? `${zoneBase} · Roll` : isAlt ? `${zoneBase} · Alt` : zoneBase;
    return {
      padLabel: matchedPad.name,
      zoneLabel,
      pairIndex: getPairIndexForPadId(matchedPad.id),
      notePitch: pitch,
      gmLabel,
    };
  }

  const thirdIdx = config.thirdZones.findIndex(
    (z) => !z.disabled && (z.note === note || z.dampenedNote === note)
  );
  if (thirdIdx >= 0) {
    const pairIdx = thirdIdx + 1;
    const leftPad = config.pads[pairIdx * 2 - 1];
    const z = config.thirdZones[thirdIdx];
    return {
      padLabel: leftPad?.name || `Pair ${pairIdx}`,
      zoneLabel: z.dampenedNote === note && z.note !== note ? 'Bell (Dampened)' : 'Bell (3rd)',
      pairIndex: pairIdx,
      notePitch: pitch,
      gmLabel,
    };
  }

  return {
    padLabel: gmLabel,
    zoneLabel: `Note #${note}`,
    pairIndex: null,
    notePitch: pitch,
    gmLabel,
  };
}

function getVelocityTier(vel: number): {
  label: string;
  barClass: string;
  textClass: string;
} {
  if (vel >= 120) {
    return {
      label: vel === 127 ? 'Peak 127' : 'Peak',
      barClass: 'bg-red-500',
      textClass: 'text-red-600 dark:text-red-400',
    };
  }
  if (vel >= 95) {
    return {
      label: 'Strong',
      barClass: 'bg-amber-500',
      textClass: 'text-amber-600 dark:text-amber-400',
    };
  }
  if (vel >= 45) {
    return {
      label: 'Medium',
      barClass: 'bg-emerald-500',
      textClass: 'text-emerald-600 dark:text-emerald-400',
    };
  }
  return {
    label: 'Soft',
    barClass: 'bg-sky-500',
    textClass: 'text-sky-600 dark:text-sky-400',
  };
}

function getTypeLabel(type: MidiLogEventType): string {
  switch (type) {
    case 'note':
      return 'NOTE ON';
    case 'note_off':
      return 'NOTE OFF';
    case 'cc':
      return 'CC';
    case 'sysex':
      return 'SYSEX';
    case 'aftertouch':
      return 'AT / CHOKE';
    case 'program':
      return 'PROG CHG';
    case 'system':
      return 'SYSTEM';
    case 'error':
      return 'ERROR';
  }
}

export const MidiLogView: React.FC<MidiLogViewProps> = ({
  logs,
  config,
  midiConnected,
  livePedalPosition,
  onClearLogs,
  onTestHit,
  onJumpToPadPair,
}) => {
  const [viewMode, setViewMode] = useState<LogViewMode>('split');
  const [directionFilter, setDirectionFilter] = useState<DirectionFilter>('all');
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [pausedSnapshot, setPausedSnapshot] = useState<MidiEventLog[] | null>(null);

  // Visual Log local controls
  const [includeVisualCC, setIncludeVisualCC] = useState<boolean>(true);
  const [includeVisualOut, setIncludeVisualOut] = useState<boolean>(true);
  const [selectedPadFilter, setSelectedPadFilter] = useState<string>('all');

  // RAW Log local controls
  const [rawTypeFilter, setRawTypeFilter] = useState<RawTypeFilter>('all');
  const [rawSearch, setRawSearch] = useState<string>('');
  const [showRawHexCol, setShowRawHexCol] = useState<boolean>(true);
  const [showDeltaCol, setShowDeltaCol] = useState<boolean>(true);
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const activeLogs = isPaused && pausedSnapshot ? pausedSnapshot : logs;
  const bufferedWhilePaused =
    isPaused && pausedSnapshot ? Math.max(0, logs.length - pausedSnapshot.length) : 0;

  const handleTogglePause = () => {
    if (!isPaused) {
      setPausedSnapshot(logs);
      setIsPaused(true);
    } else {
      setPausedSnapshot(null);
      setIsPaused(false);
    }
  };

  const handleClear = () => {
    setPausedSnapshot(isPaused ? [] : null);
    setExpandedRowId(null);
    onClearLogs();
  };

  // Pre-compute delta ms against previous (older) event in activeLogs (index + 1 because newest-first)
  const directionFilteredLogs = useMemo(() => {
    if (directionFilter === 'all') return activeLogs;
    return activeLogs.filter((l) => l.direction === directionFilter);
  }, [activeLogs, directionFilter]);

  // Visual Log rows: Note On hits, Aftertouch/Chokes, and optionally Pedal/Positional CC
  const visualRows = useMemo(() => {
    const candidates = directionFilteredLogs.filter((l) => {
      if (!includeVisualOut && l.direction === 'out') return false;
      if (l.type === 'note' || l.type === 'aftertouch') return true;
      if (l.type === 'cc' && includeVisualCC) return true;
      return false;
    });

    // Compute delta against the chronologically previous visual item (i + 1)
    return candidates.map((entry, idx) => {
      const older = candidates[idx + 1];
      const deltaMs =
        older && typeof entry.timestampMs === 'number' && typeof older.timestampMs === 'number'
          ? Math.max(0, Math.round(entry.timestampMs - older.timestampMs))
          : null;

      const resolved =
        entry.note !== undefined
          ? resolveMidiNoteContext(entry.note, entry.channel, config)
          : null;

      let timingFlag: 'double' | 'xtalk' | null = null;
      if (entry.type === 'note' && older?.type === 'note' && deltaMs !== null && deltaMs < 18) {
        timingFlag = older.note === entry.note ? 'double' : 'xtalk';
      }

      return {
        entry,
        deltaMs,
        resolved,
        timingFlag,
      };
    });
  }, [config, directionFilteredLogs, includeVisualCC, includeVisualOut]);

  const padActivityStats = useMemo(() => {
    const noteRows = visualRows.filter((r) => r.entry.type === 'note' && r.resolved);
    const map = new Map<
      string,
      { label: string; count: number; maxVel: number; pairIndex: number | null }
    >();
    let peakVel = 0;
    let sumVel = 0;
    let fastFlags = 0;

    for (const r of noteRows) {
      const vel = r.entry.velocity ?? 0;
      if (vel > peakVel) peakVel = vel;
      sumVel += vel;
      if (r.timingFlag) fastFlags++;

      const key = r.resolved!.padLabel;
      const existing = map.get(key);
      if (existing) {
        existing.count++;
        if (vel > existing.maxVel) existing.maxVel = vel;
      } else {
        map.set(key, {
          label: key,
          count: 1,
          maxVel: vel,
          pairIndex: r.resolved!.pairIndex,
        });
      }
    }

    const latestNote = noteRows[0] ?? null;
    const latestPosCc = activeLogs.find((l) => l.type === 'cc' && l.cc === 16) ?? null;
    const latestPedalCc = activeLogs.find((l) => l.type === 'cc' && l.cc === config.pedal.cc) ?? null;

    return {
      totalHits: noteRows.length,
      peakVel,
      avgVel: noteRows.length > 0 ? Math.round(sumVel / noteRows.length) : 0,
      fastFlags,
      latestNote,
      latestPosCc,
      latestPedalCc,
      padSummary: Array.from(map.values()).sort((a, b) => b.count - a.count),
    };
  }, [activeLogs, config.pedal.cc, visualRows]);

  const filteredVisualRows = useMemo(() => {
    if (selectedPadFilter === 'all') return visualRows;
    return visualRows.filter((r) => r.resolved?.padLabel === selectedPadFilter);
  }, [selectedPadFilter, visualRows]);

  // RAW Log filtering & delta calculation
  const rawTypeCounts = useMemo(() => {
    const counts: Record<RawTypeFilter, number> = {
      all: directionFilteredLogs.length,
      note: 0,
      note_off: 0,
      cc: 0,
      aftertouch: 0,
      sysex: 0,
      program: 0,
      error: 0,
    };
    for (const l of directionFilteredLogs) {
      if (l.type in counts) {
        counts[l.type as RawTypeFilter]++;
      }
    }
    return counts;
  }, [directionFilteredLogs]);

  const filteredRawRows = useMemo(() => {
    const q = rawSearch.trim().toLowerCase();
    const list = directionFilteredLogs.filter((l) => {
      if (rawTypeFilter !== 'all' && l.type !== rawTypeFilter) return false;
      if (!q) return true;
      const resolved =
        l.note !== undefined ? resolveMidiNoteContext(l.note, l.channel, config) : null;
      return (
        l.summary.toLowerCase().includes(q) ||
        l.rawHex.toLowerCase().includes(q) ||
        l.type.toLowerCase().includes(q) ||
        (resolved?.padLabel.toLowerCase().includes(q) ?? false) ||
        (l.note !== undefined && String(l.note) === q)
      );
    });

    return list.map((entry, idx) => {
      const older = list[idx + 1];
      const deltaMs =
        older && typeof entry.timestampMs === 'number' && typeof older.timestampMs === 'number'
          ? Math.max(0, Math.round(entry.timestampMs - older.timestampMs))
          : null;
      const resolved =
        entry.note !== undefined
          ? resolveMidiNoteContext(entry.note, entry.channel, config)
          : null;
      return { entry, deltaMs, resolved };
    });
  }, [config, directionFilteredLogs, rawSearch, rawTypeFilter]);

  const handleCopyHex = (id: string, hex: string) => {
    void navigator.clipboard?.writeText(normalizeHexBytes(hex));
    setCopiedId(id);
    window.setTimeout(() => {
      setCopiedId((cur) => (cur === id ? null : cur));
    }, 1400);
  };

  const handleExportCsv = () => {
    const header = ['Timestamp', 'Direction', 'Type', 'Channel', 'Summary', 'RawHex'];
    const rows = directionFilteredLogs.map((l) => [
      l.timestamp,
      l.direction.toUpperCase(),
      l.type,
      l.channel ?? '',
      `"${l.summary.replace(/"/g, '""')}"`,
      `"${l.rawHex}"`,
    ]);
    const csv = [header.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `megadrum-midi-log-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const pedalCcDisplay = padActivityStats.latestPedalCc?.ccValue ?? livePedalPosition;
  const pedalStateLabel =
    pedalCcDisplay >= config.pedal.closedLevel
      ? 'Closed'
      : pedalCcDisplay >= config.pedal.halfOpenLevel
      ? 'Half Open'
      : pedalCcDisplay >= config.pedal.semiOpenLevel
      ? 'Semi Open'
      : 'Open';

  return (
    <main className="flex-1 flex flex-col overflow-hidden bg-[var(--md-canvas)]">
      {/* Top Action & View Switcher Bar */}
      <div className="px-5 lg:px-6 py-3 border-b border-[var(--md-border)] bg-[var(--md-panel)] flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div>
          <h1 className="text-base font-display font-semibold text-slate-900 dark:text-white">
            MIDI Visual &amp; RAW Log
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Inspect hit velocity bars, trigger timing, hi-hat/positional CCs, and raw hexadecimal MIDI &amp; SysEx frames
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* View Mode Segmented Switcher */}
          <div className="flex items-center gap-1 p-1 bg-[var(--md-inset)] border border-[var(--md-border)] rounded-md">
            {(
              [
                { id: 'split' as LogViewMode, label: 'Split View' },
                { id: 'visual' as LogViewMode, label: 'Visual Log' },
                { id: 'raw' as LogViewMode, label: 'RAW Log' },
              ] as const
            ).map((mode) => (
              <button
                key={mode.id}
                type="button"
                onClick={() => setViewMode(mode.id)}
                className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                  viewMode === mode.id
                    ? 'bg-[var(--md-panel)] text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {mode.label}
              </button>
            ))}
          </div>

          {/* Direction Filter */}
          <div className="flex items-center gap-1 p-1 bg-[var(--md-inset)] border border-[var(--md-border)] rounded-md">
            {(['all', 'in', 'out'] as const).map((dir) => (
              <button
                key={dir}
                type="button"
                onClick={() => setDirectionFilter(dir)}
                className={`px-2 py-1 text-[11px] font-medium rounded uppercase transition-colors whitespace-nowrap ${
                  directionFilter === dir
                    ? 'bg-[var(--md-panel)] text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {dir === 'all' ? 'All Dir' : dir}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={onTestHit}
            title="Trigger an audition hit to test Visual & RAW MIDI logging"
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded border border-[var(--md-border-strong)] bg-[var(--md-control)] text-slate-700 dark:text-slate-200 hover:bg-[var(--md-hover)] whitespace-nowrap"
          >
            <Play className="w-3 h-3 text-blue-600 dark:text-blue-400" />
            Test Hit
          </button>

          <button
            type="button"
            onClick={handleTogglePause}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded border whitespace-nowrap transition-colors ${
              isPaused
                ? 'border-amber-500/60 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-200'
                : 'border-[var(--md-border-strong)] bg-[var(--md-control)] text-slate-700 dark:text-slate-200 hover:bg-[var(--md-hover)]'
            }`}
          >
            {isPaused ? (
              <>
                <Play className="w-3.5 h-3.5" />
                Resume{bufferedWhilePaused > 0 ? ` (+${bufferedWhilePaused})` : ''}
              </>
            ) : (
              <>
                <Pause className="w-3.5 h-3.5" />
                Pause
              </>
            )}
          </button>

          <button
            type="button"
            disabled={directionFilteredLogs.length === 0}
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded border border-[var(--md-border-strong)] bg-[var(--md-control)] text-slate-700 dark:text-slate-200 hover:bg-[var(--md-hover)] disabled:opacity-45 whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            Export .csv
          </button>

          <button
            type="button"
            disabled={logs.length === 0}
            onClick={handleClear}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded border border-[var(--md-border-strong)] bg-[var(--md-control)] text-slate-600 dark:text-slate-300 hover:text-red-600 dark:hover:text-red-400 hover:bg-[var(--md-hover)] disabled:opacity-45 whitespace-nowrap"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Clear
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-5 lg:p-6 space-y-5">
        {/* Live Telemetry Summary Strip (shown in Split and Visual modes) */}
        {viewMode !== 'raw' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* 1. Last Triggered Hit */}
            <div className="border border-[var(--md-border)] rounded-lg bg-[var(--md-panel)] p-4 space-y-2.5">
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                <span className="font-medium">Last Triggered Hit</span>
                <span className="font-mono tabular-nums">
                  {padActivityStats.latestNote
                    ? `#${padActivityStats.latestNote.entry.note} · ${padActivityStats.latestNote.resolved?.notePitch}`
                    : 'Waiting for hit'}
                </span>
              </div>
              {padActivityStats.latestNote ? (
                <>
                  <div className="flex items-baseline justify-between gap-2">
                    <div className="min-w-0 truncate">
                      <span className="text-sm font-display font-semibold text-slate-900 dark:text-white">
                        {padActivityStats.latestNote.resolved?.padLabel}
                      </span>
                      <span className="ml-2 text-xs text-slate-500 dark:text-slate-400">
                        {padActivityStats.latestNote.resolved?.zoneLabel}
                      </span>
                    </div>
                    <span className="text-sm font-mono font-semibold tabular-nums text-slate-900 dark:text-white shrink-0">
                      {padActivityStats.latestNote.entry.velocity ?? 0}
                      <span className="text-[11px] font-normal text-slate-400">/127</span>
                    </span>
                  </div>
                  <div className="h-2 rounded-sm bg-[var(--md-inset)] overflow-hidden">
                    <div
                      className={`h-full transition-all duration-150 ${
                        getVelocityTier(padActivityStats.latestNote.entry.velocity ?? 0).barClass
                      }`}
                      style={{
                        width: `${Math.round(
                          ((padActivityStats.latestNote.entry.velocity ?? 0) / 127) * 100
                        )}%`,
                      }}
                    />
                  </div>
                </>
              ) : (
                <div className="text-xs text-slate-400 dark:text-slate-500 py-1">
                  {midiConnected
                    ? 'Strike any drum or cymbal pad to inspect live velocity.'
                    : 'Connect MegaDrum MIDI or click Test Hit to record events.'}
                </div>
              )}
            </div>

            {/* 2. Hi-Hat Pedal & Positional Sensing Meters */}
            <div className="border border-[var(--md-border)] rounded-lg bg-[var(--md-panel)] p-4 space-y-2.5">
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                <span className="font-medium">Pedal (CC #{config.pedal.cc}) &amp; Positional</span>
                <span className="font-mono tabular-nums text-slate-700 dark:text-slate-200">
                  {pedalStateLabel} · {pedalCcDisplay}
                </span>
              </div>
              <div className="space-y-1.5">
                <div className="h-2 rounded-sm bg-[var(--md-inset)] overflow-hidden">
                  <div
                    className="h-full bg-indigo-500 transition-all duration-100"
                    style={{ width: `${Math.round((pedalCcDisplay / 127) * 100)}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                  <span>Positional (CC #16):</span>
                  <span>
                    {padActivityStats.latestPosCc?.ccValue !== undefined
                      ? `${padActivityStats.latestPosCc.ccValue}/127 (${
                          padActivityStats.latestPosCc.ccValue < 42
                            ? 'Center'
                            : padActivityStats.latestPosCc.ccValue < 85
                            ? 'Mid'
                            : 'Edge'
                        })`
                      : 'No CC #16 yet'}
                  </span>
                </div>
              </div>
            </div>

            {/* 3. Trigger Timing & Dynamics Diagnostics */}
            <div className="border border-[var(--md-border)] rounded-lg bg-[var(--md-panel)] p-4 space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                <span className="font-medium">Trigger Dynamics &amp; Crosstalk</span>
                <span className="font-mono tabular-nums">
                  {padActivityStats.totalHits} hits
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 pt-0.5 text-center">
                <div className="rounded bg-[var(--md-inset)] px-2 py-1.5">
                  <div className="text-[10px] text-slate-500 dark:text-slate-400">Peak Vel</div>
                  <div className="text-sm font-mono font-semibold tabular-nums text-slate-900 dark:text-white">
                    {padActivityStats.peakVel}
                  </div>
                </div>
                <div className="rounded bg-[var(--md-inset)] px-2 py-1.5">
                  <div className="text-[10px] text-slate-500 dark:text-slate-400">Avg Vel</div>
                  <div className="text-sm font-mono font-semibold tabular-nums text-slate-900 dark:text-white">
                    {padActivityStats.avgVel}
                  </div>
                </div>
                <div className="rounded bg-[var(--md-inset)] px-2 py-1.5">
                  <div className="text-[10px] text-slate-500 dark:text-slate-400">&lt;18ms</div>
                  <div
                    className={`text-sm font-mono font-semibold tabular-nums ${
                      padActivityStats.fastFlags > 0
                        ? 'text-amber-600 dark:text-amber-400'
                        : 'text-slate-900 dark:text-white'
                    }`}
                  >
                    {padActivityStats.fastFlags}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Main Workspace Panels: Split, Visual-Only, or RAW-Only */}
        <div
          className={
            viewMode === 'split'
              ? 'grid grid-cols-1 xl:grid-cols-2 gap-5 items-start'
              : 'grid grid-cols-1 gap-5'
          }
        >
          {/* PANEL 1: MIDI VISUAL LOG */}
          {viewMode !== 'raw' && (
            <section className="border border-[var(--md-border)] rounded-lg bg-[var(--md-panel)] overflow-hidden flex flex-col">
              <div className="px-4 py-3 border-b border-[var(--md-border)] flex flex-wrap items-center justify-between gap-2.5">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                  <h2 className="text-sm font-display font-semibold text-slate-900 dark:text-white">
                    MIDI Visual Log
                  </h2>
                  <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
                    ({filteredVisualRows.length})
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-3 text-xs">
                  <label className="inline-flex items-center gap-1.5 text-slate-600 dark:text-slate-300 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={includeVisualCC}
                      onChange={(e) => setIncludeVisualCC(e.target.checked)}
                      className="w-3.5 h-3.5 rounded border-slate-300 dark:border-slate-600 accent-blue-600"
                    />
                    <span>Show CC</span>
                  </label>
                  <label className="inline-flex items-center gap-1.5 text-slate-600 dark:text-slate-300 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={includeVisualOut}
                      onChange={(e) => setIncludeVisualOut(e.target.checked)}
                      className="w-3.5 h-3.5 rounded border-slate-300 dark:border-slate-600 accent-blue-600"
                    />
                    <span>Audition</span>
                  </label>
                  <select
                    aria-label="Filter visual log by pad"
                    value={selectedPadFilter}
                    onChange={(e) => setSelectedPadFilter(e.target.value)}
                    className="bg-[var(--md-control)] border border-[var(--md-border-strong)] rounded px-2 py-1 text-xs text-slate-900 dark:text-slate-100 max-w-[140px]"
                  >
                    <option value="all">All Pads</option>
                    {padActivityStats.padSummary.map((ps) => (
                      <option key={ps.label} value={ps.label}>
                        {ps.label} ({ps.count})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Compact Recently-Hit Pad Filter Strip */}
              {padActivityStats.padSummary.length > 0 && (
                <div className="px-4 py-2 border-b border-[var(--md-border)] bg-[var(--md-inset)] flex items-center gap-1.5 overflow-x-auto">
                  <button
                    type="button"
                    onClick={() => setSelectedPadFilter('all')}
                    className={`px-2 py-0.5 text-[11px] font-medium rounded border whitespace-nowrap shrink-0 transition-colors ${
                      selectedPadFilter === 'all'
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300'
                        : 'border-[var(--md-border)] bg-[var(--md-panel)] text-slate-600 dark:text-slate-300 hover:bg-[var(--md-hover)]'
                    }`}
                  >
                    All ({padActivityStats.totalHits})
                  </button>
                  {padActivityStats.padSummary.slice(0, 10).map((ps) => (
                    <button
                      key={ps.label}
                      type="button"
                      onClick={() =>
                        setSelectedPadFilter((cur) => (cur === ps.label ? 'all' : ps.label))
                      }
                      className={`px-2 py-0.5 text-[11px] font-mono tabular-nums rounded border whitespace-nowrap shrink-0 transition-colors ${
                        selectedPadFilter === ps.label
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 font-semibold'
                          : 'border-[var(--md-border)] bg-[var(--md-panel)] text-slate-600 dark:text-slate-300 hover:bg-[var(--md-hover)]'
                      }`}
                    >
                      {ps.label} · {ps.count} (max {ps.maxVel})
                    </button>
                  ))}
                </div>
              )}

              {/* Visual Velocity Waterfall */}
              <div className={viewMode === 'split' ? 'h-[480px] overflow-y-auto' : 'max-h-[540px] overflow-y-auto'}>
                {filteredVisualRows.length === 0 ? (
                  <div className="p-10 text-center space-y-2">
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      No visual MIDI hits recorded yet. Hit a pad on your drum kit or click{' '}
                      <strong className="text-slate-700 dark:text-slate-200">Test Hit</strong> to inspect velocity bars and trigger spacing.
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-[var(--md-border)]">
                    {filteredVisualRows.map(({ entry, deltaMs, resolved, timingFlag }) => {
                      const isNote = entry.type === 'note';
                      const isCC = entry.type === 'cc';
                      const isAftertouch = entry.type === 'aftertouch';
                      const val = isCC ? (entry.ccValue ?? 0) : (entry.velocity ?? 0);
                      const pct = Math.max(2, Math.round((val / 127) * 100));
                      const tier = getVelocityTier(val);

                      return (
                        <div
                          key={entry.id}
                          className="px-4 py-2 flex items-center gap-3 hover:bg-[var(--md-hover)]/60 transition-colors text-xs"
                        >
                          {/* Timestamp & Delta ms */}
                          <div className="w-[110px] shrink-0 font-mono tabular-nums">
                            <div className="text-[11px] text-slate-600 dark:text-slate-300">
                              {entry.timestamp}
                            </div>
                            <div
                              className={`text-[10px] ${
                                timingFlag
                                  ? 'text-amber-600 dark:text-amber-400 font-semibold'
                                  : 'text-slate-400 dark:text-slate-500'
                              }`}
                            >
                              {deltaMs !== null ? `+${deltaMs}ms` : '—'}
                              {timingFlag === 'double'
                                ? ' · Double?'
                                : timingFlag === 'xtalk'
                                ? ' · Xtalk?'
                                : ''}
                            </div>
                          </div>

                          {/* Pad / Zone / CC Name */}
                          <div className="w-[155px] min-w-0 shrink-0">
                            {isNote && resolved ? (
                              <>
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <span className="font-medium text-slate-900 dark:text-slate-100 truncate">
                                    {resolved.padLabel}
                                  </span>
                                  {resolved.pairIndex !== null && onJumpToPadPair && (
                                    <button
                                      type="button"
                                      onClick={() => onJumpToPadPair(resolved.pairIndex!)}
                                      title={`Edit ${resolved.padLabel} in Kit & Pads`}
                                      className="text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 shrink-0"
                                    >
                                      <ArrowRight className="w-3 h-3" />
                                    </button>
                                  )}
                                </div>
                                <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                                  {resolved.zoneLabel} · #{entry.note} ({resolved.notePitch})
                                </div>
                              </>
                            ) : isAftertouch ? (
                              <>
                                <div className="font-medium text-purple-700 dark:text-purple-300 truncate">
                                  {resolved ? `${resolved.padLabel} Choke` : 'Cymbal Choke'}
                                </div>
                                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                                  {entry.note !== undefined ? `Note #${entry.note}` : 'Channel AT'}
                                </div>
                              </>
                            ) : (
                              <>
                                <div className="font-medium text-indigo-700 dark:text-indigo-300 truncate">
                                  {entry.cc === config.pedal.cc
                                    ? 'Hi-Hat Pedal'
                                    : entry.cc === 16
                                    ? 'Positional CC'
                                    : `CC #${entry.cc}`}
                                </div>
                                <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                                  CC #{entry.cc} · Ch {entry.channel ?? 10}
                                </div>
                              </>
                            )}
                          </div>

                          {/* MDMFX-style Proportional Velocity / Value Bar */}
                          <div className="flex-1 min-w-[90px]">
                            <div className="relative h-5 rounded-sm bg-[var(--md-inset)] border border-[var(--md-border)] overflow-hidden">
                              {/* Subtle quarter reference ticks (25%, 50%, 75%) */}
                              <span
                                className="absolute inset-y-0 left-1/4 w-px bg-slate-400/20 pointer-events-none"
                                aria-hidden="true"
                              />
                              <span
                                className="absolute inset-y-0 left-1/2 w-px bg-slate-400/20 pointer-events-none"
                                aria-hidden="true"
                              />
                              <span
                                className="absolute inset-y-0 left-3/4 w-px bg-slate-400/20 pointer-events-none"
                                aria-hidden="true"
                              />
                              <div
                                className={`h-full transition-all duration-100 ${
                                  isNote
                                    ? tier.barClass
                                    : isAftertouch
                                    ? 'bg-purple-500'
                                    : 'bg-indigo-500'
                                }`}
                                style={{ width: `${pct}%` }}
                              />
                              <span className="absolute inset-y-0 right-2 flex items-center text-[10px] font-mono tabular-nums text-slate-600 dark:text-slate-300 mix-blend-normal">
                                {isNote ? tier.label : isAftertouch ? 'Choke' : 'CC'}
                              </span>
                            </div>
                          </div>

                          {/* Numeric Value & Direction */}
                          <div className="w-[54px] shrink-0 text-right font-mono tabular-nums">
                            <div
                              className={`text-xs font-semibold ${
                                isNote
                                  ? tier.textClass
                                  : 'text-slate-700 dark:text-slate-200'
                              }`}
                            >
                              {val}
                            </div>
                            <div className="text-[10px] text-slate-400">
                              {entry.direction.toUpperCase()}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </section>
          )}

          {/* PANEL 2: MIDI RAW LOG */}
          {viewMode !== 'visual' && (
            <section className="border border-[var(--md-border)] rounded-lg bg-[var(--md-panel)] overflow-hidden flex flex-col">
              <div className="px-4 py-3 border-b border-[var(--md-border)] space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <h2 className="text-sm font-display font-semibold text-slate-900 dark:text-white">
                      MIDI RAW Log
                    </h2>
                    <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
                      ({filteredRawRows.length})
                    </span>
                  </div>

                  <div className="flex items-center gap-3 text-xs">
                    <label className="inline-flex items-center gap-1.5 text-slate-600 dark:text-slate-300 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={showDeltaCol}
                        onChange={(e) => setShowDeltaCol(e.target.checked)}
                        className="w-3.5 h-3.5 rounded border-slate-300 dark:border-slate-600 accent-blue-600"
                      />
                      <span>Δms</span>
                    </label>
                    <label className="inline-flex items-center gap-1.5 text-slate-600 dark:text-slate-300 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={showRawHexCol}
                        onChange={(e) => setShowRawHexCol(e.target.checked)}
                        className="w-3.5 h-3.5 rounded border-slate-300 dark:border-slate-600 accent-blue-600"
                      />
                      <span>Hex Bytes</span>
                    </label>
                  </div>
                </div>

                {/* Type Filter & Search */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1 p-0.5 bg-[var(--md-inset)] border border-[var(--md-border)] rounded-md">
                    {(
                      [
                        { id: 'all' as RawTypeFilter, label: 'All' },
                        { id: 'note' as RawTypeFilter, label: 'Note On' },
                        { id: 'note_off' as RawTypeFilter, label: 'Note Off' },
                        { id: 'cc' as RawTypeFilter, label: 'CC' },
                        { id: 'aftertouch' as RawTypeFilter, label: 'AT' },
                        { id: 'sysex' as RawTypeFilter, label: 'SysEx' },
                        { id: 'error' as RawTypeFilter, label: 'Error' },
                      ] as const
                    ).map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setRawTypeFilter(t.id)}
                        className={`px-2 py-1 text-[11px] font-medium rounded transition-colors whitespace-nowrap tabular-nums ${
                          rawTypeFilter === t.id
                            ? 'bg-[var(--md-panel)] text-slate-900 dark:text-white shadow-xs'
                            : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        {t.label}
                        {rawTypeCounts[t.id] > 0 ? ` (${rawTypeCounts[t.id]})` : ''}
                      </button>
                    ))}
                  </div>

                  <div className="relative flex-1 min-w-[180px] max-w-xs">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={rawSearch}
                      onChange={(e) => setRawSearch(e.target.value)}
                      placeholder="Filter note, pad, cmd, or hex..."
                      className="w-full pl-8 pr-2.5 py-1 text-xs rounded border border-[var(--md-border-strong)] bg-[var(--md-control)] text-slate-900 dark:text-slate-100 placeholder:text-slate-400"
                    />
                  </div>
                </div>
              </div>

              <div className={viewMode === 'split' ? 'h-[480px] overflow-y-auto' : 'max-h-[540px] overflow-y-auto'}>
                {filteredRawRows.length === 0 ? (
                  <div className="p-10 text-center text-xs text-slate-500 dark:text-slate-400">
                    No matching raw MIDI or SysEx packets. Connect MegaDrum, trigger a pad, or run a SysEx sync.
                  </div>
                ) : (
                  <table className="w-full text-left text-xs border-collapse table-fixed">
                    <thead className="bg-[var(--md-control-alt)] text-slate-500 dark:text-slate-400 border-b border-[var(--md-border)] sticky top-0 z-10">
                      <tr>
                        <th className="w-[96px] px-3 py-2 font-medium whitespace-nowrap">Time</th>
                        {showDeltaCol && (
                          <th className="w-[52px] px-2 py-2 font-medium whitespace-nowrap text-right">+Δms</th>
                        )}
                        <th className="w-[42px] px-2 py-2 font-medium whitespace-nowrap">Dir</th>
                        <th className="w-[38px] px-2 py-2 font-medium whitespace-nowrap">Ch</th>
                        <th className="w-[74px] px-2 py-2 font-medium whitespace-nowrap">Type</th>
                        <th
                          className={`px-3 py-2 font-medium whitespace-nowrap ${
                            showRawHexCol
                              ? viewMode === 'raw'
                                ? 'w-[240px]'
                                : 'w-[180px]'
                              : 'w-auto'
                          }`}
                        >
                          Decoded Message
                        </th>
                        {showRawHexCol && (
                          <th className="px-3 py-2 font-medium whitespace-nowrap">Raw Hex</th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--md-border)] font-mono text-[11px]">
                      {filteredRawRows.map(({ entry, deltaMs, resolved }) => {
                        const isExpanded = expandedRowId === entry.id;
                        const colSpan =
                          4 + (showDeltaCol ? 1 : 0) + 1 + (showRawHexCol ? 1 : 0);
                        const cleanHex = normalizeHexBytes(entry.rawHex);
                        const fullSummary =
                          resolved && entry.type !== 'sysex'
                            ? `${entry.summary} · ${resolved.padLabel} (${resolved.zoneLabel})`
                            : entry.summary;

                        return (
                          <React.Fragment key={entry.id}>
                            <tr
                              onClick={() =>
                                setExpandedRowId((cur) => (cur === entry.id ? null : entry.id))
                              }
                              className={`cursor-pointer transition-colors ${
                                entry.type === 'error'
                                  ? 'bg-red-50/70 dark:bg-red-950/30 hover:bg-red-100/60 dark:hover:bg-red-950/50'
                                  : isExpanded
                                  ? 'bg-blue-50/50 dark:bg-blue-950/25'
                                  : 'hover:bg-[var(--md-hover)]/60'
                              }`}
                            >
                              <td className="px-3 py-1.5 text-slate-500 dark:text-slate-400 tabular-nums whitespace-nowrap">
                                {entry.timestamp}
                              </td>
                              {showDeltaCol && (
                                <td className="px-2 py-1.5 text-slate-400 dark:text-slate-500 tabular-nums whitespace-nowrap text-right">
                                  {deltaMs !== null ? `${deltaMs}` : '—'}
                                </td>
                              )}
                              <td className="px-2 py-1.5 whitespace-nowrap">
                                <span
                                  className={
                                    entry.type === 'error'
                                      ? 'text-red-600 dark:text-red-400 font-semibold'
                                      : entry.direction === 'out'
                                      ? 'text-blue-600 dark:text-blue-400 font-semibold'
                                      : 'text-emerald-600 dark:text-emerald-400 font-semibold'
                                  }
                                >
                                  {entry.direction.toUpperCase()}
                                </span>
                              </td>
                              <td className="px-2 py-1.5 text-slate-500 dark:text-slate-400 tabular-nums whitespace-nowrap">
                                {entry.channel !== undefined ? entry.channel : '—'}
                              </td>
                              <td
                                className={`px-2 py-1.5 whitespace-nowrap ${
                                  entry.type === 'error'
                                    ? 'text-red-600 dark:text-red-400 font-semibold'
                                    : entry.type === 'sysex'
                                    ? 'text-violet-600 dark:text-violet-400'
                                    : entry.type === 'cc'
                                    ? 'text-indigo-600 dark:text-indigo-400'
                                    : 'text-slate-600 dark:text-slate-300'
                                }`}
                              >
                                {getTypeLabel(entry.type)}
                              </td>
                              <td
                                title={fullSummary}
                                className={`px-3 py-1.5 font-sans text-xs truncate ${
                                  entry.type === 'error'
                                    ? 'text-red-700 dark:text-red-300 font-medium'
                                    : 'text-slate-900 dark:text-slate-100'
                                }`}
                              >
                                <span>{entry.summary}</span>
                                {resolved && entry.type !== 'sysex' && (
                                  <span className="ml-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                                    · {resolved.padLabel} ({resolved.zoneLabel})
                                  </span>
                                )}
                              </td>
                              {showRawHexCol && (
                                <td className="px-3 py-1.5 text-slate-500 dark:text-slate-400 truncate">
                                  {cleanHex || '--'}
                                </td>
                              )}
                            </tr>

                            {isExpanded && (
                              <tr className="bg-[var(--md-inset)]">
                                <td colSpan={colSpan} className="px-4 py-3 space-y-2.5">
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-sans text-xs text-slate-600 dark:text-slate-300">
                                      <span className="font-medium text-slate-900 dark:text-slate-100">
                                        {fullSummary}
                                      </span>
                                      {decodeMidiLogDetails(entry).map((line, i) => (
                                        <span key={i}>{line}</span>
                                      ))}
                                    </div>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleCopyHex(entry.id, entry.rawHex);
                                      }}
                                      className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-sans font-medium rounded border border-[var(--md-border-strong)] bg-[var(--md-control)] text-slate-700 dark:text-slate-200 hover:bg-[var(--md-hover)] whitespace-nowrap shrink-0"
                                    >
                                      {copiedId === entry.id ? (
                                        <>
                                          <Check className="w-3 h-3 text-emerald-500" />
                                          Copied
                                        </>
                                      ) : (
                                        <>
                                          <Copy className="w-3 h-3" />
                                          Copy Hex
                                        </>
                                      )}
                                    </button>
                                  </div>
                                  <pre className="p-2.5 rounded border border-[var(--md-border)] bg-[var(--md-panel)] text-[11px] font-mono text-slate-700 dark:text-slate-300 whitespace-pre-wrap break-words leading-relaxed select-all">
                                    {cleanHex || '--'}
                                  </pre>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </section>
          )}
        </div>
      </div>
    </main>
  );
};
