import { formatMidiNote, MidiEventLog } from '../types/megadrum';
import { MD_SYSEX, MD_SYSEX_NAMES } from './sysex';

export function normalizeHexBytes(rawHex: string): string {
  const tokens = rawHex.trim().split(/\s+/).filter(Boolean);
  return tokens.map((t) => t.toUpperCase()).join(' ');
}

export function decodeMidiLogDetails(log: MidiEventLog): string[] {
  const details: string[] = [];
  if (log.type === 'sysex') {
    const bytes = log.rawHex
      .trim()
      .split(/\s+/)
      .map((h) => parseInt(h, 16))
      .filter((n) => !Number.isNaN(n));
    if (bytes.length >= 4 && bytes[0] === 0xf0 && bytes[1] === MD_SYSEX) {
      const chainId = bytes[2];
      const cmd = bytes[3];
      const cmdName = MD_SYSEX_NAMES[cmd] || `0x${cmd.toString(16).toUpperCase()}`;
      details.push('Protocol: MegaDrum SysEx (0x70)');
      details.push(`Chain ID: ${chainId}`);
      details.push(`Command: ${cmdName} (0x${cmd.toString(16).padStart(2, '0').toUpperCase()})`);
      if (bytes.length >= 5 && bytes[4] !== 0xf7) {
        details.push(
          `Target ID byte: ${bytes[4]} (0x${bytes[4].toString(16).padStart(2, '0').toUpperCase()})`
        );
      }
      details.push(`Total length: ${bytes.length} bytes`);
    } else if (bytes.length > 0) {
      details.push(`SysEx / Bootloader frame (${bytes.length} bytes)`);
    }
  } else {
    if (log.channel !== undefined) details.push(`Channel: ${log.channel}`);
    if (log.note !== undefined) {
      const info = formatMidiNote(log.note);
      details.push(`Note: #${log.note} (${info.pitch} · ${info.label})`);
    }
    if (log.velocity !== undefined) {
      details.push(
        log.type === 'aftertouch' ? `Pressure: ${log.velocity}` : `Velocity: ${log.velocity} / 127`
      );
    }
    if (log.cc !== undefined) details.push(`Controller: CC #${log.cc}`);
    if (log.ccValue !== undefined) details.push(`Value: ${log.ccValue} / 127`);
    if (log.program !== undefined) details.push(`Program: #${log.program}`);
  }
  return details;
}
