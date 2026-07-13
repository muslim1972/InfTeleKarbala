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
 * 
 * استراتيجية التشغيل:
 * 1. محاولة التشغيل التلقائي فوراً (يعمل في PWA والتطبيقات المثبتة)
 * 2. إذا منع المتصفح التشغيل، ننتظر أول تفاعل من المستخدم
 */

import { useRef, useCallback } from 'react';

export const useSplashAudio = () => {
  const audioContextRef = useRef<AudioContext | null>(null);
  const isPlayingRef = useRef(false);

  /** تشغيل جميع طبقات النغمة على AudioContext جاهز */
  const _startNotes = useCallback((ctx: AudioContext) => {
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.35, ctx.currentTime);
    masterGain.gain.linearRampToValueAtTime(0.4, ctx.currentTime + 1);
    masterGain.gain.linearRampToValueAtTime(0.35, ctx.currentTime + 10);
    masterGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 13);
    masterGain.connect(ctx.destination);

    // ── Reverb (Convolution) ─────────────────────────────
    const convolver = ctx.createConvolver();
    const reverbLength = ctx.sampleRate * 4; // زيادة الرنين
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
      { freq: 130.81, start: 0, dur: 12 },   // C3
      { freq: 196.00, start: 0, dur: 12 },   // G3
      { freq: 261.63, start: 0.3, dur: 11.7 }, // C4
      { freq: 329.63, start: 0.6, dur: 11.4 }, // E4
      { freq: 392.00, start: 3, dur: 9 },   // G4
    ];

    padNotes.forEach(({ freq, start, dur }) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);

      const padGain = ctx.createGain();
      padGain.gain.setValueAtTime(0, ctx.currentTime + start);
      padGain.gain.linearRampToValueAtTime(0.06, ctx.currentTime + start + 2);
      padGain.gain.setValueAtTime(0.06, ctx.currentTime + start + dur - 3);
      padGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + dur);

      osc.connect(padGain);
      padGain.connect(dryGain);
      padGain.connect(convolver);

      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + start + dur);
    });

    // ── الطبقة 2: الـ Bell Chimes (نغمات جرس كريستالية) ──
    const bellNotes = [
      { freq: 523.25, time: 0.5, vol: 0.12 },   // C5
      { freq: 659.25, time: 1.0, vol: 0.10 },   // E5
      { freq: 783.99, time: 1.5, vol: 0.11 },   // G5
      { freq: 1046.50, time: 2.0, vol: 0.09 },  // C6
      { freq: 783.99, time: 3.5, vol: 0.08 },   // G5
      { freq: 880.00, time: 5.5, vol: 0.08 },   // A5
      { freq: 1046.50, time: 7.5, vol: 0.07 }, // C6
      { freq: 1318.51, time: 9.0, vol: 0.06 }, // E6
      { freq: 1567.98, time: 10.5, vol: 0.05 }, // G6
    ];

    bellNotes.forEach(({ freq, time, vol }) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);

      const osc2 = ctx.createOscillator();
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(freq * 2, ctx.currentTime); 

      const bellGain = ctx.createGain();
      bellGain.gain.setValueAtTime(vol, ctx.currentTime + time);
      bellGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + time + 3);

      const bellGain2 = ctx.createGain();
      bellGain2.gain.setValueAtTime(vol * 0.3, ctx.currentTime + time);
      bellGain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + time + 2);

      osc.connect(bellGain);
      osc2.connect(bellGain2);
      bellGain.connect(dryGain);
      bellGain.connect(convolver);
      bellGain2.connect(dryGain);

      osc.start(ctx.currentTime + time);
      osc.stop(ctx.currentTime + time + 3.5);
      osc2.start(ctx.currentTime + time);
      osc2.stop(ctx.currentTime + time + 2.5);
    });

    // ── الطبقة 3: Sub Bass (بيس عميق يُشعر بالفخامة) ────
    const subOsc = ctx.createOscillator();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(65.41, ctx.currentTime); 

    const subGain = ctx.createGain();
    subGain.gain.setValueAtTime(0, ctx.currentTime);
    subGain.gain.linearRampToValueAtTime(0.08, ctx.currentTime + 2);
    subGain.gain.setValueAtTime(0.08, ctx.currentTime + 10);
    subGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 12.5);

    subOsc.connect(subGain);
    subGain.connect(dryGain);

    subOsc.start(ctx.currentTime);
    subOsc.stop(ctx.currentTime + 13);

    // ── الطبقة 4: Shimmer (بريق عالي التردد) ─────────────
    const shimmerFreqs = [2093, 2637, 3136]; 
    shimmerFreqs.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);

      const shimmerGain = ctx.createGain();
      shimmerGain.gain.setValueAtTime(0, ctx.currentTime + 1.5 + i * 0.2);
      shimmerGain.gain.linearRampToValueAtTime(0.008, ctx.currentTime + 3 + i * 0.2);
      shimmerGain.gain.setValueAtTime(0.008, ctx.currentTime + 10);
      shimmerGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 12.5);

      osc.connect(shimmerGain);
      shimmerGain.connect(convolver);

      osc.start(ctx.currentTime + 1.5 + i * 0.2);
      osc.stop(ctx.currentTime + 13);
    });
  }, []);

  /**
   * playIntro — محاولة التشغيل التلقائي
   * يعود بـ true إذا نجح التشغيل فوراً، false إذا منع المتصفح الصوت
   */
  const playIntro = useCallback((): boolean => {
    if (isPlayingRef.current) return true;

    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = ctx;

      // إذا كان الـ AudioContext في حالة suspended (المتصفح منع التشغيل)
      // نحاول استئنافه — هذه الحيلة تعمل في PWA والتطبيقات المثبتة
      if (ctx.state === 'suspended') {
        const resumePromise = ctx.resume();
        resumePromise.then(() => {
          if (!isPlayingRef.current) {
            isPlayingRef.current = true;
            _startNotes(ctx);
          }
        }).catch(() => {
          // المتصفح رفض — سنحتاج تفاعل المستخدم
        });
        // نتحقق فوراً: هل نجح الاستئناف بشكل متزامن؟
        // في بعض المتصفحات ctx.state يتغير فوراً
        if (ctx.state === 'running') {
          isPlayingRef.current = true;
          _startNotes(ctx);
          return true;
        }
        return false;
      }

      // AudioContext يعمل مباشرة — نشغّل النغمات
      isPlayingRef.current = true;
      _startNotes(ctx);
      return true;
    } catch {
      return false;
    }
  }, [_startNotes]);

  const stopAudio = useCallback(() => {
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    isPlayingRef.current = false;
  }, []);

  return { playIntro, stopAudio };
};
