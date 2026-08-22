/**
 * ============================================================
 * لوحة OTDR — جهاز انعكاس الضوء في المجال الزمني (محاكاة)
 * ============================================================
 * يولّد منحنى OTDR اصطناعياً (حتمياً — بلا عشوائية متغيرة)
 * من التصميم الفعلي: مقاطع الألياف، اللحامات، القاسم، والوصلات،
 * مع جدول أحداث قابل للقراءة كما في الأجهزة الحقيقية.
 * طول الموجة المفترض: 1310nm (فحص) مع ميل 0.35 dB/km.
 */

import { useMemo } from 'react';
import type { HomeStatus } from '../engine/rules';
import type { ProjectEntities, SimMap } from '../types';
import type { SpliceRecord } from '../store/lab.store';
import {
  CONNECTOR_LOSS_DB,
  FIBER_ATTENUATION,
  SPLITTER_LOSS,
  SPLICE_LOSS_DB,
} from '../engine/physics';

/* ===================== بناء الأحداث ===================== */

export interface OtdrEvent {
  kind: 'connector' | 'splice' | 'splitter' | 'end';
  labelAr: string;
  posM: number;
  lossDb: number;
  /** الحد الأقصى المقبول لهذا النوع (للحكم) — null = معياري */
  limitDb: number | null;
}

export function buildOtdrEvents(
  home: HomeStatus,
  entities: ProjectEntities,
  labSplices: Record<string, SpliceRecord>
): OtdrEvent[] {
  if (!home.path || home.budget === null) return [];
  const { exchangeToFdcM, fdcToFatM, dropM } = home.path;
  const total = exchangeToFdcM + fdcToFatM + dropM;

  /* لحامة الإسقاط الفعلية من المختبر إن نُفّذت */
  const drop = entities.drops.find((d) => d.toBuildingId === home.buildingId);
  const labLoss = drop && labSplices[drop.id] ? labSplices[drop.id].lossDb : null;

  const fat = entities.fats.find(
    (f) => f.id === (drop?.fromFatId ?? '')
  );
  const splitterLoss =
    fat?.splitter !== undefined && fat?.splitter !== null
      ? SPLITTER_LOSS[fat.splitter]
      : 0;

  const events: OtdrEvent[] = [
    {
      kind: 'connector',
      labelAr: 'وصلة ODF في المقسم (بداية القياس)',
      posM: 0,
      lossDb: CONNECTOR_LOSS_DB,
      limitDb: 0.5,
    },
    {
      kind: 'splice',
      labelAr: 'لحامة الكابل الرئيسي في FDC',
      posM: exchangeToFdcM,
      lossDb: SPLICE_LOSS_DB,
      limitDb: 0.1,
    },
    {
      kind: 'splice',
      labelAr: `لحامة كابل التوزيع في FAT${labLoss !== null ? ' (فعلي من المختبر)' : ''}`,
      posM: exchangeToFdcM + fdcToFatM,
      lossDb: labLoss ?? SPLICE_LOSS_DB,
      limitDb: 0.15,
    },
    {
      kind: 'splitter',
      labelAr: `القاسم البصري ${fat?.splitter ?? ''} داخل FAT`,
      posM: exchangeToFdcM + fdcToFatM + 0.5,
      lossDb: splitterLoss,
      limitDb: null,
    },
    {
      kind: 'end',
      labelAr: 'نهاية الألياف — روزيتة ONT في الدار',
      posM: total,
      lossDb: CONNECTOR_LOSS_DB,
      limitDb: 0.75,
    },
  ];
  return events.filter((e) => e.kind !== 'splitter' || splitterLoss > 0);
}

/* ===================== توليد المنحنى ===================== */

/** مولد ضوضاء حتمي (نفس المدخلات = نفس المنحنى) */
const seededNoise = (seed: string, i: number): number => {
  let h = 2166136261;
  for (let k = 0; k < seed.length; k++) {
    h ^= seed.charCodeAt(k);
    h = Math.imul(h, 16777619);
  }
  h ^= i * 2654435761;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h >>> 0) % 1000) / 1000 - 0.5; // -0.5..0.5
};

export interface TracePoint {
  x: number; // متر
  y: number; // dB (سالب نحو الأسفل)
}

export function buildTrace(
  home: HomeStatus,
  events: OtdrEvent[],
  pointsCount = 340
): TracePoint[] {
  if (!home.path || home.budget === null) return [];
  const total =
    home.path.exchangeToFdcM + home.path.fdcToFatM + home.path.dropM;
  const att = FIBER_ATTENUATION['1310'] / 1000; // dB لكل متر

  const lossAt = (x: number): number => {
    let loss = x * att;
    for (const e of events) {
      if (e.kind === 'splitter' && x >= e.posM) loss += e.lossDb;
      if ((e.kind === 'splice' || e.kind === 'connector') && e.posM > 0 && x >= e.posM)
        loss += e.lossDb;
    }
    return loss;
  };

  const pts: TracePoint[] = [];
  for (let i = 0; i <= pointsCount; i++) {
    const x = (total * i) / pointsCount;
    pts.push({
      x,
      y: -(lossAt(x) + seededNoise(home.buildingId, i) * 0.04),
    });
  }
  return pts;
}

/* ===================== المكوّن ===================== */

const KIND_META: Record<OtdrEvent['kind'], { icon: string; color: string }> = {
  connector: { icon: '▲', color: '#38bdf8' },
  splice: { icon: '▼', color: '#f59e0b' },
  splitter: { icon: '⯆', color: '#a78bfa' },
  end: { icon: '⯈', color: '#f43f5e' },
};

export default function OtdrPanel({
  home,
  map,
  entities,
  labSplices,
}: {
  home: HomeStatus;
  map: SimMap;
  entities: ProjectEntities;
  labSplices: Record<string, SpliceRecord>;
}): React.ReactElement | null {
  const events = useMemo(
    () => buildOtdrEvents(home, entities, labSplices),
    [home, map, entities, labSplices]
  );
  const trace = useMemo(() => buildTrace(home, events), [home, events]);

  if (events.length === 0 || trace.length === 0 || home.path === null) return null;

  const total =
    home.path.exchangeToFdcM + home.path.fdcToFatM + home.path.dropM;
  const maxLoss = Math.max(...trace.map((p) => -p.y));
  const extra = Math.max(1, maxLoss * 0.15); /* هامش أرضية الضوضاء */

  /* أبعاد الرسم */
  const W = 820;
  const H = 300;
  const PAD = { top: 14, right: 46, bottom: 34, left: 46 };
  const px = (x: number): number =>
    PAD.left + (x / (total * 1.04)) * (W - PAD.left - PAD.right);
  const py = (y: number): number =>
    PAD.top + ((-y) / (maxLoss + extra)) * (H - PAD.top - PAD.bottom);

  const pathD = trace.map((p, i) => `${i === 0 ? 'M' : 'L'}${px(p.x).toFixed(1)},${py(p.y).toFixed(1)}`).join(' ');

  /* خطوط الشبكة */
  const xStep = total <= 120 ? 20 : total <= 300 ? 50 : 100;
  const gridX: number[] = [];
  for (let x = 0; x <= total; x += xStep) gridX.push(x);
  const yStep = Math.max(0.5, Math.ceil((maxLoss + extra) / 8));
  const gridY: number[] = [];
  for (let y = 0; y <= maxLoss + extra; y += yStep) gridY.push(y);

  return (
    <div dir="rtl" className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
      <div className="mb-2 flex items-center justify-between px-1">
        <h4 className="text-[13px] font-bold text-slate-200">
          منحنى OTDR — الدار {home.label}
          <span className="mr-2 font-mono text-[11px] font-normal text-slate-500">
            1310nm / نبضة 100ns
          </span>
        </h4>
        <span className="font-mono text-[11px] text-slate-500">
          الطول الكلي {total.toFixed(0)}م — الفقد الكلي {maxLoss.toFixed(2)}dB
        </span>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full select-none" style={{ direction: 'ltr' }}>
        {/* شبكة */}
        {gridX.map((x) => (
          <g key={`gx-${x}`}>
            <line x1={px(x)} y1={PAD.top} x2={px(x)} y2={H - PAD.bottom} stroke="#1e293b" strokeWidth="1" />
            <text x={px(x)} y={H - PAD.bottom + 16} fill="#64748b" fontSize="10" textAnchor="middle" fontFamily="monospace">
              {x}m
            </text>
          </g>
        ))}
        {gridY.map((y) => (
          <g key={`gy-${y}`}>
            <line x1={PAD.left} y1={py(-y)} x2={W - PAD.right} y2={py(-y)} stroke="#1e293b" strokeWidth="1" />
            <text x={W - PAD.right + 6} y={py(-y) + 3} fill="#64748b" fontSize="10" fontFamily="monospace">
              -{y.toFixed(yStep < 1 ? 1 : 0)}
            </text>
          </g>
        ))}

        {/* المنحنى */}
        <path d={pathD} fill="none" stroke="#22d3ee" strokeWidth="1.8" />

        {/* أرضية الضوضاء بعد النهاية */}
        <path
          d={Array.from({ length: 30 }, (_, i) => {
            const x = total + (total * 0.04 * i) / 29;
            const y = -(maxLoss + extra * 0.7 + seededNoise(home.buildingId, 900 + i) * 0.25);
            return `${i === 0 ? 'M' : 'L'}${px(x).toFixed(1)},${py(y).toFixed(1)}`;
          }).join(' ')}
          fill="none"
          stroke="#475569"
          strokeWidth="1"
          strokeDasharray="3 3"
        />

        {/* علامات الأحداث */}
        {events.map((e, i) => {
          const meta = KIND_META[e.kind];
          const ex = px(e.posM);
          const baseY = py(
            trace.reduce((best, p) => (p.x <= e.posM ? p : best), trace[0]).y
          );
          const ok = e.limitDb === null || e.lossDb <= e.limitDb;
          return (
            <g key={i}>
              {/* شعاع الانعكاس للوصلات */}
              {e.kind === 'connector' || e.kind === 'end' ? (
                <path
                  d={`M${ex},${baseY} L${ex - 3},${baseY - 26} L${ex + 3},${baseY - 26} Z`}
                  fill={ok ? meta.color : '#f43f5e'}
                />
              ) : (
                <circle cx={ex} cy={baseY} r="5" fill={ok ? meta.color : '#f43f5e'} stroke="#020617" strokeWidth="1.5" />
              )}
              <text x={ex} y={baseY - 32} fill={ok ? meta.color : '#f43f5e'} fontSize="9" textAnchor="middle" fontFamily="monospace">
                {e.lossDb.toFixed(2)}dB
              </text>
            </g>
          );
        })}

        {/* عنوان المحور */}
        <text x={W / 2} y={H - 2} fill="#475569" fontSize="10" textAnchor="middle">
          المسافة (متر)
        </text>
      </svg>

      {/* جدول الأحداث */}
      <div className="mt-2 overflow-hidden rounded-lg border border-slate-800">
        <table className="w-full text-[11.5px]">
          <thead>
            <tr className="bg-slate-900 text-slate-300">
              <th className="px-2 py-1.5 text-right font-semibold">الحدث</th>
              <th className="px-2 py-1.5 font-semibold">النوع</th>
              <th className="px-2 py-1.5 font-semibold">الموقع</th>
              <th className="px-2 py-1.5 font-semibold">الفقد</th>
              <th className="px-2 py-1.5 font-semibold">الحكم</th>
            </tr>
          </thead>
          <tbody>
            {events.map((e, i) => {
              const ok = e.limitDb === null || e.lossDb <= e.limitDb;
              return (
                <tr key={i} className="border-t border-slate-800/70 text-slate-300">
                  <td className="px-2 py-1.5 text-right">{e.labelAr}</td>
                  <td className="px-2 py-1.5 text-center font-mono" style={{ color: KIND_META[e.kind].color }}>
                    {KIND_META[e.kind].icon}
                  </td>
                  <td className="px-2 py-1.5 text-center font-mono">{e.posM.toFixed(1)}م</td>
                  <td className="px-2 py-1.5 text-center font-mono">{e.lossDb.toFixed(2)}dB</td>
                  <td className={`px-2 py-1.5 text-center font-semibold ${ok ? 'text-emerald-400' : 'text-red-400'}`}>
                    {e.limitDb === null ? 'معياري' : ok ? 'سليم' : 'مرتفع'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
