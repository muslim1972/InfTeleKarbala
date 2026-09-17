/**
 * ============================================================
 * واجهة استيراد GIS وإدارة الخرائط — محاكي FTTH
 * ============================================================
 * نافذة مستقلة توفر:
 *  - استيراد ملف GeoJSON (سحب/إفلات أو اختيار) مع تحقق صارم
 *  - تنزيل نموذج جاهز (حي كربلاء) لتجربة الاستيراد فوراً
 *  - تبديل الخريطة الحالية (الثابتة أو المستوردة)
 *  - حذف الخرائط المستوردة
 *
 * العزل: لا يستقبل سوى open/onClose، ويقرأ حالته من مخزن
 * الخرائط ومخزن المحاكي مباشرة — بلا تبعيات على مساحة العمل.
 * الأمان: JSON.parse فقط، حدود صارمة للحجم والعدد، ولا حقن HTML.
 */

import { useRef, useState } from 'react';
import { Download, Map, Trash2, Upload, X } from 'lucide-react';
import { useGisMaps } from './gis-maps.store';
import { geoJsonToSimMap, GisImportError } from './geojsonToSimMap';
import { SIM_MAPS } from '../data/maps/registry';
import { useSimulatorStore } from '../store/simulator.store';
import type { SimMap } from '../types';

const SAMPLE_URL = '/gis-samples/karbala-neighborhood.geojson';
const MAX_FILE_BYTES = 8_000_000;
const ACCEPT = '.geojson,.json,application/geo+json,application/json';

const LEVEL_AR: Record<SimMap['level'], string> = {
  beginner: 'مبتدئ',
  intermediate: 'متوسط',
  advanced: 'متقدم',
};

export default function GisImporter({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}): React.ReactElement | null {
  const gis = useGisMaps();
  const st = useSimulatorStore();
  const fileInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  if (!open) return null;

  /* =================== الاستيراد =================== */
  const importFile = async (file: File) => {
    setError(null);
    setInfo(null);
    if (file.size > MAX_FILE_BYTES) {
      setError(`حجم الملف ${(file.size / 1_000_000).toFixed(1)}MB يتجاوز الحد 8MB — استورد منطقة أصغر`);
      return;
    }
    const nameOk = /\.(geo)?json$/i.test(file.name) || file.type.includes('json');
    if (!nameOk) {
      setError('الملف ليس GeoJSON/JSON — الرجاء اختيار ملف بصيغة .geojson أو .json');
      return;
    }
    setBusy(true);
    try {
      const text = await file.text();
      const res = geoJsonToSimMap(text, { name: file.name.replace(/\.(geo)?json$/i, '') });
      gis.upsert(res.map);
      st.loadMap(res.map);
      setInfo(
        `أُستوردت «${res.map.name}» — ${res.stats.buildings} مبنى و${res.stats.roads} طريق على ${res.map.widthM}×${res.map.heightM}م`
          + (res.warnings.length ? ` · ${res.warnings.join(' · ')}` : '')
      );
    } catch (e) {
      setError(e instanceof GisImportError ? e.message : 'خطأ غير متوقع أثناء التحليل');
    } finally {
      setBusy(false);
    }
  };

  const onPick = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    void importFile(files[0]);
  };

  /* =================== تنزيل النموذج =================== */
  const downloadSample = async () => {
    setError(null);
    try {
      const res = await fetch(SAMPLE_URL, { cache: 'no-cache' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'karbala-neighborhood.geojson';
      document.body.appendChild(a);
      a.click();
      a.remove();
      /* تحرير الذاكرة فوراً — لا نُبقي مرجعاً للكائن */
      window.setTimeout(() => URL.revokeObjectURL(url), 4000);
      setInfo('نُزِّل النموذج إلى جهازك — استورده الآن من زر «اختر ملف GeoJSON»');
    } catch {
      setError('تعذّر تنزيل النموذج — تحقق من الاتصال وحاول مجدداً');
    }
  };

  /* =================== تبديل/حذف الخرائط =================== */
  const switchMap = (m: SimMap) => {
    if (m.id === st.mapId) return;
    if (st.entities.trenches.length || st.entities.fats.length || st.entities.drops.length) {
      if (
        !window.confirm(
          'التبديل سيُفرّغ التصميم الحالي غير المحفوظ على الخريطة الأخرى. متابعة؟'
        )
      ) {
        return;
      }
    }
    st.loadMap(m);
    setError(null);
    setInfo(`الخريطة الحالية: «${m.name}»`);
    onClose();
  };

  const imported = gis.maps;

  return (
    <div
      dir="rtl"
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/70 p-6 pb-28 md:pb-32 overflow-y-auto"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="flex max-h-[calc(100vh-9rem)] w-full max-w-lg flex-col rounded-2xl border border-slate-700 bg-[#0b1322] shadow-2xl overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* الرأس */}
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-3.5">
          <h3 className="flex items-center gap-2 text-sm font-bold text-slate-100">
            <Map size={16} className="text-emerald-400" />
            خرائط المحاكي واستيراد GIS
          </h3>
          <button
            type="button"
            onClick={onClose}
            title="إغلاق"
            className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800 hover:text-slate-100"
          >
            <X size={16} />
          </button>
        </div>

        <div className="space-y-4 p-4">
          {/* منطقة السحب والإفلات */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              onPick(e.dataTransfer.files);
            }}
            className={`rounded-xl border-2 border-dashed p-5 text-center transition-colors ${
              dragOver
                ? 'border-emerald-500 bg-emerald-500/10'
                : 'border-slate-600 bg-slate-900/40 hover:border-slate-500'
            }`}
          >
            <Upload size={22} className="mx-auto mb-2 text-slate-500" />
            <p className="text-[12.5px] leading-relaxed text-slate-400">
              اسحب ملف <span className="font-bold text-slate-200">GeoJSON</span> هنا
              <br />
              <span className="text-[11px] text-slate-500">
                (مبانٍ Polygon + طرق LineString · حتى 8MB · EPSG:4326)
              </span>
            </p>
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              disabled={busy}
              className="mt-3 inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-[12px] font-bold text-white transition-colors hover:bg-emerald-500 disabled:opacity-50"
            >
              {busy ? <span className="animate-pulse">جارٍ التحليل…</span> : 'اختر ملف GeoJSON'}
            </button>
            <input
              ref={fileInput}
              type="file"
              accept={ACCEPT}
              className="hidden"
              onChange={(e) => onPick(e.target.files)}
            />
          </div>

          {/* تنزيل النموذج */}
          <button
            type="button"
            onClick={() => void downloadSample()}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-emerald-700/60 bg-emerald-950/30 px-3 py-2.5 text-[12px] font-bold text-emerald-300 transition-colors hover:border-emerald-500 hover:bg-emerald-500/10"
          >
            <Download size={15} />
            تنزيل نموذج جاهز — حي شرق الحرم، كربلاء (32 مبنى حقيقياً)
          </button>

          {/* الرسائل */}
          {error && (
            <div className="rounded-lg border border-red-500/40 bg-red-950/40 px-3 py-2.5 text-[12px] leading-relaxed text-red-300">
              {error}
            </div>
          )}
          {info && (
            <div className="rounded-lg border border-emerald-500/40 bg-emerald-950/30 px-3 py-2.5 text-[12px] leading-relaxed text-emerald-300">
              {info}
            </div>
          )}

          {/* الخرائط الثابتة */}
          <div>
            <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-500">
              خرائط أساسية
            </div>
            <div className="space-y-2">
              {SIM_MAPS.map((m) => (
                <MapRow
                  key={m.id}
                  m={m}
                  active={m.id === st.mapId}
                  onPick={() => switchMap(m)}
                />
              ))}
            </div>
          </div>

          {/* الخرائط المستوردة */}
          <div>
            <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-500">
              خرائط مستوردة ({imported.length})
            </div>
            {imported.length === 0 ? (
              <p className="rounded-lg border border-slate-800 bg-slate-900/30 px-3 py-3 text-center text-[12px] leading-relaxed text-slate-600">
                لا توجد خرائط مستوردة بعد.
                <br />
                استورد ملف GeoJSON ليظهر هنا (يُحفظ على هذا الجهاز).
              </p>
            ) : (
              <div className="space-y-2">
                {imported.map((m) => (
                  <MapRow
                    key={m.id}
                    m={m}
                    active={m.id === st.mapId}
                    onPick={() => switchMap(m)}
                    onDelete={() => {
                      gis.remove(m.id);
                      if (m.id === st.mapId) st.loadMap(SIM_MAPS[0]);
                      setInfo(`حُذفت «${m.name}»`);
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function MapRow({
  m,
  active,
  onPick,
  onDelete,
}: {
  m: SimMap;
  active: boolean;
  onPick: () => void;
  onDelete?: () => void;
}): React.ReactElement {
  return (
    <div
      className={`flex items-center gap-3 rounded-xl border p-3 transition-colors ${
        active
          ? 'border-emerald-500/60 bg-emerald-500/10'
          : 'border-slate-800 bg-slate-900/60 hover:border-slate-600'
      }`}
    >
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-bold text-slate-100">{m.name}</div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[10.5px] text-slate-500">
          <span className="rounded-full bg-slate-800/80 px-1.5 py-0.5 text-slate-400">
            {LEVEL_AR[m.level]}
          </span>
          <span dir="ltr">
            {m.widthM}×{m.heightM}م
          </span>
          <span>· {m.buildings.length} دار</span>
          <span>· {m.roads.length} طريق</span>
        </div>
      </div>
      {active ? (
        <span className="shrink-0 rounded-full bg-emerald-500/20 px-2 py-1 text-[9.5px] font-bold text-emerald-300">
          الحالية
        </span>
      ) : (
        <button
          type="button"
          onClick={onPick}
          className="shrink-0 rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-1.5 text-[11px] font-bold text-slate-200 transition-colors hover:bg-slate-700"
        >
          فتح
        </button>
      )}
      {onDelete && (
        <button
          type="button"
          onClick={onDelete}
          title="حذف الخريطة المستوردة"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-red-950/50 hover:text-red-400"
        >
          <Trash2 size={14} />
        </button>
      )}
    </div>
  );
}
