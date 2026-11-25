import { type SyntheticEvent, useCallback, useEffect, useRef, useState } from 'react';
import { MocEmblem } from '../components/visual/MocEmblem';
import { useSplashAudio } from '../hooks/useSplashAudio';

interface SplashScreenProps {
  onComplete: () => void;
}

const SPLASH_DURATION_MS = 6000;
const EXIT_FADE_START_MS = 5400;

export const SplashScreen = ({ onComplete }: SplashScreenProps) => {
  const isTerminatedRef = useRef(false);
  const [isExiting, setIsExiting] = useState(false);
  const { playIntro, stopAudio } = useSplashAudio();

  const finishSplash = useCallback(() => {
    if (isTerminatedRef.current) return;
    isTerminatedRef.current = true;
    stopAudio();
    onComplete();
  }, [stopAudio, onComplete]);

  const handleSkip = useCallback(
    (e?: SyntheticEvent) => {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }
      finishSplash();
    },
    [finishSplash]
  );

  // تشغيل الهوية الصوتية فور نهوض الشاشة وبنفس آلية الاستئناف المعتمدة في التطبيق، دون أي حجب
  useEffect(() => {
    isTerminatedRef.current = false;
    let audioStarted = playIntro();

    const startTime = performance.now();
    let lastAudioRetry = startTime;
    let rafId = 0;

    const unlockOnGesture = () => {
      if (!audioStarted && !isTerminatedRef.current) {
        audioStarted = playIntro();
      }
    };

    if (!audioStarted) {
      window.addEventListener('pointerdown', unlockOnGesture, { once: true, passive: true });
      window.addEventListener('touchstart', unlockOnGesture, { once: true, passive: true });
      window.addEventListener('keydown', unlockOnGesture, { once: true });
    }

    const tick = (now: number) => {
      if (isTerminatedRef.current) return;
      const elapsed = now - startTime;

      // محاولة استئناف الصوت برفق كل 250ms خلال أول 2.5 ثانية إن كان معلقاً (نفس آلية التطبيق السابقة عبر rAF)
      if (!audioStarted && elapsed <= 2500 && now - lastAudioRetry >= 250) {
        lastAudioRetry = now;
        audioStarted = playIntro();
      }

      if (elapsed >= EXIT_FADE_START_MS) {
        setIsExiting(true);
      }

      if (elapsed >= SPLASH_DURATION_MS) {
        finishSplash();
        return;
      }

      rafId = window.requestAnimationFrame(tick);
    };

    rafId = window.requestAnimationFrame(tick);

    return () => {
      isTerminatedRef.current = true;
      if (rafId) window.cancelAnimationFrame(rafId);
      window.removeEventListener('pointerdown', unlockOnGesture);
      window.removeEventListener('touchstart', unlockOnGesture);
      window.removeEventListener('keydown', unlockOnGesture);
      stopAudio();
    };
  }, [playIntro, stopAudio, finishSplash]);

  // دعم التخطي عبر لوحة المفاتيح للمستعجلين
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') {
        handleSkip();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSkip]);

  return (
    <main
      key="splash-moc-sovereign-6s"
      dir="rtl"
      onClick={handleSkip}
      aria-label="الشاشة الافتتاحية لوزارة الاتصالات"
      className="fixed inset-0 z-[99999] flex flex-col items-center justify-center overflow-hidden bg-white select-none cursor-pointer touch-manipulation"
    >
      {/* إضاءة بيضاء ملكية خفيفة جداً خلف الشعار */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(circle at 50% 45%, #ffffff 0%, #fbfcfe 55%, #f4f7fa 100%)',
        }}
      />

      {/* المنتصف: انبثاق شعار وزارة الاتصالات من الوسط والنصوص الرسمية تحته */}
      <div
        className={`relative z-10 flex flex-col items-center justify-center px-6 text-center max-w-2xl w-full transition-all duration-500 ease-out ${
          isExiting ? 'opacity-0 scale-[0.98]' : 'opacity-100 scale-100'
        }`}
      >
        <MocEmblem className="w-[70vw] max-w-[300px] sm:max-w-[360px] md:max-w-[420px] h-auto animate-moc-emerge will-change-transform drop-shadow-[0_14px_30px_rgba(15,23,42,0.06)]" />

        <div className="mt-7 sm:mt-9 space-y-1.5 sm:space-y-2">
          <h1 className="font-tajawal text-2xl sm:text-3xl md:text-4xl font-extrabold text-slate-900 tracking-tight animate-moc-text-primary">
            وزارة الاتصالات
          </h1>
          <p className="font-tajawal text-base sm:text-lg md:text-xl font-bold text-slate-600 animate-moc-text-secondary">
            الشركة العامة للاتصالات والمعلوماتية
          </p>
        </div>
      </div>

      {/* أسفل اليمين في الزاوية: سطران متوسطان بينهما ببساطة وكفى */}
      <div
        className={`fixed bottom-[calc(1.25rem+env(safe-area-inset-bottom,0px))] right-[calc(1.5rem+env(safe-area-inset-right,0px))] z-20 text-center pointer-events-none transition-opacity duration-500 ease-out ${
          isExiting ? 'opacity-0' : 'opacity-100'
        }`}
      >
        <div className="font-tajawal text-xs sm:text-sm font-medium text-slate-500 leading-snug space-y-0.5 animate-moc-signature">
          <div>اتصالات ومعلوماتية كربلاء</div>
          <div>م. مسلم عقيل</div>
        </div>
      </div>
    </main>
  );
};
