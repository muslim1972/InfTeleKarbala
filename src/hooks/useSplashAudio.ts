/**
 * useSplashAudio.ts
 * ─────────────────────────────────────────────────────────
 * Hook مخصص لتوليد نغمة افتتاحية احترافية (Corporate Chime)
 * باستخدام Web Audio API — بدون ملفات خارجية.
 * 
 * النغمة مُصممة لتكون:
 * - فخمة ورصينة (تناسب جهة حكومية)
 * - مدتها ~8 ثوانٍ مع تلاشي تدريجي
 * - تتكون من أوتار (Chords) + Pad + Bell
 */

import { useRef, useCallback } from 'react';

export const useSplashAudio = () => {
  const audioContextRef = useRef<AudioContext | null>(null);
  const isPlayingRef = useRef(false);

  const playIntro = useCallback(() => {
    if (isPlayingRef.current) return;
    isPlayingRef.current = true;

    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    audioContextRef.current = ctx;

    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.35, ctx.currentTime);
    masterGain.gain.linearRampToValueAtTime(0.4, ctx.currentTime + 1);
    masterGain.gain.linearRampToValueAtTime(0.35, ctx.currentTime + 7);
    masterGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 9.5);
    masterGain.connect(ctx.destination);

    // ── Reverb (Convolution) ─────────────────────────────
    const convolver = ctx.createConvolver();
    const reverbLength = ctx.sampleRate * 2.5;
    const reverbBuffer = ctx.createBuffer(2, reverbLength, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const data = reverbBuffer.getChannelData(ch);
      for (let i = 0; i < reverbLength; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / reverbLength, 2.5);
      }
    }
    convolver.buffer = reverbBuffer;

    const reverbGain = ctx.createGain();
    reverbGain.gain.setValueAtTime(0.15, ctx.currentTime);
    convolver.connect(reverbGain);
    reverbGain.connect(masterGain);

    const dryGain = ctx.createGain();
    dryGain.gain.setValueAtTime(0.85, ctx.currentTime);
    dryGain.connect(masterGain);

    // ── الطبقة 1: الـ Pad (خلفية أوركسترالية دافئة) ─────
    const padNotes = [
      { freq: 130.81, start: 0, dur: 9 },   // C3
      { freq: 196.00, start: 0, dur: 9 },   // G3
      { freq: 261.63, start: 0.5, dur: 8.5 }, // C4
      { freq: 329.63, start: 1, dur: 8 },   // E4
    ];

    padNotes.forEach(({ freq, start, dur }) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);

      const padGain = ctx.createGain();
      padGain.gain.setValueAtTime(0, ctx.currentTime + start);
      padGain.gain.linearRampToValueAtTime(0.06, ctx.currentTime + start + 1.5);
      padGain.gain.setValueAtTime(0.06, ctx.currentTime + start + dur - 2);
      padGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + dur);

      osc.connect(padGain);
      padGain.connect(dryGain);
      padGain.connect(convolver);

      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + start + dur);
    });

    // ── الطبقة 2: الـ Bell Chimes (نغمات جرس كريستالية) ──
    const bellNotes = [
      { freq: 523.25, time: 0.8, vol: 0.12 },   // C5
      { freq: 659.25, time: 1.6, vol: 0.10 },   // E5
      { freq: 783.99, time: 2.4, vol: 0.11 },   // G5
      { freq: 1046.50, time: 3.2, vol: 0.09 },  // C6
      { freq: 783.99, time: 4.0, vol: 0.08 },   // G5
      { freq: 659.25, time: 5.0, vol: 0.07 },   // E5
      { freq: 523.25, time: 6.0, vol: 0.06 },   // C5
      { freq: 392.00, time: 7.0, vol: 0.05 },   // G4
    ];

    bellNotes.forEach(({ freq, time, vol }) => {
      // إنشاء نغمة جرس مركبة (Sine + ضجيج بسيط)
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);

      const osc2 = ctx.createOscillator();
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(freq * 2, ctx.currentTime); // الهارمونيك الثاني

      const bellGain = ctx.createGain();
      bellGain.gain.setValueAtTime(vol, ctx.currentTime + time);
      bellGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + time + 2.5);

      const bellGain2 = ctx.createGain();
      bellGain2.gain.setValueAtTime(vol * 0.3, ctx.currentTime + time);
      bellGain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + time + 1.5);

      osc.connect(bellGain);
      osc2.connect(bellGain2);
      bellGain.connect(dryGain);
      bellGain.connect(convolver);
      bellGain2.connect(dryGain);

      osc.start(ctx.currentTime + time);
      osc.stop(ctx.currentTime + time + 3);
      osc2.start(ctx.currentTime + time);
      osc2.stop(ctx.currentTime + time + 2);
    });

    // ── الطبقة 3: Sub Bass (بيس عميق يُشعر بالفخامة) ────
    const subOsc = ctx.createOscillator();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(65.41, ctx.currentTime); // C2

    const subGain = ctx.createGain();
    subGain.gain.setValueAtTime(0, ctx.currentTime);
    subGain.gain.linearRampToValueAtTime(0.08, ctx.currentTime + 2);
    subGain.gain.setValueAtTime(0.08, ctx.currentTime + 6);
    subGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 9);

    subOsc.connect(subGain);
    subGain.connect(dryGain);

    subOsc.start(ctx.currentTime);
    subOsc.stop(ctx.currentTime + 9.5);

    // ── الطبقة 4: Shimmer (بريق عالي التردد) ─────────────
    const shimmerFreqs = [2093, 2637, 3136]; // C7, E7, G7
    shimmerFreqs.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);

      const shimmerGain = ctx.createGain();
      shimmerGain.gain.setValueAtTime(0, ctx.currentTime + 2 + i * 0.3);
      shimmerGain.gain.linearRampToValueAtTime(0.008, ctx.currentTime + 3 + i * 0.3);
      shimmerGain.gain.setValueAtTime(0.008, ctx.currentTime + 7);
      shimmerGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 9);

      osc.connect(shimmerGain);
      shimmerGain.connect(convolver);

      osc.start(ctx.currentTime + 2 + i * 0.3);
      osc.stop(ctx.currentTime + 9.5);
    });

  }, []);

  const stopAudio = useCallback(() => {
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    isPlayingRef.current = false;
  }, []);

  return { playIntro, stopAudio };
};
