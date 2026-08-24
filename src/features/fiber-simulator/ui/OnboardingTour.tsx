/**
 * ============================================================
 * الجولة التدريبية التوجيهية — Onboarding Tour
 * ============================================================
 * تُفتح تلقائياً عند كل تشغيل للمحاكي (بعد مهلة قصيرة تستقر
 * فيها حركة ملء الشاشة)، وزر «؟» في الرأس يعيد فتحها متى شاء.
 * التقنية: إبراز منطقة الهدف (Spotlight) بعتامة حولها عبر
 * box-shadow ضخم، مع بطاقة شرح تتموضع ذكياً حول الهدف.
 */

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { GraduationCap, X } from 'lucide-react';
import { useEduStore } from '../store/education.store';
import { TRAINING_PATHS } from '../education/training-paths';
import { BUILD_STEPS } from '../education/build-order';

interface TourStep {
  titleAr: string;
  bodyAr: React.ReactNode;
  /** محدد CSS لمنطقة الهدف — غيابه يعني بطاقة مركزية */
  selector?: string;
}

const ORDER_LIST = BUILD_STEPS.map((s) => `${s.order}. ${s.titleAr}`).join(' ← ');

const STEPS: TourStep[] = [
  {
    titleAr: 'أهلاً بك في محاكي بناء شبكات الألياف الضوئية FTTH',
    bodyAr: (
      <>
        <p>
          هذه بيئة تدريب هندسية متكاملة: ستصمم شبكة ألياف ضوئية حقيقية على خريطة، من
          الحفر حتى لحام آخر شعيرة واختبار الإشارة — بأسعار مواد واقعية ومعايير عالمية
          (ITU-T G.984 / TIA-598).
        </p>
        <p className="mt-2 text-slate-300">
          لا تحتاج أي خبرة سابقة: الجولة الحالية تعرّفك بالواجهة، ونظام الترتيب سيوجّهك
          خطوة بخطوة أثناء العمل، وزر «التلميح» يشرح لك كل عنصر تنقر عليه.
        </p>
      </>
    ),
  },
  {
    titleAr: 'شريط الأدوات — يمين الشاشة',
    selector: '[data-tour="toolbar"]',
    bodyAr: (
      <>
        <p>
          هنا أدوات العمل: التحديد والتحريك والقياس، ثم أدوات البناء (حفر، منشآت، كبينة،
          قواسم، إسقاط)، فأدوات التراجع والتكبير والمسح.
        </p>
        <p className="mt-2 text-slate-300">
          عند اختيار «مسار الحفر» تظهر أسفلها طرق الحفر بخياراتها وأسعارها — انقر
          الأداة ثم انقر على الخريطة لبناء.
        </p>
      </>
    ),
  },
  {
    titleAr: 'لوحة الرسم الهندسية — وسط الشاشة',
    selector: '[data-tour="canvas"]',
    bodyAr: (
      <>
        <p>
          خريطة المنطقة بإحداثيات مترية حقيقية: الدور والمقسم والشوارع. انقر بالأداة
          المختارة لتنفيذ العمل، وبنقرة مزدوجة (أو Enter) أنهِ المسار.
        </p>
        <p className="mt-2 text-slate-300">
          تحكم العرض: عجلة الفأرة للتكبير · مسافة + سحب (أو زر التحريك) للتنقل · نقرة
          يمين للإلغاء.
        </p>
      </>
    ),
  },
  {
    titleAr: 'الفاحص الحي — يسار الشاشة',
    selector: '[data-tour="inspector"]',
    bodyAr: (
      <>
        <p>
          عينك الهندسية الدائمة: متطلبات الخريطة، نسبة التغطية، أضعف إشارة، الأخطاء
          الحية مع حلولها، جدول الكميات والتكاليف، ومحرر العنصر المحدد.
        </p>
        <p className="mt-2 text-slate-300">
          ستجد هنا أيضاً «سجل أخطائك التعليمي» بالدروس المستفادة، ومؤشر عناصر الشبكة
          التي استكشفتها.
        </p>
      </>
    ),
  },
  {
    titleAr: 'أطوار العمل الأربعة — أعلى الشاشة',
    selector: '[data-tour="phases"]',
    bodyAr: (
      <>
        <p>
          المحاكي يحاكي دورة حياة المشروع: <b>الأعمال المدنية</b> ← <b>الشبكة البصرية</b>{' '}
          ← <b>مختبر اللحام</b> ← <b>الاختبار والتشغيل</b>.
        </p>
        <p className="mt-2 text-slate-300">
          الانتقال محمي بقيود ترتيب: لن تُقبل في مختبر اللحام قبل وجود إسقاطات تُلحم.
        </p>
      </>
    ),
  },
  {
    titleAr: 'زر التلميح — معلمك الجيب',
    selector: '[data-tour="hint-tool"]',
    bodyAr: (
      <>
        <p>
          فعّله ثم انقر أي عنصر في المخطط (حتى الدور والمقسم والشارع!) لتظهر لك بطاقة
          علمية وافية: ما هو، وظيفته، ما الذي يسبقه، ما يعتمد عليه، وما يليه.
        </p>
        <p className="mt-2 text-slate-300">
          البطاقة تختفي تلقائياً بمغادرة المؤشر أو بنقر عنصر آخر — لن تعيق رؤيتك أبداً.
        </p>
      </>
    ),
  },
  {
    titleAr: 'شريط التقدم وترتيب البناء',
    selector: '[data-tour="progress"]',
    bodyAr: (
      <>
        <p>
          خمس خطوات بإلزامية الترتيب الهندسي: <b dir="rtl">{ORDER_LIST}</b>
        </p>
        <p className="mt-2 text-slate-300">
          الخطوة الحالية مضاءة، والمقفلة رمادية — أي محاولة تخطٍّ تعترضها رسالة تعليمية
          تشرح «لماذا هذا الترتيب؟». النقر على خطوة يقودك مباشرة لأداتها.
        </p>
      </>
    ),
  },
  {
    titleAr: 'مستواك ومسارك التدريبي',
    bodyAr: (
      <>
        <p>ثلاثة مسارات متدرجة — ابدأ حيث يناسبك:</p>
        <ul className="mt-2 space-y-1.5">
          {TRAINING_PATHS.map((p) => (
            <li key={p.id} className="rounded-lg border border-slate-700 bg-slate-950/60 p-2">
              <div className="flex items-center gap-1.5 font-bold" style={{ color: p.color }}>
                <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
                {p.nameAr} <span className="text-slate-400">(الاجتياز: {p.targetStars} ★)</span>
              </div>
              <div className="mt-0.5 text-slate-400">{p.audienceAr}</div>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-slate-300">
          تقييمك النهائي بالنجوم يغطي: التغطية 35% · الإشارة 25% · كفاءة الكلفة 20% ·
          السلامة 10% · جودة اللحام 10%.
        </p>
      </>
    ),
  },
];

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export default function OnboardingTour(): React.ReactElement | null {
  const { tourOpen, closeTour } = useEduStore();
  const [idx, setIdx] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  /* أبعاد إطار العرض — تُحدَّث عند تغيير حجم النافذة لضمان تموضع سليم على كل الشاشات */
  const [vp, setVp] = useState({ w: window.innerWidth, h: window.innerHeight });
  /* الارتفاع الفعلي المقاس للبطاقة — يصحح التموضع دون تقديرات ثابتة */
  const cardRef = useRef<HTMLDivElement>(null);
  const [cardH, setCardH] = useState(240);

  const step = STEPS[idx];
  const isLast = idx === STEPS.length - 1;

  const measure = useCallback(() => {
    setVp({ w: window.innerWidth, h: window.innerHeight });
    if (!step?.selector) {
      setRect(null);
      return;
    }
    const el = document.querySelector(step.selector);
    if (!el) {
      setRect(null);
      return;
    }
    const r = el.getBoundingClientRect();
    /* هامش بصري حول الهدف */
    const pad = 6;
    setRect({
      top: r.top - pad,
      left: r.left - pad,
      width: r.width + pad * 2,
      height: r.height + pad * 2,
    });
  }, [step]);

  useLayoutEffect(() => {
    if (tourOpen) measure();
  }, [tourOpen, idx, measure]);

  /* قياس الارتفاع الفعلي بعد الرسم — يعيد التموضع إذا اختلفت عن التقدير */
  useLayoutEffect(() => {
    if (tourOpen && cardRef.current) {
      const h = cardRef.current.offsetHeight;
      if (h > 0 && Math.abs(h - cardH) > 4) setCardH(h);
    }
  }, [tourOpen, idx, cardH]);

  useEffect(() => {
    if (!tourOpen) return;
    const onResize = () => measure();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [tourOpen, measure]);

  useEffect(() => {
    if (!tourOpen) return;
    setIdx(0);
  }, [tourOpen]);

  const finish = () => {
    closeTour();
  };

  if (!tourOpen || !step) return null;

  /* ===== تموضع البطاقة ذكياً حول الهدف ===== */
  const { w: vw, h: vh } = vp;
  const cardW = Math.min(350, vw - 24); /* شاشات ضيقة: لا تتجاوز الحواف */
  let cardStyle: React.CSSProperties;
  let pointerClass = '';

  if (!rect) {
    /* بطاقة مركزية للخطوات التمهيدية/الختامية */
    cardStyle = {
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      width: Math.min(460, vw - 48),
    };
  } else if (
    /* هدف ضخم كاللوحة الهندسية: مساحته تغلب الشاشة، أو عرضه وارتفاعه
       يشغلان معظمها — البطاقة أسفل وسط الشاشة بمعزل عن مركز الرسم */
    rect.width * rect.height > vw * vh * 0.45 ||
    (rect.width > vw * 0.55 && rect.height > vh * 0.35)
  ) {
    cardStyle = {
      top: Math.max(8, vh - cardH - 20),
      left: (vw - cardW) / 2,
      width: cardW,
    };
  } else {
    /* أفقياً: إن كان الهدف في الثلث الأيمن نضع البطاقة يساره (واجهة RTL) */
    const targetRightSide = rect.left > vw * 0.6;
    let left: number;
    if (targetRightSide && rect.left - cardW - 16 > 8) {
      left = rect.left - cardW - 16;
      pointerClass = 'tour-pointer-right';
    } else if (!targetRightSide && rect.left + rect.width + cardW + 16 < vw - 8) {
      left = rect.left + rect.width + 16;
      pointerClass = 'tour-pointer-left';
    } else {
      left = Math.max(8, Math.min(rect.left + rect.width / 2 - cardW / 2, vw - cardW - 8));
    }
    /* عمودياً: تحت الهدف إن اتسع، وإلا فوقه، وإلا توسّط مقيَّد بحدود الشاشة */
    let top: number;
    if (rect.top + rect.height + cardH + 16 < vh) {
      top = rect.top + rect.height + 16;
      if (!pointerClass) pointerClass = 'tour-pointer-top';
    } else if (rect.top - cardH - 16 > 8) {
      top = rect.top - cardH - 16;
      if (!pointerClass) pointerClass = 'tour-pointer-bottom';
    } else {
      top = Math.max(8, Math.min(rect.top + rect.height / 2 - cardH / 2, vh - cardH - 8));
    }
    cardStyle = { top, left, width: cardW };
  }

  return (
    <div dir="rtl" className="fixed inset-0 z-[140]" role="dialog" aria-modal="true">
      {/* العتمة مع ثقب الإبراز — box-shadow ضخم خارج مستطيل الهدف */}
      {rect && (
        <div
          className="pointer-events-none absolute rounded-xl ring-2 ring-indigo-400/80 transition-all duration-300"
          style={{
            top: rect.top,
            left: rect.left,
            width: rect.width,
            height: rect.height,
            boxShadow: '0 0 0 9999px rgba(2,6,16,0.78)',
          }}
        />
      )}
      {!rect && <div className="absolute inset-0 bg-[#020610]/80" />}

      {/* بطاقة الشرح — خلفية معتمة كلياً كي لا تتسرب ألوان الخريطة
          الساطعة خلفها فيتشوش النص (إصلاح الشفافية) */}
      <div
        ref={cardRef}
        className={`absolute rounded-2xl border border-slate-600 bg-[#0b1322] p-5 shadow-2xl shadow-black/80 ${pointerClass}`}
        style={cardStyle}
      >
        <div className="mb-2 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <GraduationCap size={18} className="text-indigo-400" />
            <span className="text-[11px] font-bold text-indigo-300">
              الجولة التدريبية {idx + 1}/{STEPS.length}
            </span>
          </div>
          <button
            type="button"
            onClick={finish}
            title="إنهاء الجولة"
            className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-800 hover:text-slate-200"
          >
            <X size={15} />
          </button>
        </div>

        <h3 className="text-[15px] font-bold text-slate-100">{step.titleAr}</h3>
        <div className="mt-2 max-h-64 overflow-y-auto text-[13px] leading-relaxed text-slate-300">
          {step.bodyAr}
        </div>

        <div className="mt-4 flex items-center justify-between gap-3">
          {/* نقاط الخطوات */}
          <div className="flex items-center gap-1.5">
            {STEPS.map((_, i) => (
              <span
                key={i}
                className={`h-1.5 rounded-full transition-all ${
                  i === idx ? 'w-5 bg-indigo-400' : i < idx ? 'w-1.5 bg-emerald-500' : 'w-1.5 bg-slate-700'
                }`}
              />
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={finish}
              className="rounded-lg px-2.5 py-1.5 text-[12px] text-slate-500 hover:text-slate-300"
            >
              تخطي الجولة
            </button>
            {idx > 0 && (
              <button
                type="button"
                onClick={() => setIdx((i) => i - 1)}
                className="rounded-lg bg-slate-800 px-3 py-1.5 text-[12px] font-semibold text-slate-200 hover:bg-slate-700"
              >
                السابق
              </button>
            )}
            <button
              type="button"
              onClick={() => (isLast ? finish() : setIdx((i) => i + 1))}
              className="rounded-lg bg-indigo-600 px-4 py-1.5 text-[12px] font-bold text-white hover:bg-indigo-500"
            >
              {isLast ? 'توكل على الله — ابدأ!' : 'التالي'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
