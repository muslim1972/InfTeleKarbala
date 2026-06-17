/**
 * SplashScreen.tsx
 * ─────────────────────────────────────────────────────────
 * واجهة افتتاحية فخمة لنظام الإدارة الموحد - ITPC كربلاء
 * مدتها 15 ثانية مع خلفية مصفوفة رقمية (Binary Rain).
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSplashAudio } from '../hooks/useSplashAudio';
import { LogoGlow } from '../components/visual/LogoGlow';

// ── خلفية المصفوفة الرقمية (Binary Background) ──────────
const BINARY_STREAMS_COUNT = 50; // تقليل العدد قليلاً لتقليل التشتيت

const BinaryBackground = () => {
  const streams = useMemo(() => {
    return Array.from({ length: BINARY_STREAMS_COUNT }).map((_, i) => ({
      id: i,
      left: `${(i / BINARY_STREAMS_COUNT) * 100}%`,
      duration: Math.random() * 10 + 15,
      // تأخير عشوائي لكي لا تنزل كل السلاسل في نفس اللحظة
      delay: Math.random() * 12, 
      initialY: -100, // تبدأ دائماً من خارج الشاشة من الأعلى
      fontSize: Math.random() * 8 + 12,
      opacity: Math.random() * 0.4 + 0.2,
      binary: Array.from({ length: Math.floor(Math.random() * 6 + 10) }).map(() => (Math.random() > 0.5 ? '1' : '0')).join('\n')
    }));
  }, []);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none select-none z-0">
      {streams.map((s) => (
        <motion.div
          key={s.id}
          className="absolute text-sky-400 font-mono whitespace-pre leading-[1.8] blur-[0.4px]"
          style={{ 
            left: s.left, 
            fontSize: s.fontSize,
            opacity: s.opacity,
          }}
          initial={{ y: `${s.initialY}%` }} // تبدأ من موقع عشوائي لضمان الامتلاء الفوري
          animate={{ y: '400%' }} 
          transition={{
            duration: s.duration,
            repeat: Infinity,
            delay: s.delay,
            ease: "linear"
          }}
        >
          {s.binary}
        </motion.div>
      ))}
      
      {/* جسيمات متوهجة هادئة */}
      {Array.from({ length: 30 }).map((_, i) => (
        <motion.div
          key={`static-${i}`}
          className="absolute text-white/60 font-mono font-bold drop-shadow-[0_0_10px_rgba(56,189,248,0.5)]"
          style={{
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            fontSize: `${Math.random() * 20 + 8}px`
          }}
          initial={{ opacity: 0, scale: 0 }}
          animate={{ 
            opacity: [0, 0.4, 0], 
            scale: [0.6, 1.1, 0.6],
            filter: ['blur(1px)', 'blur(0px)', 'blur(1px)']
          }}
          transition={{
            duration: Math.random() * 6 + 6,
            repeat: Infinity,
            delay: Math.random() * 20
          }}
        >
          {Math.random() > 0.5 ? '1' : '0'}
        </motion.div>
      ))}
    </div>
  );
};

interface SplashScreenProps {
  onComplete: () => void;
}

export const SplashScreen = ({ onComplete }: SplashScreenProps) => {
  const [isExiting, setIsExiting] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);
  const { playIntro, stopAudio } = useSplashAudio();

  const handleSkip = useCallback(() => {
    if (isExiting) return;
    setIsExiting(true);
    stopAudio();
  }, [isExiting, stopAudio]);

  // ── تشغيل المؤقت والموسيقى ─────────────────────────
  useEffect(() => {
    const exitTimer = window.setTimeout(() => {
      setIsExiting(true);
      stopAudio();
    }, 10000);

    return () => {
      window.clearTimeout(exitTimer);
      stopAudio();
    };
  }, [stopAudio]);

  // ── تفعيل الموسيقى بعد أول تفاعل ──
  useEffect(() => {
    const handleFirstInteraction = () => {
      if (!hasInteracted) {
        setHasInteracted(true);
        playIntro();
      }
    };

    window.addEventListener('click', handleFirstInteraction, { once: true });
    window.addEventListener('touchstart', handleFirstInteraction, { once: true });
    window.addEventListener('keydown', handleFirstInteraction, { once: true });

    return () => {
      window.removeEventListener('click', handleFirstInteraction);
      window.removeEventListener('touchstart', handleFirstInteraction);
      window.removeEventListener('keydown', handleFirstInteraction);
    };
  }, [playIntro, hasInteracted]);

  return (
    <AnimatePresence onExitComplete={onComplete}>
      {!isExiting && (
        <motion.div
          key="splash"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.5, ease: 'easeInOut' }}
          className="fixed inset-0 z-[99999] flex flex-col items-center justify-center overflow-hidden select-none"
          style={{ background: '#030510' }}
          dir="rtl"
          onClick={() => {
            if (!hasInteracted) {
              setHasInteracted(true);
              playIntro();
            }
          }}
        >

          {/* ── الخلفية المتدرجة المتحركة ─────────────────── */}
          <div className="absolute inset-0 overflow-hidden">
            <motion.div
              className="absolute inset-0"
              animate={{
                background: [
                  'radial-gradient(ellipse at 30% 50%, rgba(10,36,99,0.9) 0%, transparent 70%)',
                  'radial-gradient(ellipse at 70% 30%, rgba(10,36,99,0.9) 0%, transparent 70%)',
                  'radial-gradient(ellipse at 50% 70%, rgba(10,36,99,0.9) 0%, transparent 70%)',
                  'radial-gradient(ellipse at 30% 50%, rgba(10,36,99,0.9) 0%, transparent 70%)',
                ],
              }}
              transition={{ duration: 20, ease: 'linear', repeat: Infinity }}
            />
          </div>

          {/* ── خلفية الـ Binary Rain (الميزة الجديدة) ────────── */}
          <BinaryBackground />

          {/* ── الشعار الرئيسي + الهالة الضوئية ──────────────────── */}
          <div className="relative flex items-center justify-center mb-10 md:mb-16">

            {/* الهالات الضوئية المحيطة */}
            {[0, 1, 2].map((i) => (
              <motion.div
                key={`glow-${i}`}
                className="absolute rounded-full pointer-events-none"
                style={{
                  border: '2px solid',
                  borderColor: i === 0 ? 'rgba(34,197,94,0.3)' : 'rgba(96,165,250,0.2)',
                  boxShadow: '0 0 60px rgba(34,197,94,0.15)',
                }}
                initial={{ width: 0, height: 0, opacity: 0 }}
                animate={{
                  width: ['250px', '700px', '1000px'],
                  height: ['250px', '700px', '1000px'],
                  opacity: [0, 0.4, 0],
                }}
                transition={{
                  duration: 5,
                  delay: 3 + (i * 1.0), 
                  repeat: Infinity,
                  ease: 'easeOut',
                }}
              />
            ))}

            {/* الشعار الرئيسي */}
            <div className="relative z-10">
              <LogoGlow />
            </div>
          </div>

          {/* ── النصوص المتسلسلة ──────────────────────────── */}
          <div className="relative z-10 text-center space-y-4 md:space-y-6 px-6">

            {/* خط فاصل أنيق */}
            <motion.div
              className="mx-auto h-px overflow-hidden"
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 280, opacity: 1 }}
              transition={{ delay: 4, duration: 1.5, ease: 'easeOut' }}
            >
              <div className="h-full w-full bg-gradient-to-r from-transparent via-emerald-400/80 to-transparent" />
            </motion.div>

            {/* السطر 1: وزارة الاتصالات */}
            <motion.h2
              className="text-xl md:text-2xl font-bold text-white/95 font-tajawal tracking-wider"
              initial={{ opacity: 0, y: 20, filter: 'blur(8px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              transition={{ delay: 4.8, duration: 1.0, ease: 'easeOut' }}
            >
              وزارة الاتصالات
            </motion.h2>

            {/* السطر 2: الشركة العامة */}
            <motion.h3
              className="text-lg md:text-xl font-semibold text-white/85 font-tajawal"
              initial={{ opacity: 0, y: 20, filter: 'blur(8px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              transition={{ delay: 5.8, duration: 1.0, ease: 'easeOut' }}
            >
              الشركة العامة للاتصالات والمعلوماتية
            </motion.h3>

            {/* السطر 3: المديرية */}
            <motion.h3
              className="text-lg md:text-xl font-semibold text-white/80 font-tajawal"
              initial={{ opacity: 0, y: 20, filter: 'blur(8px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              transition={{ delay: 6.8, duration: 1.0, ease: 'easeOut' }}
            >
              مديرية اتصالات ومعلوماتية كربلاء المقدسة
            </motion.h3>

            {/* السطر 4: اسم النظام */}
            <motion.div
              className="pt-4"
              initial={{ opacity: 0, scale: 0.9, filter: 'blur(10px)' }}
              animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
              transition={{ delay: 8.0, duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
            >
              <span className="inline-block px-8 py-3 rounded-xl text-2xl md:text-4xl font-black text-white font-tajawal border border-emerald-500/30 bg-gradient-to-r from-emerald-600/20 via-emerald-500/10 to-emerald-700/20 backdrop-blur-sm shadow-[0_0_30px_rgba(34,197,94,0.15)]">
                نظام الادارة الموحد
              </span>
            </motion.div>
          </div>

          {/* ── شريط التقدم السفلي ─────────────────────────── */}
          <div className="absolute bottom-0 left-0 right-0">
            <motion.div
              className="h-2 origin-left"
              style={{
                background: 'linear-gradient(90deg, #22c55e, #3b82f6, #10b981, #22c55e)',
                backgroundSize: '200% 100%',
              }}
              initial={{ scaleX: 0 }}
              animate={{
                scaleX: 1,
                backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'],
              }}
              transition={{
                scaleX: { duration: 10, ease: 'linear' },
                backgroundPosition: { duration: 6, repeat: Infinity, ease: 'linear' },
              }}
            />
          </div>

          {/* ── زر التخطي ──────────────────────────────────── */}
          <motion.button
            className="absolute top-8 left-8 md:top-12 md:left-12 z-50 px-8 py-3 rounded-full text-sm font-bold text-white/50 hover:text-white/90 border border-white/20 hover:border-emerald-500/60 hover:bg-emerald-500/15 backdrop-blur-lg transition-all duration-500 font-tajawal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 2, duration: 1.2 }}
            onClick={handleSkip}
          >
            تخطي العرض ←
          </motion.button>

          {/* ── رسالة تلميح الصوت ── */}
          {!hasInteracted && (
            <motion.p
              className="absolute bottom-16 text-white/40 text-sm font-tajawal tracking-[0.3em]"
              animate={{ opacity: [0.3, 0.8, 0.3], y: [0, -8, 0] }}
              transition={{ duration: 3.5, repeat: Infinity }}
            >
              انقر لتفعيل التجربة الصوتية الفاخرة
            </motion.p>
          )}

        </motion.div>
      )}
    </AnimatePresence>
  );
};
