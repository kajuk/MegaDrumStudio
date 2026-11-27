// Lightweight Web Audio API drum synthesizer for instant pad auditioning

let audioCtx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (Ctor) {
      audioCtx = new Ctor();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

function createNoiseBuffer(ctx: AudioContext, durationSec: number): AudioBuffer {
  const sampleRate = ctx.sampleRate;
  const length = Math.floor(sampleRate * durationSec);
  const buffer = ctx.createBuffer(1, length, sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  return buffer;
}

export function playDrumSound(midiNote: number, velocity = 100): void {
  const ctx = getCtx();
  if (!ctx) return;

  const gainScale = Math.max(0.08, Math.min(1, velocity / 127));
  const now = ctx.currentTime;

  // Kick (35, 36)
  if (midiNote === 35 || midiNote === 36) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(145, now);
    osc.frequency.exponentialRampToValueAtTime(42, now + 0.12);
    gain.gain.setValueAtTime(gainScale * 0.9, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.32);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.34);
    return;
  }

  // Snare / Rim / Sidestick (37, 38, 39, 40)
  if (midiNote >= 37 && midiNote <= 40) {
    if (midiNote === 37) {
      // Sidestick click
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(920, now);
      osc.frequency.exponentialRampToValueAtTime(440, now + 0.03);
      gain.gain.setValueAtTime(gainScale * 0.55, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.055);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.06);
      return;
    }

    // Snare body
    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(midiNote === 40 ? 220 : 185, now);
    osc.frequency.exponentialRampToValueAtTime(105, now + 0.1);
    oscGain.gain.setValueAtTime(gainScale * 0.5, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
    osc.connect(oscGain);
    oscGain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.15);

    // Snare wires noise
    const noise = ctx.createBufferSource();
    noise.buffer = createNoiseBuffer(ctx, 0.22);
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 1350;
    const nGain = ctx.createGain();
    nGain.gain.setValueAtTime(gainScale * 0.55, now);
    nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    noise.connect(filter);
    filter.connect(nGain);
    nGain.connect(ctx.destination);
    noise.start(now);
    return;
  }

  // Hi-Hats (21-26, 42, 44, 46)
  if ((midiNote >= 21 && midiNote <= 26) || midiNote === 42 || midiNote === 44 || midiNote === 46) {
    const isOpen = midiNote === 46 || midiNote === 24 || midiNote === 26 || midiNote === 21;
    const isSemi = midiNote === 23 || midiNote === 25;
    const dur = isOpen ? 0.42 : isSemi ? 0.18 : 0.075;

    const noise = ctx.createBufferSource();
    noise.buffer = createNoiseBuffer(ctx, dur + 0.05);
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = midiNote === 44 ? 4200 : 6200;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(gainScale * (midiNote === 44 ? 0.35 : 0.45), now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    noise.start(now);
    return;
  }

  // Toms (41, 43, 45, 47, 48, 50)
  if ([41, 43, 45, 47, 48, 50].includes(midiNote)) {
    const pitchMap: Record<number, number> = {
      41: 72,
      43: 86,
      45: 102,
      47: 118,
      48: 136,
      50: 158,
    };
    const base = pitchMap[midiNote] || 110;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(base * 1.45, now);
    osc.frequency.exponentialRampToValueAtTime(base, now + 0.14);
    gain.gain.setValueAtTime(gainScale * 0.7, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.3);
    return;
  }

  // Ride Bell (53) / Cowbell (56)
  if (midiNote === 53 || midiNote === 56) {
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();
    osc1.type = 'triangle';
    osc2.type = 'square';
    osc1.frequency.value = midiNote === 53 ? 1120 : 540;
    osc2.frequency.value = midiNote === 53 ? 1680 : 810;
    gain.gain.setValueAtTime(gainScale * 0.32, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + (midiNote === 53 ? 0.38 : 0.14));
    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);
    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.4);
    osc2.stop(now + 0.4);
    return;
  }

  // Cymbals (49, 51, 52, 55, 57, 59) or fallback percussion
  const isCymbal = [49, 51, 52, 55, 57, 59].includes(midiNote);
  const dur = isCymbal ? (midiNote === 55 ? 0.45 : 0.85) : 0.12;
  const noise = ctx.createBufferSource();
  noise.buffer = createNoiseBuffer(ctx, dur + 0.05);
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = isCymbal ? 5200 : 1400;
  filter.Q.value = isCymbal ? 0.8 : 2.5;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(gainScale * (isCymbal ? 0.45 : 0.5), now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
  noise.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  noise.start(now);
}
