/**
 * ============================================================
 * بطاقة إطلاق محاكي FTTH — نقطة الدخول الوحيدة من التطبيق
 * ============================================================
 * البوابات الإلزامية قبل أي تشغيل:
 * 1) حساب المطور فقط (مسلم) — خلاف ذلك لا يُعرض شيء إطلاقاً.
 * 2) شاشة حاسوب ≥ 7 بوصة — مع رسالة اعتراض واضحة.
 * مساحة العمل تُحمَّل كسولاً (React.lazy) فلا تدخل حزمة التطبيق الأساسي.
 */

import { Suspense, lazy, useState } from 'react';
import { Loader2, MonitorX, Network, Play } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import {
  checkDesktopScreen,
  isDeveloperAccount,
  type ScreenCheck,
} from './security/feature-gate';

const FiberSimulatorWorkspace = lazy(() => import('./FiberSimulatorWorkspace'));

export default function FiberSimulatorLauncher(): React.ReactElement | null {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [block, setBlock] = useState<ScreenCheck | null>(null);

  /* البوابة 1: حساب المطور حصراً خلال فترة التطوير */
  if (!isDeveloperAccount(user)) return null;

  const launch = () => {
    const check = checkDesktopScreen();
    if (!check.ok) {
      setBlock(check);
      return;
    }
    setBlock(null);
    /* ملء الشاشة يطلبه عنصر المحاكي نفسه بعد تركيبه —
       كي لا يتأثر المستند/التطبيق الأساسي إطلاقاً */
    setOpen(true);
  };

  const closeWorkspace = () => {
    setOpen(false);
  };

  return (
    <>
      <div
        dir="rtl"
        className="relative overflow-hidden rounded-2xl border border-indigo-800/50 bg-gradient-to-l from-indigo-950/60 via-slate-900/80 to-slate-900/80 p-5"
      >
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-indigo-500/20 text-indigo-300 ring-1 ring-indigo-500/40">
            <Network size={26} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-bold text-slate-100">اختبر معلوماتك — محاكي بناء شبكة FTTH</h3>
              <span className="rounded-full border border-amber-700/60 bg-amber-950/50 px-2 py-0.5 text-[10px] text-amber-300">
                قيد التطوير — خاص بحساب المطور
              </span>
            </div>
            <p className="mt-1.5 text-[12px] leading-relaxed text-slate-400">
              صمّم شبكة ألياف ضوئية كاملة من الصفر: مسارات الحفر والأنابيب، المناهل والكبائن، القواسم
              البصرية وكابلات الإسقاط — مع فحص هندسي حي، حساب ميزانية القدرة الضوئية، وجدول كميات
              بأسعار السوق الحقيقية، ثم اختبرها بمختبر اللحام وأجهزة OTDR.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-[10px] text-slate-500">
              <span className="rounded bg-slate-800/80 px-2 py-1">يعمل على الحاسوب فقط (شاشة ≥ 7")</span>
              <span className="rounded bg-slate-800/80 px-2 py-1">مستوى مبتدئ: زقاق 16 داراً</span>
            </div>
          </div>
          <button
            type="button"
            onClick={launch}
            className="flex shrink-0 items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-indigo-950/50 transition-colors hover:bg-indigo-500"
          >
            <Play size={16} />
            تشغيل المحاكي
          </button>
        </div>
      </div>

      {/* رسالة اعتراض الشاشة */}
      {block && !block.ok && (
        <div
          dir="rtl"
          className="fixed inset-0 z-[95] flex items-center justify-center bg-black/70 p-6"
          onClick={() => setBlock(null)}
        >
          <div
            className="max-w-md rounded-2xl border border-red-900/60 bg-slate-900 p-6 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <MonitorX size={40} className="mx-auto text-red-400" />
            <h3 className="mt-3 text-base font-bold text-slate-100">غير متاح على هذا الجهاز</h3>
            <p className="mt-2 text-[13px] leading-relaxed text-slate-400">{block.reasonAr}</p>
            <p className="mt-2 text-[11px] text-slate-500">
              القطر التقديري للشاشة الحالية: {block.inches.toFixed(1)} بوصة
            </p>
            <button
              type="button"
              onClick={() => setBlock(null)}
              className="mt-4 rounded-lg bg-slate-800 px-4 py-2 text-sm text-slate-200 hover:bg-slate-700"
            >
              فهمت
            </button>
          </div>
        </div>
      )}

      {/* مساحة العمل — تحميل كسول */}
      {open && (
        <Suspense
          fallback={
            <div className="fixed inset-0 z-[90] flex flex-col items-center justify-center gap-3 bg-[#070d18] text-slate-300">
              <Loader2 size={32} className="animate-spin text-indigo-400" />
              <p className="text-sm">جارٍ تحميل مساحة عمل المحاكي…</p>
            </div>
          }
        >
          <FiberSimulatorWorkspace onClose={closeWorkspace} />
        </Suspense>
      )}
    </>
  );
}
