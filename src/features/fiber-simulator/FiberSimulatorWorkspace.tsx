/**
 * ============================================================
 * مساحة عمل المحاكي — التجميع النهائي (رأس + أدوات + لوحة + فحص)
 * ============================================================
 * تُحمَّل كسولاً (React.lazy) من بطاقة الإطلاق كي تبقى خارج
 * حزمة التطبيق الأساسي حتى يفتحها المطور.
 * تدعم: ملء الشاشة، تسمية المحاكاة، الحفظ/الاسترجاع،
 * ورسالة تأكيد «هل تريد حفظ التغييرات؟» قبل الخروج.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, FolderOpen, HelpCircle, Loader2, Lock, Maximize2, Minimize2, Plus, Save, Trash2, TriangleAlert, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { simRedo, simUndo, useSimulatorStore } from './store/simulator.store';
import { useEduStore } from './store/education.store';
import { checkPhaseAllowed, computeBuildProgress, type GuardResult } from './education/build-order';
import {
  deleteFiberProject,
  insertFiberProject,
  listFiberProjects,
  loadFiberProject,
  updateFiberProject,
  type FiberProjectRow,
} from './services/scores.service';
import { getMapById } from './data/maps/registry';
import SimCanvas from './ui/SimCanvas';
import SimToolbar from './ui/SimToolbar';
import SimInspector from './ui/SimInspector';
import SplicingLab from './ui/SplicingLab';
import TestingPanel from './ui/TestingPanel';
import OnboardingTour from './ui/OnboardingTour';
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
  const edu = useEduStore();
  const map = getMapById(st.mapId);

  /* ===== تسمية المحاكاة وحالة الحفظ ===== */
  const [projectName, setProjectName] = useState('');
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  /* المشروع المفتوح حالياً: معرّفه واسمه المحفوظ (أساس منطق Save As) */
  const [projectId, setProjectId] = useState<string | null>(null);
  const [savedName, setSavedName] = useState('');
  /* نافذة «فتح المشروع» */
  const [openDlg, setOpenDlg] = useState(false);
  const [projects, setProjects] = useState<FiberProjectRow[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmExit, setConfirmExit] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [isFs, setIsFs] = useState(false);
  /* رسالة اعتراض موحّدة للأطوار والخطوات المقفلة + مؤقت إخفائها */
  const [blockMsg, setBlockMsg] = useState<GuardResult | null>(null);
  const blockTimer = useRef(0);

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
        setProjectId(row.id);
        setSavedName(row.name);
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

  /* ===== فتح الجولة التدريبية تلقائياً عند كل تشغيل للمحاكي =====
     مهلة قصيرة (450ms) حتى تستقر حركة الانتقال إلى ملء الشاشة
     ويلتقي القياس بمواضع العناصر النهائية — بلا وميض أو تعارض */
  useEffect(() => {
    const t = window.setTimeout(() => edu.openTour(), 450);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ===== رسالة الاعتراض التعليمية الموحّدة (أطوار + خطوات مقفلة) ===== */
  const showBlock = (g: GuardResult) => {
    window.clearTimeout(blockTimer.current);
    setBlockMsg(g);
    edu.logError({
      code: g.code ?? 'ORDER_BLOCKED',
      severity: 'warn',
      titleAr: g.titleAr ?? 'ترتيب خاطئ',
      messageAr: g.messageAr ?? '',
      lessonAr: g.lessonAr ?? '',
    });
    blockTimer.current = window.setTimeout(() => setBlockMsg(null), 8000);
  };
  useEffect(() => () => window.clearTimeout(blockTimer.current), []);

  /* ===== حساب تقدم البناء الخمس خطوات ===== */
  const homesTotal = map?.requirements.homes ?? 1;
  const progress = useMemo(
    () => computeBuildProgress(st.entities, homesTotal),
    [st.entities, homesTotal]
  );

  /* ===== نقر طور — محمي بقيود الترتيب ===== */
  const onPhaseClick = (id: PhaseId) => {
    if (id === st.phase) return;
    const g = checkPhaseAllowed(id, st.entities);
    if (!g.ok) {
      showBlock(g);
      return;
    }
    st.setPhase(id);
  };

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

  /* ===== حفظ المحاكاة — منطق مزدوج =====
   * أ) الاسم كما هو (يطابق اسم المشروع المفتوح) → تحديث المشروع
   *    نفسه بمعرّفه — لا ينشئ شيئاً جديداً ولا يفقد البيانات.
   * ب) الاسم معدَّل → «حفظ باسم جديد» (Save As): نسخة مستقلة
   *    بالاسم الجديد، والنسخة الأصلية تبقى محفوظة كما هي.
   *    الاسم المكرر يُرفض من قاعدة البيانات (قيد التفرد) برسالة واضحة. */
  const doSave = async (): Promise<boolean> => {
    if (!user) {
      setToast('تعذر تحديد المستخدم — لا يمكن الحفظ');
      return false;
    }
    const name = projectName.trim() || 'محاكاة بدون اسم';
    setSaving(true);
    try {
      if (projectId && name === savedName) {
        /* (أ) حفظ فوق المشروع الحالي نفسه */
        await updateFiberProject(user.id, projectId, {
          name,
          phase: st.phase,
          entities: st.entities,
        });
        setToast(`تم تحديث المشروع «${name}»`);
      } else {
        /* (ب) نسخة جديدة — أول حفظ أو تغيير الاسم */
        const row = await insertFiberProject({
          userId: user.id,
          mapId: st.mapId,
          name,
          phase: st.phase,
          entities: st.entities,
        });
        setProjectId(row.id);
        setSavedName(row.name);
        setToast(
          projectId
            ? `تم حفظ نسخة جديدة «${name}» — والنسخة «${savedName}» محفوظة كما هي`
            : `تم حفظ المشروع «${name}» — افتحه لاحقاً من زر «فتح مشروع»`
        );
      }
      setDirty(false);
      return true;
    } catch (err) {
      setToast(err instanceof Error ? err.message : 'تعذر حفظ المحاكاة');
      return false;
    } finally {
      setSaving(false);
    }
  };

  /* ===== فتح المشروع: جلب قائمة المشاريع المحفوظة ===== */
  const openProjectList = async () => {
    if (!user) {
      setToast('تعذر تحديد المستخدم — لا يمكن جلب المشاريع');
      return;
    }
    setOpenDlg(true);
    setListLoading(true);
    try {
      setProjects(await listFiberProjects(user.id));
    } catch (err) {
      setToast(err instanceof Error ? err.message : 'تعذر جلب قائمة المشاريع');
      setProjects([]);
    } finally {
      setListLoading(false);
    }
  };

  /* ===== تحميل مشروع مختار إلى مساحة العمل ===== */
  const openProject = (row: FiberProjectRow) => {
    /* خريطة مختلفة؟ نبدّل الخريطة أولاً ثم نستبدل الكيانات */
    const m = getMapById(row.map_id);
    if (m && m.id !== st.mapId) st.loadMap(m);
    suppressDirty.current = 2;
    st.loadEntities(row.entities);
    st.setPhase(row.phase);
    setProjectName(row.name);
    setSavedName(row.name);
    setProjectId(row.id);
    setDirty(false);
    setOpenDlg(false);
    setToast(`تم فتح المشروع «${row.name}» — واصل من حيث توقفت`);
  };

  /* ===== حذف مشروع من القائمة ===== */
  const removeProject = async (row: FiberProjectRow) => {
    if (!user) return;
    setDeletingId(row.id);
    try {
      await deleteFiberProject(user.id, row.id);
      setProjects((ps) => ps.filter((p) => p.id !== row.id));
      /* لو حُذف المشروع المفتوح حالياً: يبقى العمل قائماً لكن
         الحفظ القادم سيُنشئ مشروعاً جديداً بالاسم الحالي */
      if (projectId === row.id) {
        setProjectId(null);
        setSavedName('');
      }
      setToast(`تم حذف المشروع «${row.name}»`);
    } catch (err) {
      setToast(err instanceof Error ? err.message : 'تعذر حذف المشروع');
    } finally {
      setDeletingId(null);
    }
  };

  /* ===== مشروع جديد: مساحة عمل فارغة تبدأ من الطور المدني =====
     يفرّغ التصميم ويعيد الطور الأول ويصفّر الاسم والمعرّف —
     والحفظ القادم ينشئ مشروعاً مستقلاً جديداً */
  const newProject = () => {
    if (
      dirty &&
      !window.confirm('لديك تغييرات غير محفوظة في المشروع الحالي وسيتم تجاهلها. متابعة؟')
    ) {
      return;
    }
    suppressDirty.current = 1;
    st.clearAll();
    st.setPhase('civil');
    setProjectName('');
    setProjectId(null);
    setSavedName('');
    setDirty(false);
    setOpenDlg(false);
    setToast('مشروع جديد — مساحة عمل فارغة، سمِّ المشروع ثم اضغط «حفظ»');
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
        if (openDlg) {
          setOpenDlg(false);
          return;
        }
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
  }, [st, confirmExit, projectName, projectId, savedName, openDlg]);

  return (
    <div ref={rootRef} id="fiber-sim-root" dir="rtl" className="fixed inset-0 z-[90] flex flex-col bg-[#070d18] text-slate-200">
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

        <button
          type="button"
          onClick={edu.openTour}
          title="الجولة التدريبية — تعريف بالواجهة والأدوات وترتيب البناء"
          className="flex h-9 w-9 items-center justify-center rounded-lg text-indigo-400 hover:bg-indigo-500/15 hover:text-indigo-300"
        >
          <HelpCircle size={18} />
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
            onClick={() => void openProjectList()}
            title="فتح مشروع محفوظ — قائمة بمشاريعك المحفوظة لمواصلة العمل عليها"
            className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-1.5 text-xs font-bold text-slate-200 transition-colors hover:bg-slate-700"
          >
            <FolderOpen size={14} />
            فتح مشروع
          </button>
          <button
            type="button"
            onClick={() => void doSave()}
            disabled={saving}
            title="حفظ (Ctrl+S) — بنفس الاسم يحدّث المشروع الحالي، وباسم معدَّل ينشئ نسخة جديدة"
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

        {/* متدرج الأطوار — محمي بقيود الترتيب التعليمي */}
        <nav data-tour="phases" className="mr-auto flex items-center gap-1">
          {PHASES.map((p, i) => {
            const active = st.phase === p.id;
            const done = PHASES.findIndex((x) => x.id === st.phase) > i;
            return (
              <button
                key={p.id}
                type="button"
                title={p.descAr}
                onClick={() => onPhaseClick(p.id)}
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

      {/* شريط التقدم التعليمي — الخطوات الخمس بإلزامية الترتيب (أطوار التصميم فقط) */}
      {(st.phase === 'civil' || st.phase === 'optical') && (
        <div
          data-tour="progress"
          dir="rtl"
          className="flex h-11 shrink-0 items-center gap-2 border-b border-slate-800 bg-slate-900/50 px-3"
        >
          <span className="shrink-0 text-[11px] font-bold text-slate-400">تسلسل البناء:</span>
          <div className="flex min-w-0 items-center gap-1 overflow-x-auto">
            {progress.steps.map((s) => (
              <button
                key={s.meta.id}
                type="button"
                title={`${s.meta.goalAr}${s.locked ? ' (مقفلة — أنجز ما قبلها أولاً)' : ''}`}
                onClick={() => {
                  if (s.locked) {
                    showBlock({
                      ok: false,
                      code: 'STEP_LOCKED',
                      titleAr: 'خطوة مقفلة — الترتيب الهندسي أولاً',
                      messageAr: `«${s.meta.titleAr}» تتطلب إنجاز «${
                        progress.currentStep?.titleAr ?? 'الخطوة الحالية'
                      }» أولاً — أكملها ثم عد لهذه الخطوة.`,
                      lessonAr:
                        'كل طبقة من الشبكة تُبنى مادياً فوق التي تسبقها: الأنابيب تحت الأرض قبل المنشآت، والتغذية قبل التوزيع. تجاهل الترتيب يعيد الحفر ويضاعف الكلفة.',
                      requiredStep: progress.currentStep ?? undefined,
                    });
                    return;
                  }
                  st.setTool(s.meta.tools[0]);
                }}
                className={`flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-[10.5px] font-semibold transition-colors ${
                  s.current
                    ? 'bg-indigo-500/20 text-indigo-200 ring-1 ring-indigo-400/50'
                    : s.done
                      ? 'bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20'
                      : s.locked
                        ? 'cursor-not-allowed text-slate-600'
                        : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                }`}
              >
                {s.done ? (
                  <Check size={11} className="text-emerald-400" />
                ) : s.locked ? (
                  <Lock size={10} />
                ) : (
                  <span className="text-slate-500">{s.meta.order}.</span>
                )}
                {s.meta.titleAr}
                <span className="text-[9px] font-normal text-slate-500">{s.countAr}</span>
              </button>
            ))}
          </div>
          {/* النسبة الكلية */}
          <div className="mr-auto flex shrink-0 items-center gap-2">
            <div className="h-1.5 w-36 overflow-hidden rounded-full bg-slate-800">
              <div
                className="h-full rounded-full bg-gradient-to-l from-emerald-500 to-sky-400 transition-all duration-500"
                style={{ width: `${progress.overallPct}%` }}
              />
            </div>
            <span className="text-[11px] font-bold text-emerald-300">{progress.overallPct}%</span>
          </div>
        </div>
      )}

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
            <main data-tour="canvas" className="min-w-0 flex-1">
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

      {/* رسالة اعتراض خرق الترتيب (أطوار/خطوات) */}
      {blockMsg && (
        <div
          dir="rtl"
          onClick={() => setBlockMsg(null)}
          className="absolute left-1/2 top-20 z-[125] max-w-[400px] -translate-x-1/2 cursor-pointer rounded-xl border border-amber-500/50 bg-[#1f1608]/95 p-3 shadow-2xl shadow-black/70"
        >
          <div className="flex items-start gap-2">
            <TriangleAlert className="mt-0.5 h-4.5 w-4.5 shrink-0 text-amber-400" />
            <div className="min-w-0">
              <div className="text-[13px] font-bold text-amber-300">{blockMsg.titleAr}</div>
              <p className="mt-1 text-[12.5px] leading-[1.7] text-slate-200">{blockMsg.messageAr}</p>
              {blockMsg.lessonAr && (
                <p className="mt-1.5 rounded-lg bg-amber-500/10 px-2 py-1 text-[11.5px] leading-[1.65] text-amber-200/90">
                  <span className="font-semibold">الدرس المستفاد: </span>
                  {blockMsg.lessonAr}
                </p>
              )}
              {blockMsg.requiredStep && (
                <p className="mt-1.5 text-[11.5px] text-sky-300">
                  <span className="font-semibold">المطلوب الآن: </span>
                  {blockMsg.requiredStep.order}. {blockMsg.requiredStep.titleAr} —{' '}
                  {blockMsg.requiredStep.goalAr}
                </p>
              )}
              <p className="mt-1.5 text-[10px] text-slate-500">انقر للإخفاء</p>
            </div>
          </div>
        </div>
      )}

      {/* نافذة «فتح المشروع» — قائمة المشاريع المحفوظة من قاعدة البيانات */}
      {openDlg && (
        <div
          dir="rtl"
          className="fixed inset-0 z-[126] flex items-center justify-center bg-black/70 p-6"
          onClick={() => setOpenDlg(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="flex max-h-[75vh] w-full max-w-lg flex-col rounded-2xl border border-slate-700 bg-[#0b1322] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-800 px-5 py-3.5">
              <h3 className="text-sm font-bold text-slate-100">مشاريعك المحفوظة</h3>
              <button
                type="button"
                onClick={() => setOpenDlg(false)}
                title="إغلاق"
                className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800 hover:text-slate-100"
              >
                <X size={16} />
              </button>
            </div>

            {/* خيار «مشروع جديد» — مساحة عمل فارغة دون الحاجة لحفظ سابق */}
            <div className="border-b border-slate-800 px-3 pt-3 pb-3">
              <button
                type="button"
                onClick={newProject}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-slate-600 bg-slate-900/40 px-3 py-2.5 text-[12.5px] font-bold text-slate-200 transition-colors hover:border-indigo-500 hover:bg-indigo-500/10 hover:text-indigo-200"
              >
                <Plus size={15} />
                مشروع جديد — مساحة عمل فارغة
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              {listLoading ? (
                <div className="flex items-center justify-center gap-2 py-10 text-slate-400">
                  <Loader2 size={18} className="animate-spin" />
                  <span className="text-sm">جارٍ جلب المشاريع…</span>
                </div>
              ) : projects.length === 0 ? (
                <div className="py-10 text-center text-[13px] leading-relaxed text-slate-500">
                  لا توجد مشاريع محفوظة بعد.
                  <br />
                  صمّم شبكتك ثم اضغط «حفظ» لتظهر هنا.
                </div>
              ) : (
                projects.map((row) => {
                  const m = getMapById(row.map_id);
                  const ph = PHASES.find((p) => p.id === row.phase);
                  const isOpen = row.id === projectId;
                  return (
                    <div
                      key={row.id}
                      className={`mb-2 flex items-center gap-3 rounded-xl border p-3 transition-colors ${
                        isOpen
                          ? 'border-indigo-500/60 bg-indigo-500/10'
                          : 'border-slate-800 bg-slate-900/60 hover:border-slate-600'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-[13px] font-bold text-slate-100">
                            {row.name}
                          </span>
                          {isOpen && (
                            <span className="shrink-0 rounded-full bg-indigo-500/20 px-2 py-0.5 text-[9.5px] font-bold text-indigo-300">
                              المفتوح الآن
                            </span>
                          )}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10.5px] text-slate-500">
                          <span>{m ? m.name : row.map_id}</span>
                          <span>· {ph ? ph.nameAr : row.phase}</span>
                          <span dir="ltr">
                            · {new Date(row.updated_at).toLocaleString('ar', { dateStyle: 'medium', timeStyle: 'short' })}
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => openProject(row)}
                        className="shrink-0 rounded-lg bg-indigo-600 px-3 py-1.5 text-[11px] font-bold text-white transition-colors hover:bg-indigo-500"
                      >
                        فتح
                      </button>
                      <button
                        type="button"
                        onClick={() => void removeProject(row)}
                        disabled={deletingId === row.id}
                        title="حذف المشروع نهائياً"
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-rose-400 transition-colors hover:bg-rose-500/15 disabled:opacity-50"
                      >
                        {deletingId === row.id ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <Trash2 size={14} />
                        )}
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            <div className="border-t border-slate-800 px-5 py-2.5 text-[10.5px] text-slate-500">
              {projects.length > 0
                ? `${projects.length} مشروعاً — مرتبة من الأحدث تعديلاً · الحفظ باسم معدَّل ينشئ نسخة جديدة`
                : 'الحفظ باسم معدَّل عن المشروع المفتوح ينشئ نسخة جديدة مستقلة'}
            </div>
          </div>
        </div>
      )}

      {/* الجولة التدريبية التوجيهية */}
      <OnboardingTour />

      {/* تنبيه عائم */}
      {toast && (
        <div className="pointer-events-none fixed bottom-6 left-1/2 z-[130] -translate-x-1/2 rounded-xl border border-slate-700 bg-slate-900/95 px-4 py-2 text-sm text-slate-100 shadow-xl">
          {toast}
        </div>
      )}
    </div>
  );
}
