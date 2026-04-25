/**
 * SplashScreen.tsx
 * ─────────────────────────────────────────────────────────
 * واجهة افتتاحية فخمة لنظام الإدارة الموحد - ITPC كربلاء
 * مدتها 20 ثانية مع حركات SpaceLogos خلفية مستمرة.
 */

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSplashAudio } from '../hooks/useSplashAudio';

// ── الشعارات الطائرة (SpaceLogos) ───────────────────────
const SPACE_LOGOS_COUNT = 18;
const LOGO_SOURCES = ['/icon-192.png', '/logo-new.png'];

const SpaceLogos = () => {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {Array.from({ length: SPACE_LOGOS_COUNT }).map((_, i) => {
        // تحديد اتجاه الخروج عشوائياً (أحد الجوانب الأربعة)
        const side = ['top', 'bottom', 'left', 'right'][Math.floor(Math.random() * 4)];
        const targetX = side === 'left' ? -120 : side === 'right' ? 120 : (Math.random() * 240 - 120);
        const targetY = side === 'top' ? -120 : side === 'bottom' ? 120 : (Math.random() * 240 - 120);
        
        return (
          <motion.img
            key={i}
            src={LOGO_SOURCES[Math.floor(Math.random() * LOGO_SOURCES.length)]}
            className="absolute w-12 h-12 opacity-0 grayscale brightness-[2] mix-blend-screen"
            initial={{ 
              x: '50%', 
              y: '50%', 
              scale: 0, 
              opacity: 0,
              left: '-24px', 
              top: '-24px' 
            }}
            animate={{ 
              x: `${50 + targetX}%`, 
              y: `${50 + targetY}%`, 
              scale: [0, 1.5, 5], 
              opacity: [0, 0.4, 0] 
            }}
            transition={{ 
              duration: Math.random() * 4 + 4, // سرعة متوسطة فخمة
              repeat: Infinity, 
              delay: Math.random() * 20,
              ease: "easeIn"
            }}
          />
        );
      })}
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
    }, 20000);

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

    try {
      playIntro();
      setHasInteracted(true);
    } catch {
      window.addEventListener('click', handleFirstInteraction, { once: true });
      window.addEventListener('touchstart', handleFirstInteraction, { once: true });
    }

    return () => {
      window.removeEventListener('click', handleFirstInteraction);
      window.removeEventListener('touchstart', handleFirstInteraction);
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
          style={{ background: '#05081a' }}
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

          {/* ── الشعارات الطائرة (خلفية مستمرة) ────────── */}
          <SpaceLogos />

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
                  delay: 7 + (i * 1.5), 
                  repeat: Infinity,
                  ease: 'easeOut',
                }}
              />
            ))}

            {/* الشعار الرئيسي */}
            <motion.div
              className="relative z-10"
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1.35 }} 
              transition={{
                delay: 7, 
                duration: 2.8,
                ease: [0.16, 1, 0.3, 1],
              }}
            >
              <motion.img
                src="/logo-new.png"
                alt="ITPC Logo"
                className="max-w-[55vw] max-h-[40vh] md:max-h-[45vh] w-auto h-auto object-contain drop-shadow-[0_0_80px_rgba(34,197,94,0.45)]"
                animate={{
                  y: [0, -12, 0],
                  filter: [
                    'drop-shadow(0 0 45px rgba(34,197,94,0.35))',
                    'drop-shadow(0 0 75px rgba(34,197,94,0.55))',
                    'drop-shadow(0 0 45px rgba(34,197,94,0.35))',
                  ],
                }}
                transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut' }}
              />
            </motion.div>
          </div>

          {/* ── النصوص المتسلسلة ──────────────────────────── */}
          <div className="relative z-10 text-center space-y-4 md:space-y-6 px-6">

            {/* خط فاصل أنيق */}
            <motion.div
              className="mx-auto h-px overflow-hidden"
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 280, opacity: 1 }}
              transition={{ delay: 8, duration: 1.8, ease: 'easeOut' }}
            >
              <div className="h-full w-full bg-gradient-to-r from-transparent via-emerald-400/80 to-transparent" />
            </motion.div>

            {/* السطر 1: وزارة الاتصالات */}
            <motion.h2
              className="text-xl md:text-3xl font-bold text-white/95 font-tajawal tracking-wider"
              initial={{ opacity: 0, y: 35, filter: 'blur(12px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              transition={{ delay: 9.2, duration: 1.6, ease: 'easeOut' }}
            >
              وزارة الاتصالات
            </motion.h2>

            {/* السطر 2: المديرية */}
            <motion.h3
              className="text-lg md:text-2xl font-semibold text-white/80 font-tajawal"
              initial={{ opacity: 0, y: 35, filter: 'blur(12px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              transition={{ delay: 10.8, duration: 1.6, ease: 'easeOut' }}
            >
              مديرية اتصالات ومعلوماتية كربلاء المقدسة
            </motion.h3>

            {/* السطر 3: قريبــــا */}
            <motion.div
              className="pt-6"
              initial={{ opacity: 0, scale: 0.5, filter: 'blur(15px)' }}
              animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
              transition={{ delay: 12.8, duration: 2.2, ease: [0.16, 1, 0.3, 1] }}
            >
              <span className="inline-block px-10 md:px-16 py-5 md:py-6 rounded-2xl text-3xl md:text-5xl font-black tracking-[0.25em] text-white font-tajawal border-2 border-emerald-500/50 bg-gradient-to-br from-emerald-600/40 via-emerald-500/25 to-emerald-700/40 shadow-[0_0_60px_rgba(34,197,94,0.3),inset_0_2px_0_rgba(255,255,255,0.2)] backdrop-blur-md">
                قريبــــاً
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
                scaleX: { duration: 20, ease: 'linear' },
                backgroundPosition: { duration: 6, repeat: Infinity, ease: 'linear' },
              }}
            />
          </div>

          {/* ── زر التخطي ──────────────────────────────────── */}
          <motion.button
            className="absolute top-8 left-8 md:top-12 md:left-12 z-50 px-8 py-3 rounded-full text-sm font-bold text-white/50 hover:text-white/90 border border-white/20 hover:border-emerald-500/60 hover:bg-emerald-500/15 backdrop-blur-lg transition-all duration-500 font-tajawal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 3, duration: 1.2 }}
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
