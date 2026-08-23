/**
 * ============================================================
 * مساحة عمل المحاكي — التجميع النهائي (رأس + أدوات + لوحة + فحص)
 * ============================================================
 * تُحمَّل كسولاً (React.lazy) من بطاقة الإطلاق كي تبقى خارج
 * حزمة التطبيق الأساسي حتى يفتحها المطور.
 * تدعم: ملء الشاشة، تسمية المحاكاة، الحفظ/الاسترجاع،
 * ورسالة تأكيد «هل تريد حفظ التغييرات؟» قبل الخروج.
 */

import { useEffect, useRef, useState } from 'react';
import { Loader2, Maximize2, Minimize2, Save, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { simRedo, simUndo, useSimulatorStore } from './store/simulator.store';
import { loadFiberProject, saveFiberProject } from './services/scores.service';
import { getMapById } from './data/maps/registry';
import SimCanvas from './ui/SimCanvas';
import SimToolbar from './ui/SimToolbar';
import SimInspector from './ui/SimInspector';
import SplicingLab from './ui/SplicingLab';
import TestingPanel from './ui/TestingPanel';
import type { PhaseId } from './types';

const PHASES: { id: PhaseId; nameAr: string; descAr: string }[] = [
  { id: 'civil', nameAr: 'الأعمال المدنية', descAr: 'مسارات الحفر والأنابيب والمنشآت' },
  { id: 'optical', nameAr: 'الشبكة البصرية', descAr: 'الكبينة والقواسم وكابلات الإسقاط' },
  { id: 'splicing', nameAr: 'مختبر اللحام', descAr: 'محاكاة اللحام والتسلسل اللوني' },
  { id: 'testing', nameAr: 'الاختبار والتشغيل', descAr: 'OTDR ومقياس القدرة والتقييم' },
];

export default function FiberSimulatorWorkspace({
  onClose,
}: {
  onClose: () => void;
}): React.ReactElement {
  const user = useAuth().user;
  const st = useSimulatorStore();
  const map = getMapById(st.mapId);

  /* ===== تسمية المحاكاة وحالة الحفظ ===== */
  const [projectName, setProjectName] = useState('');
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmExit, setConfirmExit] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [isFs, setIsFs] = useState(false);

  /* يمنع وسم «غير محفوظ» أثناء استرجاع مشروع من قاعدة البيانات */
  const suppressDirty = useRef(0);
  const mounted = useRef(false);
  /* حاوية المحاكي — هي من يدخل وضع ملء الشاشة (وليس المستند كله)،
     فتتضخم لوحة المحاكي وحدها ولا يتأثر التطبيق الأساسي إطلاقاً */
  const rootRef = useRef<HTMLDivElement>(null);

  /* ===== تتبع التعديلات غير المحفوظة ===== */
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    if (suppressDirty.current > 0) {
      suppressDirty.current -= 1;
      return;
    }
    setDirty(true);
  }, [st.entities, st.phase]);

  /* ===== استرجاع آخر محاكاة محفوظة لهذه الخريطة عند الفتح ===== */
  useEffect(() => {
    let alive = true;
    const restore = async () => {
      if (!user) return;
      try {
        const row = await loadFiberProject(user.id, st.mapId);
        if (!alive || !row) return;
        suppressDirty.current = 2;
        st.loadEntities(row.entities);
        st.setPhase(row.phase);
        setProjectName(row.name);
        setToast(`تم استرجاع المحاكاة المحفوظة «${row.name}» — واصل من حيث توقفت`);
      } catch {
        /* لا مشروع محفوظ بعد — نبدأ من صفحة بيضاء */
      }
    };
    void restore();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ===== إخفاء التنبيهات تلقائياً ===== */
  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(t);
  }, [toast]);

  /* ===== ملء الشاشة على حاوية المحاكي نفسها عند الفتح =====
     يُطلب مباشرة بعد التركيب (ضمن فترة تنشيط المستخدم من نقرة «تشغيل»).
     إن رفض المتصفح: تبقى الحاوية مالئة لنافذة المتصفح عبر fixed inset-0. */
  useEffect(() => {
    const el = rootRef.current;
    if (el && !document.fullscreenElement) {
      void el.requestFullscreen().catch(() => {});
    }
    /* عند إزالة الحاوية (إغلاق المحاكي) نضمن الخروج من ملء الشاشة
       كي يعود التطبيق الأساسي إلى حالته الطبيعية */
    return () => {
      if (document.fullscreenElement) {
        void document.exitFullscreen().catch(() => {});
      }
    };
  }, []);

  /* ===== مزامنة حالة ملء الشاشة ===== */
  useEffect(() => {
    const h = () => setIsFs(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', h);
    return () => document.removeEventListener('fullscreenchange', h);
  }, []);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    else rootRef.current?.requestFullscreen().catch(() => {});
  };

  /* ===== حفظ المحاكاة باسمها ===== */
  const doSave = async (): Promise<boolean> => {
    if (!user) {
      setToast('تعذر تحديد المستخدم — لا يمكن الحفظ');
      return false;
    }
    setSaving(true);
    try {
      await saveFiberProject({
        userId: user.id,
        mapId: st.mapId,
        name: projectName.trim() || 'محاكاة بدون اسم',
        phase: st.phase,
        entities: st.entities,
      });
      setDirty(false);
      setToast('تم حفظ المحاكاة — يمكنك العودة إليها لاحقاً ومتابعتها');
      return true;
    } catch (err) {
      setToast(err instanceof Error ? err.message : 'تعذر حفظ المحاكاة');
      return false;
    } finally {
      setSaving(false);
    }
  };

  /* ===== مسار الخروج مع تأكيد الحفظ ===== */
  const finalizeClose = () => {
    setConfirmExit(false);
    onClose();
  };

  const requestClose = () => {
    if (!dirty) {
      onClose();
      return;
    }
    setConfirmExit(true);
  };

  /* ===== اختصارات لوحة المفاتيح ===== */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && ['INPUT', 'SELECT', 'TEXTAREA'].includes(t.tagName)) return;

      if (e.key === 'Escape') {
        if (confirmExit) {
          setConfirmExit(false);
          return;
        }
        if (st.trenchDraft) st.cancelTrench();
        if (st.dropDraft) st.cancelDrop();
        st.setMeasure(null, null);
        return;
      }
      if (e.key === 'Enter' && st.trenchDraft) {
        e.preventDefault();
        st.commitTrench();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        void doSave();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) simRedo();
        else simUndo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        simRedo();
        return;
      }
      if (e.key === 'Backspace' && st.trenchDraft) {
        e.preventDefault();
        st.undoTrenchPoint();
        return;
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && st.selectedIds.length === 1) {
        e.preventDefault();
        const id = st.selectedIds[0];
        const e2 = st.entities;
        const kind = e2.trenches.some((x) => x.id === id)
          ? 'trench'
          : e2.structures.some((x) => x.id === id)
            ? 'structure'
            : e2.cabinets.some((x) => x.id === id)
              ? 'cabinet'
              : e2.fats.some((x) => x.id === id)
                ? 'fat'
                : e2.drops.some((x) => x.id === id)
                  ? 'drop'
                  : null;
        if (kind) st.removeEntity(kind, id);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [st, confirmExit, projectName]);

  return (
    <div ref={rootRef} dir="rtl" className="fixed inset-0 z-[90] flex flex-col bg-[#070d18] text-slate-200">
      {/* الرأس */}
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-slate-800 bg-slate-900/80 px-3">
        <button
          type="button"
          onClick={requestClose}
          title="إغلاق المحاكي والعودة إلى التطبيق"
          className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800 hover:text-slate-100"
        >
          <X size={20} />
        </button>

        <button
          type="button"
          onClick={toggleFullscreen}
          title={isFs ? 'الخروج من ملء الشاشة' : 'ملء الشاشة (100%)'}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800 hover:text-slate-100"
        >
          {isFs ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
        </button>

        <div className="min-w-0">
          <h1 className="truncate text-sm font-bold text-slate-100">
            محاكي بناء شبكات الألياف الضوئية FTTH
          </h1>
          <p className="truncate text-[11px] text-slate-500">
            {map ? `${map.name} — ${map.requirements.homes} داراً` : ''}
          </p>
        </div>

        {/* تسمية المحاكاة + الحفظ */}
        <div className="mr-2 flex items-center gap-2">
          <input
            type="text"
            value={projectName}
            onChange={(e) => {
              setProjectName(e.target.value);
              setDirty(true);
            }}
            placeholder="اسم المحاكاة… (مثال: زقاق 16 — التصميم الأول)"
            title="اسم المحاكاة — يتيح لك العودة إليها لاحقاً"
            className="w-56 rounded-lg border border-slate-700 bg-slate-950/60 px-2.5 py-1.5 text-xs text-slate-200 placeholder:text-slate-600 focus:border-indigo-500 focus:outline-none"
          />
          <button
            type="button"
            onClick={() => void doSave()}
            disabled={saving}
            title="حفظ المحاكاة (Ctrl+S)"
            className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-indigo-500 disabled:opacity-50"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {saving ? 'جارٍ الحفظ…' : 'حفظ'}
          </button>
          {dirty && (
            <span
              title="لديك تغييرات غير محفوظة"
              className="h-2 w-2 shrink-0 rounded-full bg-amber-400"
            />
          )}
        </div>

        {/* متدرج الأطوار */}
        <nav className="mr-auto flex items-center gap-1">
          {PHASES.map((p, i) => {
            const active = st.phase === p.id;
            const done = PHASES.findIndex((x) => x.id === st.phase) > i;
            return (
              <button
                key={p.id}
                type="button"
                title={p.descAr}
                onClick={() => st.setPhase(p.id)}
                className={`rounded-lg px-3 py-1.5 text-[11px] font-semibold transition-colors ${
                  active
                    ? 'bg-indigo-500/25 text-indigo-200 ring-1 ring-indigo-400/50'
                    : done
                      ? 'text-emerald-400/80 hover:bg-slate-800'
                      : 'text-slate-500 hover:bg-slate-800 hover:text-slate-300'
                }`}
              >
                {i + 1}. {p.nameAr}
              </button>
            );
          })}
        </nav>

        <span className="rounded-full border border-amber-800/60 bg-amber-950/40 px-2.5 py-1 text-[10px] text-amber-300">
          نسخة التطوير
        </span>
      </header>

      {/* الجسم — يتغير حسب الطور */}
      <div className="flex min-h-0 flex-1">
        {st.phase === 'splicing' ? (
          <div className="min-h-0 flex-1">
            <SplicingLab />
          </div>
        ) : st.phase === 'testing' ? (
          <div className="min-h-0 flex-1">
            <TestingPanel />
          </div>
        ) : (
          <>
            <SimToolbar />
            <main className="min-w-0 flex-1">
              <SimCanvas />
            </main>
            <SimInspector />
          </>
        )}
      </div>

      {/* رسالة تأكيد الخروج — هل تريد حفظ التغييرات؟ */}
      {confirmExit && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 p-6"
          onClick={() => setConfirmExit(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-bold text-slate-100">هل تريد حفظ التغييرات؟</h3>
            <p className="mt-2 text-[13px] leading-relaxed text-slate-400">
              لديك تعديلات غير محفوظة على المحاكاة
              {projectName.trim() ? ` «${projectName.trim()}»` : ''}. عند الحفظ يمكنك العودة
              إليها لاحقاً ومتابعة العمل من حيث توقفت، وإلا فستفقد هذه التعديلات.
            </p>
            <div className="mt-5 flex items-center gap-2">
              <button
                type="button"
                onClick={async () => {
                  if (await doSave()) finalizeClose();
                }}
                className="flex-1 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-indigo-500"
              >
                نعم، احفظ واخرج
              </button>
              <button
                type="button"
                onClick={finalizeClose}
                className="flex-1 rounded-lg bg-slate-800 px-4 py-2 text-sm text-slate-200 transition-colors hover:bg-slate-700"
              >
                لا، خروج بدون حفظ
              </button>
              <button
                type="button"
                onClick={() => setConfirmExit(false)}
                className="rounded-lg px-3 py-2 text-sm text-slate-400 transition-colors hover:text-slate-200"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* تنبيه عائم */}
      {toast && (
        <div className="pointer-events-none fixed bottom-6 left-1/2 z-[130] -translate-x-1/2 rounded-xl border border-slate-700 bg-slate-900/95 px-4 py-2 text-sm text-slate-100 shadow-xl">
          {toast}
        </div>
      )}
    </div>
  );
}
