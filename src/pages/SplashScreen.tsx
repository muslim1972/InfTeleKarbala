/**
 * SplashScreen.tsx
 * ─────────────────────────────────────────────────────────
 * واجهة افتتاحية فخمة لنظام الإدارة الموحد - ITPC كربلاء
 * مدتها 10 ثوانٍ مع حركات Framer Motion احترافية.
 * 
 * المكونات:
 * 1. خلفية متحركة بتدرجات لونية (Gradient Mesh)
 * 2. الشعار يظهر من العدم ويكبر حتى نصف الشاشة
 * 3. هالة ضوئية متكررة من المركز
 * 4. جسيمات ضوئية (Particles)
 * 5. نصوص متسلسلة (وزارة → مديرية → نظام)
 * 6. شريط تقدم سفلي
 * 7. موسيقى افتتاحية (Web Audio API)
 */

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSplashAudio } from '../hooks/useSplashAudio';

// ── الجسيمات الضوئية ────────────────────────────────────
const PARTICLES = Array.from({ length: 20 }, (_, i) => ({
  id: i,
  x: Math.random() * 100,
  y: Math.random() * 100,
  size: Math.random() * 4 + 1,
  delay: Math.random() * 5,
  duration: Math.random() * 4 + 3,
}));

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
    // بدء العد التنازلي للـ 10 ثوانٍ
    const exitTimer = window.setTimeout(() => {
      setIsExiting(true);
      stopAudio();
    }, 10000);

    return () => {
      window.clearTimeout(exitTimer);
      stopAudio();
    };
  }, [stopAudio]);

  // ── تفعيل الموسيقى بعد أول تفاعل (سياسة المتصفح) ──
  useEffect(() => {
    const handleFirstInteraction = () => {
      if (!hasInteracted) {
        setHasInteracted(true);
        playIntro();
      }
    };

    // محاولة التشغيل التلقائي أولاً
    try {
      playIntro();
      setHasInteracted(true);
    } catch {
      // إذا فشل التشغيل التلقائي، ننتظر تفاعل المستخدم
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
          transition={{ duration: 1.2, ease: 'easeInOut' }}
          className="fixed inset-0 z-[99999] flex flex-col items-center justify-center overflow-hidden select-none"
          style={{ background: '#0a0e27' }}
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
            {/* تدرج رئيسي */}
            <motion.div
              className="absolute inset-0"
              animate={{
                background: [
                  'radial-gradient(ellipse at 30% 50%, rgba(10,36,99,0.8) 0%, transparent 70%)',
                  'radial-gradient(ellipse at 70% 30%, rgba(10,36,99,0.8) 0%, transparent 70%)',
                  'radial-gradient(ellipse at 50% 70%, rgba(10,36,99,0.8) 0%, transparent 70%)',
                  'radial-gradient(ellipse at 30% 50%, rgba(10,36,99,0.8) 0%, transparent 70%)',
                ],
              }}
              transition={{ duration: 10, ease: 'linear', repeat: 0 }}
            />
            {/* توهج أخضر (هوية ITPC) */}
            <motion.div
              className="absolute w-[600px] h-[600px] rounded-full opacity-20"
              style={{
                background: 'radial-gradient(circle, rgba(34,197,94,0.4) 0%, transparent 70%)',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
              }}
              animate={{ scale: [0.8, 1.2, 0.8], opacity: [0.1, 0.25, 0.1] }}
              transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
            />
          </div>

          {/* ── الجسيمات الضوئية ──────────────────────────── */}
          <div className="absolute inset-0 pointer-events-none">
            {PARTICLES.map((p) => (
              <motion.div
                key={p.id}
                className="absolute rounded-full"
                style={{
                  width: p.size,
                  height: p.size,
                  left: `${p.x}%`,
                  top: `${p.y}%`,
                  background: p.id % 3 === 0
                    ? 'rgba(34,197,94,0.6)'
                    : p.id % 3 === 1
                      ? 'rgba(96,165,250,0.5)'
                      : 'rgba(255,255,255,0.4)',
                }}
                animate={{
                  y: [0, -30, 0],
                  opacity: [0, 0.8, 0],
                  scale: [0.5, 1.2, 0.5],
                }}
                transition={{
                  duration: p.duration,
                  delay: p.delay,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
              />
            ))}
          </div>

          {/* ── الشعار + الهالة الضوئية ──────────────────── */}
          <div className="relative flex items-center justify-center mb-8 md:mb-12">

            {/* الهالات الضوئية (3 حلقات متراكبة) */}
            {[0, 1, 2].map((i) => (
              <motion.div
                key={`glow-${i}`}
                className="absolute rounded-full pointer-events-none"
                style={{
                  border: '2px solid',
                  borderColor: i === 0
                    ? 'rgba(34,197,94,0.25)'
                    : i === 1
                      ? 'rgba(96,165,250,0.2)'
                      : 'rgba(255,255,255,0.1)',
                  boxShadow: i === 0
                    ? '0 0 40px 10px rgba(34,197,94,0.15), inset 0 0 40px 10px rgba(34,197,94,0.05)'
                    : i === 1
                      ? '0 0 30px 8px rgba(96,165,250,0.1), inset 0 0 30px 8px rgba(96,165,250,0.03)'
                      : '0 0 20px 5px rgba(255,255,255,0.05)',
                }}
                initial={{ width: 0, height: 0, opacity: 0 }}
                animate={{
                  width: ['0px', '500px', '700px'],
                  height: ['0px', '500px', '700px'],
                  opacity: [0.6, 0.3, 0],
                }}
                transition={{
                  duration: 3.5,
                  delay: i * 1.2,
                  repeat: Infinity,
                  ease: 'easeOut',
                }}
              />
            ))}

            {/* توهج خلف الشعار */}
            <motion.div
              className="absolute rounded-full pointer-events-none"
              style={{
                width: '200px',
                height: '200px',
                background: 'radial-gradient(circle, rgba(34,197,94,0.3) 0%, rgba(10,36,99,0.2) 50%, transparent 70%)',
                filter: 'blur(30px)',
              }}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0.8, 0.5] }}
              transition={{ duration: 3, delay: 0.5, repeat: Infinity, ease: 'easeInOut' }}
            />

            {/* الشعار */}
            <motion.div
              className="relative z-10"
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{
                duration: 2.2,
                ease: [0.16, 1, 0.3, 1], // Spring-like easing
              }}
            >
              <motion.img
                src="/logo-new.png"
                alt="ITPC Logo"
                className="max-w-[50vw] max-h-[35vh] md:max-h-[40vh] w-auto h-auto object-contain drop-shadow-[0_0_60px_rgba(34,197,94,0.3)]"
                animate={{
                  filter: [
                    'drop-shadow(0 0 30px rgba(34,197,94,0.2))',
                    'drop-shadow(0 0 60px rgba(34,197,94,0.4))',
                    'drop-shadow(0 0 30px rgba(34,197,94,0.2))',
                  ],
                }}
                transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
              />
            </motion.div>
          </div>

          {/* ── النصوص المتسلسلة ──────────────────────────── */}
          <div className="relative z-10 text-center space-y-3 md:space-y-4 px-6">

            {/* خط فاصل ذهبي */}
            <motion.div
              className="mx-auto h-px overflow-hidden"
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 200, opacity: 1 }}
              transition={{ delay: 2.5, duration: 1.2, ease: 'easeOut' }}
            >
              <div className="h-full w-full bg-gradient-to-r from-transparent via-emerald-400/60 to-transparent" />
            </motion.div>

            {/* السطر 1: وزارة الاتصالات */}
            <motion.h2
              className="text-lg md:text-2xl font-bold text-white/90 font-tajawal tracking-wide"
              initial={{ opacity: 0, y: 25, filter: 'blur(8px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              transition={{ delay: 3, duration: 1.2, ease: 'easeOut' }}
            >
              وزارة الاتصالات
            </motion.h2>

            {/* السطر 2: المديرية */}
            <motion.h3
              className="text-base md:text-xl font-semibold text-white/70 font-tajawal"
              initial={{ opacity: 0, y: 25, filter: 'blur(8px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              transition={{ delay: 4.5, duration: 1.2, ease: 'easeOut' }}
            >
              مديرية اتصالات ومعلوماتية كربلاء المقدسة
            </motion.h3>

            {/* السطر 3: نظام الإدارة الموحد (شارة مميزة) */}
            <motion.div
              className="pt-2"
              initial={{ opacity: 0, scale: 0.7, filter: 'blur(10px)' }}
              animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
              transition={{ delay: 6, duration: 1.5, ease: [0.16, 1, 0.3, 1] }}
            >
              <span className="inline-block px-6 md:px-10 py-2.5 md:py-3 rounded-full text-sm md:text-lg font-bold tracking-[0.15em] text-white font-tajawal border border-emerald-500/30 bg-gradient-to-r from-emerald-600/20 via-emerald-500/10 to-emerald-600/20 shadow-[0_0_30px_rgba(34,197,94,0.15),inset_0_1px_0_rgba(255,255,255,0.1)]">
                نظام الإدارة الموحد
              </span>
            </motion.div>
          </div>

          {/* ── شريط التقدم السفلي ─────────────────────────── */}
          <div className="absolute bottom-0 left-0 right-0">
            <motion.div
              className="h-1 origin-left"
              style={{
                background: 'linear-gradient(90deg, #22c55e, #60a5fa, #22c55e)',
                backgroundSize: '200% 100%',
              }}
              initial={{ scaleX: 0 }}
              animate={{
                scaleX: 1,
                backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'],
              }}
              transition={{
                scaleX: { duration: 10, ease: 'linear' },
                backgroundPosition: { duration: 3, repeat: Infinity, ease: 'linear' },
              }}
            />
          </div>

          {/* ── زر التخطي ──────────────────────────────────── */}
          <motion.button
            className="absolute top-4 left-4 md:top-6 md:left-6 z-50 px-4 py-2 rounded-full text-xs font-bold text-white/40 hover:text-white/80 border border-white/10 hover:border-white/30 backdrop-blur-sm transition-colors duration-300 font-tajawal"
            style={{ paddingTop: 'calc(0.5rem + env(safe-area-inset-top, 0px))' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 2, duration: 0.5 }}
            onClick={handleSkip}
          >
            تخطي ←
          </motion.button>

          {/* ── رسالة النقر لتشغيل الصوت (إذا فشل التشغيل التلقائي) ── */}
          {!hasInteracted && (
            <motion.p
              className="absolute bottom-8 text-white/30 text-xs font-tajawal"
              animate={{ opacity: [0.3, 0.6, 0.3] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              اضغط لتشغيل الصوت
            </motion.p>
          )}

        </motion.div>
      )}
    </AnimatePresence>
  );
};
