import { useCallback, useEffect, useRef, useState } from 'react';
import { SkipForward } from 'lucide-react';

interface SplashScreenProps {
  onComplete: () => void;
}

const DESKTOP_VIDEO = '/media/ITPC_Concept_C_IraqNetwork_25s.mp4';
const DESKTOP_POSTER = '/media/ITPC_Concept_C_IraqNetwork_25s.jpg';
const MOBILE_VIDEO = '/media/ITPC_Concept_C_IraqNetwork_portrait_25s.mp4';
const MOBILE_POSTER = '/media/ITPC_Concept_C_IraqNetwork_portrait_25s.jpg';
const MOBILE_PORTRAIT_QUERY = '(orientation: portrait) and (max-width: 767px)';

export const SplashScreen = ({ onComplete }: SplashScreenProps) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const isTerminatedRef = useRef(false);

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

  const handleSkip = useCallback((e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    stopAndCleanupVideo();
    onComplete();
  }, [stopAndCleanupVideo, onComplete]);

  const handleEnded = useCallback(() => {
    stopAndCleanupVideo();
    onComplete();
  }, [stopAndCleanupVideo, onComplete]);

  const handleError = useCallback(() => {
    stopAndCleanupVideo();
    onComplete();
  }, [stopAndCleanupVideo, onComplete]);

  // تشغيل الفيديو عند التحميل أو تبديل النسخة بسبب تغيير حجم/اتجاه الشاشة.
  useEffect(() => {
    const video = videoRef.current;
    if (!video || isTerminatedRef.current) return;

    video.load();
    video.muted = false;
    const playPromise = video.play();
    if (playPromise !== undefined) {
      playPromise.catch(() => {
        if (isTerminatedRef.current) return;
        // في حال وجود قيود سياسة المتصفح على تشغيل الصوت التلقائي، يُشغل صامتاً لتفادي أي توقف
        video.muted = true;
        video.play().catch(() => {});
      });
    }

  }, [videoSrc]);

  // تنظيف الوسائط عند مغادرة المكون فقط، لا عند تبديل نسخة الفيديو.
  useEffect(() => () => stopAndCleanupVideo(), [stopAndCleanupVideo]);

  // دعم لوحة المفاتيح: Escape أو Enter للتخطي الفوري
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Enter') {
        handleSkip();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSkip]);

  return (
    <main
      key="splash-iraq-network-video-25s"
      className="fixed inset-0 z-[99999] overflow-hidden bg-[#031718] select-none flex items-center justify-center cursor-pointer animate-fadeIn"
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
      <video
        ref={videoRef}
        src={videoSrc}
        poster={posterSrc}
        playsInline
        preload="auto"
        disablePictureInPicture
        aria-label="مقدمة نظام الإدارة الموحد - شبكة العراق"
        onEnded={handleEnded}
        onError={handleError}
        className={
          isPortrait
            ? "absolute inset-0 h-full w-full object-contain object-center pointer-events-none"
            : "absolute inset-0 h-full w-full object-contain pointer-events-none"
        }
      />

      {/* زر تخطي العرض فقط */}
      <button
        type="button"
        onClick={handleSkip}
        className="absolute left-5 top-5 z-20 flex items-center gap-2 rounded-full border border-emerald-400/30 bg-slate-950/60 px-4 py-2 font-tajawal text-xs md:text-sm font-semibold text-white/90 backdrop-blur-md transition hover:border-emerald-400/70 hover:bg-slate-900/80 hover:text-white shadow-lg active:scale-95"
      >
        <span>تخطي العرض</span>
        <SkipForward className="w-3.5 h-3.5 text-emerald-400" />
      </button>
    </main>
  );
};
