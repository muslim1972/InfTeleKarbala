/**
 * SplashBeaconVideos.tsx
 * ─────────────────────────────────────────────────────────
 * «المنارة الدوارة» لشعار كربلاء المقدسة — WebP متحرك بخلفية مفروزة (قناة Alpha).
 * يظهر في زاويتي أسفل الشاشة (يسار + يمين) على الشاشات الكبيرة فقط
 * (تابلت/كمبيوتر ≥768px)، ويظهران معاً في نفس اللحظة عند بداية السبلاش.
 * معزول بالكامل عن باقي مكونات السبلاش — حذفه لا يؤثر على أي شيء آخر.
 *
 * ملاحظة تقنية: WebP المتحرك لا يعمل داخل <video> ⇒ يُعرض عبر <img>
 * (يُشغَّل ويُكرَّر تلقائياً بفضل -loop 0 عند الترميز).
 *
 * ضمان الظهور المتزامن:
 * - لا يظهر أي من النسختين حتى تكتمل تحميل كلتاهما (onLoad) —
 *   ثم تُعرضان في نفس اللحظة بانتقال opacity واحد.
 * - معالجة حالة الكاش: إذا اكتمل التحميل قبل ربط onLoad يُفحص complete مباشرة.
 * - انتقال opacity فقط (يُنفَّذ على طبقة GPU) ⇒ بدون إعادة تخطيط.
 * - لا يُحمَّل الملف إطلاقاً على شاشات الموبايل (توفير البيانات).
 */

import { useCallback, useEffect, useRef, useState } from 'react';

/** هل الشاشة كبيرة (≥768px)؟ يُستمع لتغير القيمة عند تدوير الجهاز */
function useIsLargeScreen(): boolean {
  const [isLarge, setIsLarge] = useState<boolean>(() =>
    typeof window !== 'undefined'
      ? window.matchMedia('(min-width: 768px)').matches
      : false
  );

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const onChange = (e: MediaQueryListEvent) => setIsLarge(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return isLarge;
}

/** موقعا الزاويتين السفليتين (مطابقنتان للمربعات في تصميم ص1) */
const POSITIONS: Record<'left' | 'right', string> = {
  left: 'bottom-5 left-6 md:left-12',
  right: 'bottom-5 right-6 md:right-12',
};

/** مهلة أمان: نُظهر النسختين حتى لو تعذر تأكيد اكتمال التحميل */
const SAFETY_TIMEOUT_MS = 2500;

export const SplashBeaconVideos = () => {
  const isLarge = useIsLargeScreen();
  const readyRef = useRef({ left: false, right: false });
  const shownRef = useRef(false);
  const [shown, setShown] = useState(false);

  const tryShow = useCallback(() => {
    if (shownRef.current) return;
    const r = readyRef.current;
    if (!r.left || !r.right) return;
    shownRef.current = true;
    setShown(true);
  }, []);

  const markReady = useCallback(
    (side: 'left' | 'right') => {
      readyRef.current[side] = true;
      tryShow();
    },
    [tryShow]
  );

  useEffect(() => {
    if (!isLarge || shownRef.current) return;
    const timer = window.setTimeout(() => {
      readyRef.current.left = true;
      readyRef.current.right = true;
      tryShow();
    }, SAFETY_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [isLarge, tryShow]);

  if (!isLarge) return null;

  return (
    <>
      {(['left', 'right'] as const).map((side) => (
        <img
          key={side}
          src="/media/karbala-beacon.webp?v=3"
          alt=""
          decoding="async"
          draggable={false}
          aria-hidden="true"
          onLoad={() => markReady(side)}
          ref={(el) => {
            // حالة الكاش: الصورة قد تكتمل قبل ربط onLoad
            if (el && el.complete && el.naturalWidth > 0) markReady(side);
          }}
          className={`absolute z-20 w-36 lg:w-44 xl:w-52 h-auto pointer-events-none select-none transition-opacity duration-700 ease-out ${
            shown ? 'opacity-100' : 'opacity-0'
          } ${POSITIONS[side]}`}
        />
      ))}
    </>
  );
};
