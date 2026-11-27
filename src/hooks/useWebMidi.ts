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

export type MidiPermissionIssue =
  | 'none'
  | 'addon_required'
  | 'denied'
  | 'sysex_blocked'
  | 'unsupported';

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

const MIDI_IN_STORAGE_KEY = 'megadrum_studio_midi_in_v1';
const MIDI_OUT_STORAGE_KEY = 'megadrum_studio_midi_out_v1';

export function useWebMidi(options: UseWebMidiOptions = {}) {
  const [supported, setSupported] = useState<boolean>(false);
  const [connected, setConnected] = useState<boolean>(false);
  const [hasMidiAccess, setHasMidiAccess] = useState<boolean>(false);
  const [sysexAllowed, setSysexAllowed] = useState<boolean>(false);
  const [connectionMessage, setConnectionMessage] = useState<string>(
    'Not connected — select ports or click Connect MIDI to detect MegaDrum'
  );
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [permissionIssue, setPermissionIssue] = useState<MidiPermissionIssue>('none');
  const [permissionRequesting, setPermissionRequesting] = useState<boolean>(false);
  const [permissionAttemptCount, setPermissionAttemptCount] = useState<number>(0);
  const [isInIframe] = useState<boolean>(() => {
    try {
      return typeof window !== 'undefined' && window.self !== window.top;
    } catch {
      return true;
    }
  });
  const [isFirefox] = useState<boolean>(() => {
    if (typeof navigator === 'undefined') return false;
    return /firefox/i.test(navigator.userAgent);
  });
  const [inputs, setInputs] = useState<MidiPortInfo[]>([]);
  const [outputs, setOutputs] = useState<MidiPortInfo[]>([]);
  const [selectedInputId, setSelectedInputId] = useState<string>(() => {
    try {
      return localStorage.getItem(MIDI_IN_STORAGE_KEY) || '';
    } catch {
      return '';
    }
  });
  const [selectedOutputId, setSelectedOutputId] = useState<string>(() => {
    try {
      return localStorage.getItem(MIDI_OUT_STORAGE_KEY) || '';
    } catch {
      return '';
    }
  });
  const [midiLogs, setMidiLogs] = useState<MidiEventLog[]>([]);
  const [sysexStatus, setSysexStatus] = useState<SysexStatusState>({
    code: 'idle',
    message: 'Idle',
  });

  const accessRef = useRef<MIDIAccess | null>(null);
  const waitersRef = useRef<PendingWaiter[]>([]);
  const busyRef = useRef<boolean>(false);
  const selectedInputIdRef = useRef<string>(selectedInputId);
  selectedInputIdRef.current = selectedInputId;
  const selectedOutputIdRef = useRef<string>(selectedOutputId);
  selectedOutputIdRef.current = selectedOutputId;
  const callbacksRef = useRef(options);
  callbacksRef.current = options;
  const inFlightAccessRef = useRef<Promise<{
    access: MIDIAccess;
    hasSysex: boolean;
    nextInputs: MidiPortInfo[];
    nextOutputs: MidiPortInfo[];
    chosenIn: string;
    chosenOut: string;
  }> | null>(null);
  const hadGrantedAccessRef = useRef<boolean>(false);
  const addonRetryOnFocusRef = useRef<boolean>(false);
  const connectedRef = useRef<boolean>(false);
  connectedRef.current = connected;
  const sysexAllowedRef = useRef<boolean>(false);
  sysexAllowedRef.current = sysexAllowed;

  useEffect(() => {
    try {
      if (selectedInputId) localStorage.setItem(MIDI_IN_STORAGE_KEY, selectedInputId);
    } catch {
      // Ignore storage errors
    }
  }, [selectedInputId]);

  useEffect(() => {
    try {
      if (selectedOutputId) localStorage.setItem(MIDI_OUT_STORAGE_KEY, selectedOutputId);
    } catch {
      // Ignore storage errors
    }
  }, [selectedOutputId]);

  const appendLog = useCallback((entry: Omit<MidiEventLog, 'id' | 'timestamp' | 'timestampMs'>) => {
    const now = new Date();
    const timestamp =
      now.toTimeString().slice(0, 8) + '.' + String(now.getMilliseconds()).padStart(3, '0');
    const timestampMs = typeof performance !== 'undefined' ? performance.now() : Date.now();
    setMidiLogs((prev) => [
      {
        ...entry,
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        timestamp,
        timestampMs,
      },
      ...prev.slice(0, 499),
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

  const invalidateMidiAccess = useCallback(
    (reasonMessage?: string, issue: MidiPermissionIssue = 'none') => {
      cancelAllWaiters();
      busyRef.current = false;
      if (accessRef.current) {
        accessRef.current.onstatechange = null;
        accessRef.current.inputs.forEach((input) => {
          input.onmidimessage = null;
        });
        accessRef.current = null;
      }
      setHasMidiAccess(false);
      setSysexAllowed(false);
      setInputs([]);
      setOutputs([]);
      if (connectedRef.current) {
        setConnected(false);
      }
      if (reasonMessage) {
        setPermissionError(reasonMessage);
        setPermissionIssue(issue);
        setSysexStatus({ code: 'error', message: reasonMessage });
      }
    },
    [cancelAllWaiters]
  );

  const queryMidiPermissionStatus = useCallback(async (): Promise<PermissionStatus | null> => {
    if (typeof navigator === 'undefined' || !navigator.permissions?.query) return null;
    try {
      return await navigator.permissions.query({
        name: 'midi' as PermissionName,
        sysex: true,
      } as PermissionDescriptor);
    } catch {
      try {
        return await navigator.permissions.query({
          name: 'midi' as PermissionName,
        } as PermissionDescriptor);
      } catch {
        return null;
      }
    }
  }, []);

  const formatMidiAccessError = useCallback(
    (err: unknown): { message: string; isAddonError: boolean; issue: MidiPermissionIssue } => {
      const rawMsg = err instanceof Error ? err.message : '';
      const rawName = err instanceof Error ? err.name : '';
      const lower = rawMsg.toLowerCase();
      const isAddonError =
        lower.includes('add-on') || lower.includes('addon') || lower.includes('site permission');

      if (isAddonError) {
        return {
          isAddonError: true,
          issue: 'addon_required',
          message: isInIframe
            ? 'WebMIDI requires a site permission add-on to activate, and Firefox cannot install it inside an embedded frame. Open this app in a standalone tab and allow the WebMIDI add-on prompt.'
            : 'WebMIDI requires a site permission add-on to activate. Click Request WebMIDI Permission and accept the browser prompt in the address bar.',
        };
      }
      if (rawName === 'NotAllowedError' || lower.includes('denied') || lower.includes('permission')) {
        return {
          isAddonError: false,
          issue: 'denied',
          message: rawMsg ? `MIDI access failed: ${rawMsg}` : 'MIDI permission was denied by the browser.',
        };
      }
      if (rawMsg) {
        return {
          isAddonError: false,
          issue: 'denied',
          message: `MIDI access failed: ${rawMsg}`,
        };
      }
      return {
        isAddonError: false,
        issue: 'denied',
        message: 'MIDI permission denied. Open in a standalone tab and allow MIDI access.',
      };
    },
    [isInIframe]
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

    const prevIn = selectedInputIdRef.current;
    const chosenIn =
      prevIn && nextInputs.some((i) => i.id === prevIn)
        ? prevIn
        : nextInputs.find((i) => i.name.toLowerCase().includes('megadrum'))?.id ||
          nextInputs[0]?.id ||
          '';

    const prevOut = selectedOutputIdRef.current;
    const chosenOut =
      prevOut && nextOutputs.some((o) => o.id === prevOut)
        ? prevOut
        : nextOutputs.find((o) => o.name.toLowerCase().includes('megadrum'))?.id ||
          nextOutputs[0]?.id ||
          '';

    selectedInputIdRef.current = chosenIn;
    selectedOutputIdRef.current = chosenOut;
    setSelectedInputId(chosenIn);
    setSelectedOutputId(chosenOut);

    return { nextInputs, nextOutputs, chosenIn, chosenOut };
  }, []);

  const requestAccessAndRefresh = useCallback(async () => {
    if (accessRef.current && sysexAllowedRef.current) {
      const permStatus = await queryMidiPermissionStatus();
      if (!permStatus || permStatus.state === 'granted') {
        const ports = refreshPorts(accessRef.current);
        return { access: accessRef.current, hasSysex: true, ...ports };
      }
      // Cached MIDIAccess is stale because permission was revoked
      invalidateMidiAccess();
    }

    if (inFlightAccessRef.current) {
      return inFlightAccessRef.current;
    }

    const requestPromise = (async () => {
      let access: MIDIAccess;
      let hasSysex = true;
      try {
        access = await navigator.requestMIDIAccess({ sysex: true });
      } catch (sysexErr) {
        const errMsg = sysexErr instanceof Error ? sysexErr.message.toLowerCase() : '';
        // In Firefox, WebMIDI requires a site permission add-on for all MIDI access;
        // don't overwrite/cancel the add-on prompt with a second { sysex: false } call.
        if (errMsg.includes('add-on') || errMsg.includes('addon') || errMsg.includes('site permission')) {
          throw sysexErr;
        }
        access = await navigator.requestMIDIAccess({ sysex: false });
        hasSysex = false;
      }

      accessRef.current = access;
      hadGrantedAccessRef.current = true;
      addonRetryOnFocusRef.current = false;
      setHasMidiAccess(true);
      setSysexAllowed(hasSysex);

      const ports = refreshPorts(access);
      access.onstatechange = () => refreshPorts(access);

      return { access, hasSysex, ...ports };
    })();

    inFlightAccessRef.current = requestPromise;
    try {
      return await requestPromise;
    } finally {
      if (inFlightAccessRef.current === requestPromise) {
        inFlightAccessRef.current = null;
      }
    }
  }, [invalidateMidiAccess, queryMidiPermissionStatus, refreshPorts]);

  const scanPorts = useCallback(
    async (opts: { userTriggered?: boolean } = {}): Promise<{ ok: boolean; message: string }> => {
      if (!('requestMIDIAccess' in navigator)) {
        const msg =
          'Web MIDI is not supported in this browser. Use Firefox 108+, Chrome, or Edge to connect MegaDrum.';
        setPermissionError(msg);
        setPermissionIssue('unsupported');
        return { ok: false, message: msg };
      }

      setPermissionRequesting(true);
      try {
        setPermissionError(null);
        setPermissionIssue('none');
        const { hasSysex, nextInputs, nextOutputs } = await requestAccessAndRefresh();
        if (!hasSysex) {
          const msg = 'MIDI ports scanned without SysEx permission. Grant SysEx access to sync MegaDrum.';
          setPermissionIssue('sysex_blocked');
          return { ok: false, message: msg };
        }
        setPermissionIssue('none');
        return {
          ok: true,
          message: `Found ${nextInputs.length} MIDI In and ${nextOutputs.length} MIDI Out ports.`,
        };
      } catch (err) {
        const formatted = formatMidiAccessError(err);
        if (formatted.isAddonError) {
          addonRetryOnFocusRef.current = true;
        }
        setPermissionError(formatted.message);
        setPermissionIssue(formatted.issue);
        if (opts.userTriggered) {
          setPermissionAttemptCount((c) => c + 1);
        }
        return { ok: false, message: formatted.message };
      } finally {
        setPermissionRequesting(false);
      }
    },
    [formatMidiAccessError, requestAccessAndRefresh]
  );

  useEffect(() => {
    const isSupported = typeof navigator !== 'undefined' && 'requestMIDIAccess' in navigator;
    setSupported(isSupported);
    if (!isSupported) {
      setPermissionIssue('unsupported');
      return () => cancelAllWaiters();
    }

    let cancelled = false;
    let watchedStatus: PermissionStatus | null = null;

    const handlePermissionChange = () => {
      if (cancelled || !watchedStatus) return;

      if (watchedStatus.state === 'granted') {
        addonRetryOnFocusRef.current = false;
        void scanPorts();
        return;
      }

      if (watchedStatus.state === 'prompt') {
        const wasGranted = hadGrantedAccessRef.current || Boolean(accessRef.current);
        hadGrantedAccessRef.current = false;
        invalidateMidiAccess(
          wasGranted
            ? 'WebMIDI permissions were revoked. Re-requesting browser MIDI permission...'
            : undefined,
          wasGranted ? (isFirefox ? 'addon_required' : 'denied') : 'none'
        );
        // Re-request WebMIDI add-on / site permissions automatically when revoked back to prompt
        void scanPorts();
        return;
      }

      if (watchedStatus.state === 'denied') {
        hadGrantedAccessRef.current = false;
        addonRetryOnFocusRef.current = false;
        invalidateMidiAccess(
          'WebMIDI permission was denied or revoked. Re-enable MIDI / WebMIDI site permission in your browser and click Request WebMIDI Permission.',
          isFirefox ? 'addon_required' : 'denied'
        );
      }
    };

    const handleFocusOrVisible = () => {
      if (cancelled || document.visibilityState === 'hidden') return;
      void (async () => {
        const status = await queryMidiPermissionStatus();
        if (cancelled) return;

        if (status) {
          if (status.state === 'granted' && (!accessRef.current || !sysexAllowedRef.current)) {
            void scanPorts();
            return;
          }
          if (status.state === 'prompt' && addonRetryOnFocusRef.current) {
            addonRetryOnFocusRef.current = false;
            void scanPorts();
            return;
          }
          if (status.state !== 'granted' && (accessRef.current || hadGrantedAccessRef.current)) {
            hadGrantedAccessRef.current = false;
            invalidateMidiAccess(
              'WebMIDI permissions were revoked. Click Request WebMIDI Permission or Connect MIDI to reactivate.',
              isFirefox ? 'addon_required' : 'denied'
            );
            if (status.state === 'prompt') {
              void scanPorts();
            }
          }
        } else if (addonRetryOnFocusRef.current && !accessRef.current) {
          addonRetryOnFocusRef.current = false;
          void scanPorts();
        }
      })();
    };

    void (async () => {
      const status = await queryMidiPermissionStatus();
      if (cancelled) return;

      if (status) {
        watchedStatus = status;
        status.onchange = handlePermissionChange;

        if (status.state === 'denied') {
          setPermissionIssue(isFirefox ? 'addon_required' : 'denied');
          setPermissionError(
            isFirefox
              ? 'WebMIDI site permission add-on is blocked or not active for this site.'
              : 'WebMIDI permission is currently blocked for this site.'
          );
          return;
        }
      }

      // On first load (granted, prompt, or Permissions API unavailable),
      // request WebMIDI + SysEx permissions immediately so Firefox triggers the site permission add-on prompt.
      await scanPorts();
    })();

    window.addEventListener('focus', handleFocusOrVisible);
    document.addEventListener('visibilitychange', handleFocusOrVisible);

    return () => {
      cancelled = true;
      if (watchedStatus) {
        watchedStatus.onchange = null;
      }
      window.removeEventListener('focus', handleFocusOrVisible);
      document.removeEventListener('visibilitychange', handleFocusOrVisible);
      cancelAllWaiters();
    };
  }, [cancelAllWaiters, invalidateMidiAccess, isFirefox, queryMidiPermissionStatus, scanPorts]);

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
      setPermissionIssue('unsupported');
      setConnected(false);
      setSysexAllowed(false);
      setSysexStatus({ code: 'error', message: msg });
      return { ok: false, message: msg };
    }

    setPermissionRequesting(true);
    try {
      setPermissionError(null);
      setPermissionIssue('none');
      const { hasSysex, nextInputs, nextOutputs, chosenIn, chosenOut } =
        await requestAccessAndRefresh();

      setConnected(true);

      let resultMsg = '';
      if (!hasSysex) {
        resultMsg =
          'MIDI connected WITHOUT SysEx permission. Reload or open in a standalone tab and allow SysEx to sync MegaDrum.';
        setPermissionError(resultMsg);
        setPermissionIssue('sysex_blocked');
        setSysexStatus({ code: 'error', message: resultMsg });
      } else if (nextInputs.length === 0 && nextOutputs.length === 0) {
        resultMsg =
          'Web MIDI enabled, but no MIDI ports were found. Connect your MegaDrum USB cable and try again.';
        setSysexStatus({ code: 'midi_not_open', message: resultMsg });
      } else {
        const activeIn = nextInputs.find((i) => i.id === chosenIn) || nextInputs[0];
        const activeOut = nextOutputs.find((o) => o.id === chosenOut) || nextOutputs[0];
        resultMsg = `MIDI Connected (${activeIn?.name || 'No In'} / ${activeOut?.name || 'No Out'})`;
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
      const formatted = formatMidiAccessError(err);
      if (formatted.isAddonError) {
        addonRetryOnFocusRef.current = true;
      }
      setPermissionError(formatted.message);
      setPermissionIssue(formatted.issue);
      setPermissionAttemptCount((c) => c + 1);
      setConnected(false);
      setSysexAllowed(false);
      setSysexStatus({ code: 'error', message: formatted.message });
      appendLog({
        direction: 'in',
        type: 'error',
        summary: formatted.message,
        rawHex: '--',
      });
      return { ok: false, message: formatted.message };
    } finally {
      setPermissionRequesting(false);
    }
  }, [appendLog, formatMidiAccessError, requestAccessAndRefresh]);

  const disconnect = useCallback(() => {
    cancelAllWaiters();
    busyRef.current = false;
    if (accessRef.current) {
      accessRef.current.inputs.forEach((input) => {
        input.onmidimessage = null;
      });
    }
    setConnected(false);
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
                byteLength: pkt.length,
                summary: `SysEx In: ${cmdName} (${pkt.length}B)`,
                rawHex: formatBytesHex(pkt),
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
              byteLength: data.length,
              summary: `Note On #${d1} (vel ${d2})`,
              rawHex: formatBytesHex(data),
            });
            callbacksRef.current.onIncomingNote?.(channel, d1, d2);
          } else if (status === 0x80 || (status === 0x90 && d2 === 0)) {
            appendLog({
              direction: 'in',
              type: 'note_off',
              channel,
              note: d1,
              velocity: d2,
              byteLength: data.length,
              summary: `Note Off #${d1}`,
              rawHex: formatBytesHex(data),
            });
          } else if (status === 0xb0) {
            appendLog({
              direction: 'in',
              type: 'cc',
              channel,
              cc: d1,
              ccValue: d2,
              byteLength: data.length,
              summary: `CC #${d1} = ${d2}`,
              rawHex: formatBytesHex(data),
            });
            callbacksRef.current.onIncomingCC?.(channel, d1, d2);
          } else if (status === 0xa0) {
            appendLog({
              direction: 'in',
              type: 'aftertouch',
              channel,
              note: d1,
              velocity: d2,
              byteLength: data.length,
              summary: d2 > 0 ? `Choke / PolyAT #${d1} (pressure ${d2})` : `Choke Release #${d1}`,
              rawHex: formatBytesHex(data),
            });
          } else if (status === 0xd0) {
            appendLog({
              direction: 'in',
              type: 'aftertouch',
              channel,
              velocity: d1,
              byteLength: data.length,
              summary: `Channel Pressure (${d1})`,
              rawHex: formatBytesHex(data),
            });
          } else if (status === 0xc0) {
            appendLog({
              direction: 'in',
              type: 'program',
              channel,
              program: d1,
              byteLength: data.length,
              summary: `Program Change #${d1}`,
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
          byteLength: packet.length,
          summary: label ? `${label} (${packet.length}B)` : `SysEx Out (${packet.length}B)`,
          rawHex: formatBytesHex(packet),
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
    (entry: Omit<MidiEventLog, 'id' | 'timestamp' | 'timestampMs'>) => {
      appendLog(entry);
    },
    [appendLog]
  );

  const clearLogs = useCallback(() => setMidiLogs([]), []);
  const clearSysexStatus = useCallback(() => {
    setPermissionError(null);
    setPermissionIssue('none');
    setSysexStatus({ code: 'idle', message: 'Idle' });
  }, []);

  return {
    supported,
    connected,
    hasMidiAccess,
    sysexAllowed,
    connectionPhase,
    connectionMessage,
    permissionError,
    permissionIssue,
    permissionRequesting,
    permissionAttemptCount,
    isInIframe,
    isFirefox,
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
    scanPorts,
    connect,
    disconnect,
    sendSysex,
    runSysexQueue,
    sendFirmwareFrameWithAck,
    logSimulatedEvent,
    clearLogs,
  };
}
