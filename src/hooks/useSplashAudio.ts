/**
 * useSplashAudio.ts
 * ─────────────────────────────────────────────────────────
 * الهوية الصوتية البرمجية (Sovereign Telecom Sonic Identity)
 * لوزارة الاتصالات — الشركة العامة للاتصالات والمعلوماتية
 *
 * المدة: 6 ثوانٍ بالضبط عبر Web Audio API الخالص (دون أي ملفات خارجية).
 * البنية الأكوستية:
 * - تردد أساسي دافئ (C2/C3/G3/D4/E4) يعبر عن استقرار الشبكة الوطنية
 * - 6 نبضات بلورية صاعدة (Telecom Fiber Chimes) تعبر عن تدفق البيانات
 * - مرشح ترددات منخفضة (Lowpass) + صدى قاعي مجسم (Stereo Convolution Reverb)
 * - يحافظ على ذات استراتيجية التشغيل الفوري والاستئناف المعتمدة في التطبيق
 */

import { useRef, useCallback } from 'react';

export const useSplashAudio = () => {
  const audioContextRef = useRef<AudioContext | null>(null);
  const isPlayingRef = useRef(false);

  /** بناء طبقات الهوية الصوتية لمدة 6 ثوانٍ على AudioContext نشط */
  const _startNotes = useCallback((ctx: AudioContext) => {
    const now = ctx.currentTime;

    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.001, now);
    masterGain.gain.linearRampToValueAtTime(0.36, now + 0.55);
    masterGain.gain.setValueAtTime(0.34, now + 3.9);
    masterGain.gain.exponentialRampToValueAtTime(0.0005, now + 5.75);
    masterGain.connect(ctx.destination);

    // مرشح دافئ يفتح تدريجياً متناغماً مع انبثاق الشعار من الوسط
    const warmthFilter = ctx.createBiquadFilter();
    warmthFilter.type = 'lowpass';
    warmthFilter.frequency.setValueAtTime(900, now);
    warmthFilter.frequency.exponentialRampToValueAtTime(4800, now + 1.8);
    warmthFilter.connect(masterGain);

    // ── صدى مجسم قصير ورصين (2.6 ثانية) ────────────────
    const convolver = ctx.createConvolver();
    const reverbLength = Math.floor(ctx.sampleRate * 2.6);
    const reverbBuffer = ctx.createBuffer(2, reverbLength, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const data = reverbBuffer.getChannelData(ch);
      for (let i = 0; i < reverbLength; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / reverbLength, 2.8);
      }
    }
    convolver.buffer = reverbBuffer;

    const reverbGain = ctx.createGain();
    reverbGain.gain.setValueAtTime(0.20, now);
    convolver.connect(reverbGain);
    reverbGain.connect(warmthFilter);

    const dryGain = ctx.createGain();
    dryGain.gain.setValueAtTime(0.82, now);
    dryGain.connect(warmthFilter);

    // ── الطبقة 1: أساس اتصالاتي دافئ (Major9 Open Pad) ────
    const padNotes = [
      { freq: 130.81, start: 0.0, dur: 5.5, vol: 0.06 }, // C3
      { freq: 196.00, start: 0.05, dur: 5.45, vol: 0.05 }, // G3
      { freq: 293.66, start: 0.5, dur: 4.9, vol: 0.032 }, // D4 (إضافة اتصالاتية حديثة)
      { freq: 329.63, start: 0.9, dur: 4.5, vol: 0.032 }, // E4
    ];

    padNotes.forEach(({ freq, start, dur, vol }) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + start);

      const padGain = ctx.createGain();
      padGain.gain.setValueAtTime(0.0001, now + start);
      padGain.gain.linearRampToValueAtTime(vol, now + start + 0.9);
      padGain.gain.setValueAtTime(vol, now + start + dur - 1.6);
      padGain.gain.exponentialRampToValueAtTime(0.0001, now + start + dur);

      osc.connect(padGain);
      padGain.connect(dryGain);
      padGain.connect(convolver);

      osc.start(now + start);
      osc.stop(now + start + dur + 0.05);
    });

    // ── الطبقة 2: نبضات الألياف البلورية (6-Second Signature Chimes) ──
    const bellNotes = [
      { freq: 523.25, time: 0.35, dur: 2.4, vol: 0.11 },  // C5
      { freq: 783.99, time: 0.72, dur: 2.4, vol: 0.095 }, // G5 (بعد خامس واسع)
      { freq: 587.33, time: 1.10, dur: 2.5, vol: 0.09 },  // D5
      { freq: 659.25, time: 1.50, dur: 2.9, vol: 0.10 },  // E5
      { freq: 1046.50, time: 2.00, dur: 3.3, vol: 0.085 }, // C6 (اكتمال الشعار في المنتصف)
      { freq: 1567.98, time: 2.55, dur: 2.9, vol: 0.04 },  // G6 (همس كريستالي نهائي)
    ];

    bellNotes.forEach(({ freq, time, dur, vol }) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + time);

      const osc2 = ctx.createOscillator();
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(freq * 2, now + time);

      const bellGain = ctx.createGain();
      bellGain.gain.setValueAtTime(0.0001, now + time);
      bellGain.gain.linearRampToValueAtTime(vol, now + time + 0.03);
      bellGain.gain.exponentialRampToValueAtTime(0.0005, now + time + dur);

      const bellGain2 = ctx.createGain();
      bellGain2.gain.setValueAtTime(0.0001, now + time);
      bellGain2.gain.linearRampToValueAtTime(vol * 0.16, now + time + 0.02);
      bellGain2.gain.exponentialRampToValueAtTime(0.0005, now + time + Math.min(dur, 1.4));

      osc.connect(bellGain);
      osc2.connect(bellGain2);
      bellGain.connect(dryGain);
      bellGain.connect(convolver);
      bellGain2.connect(dryGain);

      osc.start(now + time);
      osc.stop(now + time + dur + 0.05);
      osc2.start(now + time);
      osc2.stop(now + time + Math.min(dur, 1.45));
    });

    // ── الطبقة 3: Sub Bass رصين (C2) ─────────────────────
    const subOsc = ctx.createOscillator();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(65.41, now);

    const subGain = ctx.createGain();
    subGain.gain.setValueAtTime(0.0001, now);
    subGain.gain.linearRampToValueAtTime(0.045, now + 0.8);
    subGain.gain.setValueAtTime(0.045, now + 3.6);
    subGain.gain.exponentialRampToValueAtTime(0.0001, now + 5.5);

    subOsc.connect(subGain);
    subGain.connect(dryGain);
    subOsc.start(now);
    subOsc.stop(now + 5.6);

    // ── الطبقة 4: Shimmer هوائي خفيف في الصدى ──────────────
    [1318.51, 2093.0].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + 1.6 + i * 0.25);

      const shimmerGain = ctx.createGain();
      shimmerGain.gain.setValueAtTime(0.0001, now + 1.6 + i * 0.25);
      shimmerGain.gain.linearRampToValueAtTime(0.006, now + 2.4 + i * 0.25);
      shimmerGain.gain.exponentialRampToValueAtTime(0.0001, now + 5.4);

      osc.connect(shimmerGain);
      shimmerGain.connect(convolver);
      osc.start(now + 1.6 + i * 0.25);
      osc.stop(now + 5.5);
    });
  }, []);

  /**
   * playIntro — نفس آلية التشغيل الفوري والاستئناف التي تعمل عبر جميع الأجهزة والمتصفحات
   */
  const playIntro = useCallback((): boolean => {
    if (isPlayingRef.current) return true;

    try {
      let ctx = audioContextRef.current;
      if (!ctx || ctx.state === 'closed') {
        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (!AudioCtx) return false;
        ctx = new AudioCtx();
        audioContextRef.current = ctx;
      }

      if (ctx.state === 'suspended') {
        ctx.resume().then(() => {
          if (!isPlayingRef.current && audioContextRef.current === ctx && ctx.state === 'running') {
            isPlayingRef.current = true;
            _startNotes(ctx);
          }
        }).catch(() => {
          // سيستمر التنفيذ أو الاستئناف التلقائي في المحاولة التالية دون تعطيل
        });

        if ((ctx.state as AudioContextState) === 'running') {
          isPlayingRef.current = true;
          _startNotes(ctx);
          return true;
        }
        return false;
      }

      isPlayingRef.current = true;
      _startNotes(ctx);
      return true;
    } catch {
      return false;
    }
  }, [_startNotes]);

  const stopAudio = useCallback(() => {
    if (audioContextRef.current) {
      if (audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(() => {});
      }
      audioContextRef.current = null;
    }
    isPlayingRef.current = false;
  }, []);

  return { playIntro, stopAudio };
};
