import React, { useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Cpu,
  Download,
  FileCode2,
  Play,
  Square,
  Upload,
} from 'lucide-react';
import { MD_MCU_TYPES } from '../types/megadrum';
import {
  buildBootloaderEnterPacket,
  decodeMegaDrumBinBuffer,
  FirmwareMetadata,
  MCU_TARGETS,
  MegaDrumMcuId,
  parseFirmwareFilename,
} from '../utils/sysex';

interface FirmwareUpgradePanelProps {
  midiConnected: boolean;
  chainId: number;
  mcuTypeId: number;
  configuredInputs: number;
  currentVersion: string;
  onQueryHardware: () => void;
  onSendBootloaderEnter: (packet: Uint8Array, label: string) => boolean;
  onSendFirmwareFrameWithAck: (
    packet: Uint8Array,
    label: string,
    timeoutMs?: number
  ) => Promise<'ok' | 'crc' | 'read' | 'timeout' | 'midi_not_open'>;
  onBackupMds: () => void;
  onNotice: (msg: string) => void;
}

type FlashStage = 'idle' | 'bootloader' | 'flashing' | 'completed' | 'aborted' | 'error';

export const FirmwareUpgradePanel: React.FC<FirmwareUpgradePanelProps> = ({
  midiConnected,
  chainId,
  mcuTypeId,
  configuredInputs,
  currentVersion,
  onQueryHardware,
  onSendBootloaderEnter,
  onSendFirmwareFrameWithAck,
  onBackupMds,
  onNotice,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<boolean>(false);

  const [targetMcu, setTargetMcu] = useState<MegaDrumMcuId>('STM32f');
  const [firmwareBytes, setFirmwareBytes] = useState<Uint8Array | null>(null);
  const [frames, setFrames] = useState<Uint8Array[]>([]);
  const [metadata, setMetadata] = useState<FirmwareMetadata | null>(null);
  const [bootloaderConfirmed, setBootloaderConfirmed] = useState<boolean>(false);
  const [backedUp, setBackedUp] = useState<boolean>(false);
  const [stage, setStage] = useState<FlashStage>('idle');
  const [statusMessage, setStatusMessage] = useState<string>('Ready');
  const [progressIdx, setProgressIdx] = useState<number>(0);
  const [totalBlocks, setTotalBlocks] = useState<number>(0);

  const selectedMcuInfo = MCU_TARGETS.find((m) => m.id === targetMcu) || MCU_TARGETS[0];
  const isAvr = selectedMcuInfo.arch === 'AVR';
  const detectedMcuName = MD_MCU_TYPES[mcuTypeId] || `Unknown (${mcuTypeId})`;

  const handleLoadFirmware = async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.bin')) {
      onNotice('Unsupported firmware format. MegaDrum firmware upgrade accepts only encrypted *.bin files.');
      return;
    }
    const buf = new Uint8Array(await file.arrayBuffer());
    if (buf.length < 256) {
      onNotice('Selected .bin file is too small to be a valid encrypted MegaDrum firmware image.');
      return;
    }
    const decoded = decodeMegaDrumBinBuffer(buf);
    const meta = parseFirmwareFilename(file.name, buf);
    setFirmwareBytes(buf);
    setFrames(decoded.frames);
    setMetadata(meta);
    if (meta.mcu !== 'Unknown') {
      setTargetMcu(meta.mcu);
    }
    setStage('idle');
    setProgressIdx(0);
    setTotalBlocks(decoded.frames.length);
    setStatusMessage(
      `Loaded ${file.name} (${decoded.frames.length} ${meta.isAsciiHex ? 'ASCII-hex' : 'binary'} SysEx frames)`
    );
    onNotice(`Loaded encrypted firmware image: ${file.name} (${decoded.frames.length} frames)`);
  };

  const handleStartFlash = async (dryRunOnly: boolean) => {
    if (!firmwareBytes || !metadata || frames.length === 0) return;

    if (!dryRunOnly && !midiConnected) {
      setStage('error');
      const msg = 'MIDI ports are NOT open. Connect MegaDrum USB MIDI first or run Offline Dry-Run.';
      setStatusMessage(msg);
      onNotice(msg);
      return;
    }

    abortRef.current = false;
    setTotalBlocks(frames.length);
    setProgressIdx(0);

    // Step 1: Enter Bootloader (ARM sends 21-byte 0x0B magic sequence and waits ~4s)
    if (!isAvr) {
      setStage('bootloader');
      setStatusMessage(
        dryRunOnly
          ? 'Sending ARM bootloader entry SysEx (Offline Dry-Run)...'
          : 'Entering MegaDrum ARM bootloader (waiting 4s for reboot)...'
      );
      const bootPkt = buildBootloaderEnterPacket(chainId);
      if (!dryRunOnly) {
        const sent = onSendBootloaderEnter(bootPkt, `Enter ARM Bootloader (Chain ${chainId})`);
        if (!sent) {
          setStage('error');
          setStatusMessage('Failed to send bootloader entry packet — MIDI port closed.');
          return;
        }
      }
      const waitSteps = dryRunOnly ? 3 : 40; // 300ms dry-run, 4000ms live hardware
      for (let s = 0; s < waitSteps; s++) {
        if (abortRef.current) {
          setStage('aborted');
          setStatusMessage('Aborted during bootloader entry.');
          return;
        }
        await new Promise((r) => window.setTimeout(r, 100));
      }
    }

    // Step 2: Stream framed SysEx blocks with MDMFX ACK (0x11 OK / 0x22 CRC / 0x23 Read)
    setStage('flashing');

    for (let i = 0; i < frames.length; i++) {
      if (abortRef.current) {
        setStage('aborted');
        setStatusMessage(`Aborted at frame ${i} / ${frames.length}`);
        onNotice('Firmware transfer aborted by user.');
        return;
      }

      const label = `FW Frame ${i + 1}/${frames.length}`;
      setStatusMessage(`Streaming ${label}...`);

      if (dryRunOnly) {
        setProgressIdx(i + 1);
        await new Promise((r) => window.setTimeout(r, 6));
        continue;
      }

      let frameAcked = false;
      let lastResult: 'ok' | 'crc' | 'read' | 'timeout' | 'midi_not_open' = 'timeout';

      for (let retry = 0; retry < 4; retry++) {
        if (abortRef.current) break;
        const res = await onSendFirmwareFrameWithAck(
          frames[i],
          retry === 0 ? label : `${label} (Retry ${retry})`,
          1800
        );
        lastResult = res;
        if (res === 'ok') {
          frameAcked = true;
          break;
        }
        if (res === 'midi_not_open') {
          break;
        }
        if (res === 'crc' || res === 'read') {
          setStatusMessage(`${label}: Bootloader reported ${res.toUpperCase()} error — retrying...`);
          await new Promise((r) => window.setTimeout(r, 60));
        }
      }

      if (!frameAcked) {
        setStage('error');
        const errMsg =
          lastResult === 'midi_not_open'
            ? 'MIDI ports closed during firmware transfer.'
            : `Bootloader failed at frame ${i + 1}/${frames.length} (${lastResult.toUpperCase()}). Keep MegaDrum powered in bootloader and retry.`;
        setStatusMessage(errMsg);
        onNotice(errMsg);
        return;
      }

      setProgressIdx(i + 1);
    }

    setStage('completed');
    const doneMsg = dryRunOnly
      ? `Offline dry-run complete (${frames.length} SysEx frames verified, 0 sent to hardware).`
      : `Firmware upgrade complete (${frames.length} SysEx frames acknowledged).`;
    setStatusMessage(doneMsg);
    onNotice(doneMsg);
  };

  const mcuMismatch =
    metadata && metadata.mcu !== 'Unknown' && metadata.mcu !== targetMcu;
  const inputsMismatch =
    metadata && metadata.inputs !== null && metadata.inputs !== configuredInputs;
  const pct = totalBlocks > 0 ? Math.round((progressIdx / totalBlocks) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Hardware Target & Bootloader */}
        <section className="border border-[var(--md-border)] rounded-lg bg-[var(--md-panel)] p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Cpu className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <h2 className="text-sm font-display font-semibold text-slate-900 dark:text-white">
                Target MCU &amp; Bootloader
              </h2>
            </div>
            <button
              type="button"
              onClick={onQueryHardware}
              className="px-2.5 py-1 text-xs font-medium rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#161C28] text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap"
            >
              Query MCU &amp; Version
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Firmware Image MCU Target
              </label>
              <select
                value={targetMcu}
                onChange={(e) => setTargetMcu(e.target.value as MegaDrumMcuId)}
                className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-[#0E121A] border border-slate-200 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100"
              >
                {MCU_TARGETS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Detected Module Hardware
              </label>
              <div className="px-2.5 py-1.5 text-xs font-mono tabular-nums bg-slate-50 dark:bg-[#0E121A] border border-slate-200 dark:border-slate-800 rounded text-slate-700 dark:text-slate-300 truncate">
                {detectedMcuName} · FW {currentVersion}
              </div>
            </div>
          </div>

          <div className="p-3 rounded bg-[var(--md-inset)] border border-[var(--md-border)] text-xs text-slate-600 dark:text-slate-400 space-y-1">
            <div className="font-medium text-slate-800 dark:text-slate-200">
              Official MDMFX Bootloader Handshake
            </div>
            <p>
              {isAvr
                ? 'For legacy ATmega units, hold the LEFT button while powering on MegaDrum and select your crystal frequency on the LCD, then start the transfer.'
                : 'For STM32 / GD32 modules with the protected bootloader, MegaDrum Studio sends the 21-byte 0x0B bootloader command, waits 4 seconds, and verifies every frame against 0x11 ACK.'}
            </p>
          </div>
        </section>

        {/* Encrypted Firmware Image (*.bin) */}
        <section className="border border-[var(--md-border)] rounded-lg bg-[var(--md-panel)] p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <FileCode2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <h2 className="text-sm font-display font-semibold text-slate-900 dark:text-white">
                Encrypted Firmware Image (*.bin)
              </h2>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".bin"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  handleLoadFirmware(file);
                  e.target.value = '';
                }
              }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:opacity-90 whitespace-nowrap"
            >
              <Upload className="w-3.5 h-3.5" />
              Select .bin File
            </button>
          </div>

          {!metadata ? (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full py-10 px-4 border border-dashed border-slate-300 dark:border-slate-700 rounded-md bg-slate-50/70 dark:bg-[#0B0E14] text-center hover:border-blue-500 transition-colors"
            >
              <p className="text-xs font-medium text-slate-700 dark:text-slate-200">
                Choose an encrypted MegaDrum firmware file (e.g. megadrumSTM32f_56_20250201.bin)
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                Accepts encrypted *.bin images only · Decodes ASCII-hex framing, CRC-32, MCU &amp; input count
              </p>
            </button>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                <div className="p-2.5 rounded bg-slate-50 dark:bg-[#0B0E14] border border-slate-200 dark:border-slate-800">
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">File</div>
                  <div
                    className="font-mono font-medium text-slate-900 dark:text-white truncate mt-0.5"
                    title={metadata.filename}
                  >
                    {metadata.filename}
                  </div>
                </div>
                <div className="p-2.5 rounded bg-slate-50 dark:bg-[#0B0E14] border border-slate-200 dark:border-slate-800">
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">Detected MCU</div>
                  <div className="font-mono font-medium text-slate-900 dark:text-white mt-0.5">
                    {metadata.mcu} {metadata.inputs ? `· ${metadata.inputs}ch` : ''}
                  </div>
                </div>
                <div className="p-2.5 rounded bg-slate-50 dark:bg-[#0B0E14] border border-slate-200 dark:border-slate-800">
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">Payload &amp; Frames</div>
                  <div className="font-mono tabular-nums font-medium text-slate-900 dark:text-white mt-0.5">
                    {(metadata.sizeBytes / 1024).toFixed(1)} KB · {metadata.frameCount} frms
                  </div>
                </div>
                <div className="p-2.5 rounded bg-slate-50 dark:bg-[#0B0E14] border border-slate-200 dark:border-slate-800">
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">CRC-32</div>
                  <div className="font-mono tabular-nums font-medium text-slate-900 dark:text-white mt-0.5">
                    0x{metadata.crc32}
                  </div>
                </div>
                <div className="p-2.5 rounded bg-slate-50 dark:bg-[#0B0E14] border border-slate-200 dark:border-slate-800">
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">Build Date</div>
                  <div className="font-mono tabular-nums font-medium text-slate-900 dark:text-white mt-0.5">
                    {metadata.buildDate || 'Unspecified'}
                  </div>
                </div>
                <div className="p-2.5 rounded bg-slate-50 dark:bg-[#0B0E14] border border-slate-200 dark:border-slate-800">
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">Encoding</div>
                  <div className="font-mono font-medium text-slate-900 dark:text-white mt-0.5">
                    {metadata.isAsciiHex ? 'ASCII-Hex .bin' : 'Binary .bin'}
                  </div>
                </div>
              </div>

              {(mcuMismatch || inputsMismatch) && (
                <div className="flex items-start gap-2 p-2.5 rounded bg-amber-500/10 border border-amber-500/30 text-xs text-amber-700 dark:text-amber-300">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>
                    {mcuMismatch && `Image MCU (${metadata.mcu}) differs from selected target (${targetMcu}). `}
                    {inputsMismatch &&
                      `Image input count (${metadata.inputs}) differs from current Global Max Inputs (${configuredInputs}).`}
                  </span>
                </div>
              )}
            </div>
          )}
        </section>
      </div>

      {/* Flash Execution & Progress */}
      <section className="border border-[var(--md-border)] rounded-lg bg-[var(--md-panel)] p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-3">
          <div>
            <h2 className="text-sm font-display font-semibold text-slate-900 dark:text-white">
              Flash Execution &amp; Pre-Flight Check
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {midiConnected
                ? 'Live Web MIDI bootloader transport ready with per-frame ACK/CRC verification'
                : 'MIDI not connected — connect MegaDrum to flash hardware, or run Offline Dry-Run to validate .bin framing'}
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              onBackupMds();
              setBackedUp(true);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#141923] text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            {backedUp ? 'Kit Backed Up (.mds)' : '1. Backup Current Kit (.mds)'}
          </button>
        </div>

        <label className="flex items-center gap-2.5 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
          <input
            type="checkbox"
            checked={bootloaderConfirmed}
            onChange={(e) => setBootloaderConfirmed(e.target.checked)}
            className="rounded border-slate-300 dark:border-slate-600 text-blue-600"
          />
          <span>
            I have backed up my kit presets and verified this encrypted .bin image matches my MegaDrum MCU.
          </span>
        </label>

        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-mono tabular-nums text-slate-600 dark:text-slate-300">
            <span className={stage === 'error' ? 'text-red-600 dark:text-red-400 font-semibold' : ''}>
              {statusMessage}
            </span>
            <span>
              {progressIdx}/{totalBlocks} ({pct}%)
            </span>
          </div>
          <div className="h-2.5 w-full rounded bg-slate-100 dark:bg-[#0B0E14] border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div
              style={{ width: `${pct}%` }}
              className={`h-full transition-[width] duration-100 ${
                stage === 'completed'
                  ? 'bg-emerald-600'
                  : stage === 'error'
                  ? 'bg-red-600'
                  : stage === 'aborted'
                  ? 'bg-amber-600'
                  : 'bg-blue-600'
              }`}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {stage === 'completed' && (
              <span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
                <CheckCircle2 className="w-4 h-4" />
                {statusMessage}
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {(stage === 'bootloader' || stage === 'flashing') && (
              <button
                type="button"
                onClick={() => {
                  abortRef.current = true;
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded border border-red-300 dark:border-red-800 text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/40 hover:bg-red-100"
              >
                <Square className="w-3 h-3 fill-current" />
                Abort Transfer
              </button>
            )}

            {!midiConnected && (
              <button
                type="button"
                disabled={
                  !firmwareBytes ||
                  !bootloaderConfirmed ||
                  stage === 'bootloader' ||
                  stage === 'flashing'
                }
                onClick={() => handleStartFlash(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#171D29] text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-45 disabled:cursor-not-allowed whitespace-nowrap"
              >
                <Play className="w-3 h-3" />
                Offline Dry-Run Verify
              </button>
            )}

            <button
              type="button"
              disabled={
                !firmwareBytes ||
                !bootloaderConfirmed ||
                stage === 'bootloader' ||
                stage === 'flashing'
              }
              onClick={() => handleStartFlash(false)}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-45 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              Start Live Firmware Upgrade
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};
