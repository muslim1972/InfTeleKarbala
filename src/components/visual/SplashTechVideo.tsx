/**
 * SplashTechVideo.tsx
 * ─────────────────────────────────────────────────────────
 * خلفية الفيديو الترويجي للشاشة الافتتاحية — مشهد تقني مولّد برمجياً:
 * ألياف ضوئية (FTTH) بنبضات ضوء تسري بين عقد شبكة الاتصالات،
 * بألوان الهوية الرسمية (زمردي/أزرق/سماوي) على خلفية داكنة.
 *
 * - نسختان: أفقية 1920×1080 للشاشات العريضة، عمودية 720×1280 للموبايل (~650KB).
 * - مدة الفيديو 10 ثوانٍ = مدة السبلاش بالضبط (يُشغَّل مرة واحدة، بلا loop).
 * - صامت (النغمة الافتتاحية تُولَّد عبر Web Audio في useSplashAudio).
 * - muted + playsInline + autoPlay ⇒ تشغيل تلقائي مسموح في كل المتصفحات
 *   وفي WebView أندرويد (Capacitor).
 * - poster: يظهر فوراً قبل اكتمال تحميل الفيديو (بلا وميض أسود).
 * - معزول بالكامل عن باقي مكونات السبلاش — حذفه لا يؤثر على أي شيء آخر.
 * - عند فشل تحميل الفيديو (شبكة ضعيفة) يختفي بصمت وتبقى خلفية السبلاش الأصلية.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

/** هل الشاشة عمودية؟ (يُقيَّم مرة واحدة عند فتح السبلاش — لا معنى لإعادة التقييم خلال 10 ثوانٍ) */
function useIsPortrait(): boolean {
  const [isPortrait, setIsPortrait] = useState<boolean>(() =>
    typeof window !== 'undefined'
      ? window.matchMedia('(orientation: portrait)').matches
      : false
  );

  useEffect(() => {
    const mq = window.matchMedia('(orientation: portrait)');
    const onChange = (e: MediaQueryListEvent) => setIsPortrait(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return isPortrait;
}

export const SplashTechVideo = () => {
  const isPortrait = useIsPortrait();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [failed, setFailed] = useState(false);

  const src = isPortrait ? '/media/splash-tech-portrait.mp4' : '/media/splash-tech-wide.mp4';
  const poster = isPortrait
    ? '/media/splash-tech-portrait-poster.jpg'
    : '/media/splash-tech-wide-poster.jpg';

  /** ضمان التشغيل: autoPlay يكفي عادةً، وهذه شبكة أمان لسياسات المتصفح الصارمة */
  const tryPlay = useCallback(() => {
    const el = videoRef.current;
    if (!el) return;
    el.play().catch(() => {
      /* ممنوع التشغيل التلقائي — سيبدأ عند أول تفاعل (السبلاش يستمع له أصلاً) */
    });
  }, []);

  // إعادة محاولة التشغيل عند أول تفاعل إن منع المتصفح autoPlay
  useEffect(() => {
    const onFirstInteraction = () => tryPlay();
    window.addEventListener('click', onFirstInteraction, { once: true });
    window.addEventListener('touchstart', onFirstInteraction, { once: true });
    window.addEventListener('keydown', onFirstInteraction, { once: true });
    return () => {
      window.removeEventListener('click', onFirstInteraction);
      window.removeEventListener('touchstart', onFirstInteraction);
      window.removeEventListener('keydown', onFirstInteraction);
    };
  }, [tryPlay]);

  if (failed) return null;

  return (
    <video
      ref={videoRef}
      src={src}
      poster={poster}
      autoPlay
      muted
      playsInline
      preload="auto"
      disablePictureInPicture
      aria-hidden="true"
      onCanPlay={tryPlay}
      onError={() => setFailed(true)}
      className="absolute inset-0 z-0 w-full h-full object-cover pointer-events-none select-none"
      style={{ background: '#030510' }}
    />
  );
};
