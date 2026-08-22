/**
 * ============================================================
 * مختبر اللحام — الطور الثالث في محاكي FTTH
 * ============================================================
 * محاكاة تعليمية لعملية اللحام الحراري (Fusion Splicing):
 * 1) اختيار ليفة اللون الصحيح وفق التسلسل المعياري TIA-598
 *    (رقم المنفذ في FAT يحدد اللون).
 * 2) لعبة قوس اللحام: ضبط قدرة القوس في المنطقة الخضراء
 *    يمنح لحامةً بفقد منخفض (0.02 dB) والانحراف يرفع الفقد.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCircle2,
  ChevronLeft,
  CircleDashed,
  FlaskConical,
  Lightbulb,
  RefreshCw,
} from 'lucide-react';
import { useSimulatorStore } from '../store/simulator.store';
import { useLabStore } from '../store/lab.store';
import { getMapById } from '../data/maps/registry';
import { FIBER_COLORS, SPLICE_LOSS_DB } from '../engine/physics';

/* ألوان الشعيرات الفعلية على الشاشة (بنفس ترتيب FIBER_COLORS العربي) */
const FIBER_HEX = [
  '#2563eb', '#f97316', '#16a34a', '#92400e', '#9ca3af', '#f8fafc',
  '#dc2626', '#171717', '#eab308', '#7c3aed', '#ec4899', '#06b6d4',
];

interface DropTask {
  dropId: string;
  buildingId: string;
  label: string;
  fatId: string;
  portNumber: number;
  fiberIndex: number;
}

const spliceVerdict = (loss: number): { label: string; cls: string } =>
  loss <= 0.06
    ? { label: 'لحامة مثالية', cls: 'text-emerald-400' }
    : loss <= 0.15
      ? { label: 'لحامة مقبولة', cls: 'text-lime-400' }
      : loss <= 0.3
        ? { label: 'لحامة ضعيفة — يُفضل إعادتها', cls: 'text-amber-400' }
        : { label: 'لحامة فاشلة — أعدها فوراً', cls: 'text-red-400' };

export default function SplicingLab(): React.ReactElement {
  const entities = useSimulatorStore((s) => s.entities);
  const mapId = useSimulatorStore((s) => s.mapId);
  const setPhase = useSimulatorStore((s) => s.setPhase);
  const lab = useLabStore();
  const map = getMapById(mapId);

  const [activeIdx, setActiveIdx] = useState(0);
  const [stage, setStage] = useState<'color' | 'arc' | 'result'>('color');
  const [wrongColor, setWrongColor] = useState<number | null>(null);
  const [lastLoss, setLastLoss] = useState<number | null>(null);
  const [arcPos, setArcPos] = useState(0);
  const arcDir = useRef(1);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /* بناء قائمة المهام: منفذ كل دار في FAT ولونها المعياري */
  const tasks: DropTask[] = useMemo(() => {
    if (!map) return [];
    const labelOf = (bid: string) => map.buildings.find((b) => b.id === bid)?.label ?? bid;
    const out: DropTask[] = [];
    for (const fat of entities.fats) {
      const drops = entities.drops
        .filter((d) => d.fromFatId === fat.id)
        .sort((a, b) => labelOf(a.toBuildingId).localeCompare(labelOf(b.toBuildingId), 'ar'));
      drops.forEach((d, i) => {
        out.push({
          dropId: d.id,
          buildingId: d.toBuildingId,
          label: labelOf(d.toBuildingId),
          fatId: fat.id,
          portNumber: i + 1,
          fiberIndex: i % 12,
        });
      });
    }
    return out;
  }, [entities.fats, entities.drops, map]);

  const doneCount = tasks.filter((t) => lab.splices[t.dropId]).length;
  const task = tasks.filter((t) => !lab.splices[t.dropId])[activeIdx] ?? null;
  const allDone = tasks.length > 0 && doneCount === tasks.length;

  /* تحريك مؤشر قوس اللحام ذهاباً وإياباً */
  useEffect(() => {
    if (stage !== 'arc') return;
    timerRef.current = setInterval(() => {
      setArcPos((p) => {
        let next = p + arcDir.current * 2.2;
        if (next >= 100) {
          next = 100;
          arcDir.current = -1;
        } else if (next <= 0) {
          next = 0;
          arcDir.current = 1;
        }
        return next;
      });
    }, 16);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [stage]);

  /* زر المسافة لتنفيذ اللحام */
  useEffect(() => {
    if (stage !== 'arc') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        fuse();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, arcPos]);

  const pickColor = (idx: number): void => {
    if (!task) return;
    if (idx === task.fiberIndex) {
      setWrongColor(null);
      setStage('arc');
      setArcPos(0);
      arcDir.current = 1;
    } else {
      setWrongColor(idx);
      setTimeout(() => setWrongColor(null), 900);
    }
  };

  /** فقد اللحامة حسب قرب القوس من مركزه الأمثل (55) */
  const fuse = (): void => {
    const dist = Math.abs(arcPos - 55);
    const loss = Math.min(
      0.5,
      SPLICE_LOSS_DB + Math.pow(dist / 45, 1.6) * 0.45
    );
    setLastLoss(Math.round(loss * 1000) / 1000);
    setStage('result');
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const acceptSplice = (): void => {
    if (!task || lastLoss === null) return;
    lab.recordSplice({
      dropId: task.dropId,
      buildingId: task.buildingId,
      fiberIndex: task.fiberIndex,
      correctColor: true,
      lossDb: lastLoss,
      at: Date.now(),
    });
    setLastLoss(null);
    setStage('color');
    setActiveIdx(0);
  };

  const redoSplice = (): void => {
    setStage('color');
    setLastLoss(null);
  };

  const avgLoss =
    doneCount > 0
      ? tasks.reduce((a, t) => a + (lab.splices[t.dropId]?.lossDb ?? 0), 0) / doneCount
      : null;

  /* ---------------- حالة عدم وجود إسقاطات ---------------- */
  if (tasks.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-10 text-center" dir="rtl">
        <FlaskConical size={44} className="text-slate-600" />
        <h2 className="text-lg font-bold text-slate-200">لا توجد إسقاطات للَّحام</h2>
        <p className="max-w-md text-sm leading-6 text-slate-400">
          أكمل طور «الشبكة البصرية» أولاً: ركّب صناديق FAT واربط كابلات الإسقاط
          إلى المنازل، ثم عد إلى مختبر اللحام.
        </p>
        <button
          type="button"
          onClick={() => setPhase('optical')}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
        >
          العودة إلى الشبكة البصرية
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 gap-3 p-3" dir="rtl">
      {/* ============ قائمة الدور ============ */}
      <aside className="flex w-64 shrink-0 flex-col rounded-xl border border-slate-800 bg-slate-900/60">
        <div className="border-b border-slate-800 p-3">
          <h3 className="text-sm font-bold text-slate-200">سجل اللحامات</h3>
          <p className="mt-1 text-[11px] text-slate-500">
            {doneCount}/{tasks.length} لحامة — متوسط الفقد{' '}
            {avgLoss !== null ? `${avgLoss.toFixed(3)} dB` : '—'}
          </p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-full bg-gradient-to-l from-emerald-500 to-lime-400 transition-all"
              style={{ width: `${(doneCount / tasks.length) * 100}%` }}
            />
          </div>
        </div>
        <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto p-2">
          {tasks.map((t) => {
            const rec = lab.splices[t.dropId];
            const v = rec ? spliceVerdict(rec.lossDb) : null;
            return (
              <li
                key={t.dropId}
                className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-[12px] ${
                  rec ? 'bg-slate-800/40' : 'bg-slate-800/15'
                } ${task?.dropId === t.dropId ? 'ring-1 ring-indigo-500/60' : ''}`}
              >
                {rec ? (
                  <CheckCircle2 size={15} className="shrink-0 text-emerald-400" />
                ) : (
                  <CircleDashed size={15} className="shrink-0 text-slate-600" />
                )}
                <span className="font-semibold text-slate-300">{t.label}</span>
                <span className="text-slate-500">منفذ {t.portNumber}</span>
                {rec && (
                  <span className={`mr-auto font-mono ${v?.cls}`}>
                    {rec.lossDb.toFixed(2)}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
        {allDone && (
          <div className="border-t border-slate-800 p-3">
            <button
              type="button"
              onClick={() => setPhase('testing')}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-bold text-white hover:bg-emerald-500"
            >
              اكتمل اللحام — الانتقال إلى الاختبار
              <ChevronLeft size={16} />
            </button>
          </div>
        )}
      </aside>

      {/* ============ طاولة العمل ============ */}
      <section className="flex min-w-0 flex-1 flex-col rounded-xl border border-slate-800 bg-slate-900/40 p-5">
        {allDone || !task ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
            <CheckCircle2 size={48} className="text-emerald-400" />
            <h2 className="text-lg font-bold text-slate-100">
              اكتمل لحام {tasks.length} إسقاطاً بنجاح
            </h2>
            <p className="text-sm text-slate-400">
              متوسط فقد اللحامات {avgLoss?.toFixed(3)} dB — انتقل الآن إلى طور
              الاختبار والتشغيل.
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-100">
                  لحام إسقاط الدار {task.label}
                </h2>
                <p className="text-[12px] text-slate-500">
                  FAT ({task.fatId.slice(0, 6)}…) — المنفذ رقم {task.portNumber} —
                  الليفة المعيارية رقم {task.fiberIndex + 1}
                </p>
              </div>
              <span className="rounded-full bg-slate-800 px-3 py-1 text-[11px] font-semibold text-slate-300">
                {stage === 'color'
                  ? 'الخطوة 1: اختر ليفة اللون الصحيح'
                  : stage === 'arc'
                    ? 'الخطوة 2: نفّذ اللحام الحراري'
                    : 'النتيجة'}
              </span>
            </div>

            {/* ---------- الخطوة 1: التسلسل اللوني ---------- */}
            {stage === 'color' && (
              <div className="mt-6">
                <p className="mb-3 text-[13px] leading-6 text-slate-400">
                  وفق المعيار <span className="font-semibold text-slate-200">TIA-598</span>{' '}
                  تُلحم شعيرات الكابل بترتيب لوني ثابت داخل الكلوزر. المنفذ رقم{' '}
                  <span className="font-bold text-indigo-300">{task.portNumber}</span> يأخذ
                  اللون الترتيبي <span className="font-bold text-indigo-300">{(task.portNumber - 1) % 12 + 1}</span>{' '}
                  من التسلسل. اختر الليفة الصحيحة من الصينية:
                </p>
                <div className="grid grid-cols-6 gap-2">
                  {FIBER_COLORS.map((name, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => pickColor(i)}
                      className={`group flex flex-col items-center gap-1.5 rounded-xl border p-3 transition-all ${
                        wrongColor === i
                          ? 'border-red-500 bg-red-950/40'
                          : 'border-slate-700 bg-slate-800/50 hover:border-indigo-500 hover:bg-slate-800'
                      }`}
                    >
                      <span
                        className="h-7 w-7 rounded-full border-2 border-slate-500/60 shadow-inner"
                        style={{ backgroundColor: FIBER_HEX[i] }}
                      />
                      <span className="text-[11px] font-semibold text-slate-300">{name}</span>
                      <span className="font-mono text-[10px] text-slate-500">#{i + 1}</span>
                    </button>
                  ))}
                </div>
                {wrongColor !== null && (
                  <p className="mt-3 text-[12px] font-semibold text-red-400">
                    ليفة خاطئة — راجع التسلسل اللوني (رقم المنفذ يطابق رقم اللون).
                  </p>
                )}
                <details className="mt-4 rounded-lg border border-slate-800 bg-slate-900/60 p-3">
                  <summary className="flex cursor-pointer items-center gap-2 text-[12px] font-semibold text-slate-300">
                    <Lightbulb size={14} className="text-amber-400" />
                    مساعد: التسلسل اللوني المعياري الكامل
                  </summary>
                  <p className="mt-2 text-[12px] leading-7 text-slate-400" dir="rtl">
                    {FIBER_COLORS.map((c, i) => `${i + 1}-${c}`).join(' ، ')}
                  </p>
                </details>
              </div>
            )}

            {/* ---------- الخطوة 2: قوس اللحام ---------- */}
            {stage === 'arc' && (
              <div className="mt-8 flex flex-col items-center gap-6">
                <p className="text-[13px] text-slate-400">
                  اضبط قدرة قوس اللحام: اضغط «نفّذ اللحام» (أو مفتاح المسافة) عندما
                  يدخل المؤشر <span className="font-semibold text-emerald-400">المنطقة الخضراء</span> —
                  كل انحراف يضاعف الفقد.
                </p>
                <div className="relative h-14 w-full max-w-2xl overflow-hidden rounded-xl border border-slate-700 bg-slate-950">
                  {/* مناطق الجودة */}
                  <div className="absolute inset-y-0 right-[35%] left-[35%] bg-emerald-500/25" />
                  <div className="absolute inset-y-0 right-[45%] left-[45%] bg-emerald-400/35" />
                  {/* المؤشر (يتحرك من اليمين لليسار بصرياً — القيمة 0..100) */}
                  <div
                    className="absolute inset-y-0 w-1 bg-white shadow-[0_0_12px_rgba(255,255,255,0.9)]"
                    style={{ right: `${arcPos}%` }}
                  />
                  <span className="absolute bottom-1 right-2 font-mono text-[10px] text-slate-500">قدرة القوس 0</span>
                  <span className="absolute bottom-1 left-2 font-mono text-[10px] text-slate-500">100</span>
                  <span className="absolute top-1 right-[47%] font-mono text-[10px] text-emerald-300">الأمثل 55</span>
                </div>
                <button
                  type="button"
                  onClick={fuse}
                  className="rounded-xl bg-gradient-to-l from-indigo-600 to-violet-600 px-8 py-3 text-sm font-bold text-white shadow-lg hover:from-indigo-500 hover:to-violet-500"
                >
                  نفّذ اللحام (Space)
                </button>
              </div>
            )}

            {/* ---------- النتيجة ---------- */}
            {stage === 'result' && lastLoss !== null && (
              <div className="mt-8 flex flex-col items-center gap-5">
                <div className="flex items-center gap-3">
                  <span className="text-5xl font-black tabular-nums text-slate-100">
                    {lastLoss.toFixed(3)}
                  </span>
                  <span className="text-lg font-bold text-slate-400">dB</span>
                </div>
                <span className={`text-base font-bold ${spliceVerdict(lastLoss).cls}`}>
                  {spliceVerdict(lastLoss).label}
                </span>
                <p className="max-w-lg text-center text-[12px] leading-6 text-slate-500">
                  الفقد التصميمي المفترض للحامة الواحدة هو {SPLICE_LOSS_DB} dB؛
                  الفعلي سيظهر في قياسات OTDR ومقياس القدرة لاحقاً.
                </p>
                <div className="flex gap-3">
                  {lastLoss > 0.15 && (
                    <button
                      type="button"
                      onClick={redoSplice}
                      className="flex items-center gap-2 rounded-lg border border-amber-700/60 bg-amber-950/40 px-4 py-2 text-sm font-semibold text-amber-300 hover:bg-amber-950/70"
                    >
                      <RefreshCw size={15} />
                      قصّ ولحام من جديد
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={acceptSplice}
                    className="rounded-lg bg-emerald-600 px-6 py-2 text-sm font-bold text-white hover:bg-emerald-500"
                  >
                    اعتماد والتالي
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
