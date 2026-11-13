import { type SyntheticEvent, useCallback, useEffect, useRef, useState } from 'react';

interface SplashScreenProps {
  onComplete: () => void;
}

const DESKTOP_VIDEO = '/media/MOC_Nomap_Concept_wide_25s.mp4';
const DESKTOP_POSTER = '/media/MOC_Nomap_Concept_wide_25s.jpg';
const MOBILE_VIDEO = '/media/MOC_Nomap_Concept_portrait_25s.mp4';
const MOBILE_POSTER = '/media/MOC_Nomap_Concept_portrait_25s.jpg';
const MOBILE_PORTRAIT_QUERY = '(orientation: portrait) and (max-width: 767px)';

export const SplashScreen = ({ onComplete }: SplashScreenProps) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const isTerminatedRef = useRef(false);
  const autoplayBlockedRef = useRef(false);
  const triedMutedFallbackRef = useRef(false);
  const [startedVideoSrc, setStartedVideoSrc] = useState<string | null>(null);

  // فيديو الهاتف مخصص للشاشات الصغيرة الطولية؛ التابلت يستخدم النسخة العريضة.
  const [isPortrait, setIsPortrait] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(MOBILE_PORTRAIT_QUERY).matches;
  });

  useEffect(() => {
    const mediaQuery = window.matchMedia(MOBILE_PORTRAIT_QUERY);
    const updateOrientation = () => setIsPortrait(mediaQuery.matches);
    mediaQuery.addEventListener('change', updateOrientation);
    return () => mediaQuery.removeEventListener('change', updateOrientation);
  }, []);

  const videoSrc = isPortrait ? MOBILE_VIDEO : DESKTOP_VIDEO;
  const posterSrc = isPortrait ? MOBILE_POSTER : DESKTOP_POSTER;
  const hasVideoStarted = startedVideoSrc === videoSrc;

  // إيقاف وتفريغ الفيديو والصوت نهائياً وفورياً لقطع أي تدفق صوتي
  const stopAndCleanupVideo = useCallback(() => {
    isTerminatedRef.current = true;
    const video = videoRef.current;
    if (video) {
      try {
        video.pause();
        video.muted = true;
        video.volume = 0;
        video.currentTime = 0;
        video.removeAttribute('src');
        video.load();
      } catch {
        // حماية من أي أخطاء أثناء تنظيف عنصر الوسائط
      }
    }

    // تأكيد إيقاف وكتم أي عنصر فيديو في الصفحة
    try {
      document.querySelectorAll('video').forEach((el) => {
        el.pause();
        el.muted = true;
        el.volume = 0;
        el.removeAttribute('src');
        el.load();
      });
    } catch {
      // حماية إضافية
    }
  }, []);

  const finishSplash = useCallback(() => {
    if (isTerminatedRef.current) return;
    stopAndCleanupVideo();
    onComplete();
  }, [stopAndCleanupVideo, onComplete]);

  const handleSkip = useCallback((e?: SyntheticEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    finishSplash();
  }, [finishSplash]);

  const handleEnded = useCallback(() => {
    finishSplash();
  }, [finishSplash]);

  const handleError = useCallback(() => {
    finishSplash();
  }, [finishSplash]);

  const attemptPlayback = useCallback(() => {
    const video = videoRef.current;
    if (!video || isTerminatedRef.current || autoplayBlockedRef.current) return;

    // البدء بالمحاولة بالصوت المدمج أولاً، ثم التحول الفوري للصامت إذا منع المتصفح التشغيل التلقائي بالصوت
    if (!triedMutedFallbackRef.current) {
      video.muted = false;
    }

    const playPromise = video.play();
    if (playPromise !== undefined) {
      playPromise.catch((err: unknown) => {
        if (isTerminatedRef.current) return;
        const errName = (err as { name?: string } | null)?.name;
        if (errName === 'AbortError') return;

        if (!triedMutedFallbackRef.current) {
          triedMutedFallbackRef.current = true;
          video.muted = true;
          video.defaultMuted = true;
          const mutedPromise = video.play();
          if (mutedPromise !== undefined) {
            mutedPromise.catch((mutedErr: unknown) => {
              if (isTerminatedRef.current) return;
              const mutedErrName = (mutedErr as { name?: string } | null)?.name;
              if (mutedErrName !== 'AbortError') {
                autoplayBlockedRef.current = true;
              }
            });
          }
        } else {
          autoplayBlockedRef.current = true;
        }
      });
    }
  }, []);

  // إعادة ضبط العلم عند التركيب (مفيد مع React StrictMode) وتنظيف الوسائط عند المغادرة
  useEffect(() => {
    isTerminatedRef.current = false;
    return () => stopAndCleanupVideo();
  }, [stopAndCleanupVideo]);

  // تشغيل الفيديو عند التحميل أو تبديل النسخة دون استدعاء load() المكرر لتجنب قطع الجلب الأولي
  useEffect(() => {
    autoplayBlockedRef.current = false;
    triedMutedFallbackRef.current = false;
    attemptPlayback();
  }, [videoSrc, attemptPlayback]);

  // حارس مراقبة التشغيل عبر requestAnimationFrame لمنع أي تجمد إذا توقف التشغيل أو رُفض التلقائي أو انقطع الشبكة
  useEffect(() => {
    const mountTime = performance.now();
    let lastObservedTime = 0;
    let lastProgressAt = mountTime;
    let rafId = 0;

    const monitorPlayback = (now: number) => {
      if (isTerminatedRef.current) return;

      const video = videoRef.current;
      if (video) {
        if (video.ended) {
          finishSplash();
          return;
        }
        if (video.currentTime > lastObservedTime + 0.01) {
          lastObservedTime = video.currentTime;
          lastProgressAt = now;
        }
      }

      const elapsedSinceMount = now - mountTime;
      const elapsedSinceProgress = now - lastProgressAt;

      // 1) إذا حظر المتصفح التشغيل التلقائي تماماً (حتى الصامت)، نكمل تلقائياً بعد عرض الملصق لفترة وجيزة
      if (autoplayBlockedRef.current && elapsedSinceMount >= 2200) {
        finishSplash();
        return;
      }

      // 2) إذا لم يبدأ الفيديو بالتقدم خلال 5.5 ثوانٍ من فتح الشاشة، نتجاوز لتفادي التجمد
      if (lastObservedTime <= 0.05 && elapsedSinceMount >= 5500) {
        finishSplash();
        return;
      }

      // 3) إذا تجمد الفيديو أثناء التشغيل لأكثر من 5 ثوانٍ أو تجاوزت الشاشة الحد الأقصى (29 ثانية)
      if ((lastObservedTime > 0.05 && elapsedSinceProgress >= 5000) || elapsedSinceMount >= 29000) {
        finishSplash();
        return;
      }

      rafId = window.requestAnimationFrame(monitorPlayback);
    };

    rafId = window.requestAnimationFrame(monitorPlayback);
    return () => {
      if (rafId) window.cancelAnimationFrame(rafId);
    };
  }, [videoSrc, finishSplash]);

  // دعم لوحة المفاتيح: Escape أو Enter للتخطي الفوري
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
      key="splash-iraq-network-video-25s"
      className="fixed inset-0 z-[99999] overflow-hidden bg-[#031718] select-none flex items-center justify-center cursor-pointer touch-manipulation animate-fadeIn"
      dir="rtl"
      onClick={handleSkip}
    >
      {isPortrait && (
        <div
          aria-hidden="true"
          className="absolute inset-0 scale-110 bg-cover bg-center opacity-40 blur-2xl pointer-events-none"
          style={{ backgroundImage: `url("${posterSrc}")` }}
        />
      )}

      {/* الملصق المؤسسي يظهر فوراً حتى يبدأ الفيديو فعلياً فيمنع بقاء إطار البداية الفارغ عند أي تعثر */}
      <img
        src={posterSrc}
        alt=""
        aria-hidden="true"
        className={`absolute inset-0 h-full w-full object-contain object-center pointer-events-none transition-opacity duration-200 ${
          hasVideoStarted ? 'opacity-0' : 'opacity-100'
        }`}
      />

      <video
        key={videoSrc}
        ref={videoRef}
        src={videoSrc}
        poster={posterSrc}
        playsInline
        preload="auto"
        disablePictureInPicture
        aria-label="مقدمة نظام الإدارة الموحد - شبكة العراق"
        onCanPlay={attemptPlayback}
        onPlaying={() => setStartedVideoSrc(videoSrc)}
        onTimeUpdate={(e) => {
          if (e.currentTarget.currentTime > 0.05 && !hasVideoStarted) {
            setStartedVideoSrc(videoSrc);
          }
        }}
        onEnded={handleEnded}
        onError={handleError}
        className={`absolute inset-0 h-full w-full object-contain pointer-events-none transition-opacity duration-200 ${
          isPortrait ? 'object-center ' : ''
        }${hasVideoStarted ? 'opacity-100' : 'opacity-0'}`}
      />

      {/* طبقة نقر شاملة على كامل الشاشة لضمان استجابة اللمس والنقر في Safari و WebView والأندرويد */}
      <button
        type="button"
        onClick={handleSkip}
        aria-label="تجاوز العرض الافتتاحي"
        className="absolute inset-0 z-10 w-full h-full bg-transparent border-0 cursor-pointer touch-manipulation focus:outline-none"
      />

      {/* زر/شريط التوجيه أسفل الشاشة لتجاوز العرض */}
      <button
        type="button"
        onClick={handleSkip}
        className="absolute bottom-[calc(1.5rem+env(safe-area-inset-bottom,0px))] md:bottom-8 left-1/2 -translate-x-1/2 z-20 cursor-pointer touch-manipulation font-tajawal text-xs md:text-sm font-medium text-emerald-100/80 hover:text-white tracking-wider text-center drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)] select-none animate-pulse px-4 py-1.5 rounded-full bg-slate-950/50 border border-emerald-500/20 backdrop-blur-sm whitespace-nowrap focus:outline-none"
      >
        انقر في أي مكان لتجاوز العرض
      </button>
    </main>
  );
};
