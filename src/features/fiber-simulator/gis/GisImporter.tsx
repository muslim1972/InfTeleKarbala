/**
 * ============================================================
 * واجهة استيراد GIS وإدارة الخرائط — محاكي FTTH
 * ============================================================
 * نافذة مستقلة توفر:
 *  - استيراد ملف GeoJSON (سحب/إفلات أو اختيار) مع تحقق صارم
 *  - جلب خريطة حقيقية في الوقت الفعلي من OpenStreetMap حسب طلب
 *    المستخدم (مباشرةً من المتصفح عبر مرايا Overpass العامة)
 *  - تبديل الخريطة الحالية (الثابتة أو المستوردة)
 *  - حذف الخرائط المستوردة
 *
 * لا يُحفظ أي ملف داخل حزمة التطبيق (public/): الخريطة تُجلَب أو
 * تُستورد عند الطلب، وحين يحفظ المستخدم مشروعه تستقر الخريطة
 * معه في قاعدة البيانات (map_data) ليعمل من أي جهاز.
 *
 * العزل: لا يستقبل سوى open/onClose، ويقرأ حالته من مخزن
 * الخرائط ومخزن المحاكي مباشرة — بلا تبعيات على مساحة العمل.
 * الأمان: JSON.parse فقط، حدود صارمة للحجم والعدد، ولا حقن HTML.
 */

import { useEffect, useRef, useState } from 'react';
import { Globe, HelpCircle, Map, Plus, Trash2, Upload, X } from 'lucide-react';
import { useGisMaps } from './gis-maps.store';
import { useOsmCustomPresets } from './osm-custom-presets.store';
import { geoJsonToSimMap, GisImportError } from './geojsonToSimMap';
import { fetchOsmArea, OSM_PRESETS } from './osm-areas';
import { SIM_MAPS } from '../data/maps/registry';
import { useSimulatorStore } from '../store/simulator.store';
import type { SimMap } from '../types';

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
  /* عنصر ملء الشاشة قبل فتح مستكشف الملفات (حاوية المحاكي rootRef).
   * المستكشف يُخرج المتصفح من ملء الشاشة فنعيد الطلب على العنصر نفسه
   * بعد الاختيار/الإلغاء — لا على documentElement وإلا ملأت الصفحة كلها */
  const wasFsRef = useRef<Element | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [stage, setStage] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [osmPreset, setOsmPreset] = useState(OSM_PRESETS[0].id);
  /* إظهار التلميح التعليمي لسير عمل GeoJSON الشخصي */
  const [showGeoHelp, setShowGeoHelp] = useState(false);
  /* إدارة القوالب المخصصة: نموذج الإضافة وحقوله */
  const [showPresetForm, setShowPresetForm] = useState(false);
  const [pfLabel, setPfLabel] = useState('');
  const [pfSouth, setPfSouth] = useState('');
  const [pfWest, setPfWest] = useState('');
  const [pfNorth, setPfNorth] = useState('');
  const [pfEast, setPfEast] = useState('');
  const osmCustom = useOsmCustomPresets();

  /* إلغاء منتقي الملفات: نستمع لحدث cancel الأصلي على الـ input
   * لاستعادة ملء الشاشة فوراً. يُركَّب عبر addEventListener لأن
   * onCancel في أنواع React معرَّف على <dialog> فقط — وليس على
   * input (وهذا سبب خطأ TS2322 عند تمريره كخاصية JSX). */
  useEffect(() => {
    const el = fileInput.current;
    if (!open || !el) return;
    const onPickerCancel = () => restoreFs();
    el.addEventListener('cancel', onPickerCancel);
    return () => el.removeEventListener('cancel', onPickerCancel);
  }, [open]);

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
      /* نجاح الاستيراد: نغلق النافذة تلقائياً ليستلمها المستخدم
       * على مساحة العمل مباشرة — نفس سلوك الجلب الحيّ من OSM */
      onClose();
    } catch (e) {
      setError(e instanceof GisImportError ? e.message : 'خطأ غير متوقع أثناء التحليل');
    } finally {
      setBusy(false);
    }
  };

  /* فتح المستكشف: نتذكّر عنصر ملء الشاشة قبل خروج المتصفح منه */
  const openPicker = () => {
    wasFsRef.current = document.fullscreenElement;
    fileInput.current?.click();
  };

  /* استعادة ملء الشاشة على العنصر الأصلي فور إغلاق المستكشف.
   * ملاحظة حاسمة: change/cancel ليسان من أحداث «تنشيط المستخدم»
   * في المتصفح، فقد تُرفض المحاولة الفورية — لذلك الشبكة الأمانة
   * (أول pointerdown/keydown بعدهما، وهما حدثا تنشيط مؤكدان) هي
   * الفاعل الفعلي: تعيد الطلب على العنصر المحفوظ ثم تنظّف نفسها.
   * (خلل سابق: المحاولة الفورية كانت تصفّر المرجع فتجد النقرة
   * المرجع null — صُحّح بإبقاء المرجع حتى أول إيماءة) */
  const restoreFs = () => {
    const attempt = (final: boolean) => {
      const el = wasFsRef.current;
      if (el && !document.fullscreenElement) {
        void el.requestFullscreen().catch(() => {});
      }
      if (final) {
        wasFsRef.current = null;
        document.removeEventListener('pointerdown', onGesture);
        document.removeEventListener('keydown', onGesture);
      }
    };
    const onGesture = () => attempt(true);
    attempt(false);
    document.addEventListener('pointerdown', onGesture);
    document.addEventListener('keydown', onGesture);
  };

  const onPick = (files: FileList | null) => {
    restoreFs();
    if (!files || files.length === 0) return;
    void importFile(files[0]);
  };

  /* =================== جلب خريطة حيّة من OpenStreetMap ===================
   * الاستيراد في الوقت الفعلي حسب طلب المستخدم: تُجلب بيانات حقيقية
   * من OSM مباشرةً من متصفح المستخدم عبر مرايا Overpass العامة —
   * لا نحفظ أي ملف في حزمة التطبيق. بعد العمل عليها يحفظها
   * المستخدم ضمن مشروعه فتستقر في قاعدة البيانات.
   * التغذية الراجعة: مؤقّت ثوانٍ حيّ + المرآة الحالية، لأن بعض
   * المرايا المزدحمة تستغرق عشرات الثواني ولا نريد المستخدم يظن
   * الواجهة معلّقة. */
  const fetchLive = async () => {
    setError(null);
    setInfo(null);
    setStage(null);
    setElapsed(0);
    const preset = [...OSM_PRESETS, ...osmCustom.presets].find(
      (p) => p.id === osmPreset
    );
    if (!preset) return;
    setBusy(true);
    const timer = window.setInterval(() => setElapsed((s) => s + 1), 1000);
    try {
      const { geojson } = await fetchOsmArea(preset.bbox, preset.label, setStage);
      const res = geoJsonToSimMap(geojson, { name: preset.label });
      gis.upsert(res.map);
      st.loadMap(res.map);
      /* نجاح الجلب: الخريطة مسجَّلة ومحمَّلة في مساحة العمل —
       * نغلق النافذة تلقائياً ليستلمها المستخدم على القسم مباشرة */
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذّر جلب الخريطة من OpenStreetMap');
    } finally {
      window.clearInterval(timer);
      setBusy(false);
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
                (مبانٍ Polygon + طرق LineString · حتى 8MB · EPSG:4326
                <br />
                · السحب والإفلات لا يُخرجك من ملء الشاشة)
              </span>
            </p>
            <button
              type="button"
              onClick={openPicker}
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

          {/* تلميح تعليمي: سير عمل «خريطتي الخاصة» خطوة بخطوة */}
          <button
            type="button"
            onClick={() => setShowGeoHelp((v) => !v)}
            aria-expanded={showGeoHelp}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900/40 px-3 py-2 text-[11.5px] font-bold text-slate-300 transition-colors hover:border-emerald-600 hover:text-emerald-300"
          >
            <HelpCircle size={14} className="text-emerald-400" />
            كيف أعمل على خريطتي الخاصة (GeoJSON) خطوة بخطوة؟
          </button>
          {showGeoHelp && (
            <ol className="space-y-2 rounded-xl border border-emerald-700/40 bg-emerald-950/20 p-3.5 text-[12px] leading-relaxed text-slate-300">
              <li>
                <b className="text-emerald-300">1) الملف على جهازك:</b> احفظ ملف الخريطة بصيغة
                <span dir="ltr"> .geojson </span>في أي مجلد (سطح المكتب مثلاً) — لا يهم مكانه،
                فالتطبيق يقرأ نسخةً منه مرة واحدة ثم لا يحتاجه بعد ذلك.
              </li>
              <li>
                <b className="text-emerald-300">2) الاستيراد:</b> اسحب الملف إلى المربع أعلاه أو
                اضغط «اختر ملف GeoJSON». التحليل يتم بالكامل داخل متصفحك —
                <b className="text-slate-100"> لا يُرفع الملف إلى أي خادم</b>.
              </li>
              <li>
                <b className="text-emerald-300">3) العمل:</b> تُفتح الخريطة فوراً في مساحة العمل
                وتظهر في قائمة «خرائط مستوردة» — تُرى منك وحدك ولا تظهر لبقية المستخدمين
                ولا تؤثر فيهم.
              </li>
              <li>
                <b className="text-emerald-300">4) الحفظ على حسابك:</b> بعد تصميم شبكتك اضغط زر
                <b className="text-emerald-300"> حفظ المشروع</b> في شريط المحاكي — تُخزَّن الخريطة
                مع تصميمك على مساحتك في قاعدة البيانات (VPS)، فيعمل مشروعك من أي جهاز تسجّل
                منه الدخول.
              </li>
              <li>
                <b className="text-emerald-300">5) حذف الملف المحلي:</b> الآن احذف
                <span dir="ltr"> .geojson </span>من جهازك بأمان — كل شيء مستقر في مشروعك.
              </li>
              <li className="border-t border-emerald-900/60 pt-2 text-[11px] text-slate-400">
                ملاحظة: قائمة «خرائط مستوردة» تُحفظ في متصفحك للوصول السريع، والنسخة الضامنة
                هي نسخة المشروع المحفوظ في قاعدة البيانات.
              </li>
            </ol>
          )}

          {/* جلب خريطة حقيقية في الوقت الفعلي من OpenStreetMap */}
          <div className="rounded-xl border border-sky-700/50 bg-sky-950/30 p-4">
            <div className="mb-2.5 flex items-center gap-2 text-[12px] font-bold text-sky-300">
              <Globe size={15} />
              جلب خريطة حقيقية — OpenStreetMap
            </div>
            <p className="mb-3 text-[11px] leading-relaxed text-slate-400">
              تُجلَب بيانات حقيقية من خرائط OpenStreetMap لحظة طلبها
              مباشرةً من متصفحك — ولا تُخزَّن أي ملفات داخل التطبيق.
            </p>
            <div className="flex items-center gap-2">
              <select
                value={osmPreset}
                onChange={(e) => setOsmPreset(e.target.value)}
                disabled={busy}
                className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-[12px] font-bold text-slate-100 outline-none focus:border-sky-500 disabled:opacity-50"
              >
                <optgroup label="قوالب أساسية — يديرها المطور">
                  {OSM_PRESETS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label} — {p.hint}
                    </option>
                  ))}
                </optgroup>
                {osmCustom.presets.length > 0 && (
                  <optgroup label="قوالبي المخصصة — في متصفحي فقط">
                    {osmCustom.presets.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.label} — {p.hint}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
              <button
                type="button"
                onClick={() => void fetchLive()}
                disabled={busy}
                className="shrink-0 rounded-lg bg-sky-600 px-4 py-2 text-[12px] font-bold text-white transition-colors hover:bg-sky-500 disabled:opacity-50"
              >
                {busy ? 'جارٍ الجلب…' : 'جلب'}
              </button>
            </div>

            {/* إدارة القوالب المخصصة: تخصيص تفاعلي بيد كل مستخدم —
             * تُحفظ في متصفحه ولا تمس القوالب الأساسية ولا بقية المستخدمين */}
            <div className="mt-2.5 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setShowPresetForm((v) => !v)}
                disabled={busy}
                aria-expanded={showPresetForm}
                className="inline-flex items-center gap-1.5 rounded-lg border border-sky-700/60 bg-sky-900/30 px-2.5 py-1.5 text-[11px] font-bold text-sky-300 transition-colors hover:bg-sky-900/60 disabled:opacity-50"
              >
                <Plus size={13} />
                إضافة قالب منطقتي
              </button>
              {osmCustom.presets.some((p) => p.id === osmPreset) && (
                <button
                  type="button"
                  onClick={() => {
                    const cur = osmCustom.presets.find((p) => p.id === osmPreset);
                    if (!cur) return;
                    if (
                      !window.confirm(
                        `حذف القالب المخصص «${cur.label}»؟ (لن تُحذف أي خرائط جُلبت به)`
                      )
                    )
                      return;
                    osmCustom.remove(cur.id);
                    setOsmPreset(OSM_PRESETS[0].id);
                    setInfo(`حُذف القالب «${cur.label}»`);
                    setError(null);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-bold text-slate-500 transition-colors hover:bg-red-950/40 hover:text-red-400"
                >
                  <Trash2 size={13} />
                  حذف القالب المحدد
                </button>
              )}
            </div>
            {showPresetForm && (
              <form
                className="mt-2.5 space-y-2 rounded-lg border border-slate-700 bg-slate-900/60 p-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  const south = Number(pfSouth);
                  const west = Number(pfWest);
                  const north = Number(pfNorth);
                  const east = Number(pfEast);
                  if ([south, west, north, east].some((v) => !Number.isFinite(v))) {
                    setError('أدخل إحداثيات رقمية صحيحة في الحقول الأربعة');
                    return;
                  }
                  const res = osmCustom.add({ label: pfLabel, south, west, north, east });
                  if (typeof res === 'string') {
                    setError(res);
                    return;
                  }
                  setError(null);
                  setOsmPreset(res.id);
                  setInfo(`أُضيف القالب «${res.label}» — محدد الآن، اضغط «جلب»`);
                  setShowPresetForm(false);
                  setPfLabel('');
                  setPfSouth('');
                  setPfWest('');
                  setPfNorth('');
                  setPfEast('');
                }}
              >
                <div className="text-[11px] leading-relaxed text-slate-400">
                  أضف منطقتك كقالب دائم: صندوق بإحداثيات درجات عشرية (WGS84) بمساحة
                  صغيرة (100م–5كم للضلع). القوالب المخصصة تُحفظ في متصفحك فقط
                  ولا تظهر لبقية المستخدمين.
                </div>
                <input
                  value={pfLabel}
                  onChange={(e) => setPfLabel(e.target.value)}
                  maxLength={60}
                  required
                  placeholder="اسم المنطقة (مثال: حي الأمل — النجف)"
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-[12px] text-slate-100 outline-none focus:border-sky-500"
                />
                <div className="grid grid-cols-4 gap-2" dir="ltr">
                  {(
                    [
                      ['South', pfSouth, setPfSouth],
                      ['West', pfWest, setPfWest],
                      ['North', pfNorth, setPfNorth],
                      ['East', pfEast, setPfEast],
                    ] as const
                  ).map(([ph, val, set]) => (
                    <input
                      key={ph}
                      value={val}
                      onChange={(e) => set(e.target.value)}
                      inputMode="decimal"
                      required
                      placeholder={ph}
                      className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-2 text-center text-[12px] text-slate-100 outline-none focus:border-sky-500"
                    />
                  ))}
                </div>
                <button
                  type="submit"
                  disabled={busy}
                  className="rounded-lg bg-sky-600 px-3 py-1.5 text-[11.5px] font-bold text-white transition-colors hover:bg-sky-500 disabled:opacity-50"
                >
                  حفظ القالب
                </button>
              </form>
            )}
          </div>

          {/* الرسائل */}
          {busy && (stage || elapsed > 0) && (
            <div className="rounded-lg border border-sky-500/40 bg-sky-950/40 px-3 py-2.5 text-[12px] leading-relaxed text-sky-300">
              <span className="inline-flex items-center gap-2 font-bold">
                <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-sky-400" />
                جارٍ الجلب… <span dir="ltr">{elapsed}ث</span>
              </span>
              {stage && (
                <span className="mt-1 block text-[11px] leading-relaxed text-slate-400">
                  {stage}
                </span>
              )}
            </div>
          )}
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
                استورد ملف GeoJSON أو اجلب خريطة حيّة — وحين تحفظ
                مشروعك تُخزَّن الخريطة معه في قاعدة البيانات.
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
