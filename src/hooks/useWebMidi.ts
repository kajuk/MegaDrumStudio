import { useCallback, useEffect, useRef, useState } from 'react';
import { MidiEventLog, SysexStatusState } from '../types/megadrum';
import {
  formatBytesHex,
  FW_ERROR,
  MD_SYSEX,
  MD_SYSEX_NAMES,
  splitSysexStream,
  SYSEX_END,
  SYSEX_START,
} from '../utils/sysex';

export interface MidiPortInfo {
  id: string;
  name: string;
  manufacturer: string;
}

export type MidiConnectionPhase =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'no_ports'
  | 'partial'
  | 'sysex_blocked'
  | 'error';

export interface SysexTaskItem {
  kind: 'request' | 'send' | 'fire_and_forget';
  packet: Uint8Array;
  verifyRequest?: Uint8Array;
  expectedCmd: number;
  expectedId?: number;
  label: string;
}

export interface SysexBatchResult {
  ok: boolean;
  reason?: 'midi_not_open' | 'timeout' | 'aborted' | 'cancelled';
  completed: number;
  total: number;
  failedLabel?: string;
  responses: Uint8Array[];
}

interface PendingWaiter {
  matcher: (pkt: Uint8Array) => boolean;
  resolve: (pkt: Uint8Array | null) => void;
  timer: number;
}

interface UseWebMidiOptions {
  onIncomingSysex?: (packet: Uint8Array) => void;
  onIncomingNote?: (channel: number, note: number, velocity: number) => void;
  onIncomingCC?: (channel: number, cc: number, value: number) => void;
}

export function useWebMidi(options: UseWebMidiOptions = {}) {
  const [supported, setSupported] = useState<boolean>(false);
  const [connected, setConnected] = useState<boolean>(false);
  const [sysexAllowed, setSysexAllowed] = useState<boolean>(false);
  const [connectionMessage, setConnectionMessage] = useState<string>(
    'Not connected — click Connect MIDI to detect MegaDrum'
  );
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [inputs, setInputs] = useState<MidiPortInfo[]>([]);
  const [outputs, setOutputs] = useState<MidiPortInfo[]>([]);
  const [selectedInputId, setSelectedInputId] = useState<string>('');
  const [selectedOutputId, setSelectedOutputId] = useState<string>('');
  const [midiLogs, setMidiLogs] = useState<MidiEventLog[]>([]);
  const [sysexStatus, setSysexStatus] = useState<SysexStatusState>({
    code: 'idle',
    message: 'Idle',
  });

  const accessRef = useRef<MIDIAccess | null>(null);
  const waitersRef = useRef<PendingWaiter[]>([]);
  const busyRef = useRef<boolean>(false);
  const callbacksRef = useRef(options);
  callbacksRef.current = options;

  const appendLog = useCallback((entry: Omit<MidiEventLog, 'id' | 'timestamp'>) => {
    const now = new Date();
    const timestamp =
      now.toTimeString().slice(0, 8) + '.' + String(now.getMilliseconds()).padStart(3, '0');
    setMidiLogs((prev) => [
      {
        ...entry,
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        timestamp,
      },
      ...prev.slice(0, 199),
    ]);
  }, []);

  const cancelAllWaiters = useCallback(() => {
    waitersRef.current.forEach((w) => {
      window.clearTimeout(w.timer);
      w.resolve(null);
    });
    waitersRef.current = [];
  }, []);

  const waitForPacket = useCallback(
    (matcher: (pkt: Uint8Array) => boolean, timeoutMs: number): Promise<Uint8Array | null> => {
      return new Promise((resolve) => {
        const waiter: PendingWaiter = {
          matcher,
          resolve: (pkt) => {
            waitersRef.current = waitersRef.current.filter((w) => w !== waiter);
            resolve(pkt);
          },
          timer: window.setTimeout(() => {
            waitersRef.current = waitersRef.current.filter((w) => w !== waiter);
            resolve(null);
          }, timeoutMs),
        };
        waitersRef.current.push(waiter);
      });
    },
    []
  );

  const refreshPorts = useCallback((access: MIDIAccess) => {
    const nextInputs: MidiPortInfo[] = [];
    const nextOutputs: MidiPortInfo[] = [];
    access.inputs.forEach((input) => {
      nextInputs.push({
        id: input.id,
        name: input.name || 'MIDI Input',
        manufacturer: input.manufacturer || 'Generic',
      });
    });
    access.outputs.forEach((output) => {
      nextOutputs.push({
        id: output.id,
        name: output.name || 'MIDI Output',
        manufacturer: output.manufacturer || 'Generic',
      });
    });
    setInputs(nextInputs);
    setOutputs(nextOutputs);

    let chosenIn = '';
    let chosenOut = '';

    setSelectedInputId((prev) => {
      if (prev && nextInputs.some((i) => i.id === prev)) {
        chosenIn = prev;
        return prev;
      }
      const md = nextInputs.find((i) => i.name.toLowerCase().includes('megadrum'));
      chosenIn = md?.id || nextInputs[0]?.id || '';
      return chosenIn;
    });
    setSelectedOutputId((prev) => {
      if (prev && nextOutputs.some((o) => o.id === prev)) {
        chosenOut = prev;
        return prev;
      }
      const md = nextOutputs.find((o) => o.name.toLowerCase().includes('megadrum'));
      chosenOut = md?.id || nextOutputs[0]?.id || '';
      return chosenOut;
    });

    return { nextInputs, nextOutputs, chosenIn, chosenOut };
  }, []);

  useEffect(() => {
    setSupported(typeof navigator !== 'undefined' && 'requestMIDIAccess' in navigator);
    return () => cancelAllWaiters();
  }, [cancelAllWaiters]);

  const connectionPhase: MidiConnectionPhase = (() => {
    if (!connected) return permissionError ? 'error' : 'disconnected';
    if (!sysexAllowed) return 'sysex_blocked';
    if (inputs.length === 0 && outputs.length === 0) return 'no_ports';
    if (!selectedInputId || !selectedOutputId) return 'partial';
    return 'connected';
  })();

  useEffect(() => {
    if (!connected) {
      if (permissionError) {
        setConnectionMessage(permissionError);
      } else {
        setConnectionMessage('Not connected — click Connect MIDI to detect MegaDrum');
      }
      return;
    }
    const inName = inputs.find((i) => i.id === selectedInputId)?.name;
    const outName = outputs.find((o) => o.id === selectedOutputId)?.name;

    if (!sysexAllowed) {
      setConnectionMessage(
        'Connected without SysEx permission — SysEx Get/Send blocked by browser. Grant SysEx access to sync MegaDrum.'
      );
    } else if (inputs.length === 0 && outputs.length === 0) {
      setConnectionMessage(
        'Web MIDI opened, but 0 MIDI devices were found. Connect MegaDrum USB cable and check browser permissions.'
      );
    } else if (!inName || !outName) {
      setConnectionMessage(
        `Select both MIDI In and MIDI Out ports (${inputs.length} In / ${outputs.length} Out available).`
      );
    } else {
      setConnectionMessage(`Connected: In "${inName}" · Out "${outName}"`);
    }
  }, [connected, inputs, outputs, permissionError, selectedInputId, selectedOutputId, sysexAllowed]);

  const connect = useCallback(async (): Promise<{ ok: boolean; message: string }> => {
    if (!('requestMIDIAccess' in navigator)) {
      const msg =
        'Web MIDI is not supported in this browser. Use Firefox 108+, Chrome, or Edge to connect MegaDrum.';
      setPermissionError(msg);
      setConnected(false);
      setSysexAllowed(false);
      setSysexStatus({ code: 'error', message: msg });
      return { ok: false, message: msg };
    }

    try {
      setPermissionError(null);
      let access: MIDIAccess;
      let hasSysex = true;
      try {
        access = await navigator.requestMIDIAccess({ sysex: true });
      } catch {
        access = await navigator.requestMIDIAccess({ sysex: false });
        hasSysex = false;
      }

      accessRef.current = access;
      setConnected(true);
      setSysexAllowed(hasSysex);

      const { nextInputs, nextOutputs } = refreshPorts(access);
      access.onstatechange = () => refreshPorts(access);

      let resultMsg = '';
      if (!hasSysex) {
        resultMsg =
          'MIDI connected WITHOUT SysEx permission. Reload or open in a standalone tab and allow SysEx to sync MegaDrum.';
        setPermissionError(resultMsg);
        setSysexStatus({ code: 'error', message: resultMsg });
      } else if (nextInputs.length === 0 && nextOutputs.length === 0) {
        resultMsg =
          'Web MIDI enabled, but no MIDI ports were found. Connect your MegaDrum USB cable and try again.';
        setSysexStatus({ code: 'midi_not_open', message: resultMsg });
      } else {
        const mdIn =
          nextInputs.find((i) => i.name.toLowerCase().includes('megadrum')) || nextInputs[0];
        const mdOut =
          nextOutputs.find((o) => o.name.toLowerCase().includes('megadrum')) || nextOutputs[0];
        resultMsg = `MIDI Connected (${mdIn?.name || 'No In'} / ${mdOut?.name || 'No Out'})`;
        setSysexStatus({ code: 'ok', message: resultMsg });
      }

      appendLog({
        direction: 'in',
        type: hasSysex ? 'system' : 'error',
        summary: resultMsg,
        rawHex: '--',
      });

      return { ok: hasSysex && nextInputs.length > 0 && nextOutputs.length > 0, message: resultMsg };
    } catch (err) {
      const msg =
        err instanceof Error
          ? `MIDI access failed: ${err.message}`
          : 'MIDI permission denied. Open in a standalone tab and allow MIDI access.';
      setPermissionError(msg);
      setConnected(false);
      setSysexAllowed(false);
      setSysexStatus({ code: 'error', message: msg });
      appendLog({
        direction: 'in',
        type: 'error',
        summary: msg,
        rawHex: '--',
      });
      return { ok: false, message: msg };
    }
  }, [appendLog, refreshPorts]);

  const disconnect = useCallback(() => {
    cancelAllWaiters();
    busyRef.current = false;
    if (accessRef.current) {
      accessRef.current.inputs.forEach((input) => {
        input.onmidimessage = null;
      });
      accessRef.current = null;
    }
    setConnected(false);
    setSysexAllowed(false);
    setPermissionError(null);
    setSysexStatus({ code: 'idle', message: 'Disconnected' });
  }, [cancelAllWaiters]);

  useEffect(() => {
    const access = accessRef.current;
    if (!access || !connected) return;

    access.inputs.forEach((input) => {
      if (input.id === selectedInputId) {
        input.onmidimessage = (ev: MIDIMessageEvent) => {
          const data = ev.data;
          if (!data || data.length === 0) return;

          if (data[0] === SYSEX_START) {
            const packets = splitSysexStream(data);
            packets.forEach((pkt) => {
              const cmdName =
                pkt.length >= 4 && pkt[1] === MD_SYSEX
                  ? MD_SYSEX_NAMES[pkt[3]] || `Cmd 0x${pkt[3].toString(16)}`
                  : 'Bootloader/SysEx';
              appendLog({
                direction: 'in',
                type: 'sysex',
                summary: `SysEx In: ${cmdName} (${pkt.length}B)`,
                rawHex:
                  formatBytesHex(pkt.slice(0, 24)) + (pkt.length > 24 ? ' ... F7' : ''),
              });

              // Notify any waiting SysEx transaction first
              for (const waiter of [...waitersRef.current]) {
                if (waiter.matcher(pkt)) {
                  window.clearTimeout(waiter.timer);
                  waiter.resolve(pkt);
                  break;
                }
              }

              callbacksRef.current.onIncomingSysex?.(pkt);
            });
            return;
          }

          const status = data[0] & 0xf0;
          const channel = (data[0] & 0x0f) + 1;
          const d1 = data[1] ?? 0;
          const d2 = data[2] ?? 0;

          if (status === 0x90 && d2 > 0) {
            appendLog({
              direction: 'in',
              type: 'note',
              channel,
              note: d1,
              velocity: d2,
              summary: `Note On #${d1} (vel ${d2})`,
              rawHex: formatBytesHex(data),
            });
            callbacksRef.current.onIncomingNote?.(channel, d1, d2);
          } else if (status === 0xb0) {
            appendLog({
              direction: 'in',
              type: 'cc',
              channel,
              cc: d1,
              ccValue: d2,
              summary: `CC #${d1} = ${d2}`,
              rawHex: formatBytesHex(data),
            });
            callbacksRef.current.onIncomingCC?.(channel, d1, d2);
          } else if (status === 0xa0 || status === 0xd0) {
            appendLog({
              direction: 'in',
              type: 'aftertouch',
              channel,
              note: d1,
              velocity: d2,
              summary: `Choke / Aftertouch (${d1})`,
              rawHex: formatBytesHex(data),
            });
          }
        };
      } else {
        input.onmidimessage = null;
      }
    });
  }, [appendLog, connected, selectedInputId]);

  const sendRawSysex = useCallback(
    (packet: Uint8Array, label?: string): { sent: boolean; error?: string } => {
      const access = accessRef.current;
      if (!access || !connected) {
        return {
          sent: false,
          error: 'MIDI is not open. Click Connect MIDI and select your MegaDrum ports.',
        };
      }
      if (!sysexAllowed) {
        return {
          sent: false,
          error: 'SysEx permission is disabled in this browser context.',
        };
      }
      const outPort = access.outputs.get(selectedOutputId);
      const inPort = access.inputs.get(selectedInputId);
      if (!outPort || !inPort) {
        return {
          sent: false,
          error: 'Select both a valid MIDI Input and MIDI Output port before sending SysEx.',
        };
      }

      try {
        outPort.send(packet);
        appendLog({
          direction: 'out',
          type: 'sysex',
          summary: label ? `${label} (${packet.length}B)` : `SysEx Out (${packet.length}B)`,
          rawHex:
            formatBytesHex(packet.slice(0, 24)) + (packet.length > 24 ? ' ... F7' : ''),
        });
        return { sent: true };
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to send SysEx message';
        appendLog({
          direction: 'out',
          type: 'error',
          summary: `Send error (${label || 'SysEx'}): ${msg}`,
          rawHex: formatBytesHex(packet.slice(0, 16)),
        });
        return { sent: false, error: msg };
      }
    },
    [appendLog, connected, selectedInputId, selectedOutputId, sysexAllowed]
  );

  // Sequential queued SysEx transaction runner with retries & clear timeout detection
  const runSysexQueue = useCallback(
    async (
      tasks: SysexTaskItem[],
      options: { maxRetries?: number; timeoutMs?: number; abortOnFirstTimeout?: boolean } = {}
    ): Promise<SysexBatchResult> => {
      const maxRetries = options.maxRetries ?? 3;
      const timeoutMs = options.timeoutMs ?? 650;
      const abortOnFirstTimeout = options.abortOnFirstTimeout ?? true;

      if (!connected || !accessRef.current) {
        const msg = 'MIDI ports are NOT open. Click Connect MIDI and select your MegaDrum In/Out ports.';
        setSysexStatus({ code: 'midi_not_open', message: msg });
        appendLog({ direction: 'out', type: 'error', summary: msg, rawHex: '--' });
        return { ok: false, reason: 'midi_not_open', completed: 0, total: tasks.length, responses: [] };
      }
      if (!sysexAllowed) {
        const msg = 'Browser blocked Web MIDI SysEx access. Reconnect with SysEx enabled in a standalone tab.';
        setSysexStatus({ code: 'error', message: msg });
        return { ok: false, reason: 'midi_not_open', completed: 0, total: tasks.length, responses: [] };
      }
      if (!selectedInputId || !selectedOutputId) {
        const msg = 'Select both MIDI Input and MIDI Output ports to communicate with MegaDrum.';
        setSysexStatus({ code: 'midi_not_open', message: msg });
        return { ok: false, reason: 'midi_not_open', completed: 0, total: tasks.length, responses: [] };
      }

      busyRef.current = true;
      const responses: Uint8Array[] = [];
      let completed = 0;

      setSysexStatus({
        code: 'working',
        message: `SysEx Working (0/${tasks.length})...`,
        completed: 0,
        total: tasks.length,
      });

      for (const task of tasks) {
        if (!busyRef.current) {
          return {
            ok: false,
            reason: 'cancelled',
            completed,
            total: tasks.length,
            responses,
          };
        }

        if (task.kind === 'fire_and_forget') {
          const res = sendRawSysex(task.packet, task.label);
          if (!res.sent) {
            busyRef.current = false;
            setSysexStatus({ code: 'midi_not_open', message: res.error || 'MIDI send failed' });
            return {
              ok: false,
              reason: 'midi_not_open',
              completed,
              total: tasks.length,
              failedLabel: task.label,
              responses,
            };
          }
          completed++;
          setSysexStatus({
            code: 'working',
            message: `${task.label} (${completed}/${tasks.length})`,
            completed,
            total: tasks.length,
          });
          await new Promise((r) => window.setTimeout(r, 40));
          continue;
        }

        let gotReply: Uint8Array | null = null;

        for (let attempt = 0; attempt < maxRetries; attempt++) {
          const waitPromise = waitForPacket((pkt) => {
            if (pkt.length < 5 || pkt[0] !== SYSEX_START || pkt[1] !== MD_SYSEX) return false;
            if (pkt[3] !== task.expectedCmd) return false;
            if (task.expectedId !== undefined && pkt[4] !== (task.expectedId & 0x7f)) return false;
            return true;
          }, timeoutMs);

          const packetToSend =
            task.kind === 'send' && attempt > 0 && task.verifyRequest
              ? task.packet
              : task.packet;

          const sendRes = sendRawSysex(
            packetToSend,
            attempt === 0 ? task.label : `${task.label} (Retry ${attempt})`
          );
          if (!sendRes.sent) {
            busyRef.current = false;
            const errMsg = sendRes.error || 'MIDI port write failed';
            setSysexStatus({ code: 'midi_not_open', message: errMsg });
            return {
              ok: false,
              reason: 'midi_not_open',
              completed,
              total: tasks.length,
              failedLabel: task.label,
              responses,
            };
          }

          if (task.kind === 'send' && task.verifyRequest) {
            await new Promise((r) => window.setTimeout(r, Math.max(12, Math.round(task.packet.length / 4))));
            sendRawSysex(task.verifyRequest, `Verify ${task.label}`);
          }

          gotReply = await waitPromise;
          if (gotReply) break;
        }

        if (!gotReply) {
          const timeoutMsg = `Timeout: No SysEx response from MegaDrum for "${task.label}". Check MIDI In/Out ports, USB cable, and Chain ID.`;
          appendLog({
            direction: 'in',
            type: 'error',
            summary: timeoutMsg,
            rawHex: '--',
          });
          if (abortOnFirstTimeout) {
            busyRef.current = false;
            setSysexStatus({
              code: 'timeout',
              message: timeoutMsg,
              completed,
              total: tasks.length,
            });
            return {
              ok: false,
              reason: 'timeout',
              completed,
              total: tasks.length,
              failedLabel: task.label,
              responses,
            };
          }
        } else {
          responses.push(gotReply);
        }

        completed++;
        setSysexStatus({
          code: 'working',
          message: `Synced ${task.label} (${completed}/${tasks.length})`,
          completed,
          total: tasks.length,
        });
      }

      busyRef.current = false;
      const doneMsg =
        tasks.length === 1
          ? `Sysex OK: ${tasks[0].label}`
          : `Sysex OK: Completed ${completed}/${tasks.length} packets`;
      setSysexStatus({ code: 'ok', message: doneMsg, completed, total: tasks.length });

      return { ok: true, completed, total: tasks.length, responses };
    },
    [appendLog, connected, selectedInputId, selectedOutputId, sendRawSysex, sysexAllowed, waitForPacket]
  );

  // Firmware frame transfer waiting for MegaDrum bootloader ACK (0x11 OK / 0x22 CRC / 0x23 Read)
  const sendFirmwareFrameWithAck = useCallback(
    async (
      packet: Uint8Array,
      label: string,
      timeoutMs = 1500
    ): Promise<'ok' | 'crc' | 'read' | 'timeout' | 'midi_not_open'> => {
      const waitPromise = waitForPacket((pkt) => {
        // Bootloader reply is F0 <hi> <lo> F7 (or >=3 bytes) without MD_SYSEX header
        return pkt.length >= 3 && pkt[0] === SYSEX_START && pkt[pkt.length - 1] === SYSEX_END;
      }, timeoutMs);

      const sendRes = sendRawSysex(packet, label);
      if (!sendRes.sent) {
        return 'midi_not_open';
      }

      const reply = await waitPromise;
      if (!reply) return 'timeout';
      if (reply.length >= 3) {
        const status = ((reply[1] & 0x0f) << 4) | (reply[2] & 0x0f);
        if (status === FW_ERROR.OK) return 'ok';
        if (status === FW_ERROR.CRC) return 'crc';
        if (status === FW_ERROR.READ) return 'read';
      }
      return 'read';
    },
    [sendRawSysex, waitForPacket]
  );

  const sendSysex = useCallback(
    (packet: Uint8Array, label?: string) => {
      const res = sendRawSysex(packet, label);
      if (!res.sent && res.error) {
        setSysexStatus({ code: 'midi_not_open', message: res.error });
      }
      return res.sent;
    },
    [sendRawSysex]
  );

  const logSimulatedEvent = useCallback(
    (entry: Omit<MidiEventLog, 'id' | 'timestamp'>) => {
      appendLog(entry);
    },
    [appendLog]
  );

  const clearLogs = useCallback(() => setMidiLogs([]), []);
  const clearSysexStatus = useCallback(
    () => setSysexStatus({ code: 'idle', message: 'Idle' }),
    []
  );

  return {
    supported,
    connected,
    sysexAllowed,
    connectionPhase,
    connectionMessage,
    permissionError,
    inputs,
    outputs,
    selectedInputId,
    setSelectedInputId,
    selectedOutputId,
    setSelectedOutputId,
    midiLogs,
    sysexStatus,
    setSysexStatus,
    clearSysexStatus,
    connect,
    disconnect,
    sendSysex,
    runSysexQueue,
    sendFirmwareFrameWithAck,
    logSimulatedEvent,
    clearLogs,
  };
}
