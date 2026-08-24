/**
 * لوحة الفحص الجانبية — الفحص الحي + التغطية + جدول الكميات + محرر العنصر المحدد
 */

import { useMemo } from 'react';
import { CircleAlert, Info, NotebookPen, Trash2, TriangleAlert } from 'lucide-react';
import { useSimulatorStore } from '../store/simulator.store';
import { useEduStore } from '../store/education.store';
import { getMapById } from '../data/maps/registry';
import { lintDesign } from '../engine/rules';
import { computeBoq } from '../engine/boq';
import { USD_TO_IQD } from '../data/materials.catalog';
import { VERDICT_META } from '../engine/physics';
import { ALL_INFO_KEYS, ELEMENT_INFO } from '../education/element-info';
import type { EntityKind, ProjectEntities, SplitterRatio, TrenchMethod } from '../types';
import { TRENCH_METHODS } from '../data/materials.catalog';

const SEVERITY_STYLE = {
  error: { icon: CircleAlert, cls: 'text-red-300 bg-red-950/40 border-red-900/60' },
  warning: { icon: TriangleAlert, cls: 'text-amber-300 bg-amber-950/40 border-amber-900/60' },
  info: { icon: Info, cls: 'text-sky-300 bg-sky-950/40 border-sky-900/60' },
} as const;

const SPLITTERS: SplitterRatio[] = ['1:4', '1:8', '1:16', '1:32'];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
      <h3 className="mb-2 text-xs font-bold text-slate-300">{title}</h3>
      {children}
    </section>
  );
}

/** إيجاد العنصر المحدد مع نوعه */
function findSelected(
  entities: ProjectEntities,
  id: string
): { kind: EntityKind; id: string } | null {
  if (entities.trenches.some((x) => x.id === id)) return { kind: 'trench', id };
  if (entities.structures.some((x) => x.id === id)) return { kind: 'structure', id };
  if (entities.cabinets.some((x) => x.id === id)) return { kind: 'cabinet', id };
  if (entities.fats.some((x) => x.id === id)) return { kind: 'fat', id };
  if (entities.drops.some((x) => x.id === id)) return { kind: 'drop', id };
  return null;
}

export default function SimInspector(): React.ReactElement {
  const st = useSimulatorStore();
  const edu = useEduStore();
  const map = getMapById(st.mapId);
  const entities = st.entities;

  const report = useMemo(() => (map ? lintDesign(entities, map) : null), [entities, map]);
  const boq = useMemo(() => (map ? computeBoq(entities, map) : null), [entities, map]);

  if (!map || !report || !boq) return <div className="p-3 text-sm text-slate-400">لا توجد خريطة</div>;

  const sel = st.selectedIds.length === 1 ? findSelected(entities, st.selectedIds[0]) : null;
  const selTrench = sel?.kind === 'trench' ? entities.trenches.find((t) => t.id === sel.id) : undefined;
  const selFat = sel?.kind === 'fat' ? entities.fats.find((f) => f.id === sel.id) : undefined;
  const selCabinet = sel?.kind === 'cabinet' ? entities.cabinets.find((c) => c.id === sel.id) : undefined;
  const selDrop = sel?.kind === 'drop' ? entities.drops.find((d) => d.id === sel.id) : undefined;

  const worstHome = report.homes
    .filter((h) => h.covered && h.budget)
    .sort((a, b) => (a.budget!.rxDbm ?? 0) - (b.budget!.rxDbm ?? 0))[0];
  const failing = report.homes.filter(
    (h) => h.covered && h.budget && h.budget.rxDbm < map.requirements.minRxDbm
  ).length;

  const coveragePct = Math.round((report.coverage.covered / report.coverage.total) * 100);
  const errors = report.issues.filter((i) => i.severity === 'error');

  return (
    <div
      data-tour="inspector"
      className="flex h-full w-80 shrink-0 flex-col gap-3 overflow-y-auto border-s border-slate-800 bg-[#0b1220] p-3"
    >
      {/* متطلبات الخريطة */}
      <Section title={`الخريطة: ${map.name}`}>
        <ul className="space-y-1 text-[11px] text-slate-400">
          <li>عدد الدور المطلوب تغطيتها: <b className="text-slate-200">{map.requirements.homes}</b></li>
          <li>أدنى إشارة مقبولة: <b className="text-slate-200">{map.requirements.minRxDbm} dBm</b></li>
          <li>أقصى طول كابل إسقاط: <b className="text-slate-200">{map.requirements.maxDropMeters} م</b></li>
        </ul>
      </Section>

      {/* الفحص الحي */}
      <Section title="الفحص الحي (Live Lint)">
        <div className="mb-2">
          <div className="mb-1 flex justify-between text-[11px] text-slate-400">
            <span>التغطية</span>
            <span className="text-slate-200">
              {report.coverage.covered} / {report.coverage.total} داراً
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-800">
            <div
              className={`h-full rounded-full transition-all ${
                coveragePct === 100 ? 'bg-emerald-500' : 'bg-indigo-500'
              }`}
              style={{ width: `${coveragePct}%` }}
            />
          </div>
        </div>

        <div className="mb-2 grid grid-cols-2 gap-2 text-center text-[11px]">
          <div className="rounded-lg bg-slate-950/60 p-2">
            <div className="text-slate-500">أضعف إشارة</div>
            <div
              className="text-sm font-bold"
              style={{ color: worstHome ? VERDICT_META[worstHome.budget!.verdict].color : '#64748b' }}
            >
              {worstHome ? `${worstHome.budget!.rxDbm.toFixed(1)} dBm` : '—'}
            </div>
          </div>
          <div className="rounded-lg bg-slate-950/60 p-2">
            <div className="text-slate-500">دار دون الحد</div>
            <div className={`text-sm font-bold ${failing ? 'text-red-300' : 'text-emerald-300'}`}>
              {failing}
            </div>
          </div>
        </div>

        {errors.length === 0 && report.coverage.covered === report.coverage.total ? (
          <p className="rounded-lg border border-emerald-900/60 bg-emerald-950/40 p-2 text-[11px] text-emerald-300">
            التصميم مستوفٍ للمتطلبات — يمكنك الانتقال إلى طور الاختبار.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {report.issues.slice(0, 12).map((iss) => {
              const S = SEVERITY_STYLE[iss.severity];
              return (
                <li key={iss.id} className={`rounded-lg border p-2 text-[11px] ${S.cls}`}>
                  <div className="flex items-start gap-1.5">
                    <S.icon size={14} className="mt-0.5 shrink-0" />
                    <div>
                      <div>{iss.messageAr}</div>
                      {iss.hintAr && <div className="mt-0.5 text-slate-400">{iss.hintAr}</div>}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      {/* جدول الكميات */}
      <Section title="جدول الكميات والتكاليف (BOQ)">
        <div className="grid grid-cols-2 gap-2 text-center text-[11px]">
          <div className="rounded-lg bg-slate-950/60 p-2">
            <div className="text-slate-500">الكلفة الإجمالية</div>
            <div className="text-sm font-bold text-emerald-300">
              {boq.grandTotalUSD.toLocaleString('en-US', { maximumFractionDigits: 0 })} $
            </div>
            <div className="text-slate-500">
              ≈ {boq.grandTotalIQD.toLocaleString('en-US')} د.ع
            </div>
          </div>
          <div className="rounded-lg bg-slate-950/60 p-2">
            <div className="text-slate-500">كلفة الدار الواحدة</div>
            <div className="text-sm font-bold text-sky-300">
              {boq.costPerHomeUSD !== null ? `${boq.costPerHomeUSD.toFixed(0)} $` : '—'}
            </div>
            <div className="text-slate-500">
              حفر: {boq.trenchMeters.toFixed(0)}م · أنابيب: {boq.ductMeters.toFixed(0)}م
            </div>
          </div>
        </div>

        <details className="mt-2 text-[11px]">
          <summary className="cursor-pointer text-slate-400 hover:text-slate-200">
            عرض البنود ({boq.lines.length} بنداً)
          </summary>
          <table className="mt-1 w-full text-right">
            <thead className="text-slate-500">
              <tr>
                <th className="py-1 font-normal">البند</th>
                <th className="py-1 font-normal">الكمية</th>
                <th className="py-1 font-normal">$</th>
              </tr>
            </thead>
            <tbody className="text-slate-300">
              {boq.lines.map((l) => (
                <tr key={l.itemId} className="border-t border-slate-800/70">
                  <td className="py-1 pe-1 leading-tight">{l.nameAr}</td>
                  <td className="py-1 whitespace-nowrap text-slate-400">
                    {l.qty.toLocaleString('en-US')} {l.unit === 'm' ? 'م' : l.unit === 'pc' ? 'ق' : l.unit === 'set' ? 'طقم' : l.unit === 'splice' ? 'لحام' : 'منفذ'}
                  </td>
                  <td className="py-1 whitespace-nowrap text-emerald-300/90">{l.totalUSD.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-1 text-slate-500">
            سعر الصرف: 1$ = {USD_TO_IQD.toLocaleString('en-US')} د.ع
          </p>
        </details>
      </Section>

      {/* محرر العنصر المحدد */}
      <Section title="العنصر المحدد">
        {!sel && <p className="text-[11px] text-slate-500">استخدم أداة التحديد ثم انقر على عنصر لتعديله.</p>}

        {selTrench && (
          <div className="space-y-2 text-[11px]">
            <div className="text-slate-300">مسار حفر — الطول {Math.round(
              selTrench.points.slice(1).reduce(
                (s, p, i) => s + Math.hypot(p.x - selTrench.points[i].x, p.y - selTrench.points[i].y),
                0
              )
            )} م</div>
            <div className="text-slate-400">طريقة الحفر:</div>
            <div className="grid grid-cols-2 gap-1">
              {(Object.keys(TRENCH_METHODS) as TrenchMethod[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => st.setTrenchMethodFor(selTrench.id, m)}
                  className={`rounded px-2 py-1 ${
                    selTrench.method === m ? 'bg-slate-700 text-white' : 'bg-slate-800 text-slate-300'
                  }`}
                  style={{ borderRight: `3px solid ${TRENCH_METHODS[m].color}` }}
                >
                  {TRENCH_METHODS[m].nameAr}
                </button>
              ))}
            </div>
            <div className="text-slate-400 pt-1">عدد الأنابيب داخل المسار:</div>
            {(['hdpe32', 'hdpe40', 'micro7'] as const).map((k) => (
              <div key={k} className="flex items-center justify-between">
                <span className="text-slate-300">
                  {k === 'hdpe32' ? 'HDPE 32مم' : k === 'hdpe40' ? 'HDPE 40مم' : 'مايكروداكت 7'}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="h-6 w-6 rounded bg-slate-800 text-slate-200"
                    onClick={() =>
                      st.setTrenchDucts(selTrench.id, { ...selTrench.ducts, [k]: Math.max(0, selTrench.ducts[k] - 1) })
                    }
                  >
                    −
                  </button>
                  <span className="w-5 text-center text-slate-100">{selTrench.ducts[k]}</span>
                  <button
                    type="button"
                    className="h-6 w-6 rounded bg-slate-800 text-slate-200"
                    onClick={() => st.setTrenchDucts(selTrench.id, { ...selTrench.ducts, [k]: selTrench.ducts[k] + 1 })}
                  >
                    +
                  </button>
                </div>
              </div>
            ))}
            <DeleteButton onClick={() => st.removeEntity('trench', selTrench.id)} />
          </div>
        )}

        {selFat && (
          <div className="space-y-2 text-[11px]">
            <div className="text-slate-300">
              صندوق FAT — {selFat.ports} منفذاً، عليه {entities.drops.filter((d) => d.fromFatId === selFat.id).length} إسقاطاً
            </div>
            <div className="text-slate-400">القاسم البصري:</div>
            <div className="grid grid-cols-5 gap-1">
              <button
                type="button"
                onClick={() => st.setFatSplitterFor(selFat.id, null)}
                className={`rounded py-1 ${selFat.splitter === null ? 'bg-red-800/70 text-white' : 'bg-slate-800 text-slate-300'}`}
              >
                بدون
              </button>
              {SPLITTERS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => st.setFatSplitterFor(selFat.id, s)}
                  className={`rounded py-1 ${selFat.splitter === s ? 'bg-emerald-800/70 text-white' : 'bg-slate-800 text-slate-300'}`}
                >
                  {s}
                </button>
              ))}
            </div>
            <DeleteButton onClick={() => st.removeEntity('fat', selFat.id)} />
          </div>
        )}

        {selCabinet && (
          <div className="space-y-2 text-[11px]">
            <div className="text-slate-300">كبينة FDC بسعة {selCabinet.capacityF} شعيرة</div>
            <p className="text-slate-500">تُحدد السعة قبل التركيب من شريط الأدوات (قادم: تعدد الكبائن حسب المستوى).</p>
            <DeleteButton onClick={() => st.removeEntity('cabinet', selCabinet.id)} />
          </div>
        )}

        {selDrop && (
          <div className="space-y-2 text-[11px]">
            <div className="text-slate-300">
              كابل إسقاط — الطول{' '}
              {Math.round(
                selDrop.points.slice(1).reduce(
                  (s, p, i) => s + Math.hypot(p.x - selDrop.points[i].x, p.y - selDrop.points[i].y),
                  0
                )
              )}{' '}
              م (الحد {map.requirements.maxDropMeters}م)
            </div>
            <DeleteButton onClick={() => st.removeEntity('drop', selDrop.id)} />
          </div>
        )}
      </Section>

      {/* سجل الأخطاء التعليمي */}
      <Section title="سجل أخطائك التعليمي">
        {edu.errors.length === 0 ? (
          <p className="text-[11px] leading-relaxed text-slate-500">
            لا أخطاء مسجلة بعد — كل محاولة تخطٍّ لترتيب البناء ستظهر هنا مع درسها المستفاد،
            لتتحسن في المحاولة القادمة.
          </p>
        ) : (
          <>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[10.5px] text-slate-500">
                {edu.errors.length} محاولة خاطئة هذه الجلسة — الأخطاء فرص تعلّم
              </span>
              <button
                type="button"
                onClick={edu.clearErrors}
                title="مسح السجل"
                className="flex h-6 w-6 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-800 hover:text-red-300"
              >
                <Trash2 size={12} />
              </button>
            </div>
            <ul className="space-y-1.5">
              {edu.errors.slice(0, 6).map((er) => (
                <li
                  key={er.id}
                  className="rounded-lg border border-amber-900/50 bg-amber-950/25 p-2 text-[10.5px] leading-relaxed"
                >
                  <div className="flex items-start gap-1.5">
                    <NotebookPen size={12} className="mt-0.5 shrink-0 text-amber-400" />
                    <div className="min-w-0">
                      <div className="font-semibold text-amber-200">{er.titleAr}</div>
                      <div className="mt-0.5 text-slate-300">{er.messageAr}</div>
                      {er.lessonAr && (
                        <div className="mt-1 rounded bg-amber-500/10 px-1.5 py-1 text-amber-200/85">
                          <span className="font-semibold">الدرس: </span>
                          {er.lessonAr}
                        </div>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
            {edu.errors.length > 6 && (
              <p className="mt-1.5 text-center text-[10px] text-slate-600">
                تُعرض آخر 6 أخطاء فقط · {edu.errors.length} إجمالاً
              </p>
            )}
          </>
        )}
      </Section>

      {/* استكشاف العناصر بوضع التلميح */}
      <Section title="استكشافك لعناصر الشبكة">
        <p className="mb-2 text-[10.5px] text-slate-500">
          فعّل أداة «التلميح» وانقر العناصر لتتعلمها — استكشفت{' '}
          <b className="text-sky-300">
            {edu.explored.length}/{ALL_INFO_KEYS.length}
          </b>{' '}
          حتى الآن:
        </p>
        <div className="flex flex-wrap gap-1">
          {ALL_INFO_KEYS.map((k) => {
            const seen = edu.explored.includes(k);
            return (
              <span
                key={k}
                title={seen ? ELEMENT_INFO[k].whatAr : 'لم تستكشفه بعد — فعّل التلميح وانقر عليه'}
                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                  seen
                    ? 'bg-sky-500/15 text-sky-300 ring-1 ring-sky-500/40'
                    : 'bg-slate-800/60 text-slate-600'
                }`}
              >
                {ELEMENT_INFO[k].titleAr}
              </span>
            );
          })}
        </div>
      </Section>
    </div>
  );
}

function DeleteButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-lg border border-red-900/60 bg-red-950/40 py-1.5 text-[11px] text-red-300 hover:bg-red-950/70"
    >
      حذف العنصر (Delete)
    </button>
  );
}
