/**
 * ============================================================
 * لوحة الاختبار والتشغيل — الطور الرابع في محاكي FTTH
 * ============================================================
 * 1) مقياس القدرة البصرية (Power Meter): قراءة Rx عند كل دار
 *    محسوبة من التصميم + الفقد الفعلي للَّحامات المنفذة في المختبر.
 * 2) الفاحص الضوئي VFL: فحص استمرارية كل إسقاط وكشف الانكسارات.
 * 3) منحنى OTDR لكل مسار بصري.
 * 4) إتمام المشروع: تقييم بالنجوم + حفظ في fiber_sim_* + تصدير Excel/PDF.
 */

import { useMemo, useState } from 'react';
import {
  Activity,
  BadgeCheck,
  Download,
  FileSpreadsheet,
  FileText,
  Gauge,
  Lightbulb,
  Loader2,
  Save,
  Star,
  Zap,
} from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { useSimulatorStore } from '../store/simulator.store';
import { useLabStore } from '../store/lab.store';
import { getMapById } from '../data/maps/registry';
import { lintDesign, type HomeStatus } from '../engine/rules';
import { computeBoq } from '../engine/boq';
import { scoreProject } from '../engine/scoring';
import { SPLICE_LOSS_DB } from '../engine/physics';
import OtdrPanel from './OtdrPanel';
import {
  saveFiberScore,
} from '../services/scores.service';
import {
  exportProjectExcel,
  exportProjectPdf,
  type ExportMeta,
} from '../export/boq-export';

/* قراءة حتمية شبه ثابتة لكل دار (±0.2 dB كانحراف جهاز) */
const meterTolerance = (bid: string): number => {
  let h = 0;
  for (let i = 0; i < bid.length; i++) h = (h * 31 + bid.charCodeAt(i)) % 997;
  return ((h % 40) / 100 - 0.2);
};

export default function TestingPanel(): React.ReactElement {
  const user = useAuth().user;
  const entities = useSimulatorStore((s) => s.entities);
  const mapId = useSimulatorStore((s) => s.mapId);
  const setPhase = useSimulatorStore((s) => s.setPhase);
  const lab = useLabStore();
  const map = getMapById(mapId);

  const [selected, setSelected] = useState<string | null>(null);
  const [vflBusy, setVflBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [exporting, setExporting] = useState<'excel' | 'pdf' | null>(null);

  const report = useMemo(
    () => (map ? lintDesign(entities, map) : null),
    [entities, map]
  );
  const boq = useMemo(() => (map ? computeBoq(entities, map) : null), [entities, map]);

  const covered = useMemo(
    () => (report ? report.homes.filter((h) => h.covered) : []),
    [report]
  );
  const home: HomeStatus | null =
    covered.find((h) => h.buildingId === selected) ?? covered[0] ?? null;

  const measured = home ? lab.measurements[home.buildingId] ?? null : null;
  const vflDone = home ? lab.vfl[home.buildingId] === true : false;

  /* أخطاء خاصة بالدار المحددة (تستخدم في حكم VFL) */
  const homeErrors = useMemo(
    () =>
      report && home
        ? report.issues.filter(
            (i) => i.severity === 'error' && i.id.includes(home.buildingId)
          )
        : [],
    [report, home]
  );

  if (!map || !report || !boq) return <div className="p-6 text-slate-400">—</div>;

  /* ============ قياس القدرة ============ */
  const runMeasurement = (): void => {
    if (!home || home.budget === null) return;
    /* لحامة FAT الفعلية لهذه الدار */
    const drop = entities.drops.find((d) => d.toBuildingId === home.buildingId);
    const labLoss = drop && lab.splices[drop.id] ? lab.splices[drop.id].lossDb : null;
    /* فرق الفقد الفعلي عن التصميمي (لحامتان مفترضتان ×0.05) */
    const delta = labLoss !== null ? labLoss - SPLICE_LOSS_DB : 0;
    const rx = home.budget.rxDbm - delta + meterTolerance(home.buildingId);
    lab.recordMeasurement({
      dropId: drop?.id ?? home.buildingId,
      buildingId: home.buildingId,
      rxDbm: Math.round(rx * 10) / 10,
      pass: rx >= map.requirements.minRxDbm,
      at: Date.now(),
    });
  };

  /* ============ الفاحص الضوئي VFL ============ */
  const runVfl = (): void => {
    if (!home || vflBusy) return;
    setVflBusy(true);
    setTimeout(() => {
      setVflBusy(false);
      if (home) lab.recordVfl(home.buildingId);
    }, 1400);
  };

  /* ============ إحصاءات الإنجاز ============ */
  const measuredCount = Object.keys(lab.measurements).length;
  const vflCount = Object.keys(lab.vfl).length;
  const spliceTotal = entities.drops.length;
  const spliceDone = Object.keys(lab.splices).length;
  const allTestsDone =
    covered.length > 0 &&
    measuredCount >= covered.length &&
    vflCount >= covered.length;

  /* ============ التقييم النهائي ============ */
  const finalize = async (): Promise<void> => {
    const spliceVals = Object.values(lab.splices);
    const score = scoreProject({
      report,
      boq,
      map,
      splice: {
        done: spliceDone,
        total: spliceTotal,
        avgLossDb:
          spliceVals.length > 0
            ? spliceVals.reduce((a, r) => a + r.lossDb, 0) / spliceVals.length
            : null,
      },
    });
    lab.setFinalScore(score);

    if (user) {
      setSaving(true);
      try {
        await saveFiberScore({
          userId: user.id,
          mapId: map.id,
          totalCostUSD: boq.grandTotalUSD,
          coverageHomes: report.coverage.covered,
          opticalPass: report.opticalOk,
          score,
        });
        /* حفظ المشروع يبقى بيد المستخدم من زر «حفظ» (بنفس الاسم
           تحديث / باسم معدل نسخة جديدة) — يمنع تضارب الأسماء */
        setSavedMsg('حُفظت النتيجة في قاعدة البيانات — لحفظ التصميم استخدم زر «حفظ» في الرأس');
      } catch (e) {
        setSavedMsg(e instanceof Error ? e.message : 'تعذر الحفظ في قاعدة البيانات');
      } finally {
        setSaving(false);
      }
    }
  };

  /* ============ التصدير ============ */
  const doExport = async (kind: 'excel' | 'pdf'): Promise<void> => {
    if (!user) return;
    setExporting(kind);
    try {
      const meta: ExportMeta = {
        userName: user.full_name,
        map,
        report,
        boq,
        score: lab.finalScore,
      };
      if (kind === 'excel') await exportProjectExcel(meta);
      else await exportProjectPdf(meta);
    } finally {
      setExporting(null);
    }
  };

  const score = lab.finalScore;

  return (
    <div className="flex h-full min-h-0 gap-3 p-3" dir="rtl">
      {/* ============ قائمة الدور المغطاة ============ */}
      <aside className="flex w-60 shrink-0 flex-col rounded-xl border border-slate-800 bg-slate-900/60">
        <div className="border-b border-slate-800 p-3">
          <h3 className="text-sm font-bold text-slate-200">الدور المشتركة ({covered.length})</h3>
          <p className="mt-1 text-[11px] text-slate-500">
            قياسات: {measuredCount}/{covered.length} — VFL: {vflCount}/{covered.length}
          </p>
        </div>
        <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto p-2">
          {covered.map((h) => {
            const m = lab.measurements[h.buildingId];
            const v = lab.vfl[h.buildingId] === true;
            const s = entities.drops.some(
              (d) => d.toBuildingId === h.buildingId && lab.splices[d.id]
            );
            const active = home?.buildingId === h.buildingId;
            return (
              <li key={h.buildingId}>
                <button
                  type="button"
                  onClick={() => setSelected(h.buildingId)}
                  className={`w-full rounded-lg px-2 py-1.5 text-right transition-colors ${
                    active ? 'bg-indigo-500/20 ring-1 ring-indigo-500/50' : 'bg-slate-800/20 hover:bg-slate-800/50'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <span className="text-[12px] font-bold text-slate-200">{h.label}</span>
                    <span className="mr-auto flex gap-1 text-[10px]">
                      <span title="لحام" className={s ? 'text-emerald-400' : 'text-slate-600'}>⬤</span>
                      <span title="قياس" className={m ? 'text-emerald-400' : 'text-slate-600'}>⬤</span>
                      <span title="VFL" className={v ? 'text-emerald-400' : 'text-slate-600'}>⬤</span>
                    </span>
                  </div>
                  {m && (
                    <span className={`font-mono text-[11px] ${m.pass ? 'text-emerald-400' : 'text-red-400'}`}>
                      {m.rxDbm.toFixed(1)} dBm
                    </span>
                  )}
                </button>
              </li>
            );
          })}
          {covered.length === 0 && (
            <li className="p-3 text-center text-[12px] leading-6 text-slate-500">
              لا توجد دور مغطاة — أكمل التصميم البصري أولاً.
            </li>
          )}
        </ul>
      </aside>

      {/* ============ منطقة الأجهزة ============ */}
      <section className="flex min-w-0 flex-1 flex-col gap-3 overflow-y-auto">
        {home ? (
          <>
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              {/* ---- مقياس القدرة ---- */}
              <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
                <div className="mb-3 flex items-center gap-2">
                  <Gauge size={17} className="text-cyan-400" />
                  <h4 className="text-[13px] font-bold text-slate-200">
                    مقياس القدرة البصرية — الدار {home.label}
                  </h4>
                </div>
                <div className="flex items-center gap-4">
                  <div
                    className={`flex h-24 w-44 flex-col items-center justify-center rounded-lg border-2 font-mono ${
                      measured
                        ? measured.pass
                          ? 'border-emerald-600 bg-emerald-950/40 text-emerald-300'
                          : 'border-red-600 bg-red-950/40 text-red-300'
                        : 'border-slate-700 bg-slate-950 text-slate-600'
                    }`}
                  >
                    <span className="text-3xl font-black tabular-nums">
                      {measured ? measured.rxDbm.toFixed(1) : '-.--'}
                    </span>
                    <span className="text-[11px]">dBm @1490nm</span>
                  </div>
                  <div className="flex-1 space-y-2 text-[11.5px] text-slate-400">
                    <p>
                      الحد الأطلوب:{' '}
                      <span className="font-mono font-bold text-slate-200">
                        {map.requirements.minRxDbm} dBm
                      </span>
                    </p>
                    <p>
                      المحسوب تصميمياً:{' '}
                      <span className="font-mono">
                        {home.budget ? home.budget.rxDbm.toFixed(1) : '—'} dBm
                      </span>
                    </p>
                    <p className="text-[10.5px] leading-5 text-slate-500">
                      القراءة تتأثر بجودة لحاماتك الفعلية في المختبر.
                    </p>
                    <button
                      type="button"
                      onClick={runMeasurement}
                      className="flex items-center gap-1.5 rounded-lg bg-cyan-600 px-4 py-1.5 text-[12px] font-bold text-white hover:bg-cyan-500"
                    >
                      <Zap size={13} />
                      قياس
                    </button>
                  </div>
                </div>
              </div>

              {/* ---- الفاحص الضوئي VFL ---- */}
              <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
                <div className="mb-3 flex items-center gap-2">
                  <Lightbulb size={17} className="text-red-400" />
                  <h4 className="text-[13px] font-bold text-slate-200">
                    الفاحص الضوئي VFL — الدار {home.label}
                  </h4>
                </div>
                <div className="flex items-center gap-4">
                  {/* أنبوب المسار */}
                  <div className="relative h-14 flex-1 overflow-hidden rounded-lg border border-slate-700 bg-slate-950">
                    <div className="absolute inset-x-2 top-1/2 h-1 -translate-y-1/2 rounded bg-slate-800" />
                    {vflBusy && (
                      <div
                        className="absolute top-1/2 h-2.5 w-10 -translate-y-1/2 rounded-full bg-red-500 shadow-[0_0_18px_4px_rgba(239,68,68,0.8)]"
                        style={{ animation: 'sim-vfl 1.2s linear infinite' }}
                      />
                    )}
                    {!vflBusy && vflDone && (
                      <div className="absolute inset-x-2 top-1/2 h-1 -translate-y-1/2 rounded bg-red-500/70 shadow-[0_0_10px_rgba(239,68,68,0.6)]" />
                    )}
                    <span className="absolute right-2 top-1 text-[9px] text-slate-600">FAT</span>
                    <span className="absolute left-2 top-1 text-[9px] text-slate-600">ONT الدار {home.label}</span>
                  </div>
                  <button
                    type="button"
                    onClick={runVfl}
                    disabled={vflBusy}
                    className="flex items-center gap-1.5 rounded-lg bg-red-600/90 px-4 py-1.5 text-[12px] font-bold text-white hover:bg-red-500 disabled:opacity-50"
                  >
                    {vflBusy ? <Loader2 size={13} className="animate-spin" /> : <Lightbulb size={13} />}
                    {vflBusy ? 'يفحص…' : 'تشغيل'}
                  </button>
                </div>
                {vflDone && !vflBusy && (
                  <p className={`mt-2 text-[11.5px] font-semibold ${homeErrors.length ? 'text-amber-400' : 'text-emerald-400'}`}>
                    {homeErrors.length
                      ? `توهج أحمر غير طبيعي — يوجد عيب في مسار الدار ${home.label} (راجع الفحص الحي).`
                      : 'المسار متصل — الضوء الأحمر يصل إلى نهاية الألياف دون انكسار.'}
                  </p>
                )}
                <style>{`@keyframes sim-vfl { 0% { right: 4%; } 100% { right: 92%; } }`}</style>
              </div>
            </div>

            {/* ---- منحنى OTDR ---- */}
            <OtdrPanel home={home} map={map} entities={entities} labSplices={lab.splices} />
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center rounded-xl border border-slate-800 bg-slate-900/40 text-sm text-slate-500">
            لا توجد دور مغطاة لاختبارها — أكمل طور الشبكة البصرية أولاً.
          </div>
        )}

        {/* ============ التقييم النهائي ============ */}
        <div className="rounded-xl border border-indigo-900/60 bg-gradient-to-l from-indigo-950/50 to-slate-900/60 p-4">
          {!score ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-[13px] text-slate-300">
                <BadgeCheck size={18} className="text-indigo-400" />
                <span>
                  عند إتمام القياسات ({measuredCount}/{covered.length}) والفحص البصري
                  ({vflCount}/{covered.length}) اضغط «إتمام المشروع» لتقييم تصميمك
                  بالنجوم وحفظه وتصديره.
                </span>
              </div>
              <button
                type="button"
                onClick={finalize}
                disabled={saving}
                className="flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-2.5 text-sm font-bold text-white shadow-lg hover:bg-indigo-500 disabled:opacity-50"
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Star size={16} />}
                إتمام المشروع والتقييم النهائي
              </button>
            </div>
          ) : (
            <div>
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Star
                      key={i}
                      size={26}
                      className={
                        i <= score.stars
                          ? 'fill-amber-400 text-amber-400'
                          : i - 0.5 === score.stars
                            ? 'fill-amber-400/40 text-amber-400'
                            : 'text-slate-700'
                      }
                    />
                  ))}
                  <span className="mr-2 font-mono text-lg font-black text-amber-300">
                    {score.stars}/5
                  </span>
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-100">{score.titleAr}</h4>
                  <p className="text-[11px] text-slate-400">
                    المجموع {score.percentage} من 100 نقطة
                    {savedMsg ? ` — ${savedMsg}` : ''}
                  </p>
                </div>
                <div className="mr-auto flex gap-2">
                  <button
                    type="button"
                    onClick={() => doExport('excel')}
                    disabled={exporting !== null}
                    className="flex items-center gap-1.5 rounded-lg border border-emerald-700/60 bg-emerald-950/50 px-3 py-1.5 text-[12px] font-bold text-emerald-300 hover:bg-emerald-950/80 disabled:opacity-50"
                  >
                    {exporting === 'excel' ? <Loader2 size={13} className="animate-spin" /> : <FileSpreadsheet size={13} />}
                    تصدير Excel
                  </button>
                  <button
                    type="button"
                    onClick={() => doExport('pdf')}
                    disabled={exporting !== null}
                    className="flex items-center gap-1.5 rounded-lg border border-red-800/60 bg-red-950/40 px-3 py-1.5 text-[12px] font-bold text-red-300 hover:bg-red-950/70 disabled:opacity-50"
                  >
                    {exporting === 'pdf' ? <Loader2 size={13} className="animate-spin" /> : <FileText size={13} />}
                    تصدير PDF
                  </button>
                  <button
                    type="button"
                    onClick={finalize}
                    disabled={saving}
                    className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-1.5 text-[12px] font-bold text-slate-300 hover:bg-slate-800 disabled:opacity-50"
                  >
                    {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                    إعادة التقييم والحفظ
                  </button>
                </div>
              </div>

              {/* تفصيل المعايير */}
              <div className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-5">
                {score.criteria.map((c) => (
                  <div key={c.id} className="rounded-lg border border-slate-800 bg-slate-900/70 p-2.5">
                    <div className="flex items-baseline justify-between">
                      <span className="text-[11.5px] font-bold text-slate-200">{c.labelAr}</span>
                      <span className="font-mono text-[11px] text-slate-400">
                        {Math.round(c.points)}/{c.weight}
                      </span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-800">
                      <div
                        className={`h-full ${
                          c.earnedPct >= 70
                            ? 'bg-emerald-500'
                            : c.earnedPct >= 40
                              ? 'bg-amber-500'
                              : 'bg-red-500'
                        }`}
                        style={{ width: `${Math.min(100, c.earnedPct)}%` }}
                      />
                    </div>
                    <p className="mt-1.5 text-[10.5px] leading-4 text-slate-500">{c.detailAr}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* شريط التقدم السفلي */}
        <div className="flex items-center gap-4 rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-2.5 text-[11.5px] text-slate-400">
          <span className="flex items-center gap-1.5">
            <Activity size={13} className="text-cyan-500" />
            التغطية {report.coverage.covered}/{report.coverage.total}
          </span>
          <span>اللحام {spliceDone}/{spliceTotal || '—'}</span>
          <span>القياسات {measuredCount}/{covered.length}</span>
          <span>VFL {vflCount}/{covered.length}</span>
          <span className="mr-auto flex items-center gap-1.5">
            <Download size={13} className="text-slate-600" />
            {allTestsDone ? 'جميع الاختبارات مكملة — جاهز للتقييم' : 'أكمل جميع الاختبارات'}
          </span>
          <button
            type="button"
            onClick={() => setPhase('splicing')}
            className="rounded-lg border border-slate-700 px-3 py-1 font-semibold text-slate-300 hover:bg-slate-800"
          >
            عودة للمختبر
          </button>
        </div>
      </section>
    </div>
  );
}
