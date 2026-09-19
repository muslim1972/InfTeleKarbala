/**
 * ============================================================
 * واجهة خرائط المحاكي واستيراد GIS — محاكي FTTH
 * ============================================================
 * نافذة مستقلة توفر:
 *  - استيراد ملف GeoJSON من جهاز المستخدم (سحب/إفلات أو اختيار)
 *    مع تحقق صارم — تحليل محلي بالكامل دون رفع للخادم
 *  - «مكتبة الخرائط المشتركة»: ملفات GeoJSON يرفعها حساب المطور
 *    إلى قاعدة البيانات فتظهر للجميع (القائمة تبدأ فارغة)
 *  - تبديل الخريطة الحالية وحذف الخرائط المستوردة
 *
 * لا أي روابط خارجية أو جلب حيّ: الخريطة إمّا من ملف المستخدم
 * المحلي أو من المكتبة المشتركة في قاعدة البيانات. وحين يحفظ
 * المستخدم مشروعه تستقر الخريطة معه في مساحته الخاصة (map_data)
 * ليعمل من أي جهاز.
 *
 * العزل: لا يستقبل سوى open/onClose، ويقرأ حالته من مخزن
 * الخرائط ومخزن المحاكي مباشرة — بلا تبعيات على مساحة العمل.
 * الأمان: JSON.parse فقط، حدود صارمة للحجم والعدد، ولا حقن HTML.
 */

import { useEffect, useRef, useState } from 'react';
import { HelpCircle, Library, Map, Trash2, Upload, Wrench, X } from 'lucide-react';
import { useGisMaps } from './gis-maps.store';
import { geoJsonToSimMap, GisImportError } from './geojsonToSimMap';
import {
  deleteMapFromLibrary,
  LIBRARY_MAX_FILE_BYTES,
  listMapLibrary,
  loadMapFromLibrary,
  uploadMapToLibrary,
} from './sim-map-library.service';
import type { LibraryEntry } from './sim-map-library.service';
import { useAuth } from '../../../context/AuthContext';
import { isDeveloperAccount } from '../security/feature-gate';
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
  /* مدخل ملف المستخدم (استيراد شخصي محلي) ومدخل ملف المطور (رفع للمكتبة) */
  const fileInput = useRef<HTMLInputElement>(null);
  const devFileInput = useRef<HTMLInputElement>(null);
  /* عنصر ملء الشاشة قبل فتح مستكشف الملفات (حاوية المحاكي rootRef).
   * المستكشف يُخرج المتصفح من ملء الشاشة فنعيد الطلب على العنصر نفسه
   * بعد الاختيار/الإلغاء — لا على documentElement وإلا ملأت الصفحة كلها */
  const wasFsRef = useRef<Element | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  /* إظهار التلميح التعليمي لسير عمل GeoJSON الشخصي */
  const [showGeoHelp, setShowGeoHelp] = useState(false);

  /* =================== مكتبة الخرائط المشتركة ===================
   * القائمة تبدأ فارغة ويملؤها المطور من لوحته أدناه. تُقرأ من
   * قاعدة البيانات عند كل فتح للنافذة فيرى الجميع آخر حالة.
   * الإضافة/الحذف لحساب المطور فقط — والضمانة النهائية سياسات
   * RLS في الخادم لا الواجهة. */
  const { user } = useAuth();
  const isDev = isDeveloperAccount(user);
  const [library, setLibrary] = useState<LibraryEntry[]>([]);
  const [libOk, setLibOk] = useState(true);
  /* لوحة المطور: الاسم + الملف المختار */
  const [devOpen, setDevOpen] = useState(false);
  const [devBusy, setDevBusy] = useState(false);
  const [dpLabel, setDpLabel] = useState('');
  const [dpFile, setDpFile] = useState<File | null>(null);

  /* قراءة المكتبة من قاعدة البيانات عند كل فتح للنافذة */
  useEffect(() => {
    if (!open) return;
    let alive = true;
    listMapLibrary()
      .then((rows) => {
        if (!alive) return;
        setLibrary(rows);
        setLibOk(true);
      })
      .catch(() => {
        if (alive) setLibOk(false);
      });
    return () => {
      alive = false;
    };
  }, [open]);

  if (!open) return null;

  /* =================== أدوات ملء الشاشة والمستكشف =================== */

  /* فتح مستكشف الملفات: نتذكّر عنصر ملء الشاشة قبل خروج المتصفح منه
   * ونستمع لحدث cancel الأصلي على الـ input (لا خاصية onCancel في
   * React — معرَّف على <dialog> فقط، وتمريره كخاصية JSX يسبب TS2322). */
  const openPicker = (input: HTMLInputElement | null) => {
    wasFsRef.current = document.fullscreenElement;
    const onPickerCancel = () => restoreFs();
    input?.addEventListener('cancel', onPickerCancel, { once: true });
    input?.click();
  };

  /* استعادة ملء الشاشة على العنصر الأصلي فور إغلاق المستكشف.
   * ملاحظة حاسمة: change/cancel ليسان من أحداث «تنشيط المستخدم»
   * في المتصفح، فقد تُرفض المحاولة الفورية — لذلك الشبكة الأمانة
   * (أول pointerdown/keydown بعدهما، وهما حدثا تنشيط مؤكدان) هي
   * الفاعل الفعلي: تعيد الطلب على العنصر المحفوظ ثم تنظّف نفسها. */
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

  /* =================== الاستيراد الشخصي (محلي فقط) ===================
   * الملف يُقرأ ويُحلَّل داخل متصفح المستخدم — لا يُرفع إلى أي خادم
   * في هذه الخطوة. يصبح في مساحة العمل فوراً، ويستقر في قاعدة
   * البيانات لاحقاً فقط حين يحفظ المستخدم مشروعه. */
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
       * على مساحة العمل مباشرة */
      onClose();
    } catch (e) {
      setError(e instanceof GisImportError ? e.message : 'خطأ غير متوقع أثناء التحليل');
    } finally {
      setBusy(false);
    }
  };

  const onPick = (files: FileList | null) => {
    restoreFs();
    if (!files || files.length === 0) return;
    void importFile(files[0]);
  };

  /* =================== فتح خريطة من المكتبة (للجميع) =================== */
  const openFromLibrary = async (entry: LibraryEntry) => {
    setError(null);
    setInfo(null);
    setBusy(true);
    try {
      const map = await loadMapFromLibrary(entry.id);
      gis.upsert(map);
      st.loadMap(map);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذّر تحميل الخريطة من المكتبة');
    } finally {
      setBusy(false);
    }
  };

  /* =================== لوحة المطور: رفع/حذف من المكتبة =================== */

  /* اختيار ملف من جهاز المطور — فحص أولي فوري ثم انتظار زر الاستيراد */
  const onPickDevFile = (files: FileList | null) => {
    restoreFs();
    if (!files || files.length === 0) return;
    const f = files[0];
    if (f.size > LIBRARY_MAX_FILE_BYTES) {
      setError(`حجم الملف ${(f.size / 1_000_000).toFixed(1)}MB يتجاوز الحد 8MB — اختر منطقة أصغر`);
      return;
    }
    const nameOk = /\.(geo)?json$/i.test(f.name) || f.type.includes('json');
    if (!nameOk) {
      setError('الملف ليس GeoJSON/JSON — اختر ملفاً بصيغة .geojson أو .json');
      return;
    }
    setError(null);
    setDpFile(f);
    setInfo(`تم اختيار «${f.name}» — اكتب اسم الخريطة ثم اضغط «استيراد إلى المكتبة»`);
  };

  /* الرفع إلى المكتبة: التحقق النهائي والتحليل داخل الخدمة، ثم
   * الإدخال في قاعدة البيانات ليظهر في قائمة جميع المستخدمين */
  const uploadToLibrary = async () => {
    if (!dpFile || devBusy) return;
    setDevBusy(true);
    const res = await uploadMapToLibrary(dpLabel, dpFile);
    setDevBusy(false);
    if (typeof res === 'string') {
      setError(res);
      return;
    }
    setLibrary((prev) => [...prev, res.entry]);
    setError(null);
    setInfo(`أُضيفت «${res.entry.label}» إلى المكتبة — أصبحت متاحة لجميع المستخدمين`);
    setDpLabel('');
    setDpFile(null);
    if (devFileInput.current) devFileInput.current.value = '';
  };

  const removeFromLibrary = async (entry: LibraryEntry) => {
    if (
      !window.confirm(
        `حذف «${entry.label}» من مكتبة جميع المستخدمين؟ (المشاريع المحفوظة بهذه الخريطة لن تتأثر)`
      )
    )
      return;
    setDevBusy(true);
    const err = await deleteMapFromLibrary(entry.id);
    setDevBusy(false);
    if (err) {
      setError(err);
      return;
    }
    setLibrary((prev) => prev.filter((x) => x.id !== entry.id));
    setError(null);
    setInfo(`حُذفت «${entry.label}» من المكتبة — اختفت من قائمة الجميع`);
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
          {/* منطقة السحب والإفلات — متاحة لجميع المستخدمين، والملف يبقى محلياً */}
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
                · يُحلَّل في متصفحك ولا يُرفع لأي خادم · السحب والإفلات لا يُخرجك من ملء الشاشة)
              </span>
            </p>
            <button
              type="button"
              onClick={() => openPicker(fileInput.current)}
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
                هي نسخة المشروع المحفوظ في قاعدة البيانات. وقائمة «مكتبة الخرائط» مشتركة
                بين الجميع ويديرها المطور.
              </li>
            </ol>
          )}

          {/* مكتبة الخرائط المشتركة — تبدأ فارغة ويملؤها المطور */}
          <div>
            <div className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-500">
              <Library size={13} />
              مكتبة الخرائط المشتركة ({library.length})
            </div>
            {!libOk && (
              <p className="mb-2 rounded-lg border border-amber-700/40 bg-amber-950/20 px-3 py-2 text-[11px] leading-relaxed text-amber-300">
                تعذّرت القراءة من قاعدة البيانات — أعد فتح النافذة بعد استعادة الاتصال.
              </p>
            )}
            {library.length === 0 ? (
              <p className="rounded-lg border border-slate-800 bg-slate-900/30 px-3 py-3 text-center text-[12px] leading-relaxed text-slate-600">
                المكتبة فارغة حالياً.
                <br />
                {isDev
                  ? 'أضف أول خريطة من لوحة المطور أدناه — ملف GeoJSON من جهازك باسم من اختيارك.'
                  : 'استورد ملف GeoJSON من الأعلى، أو اطلب من المشرف إضافة خرائط المكتبة.'}
              </p>
            ) : (
              <div className="space-y-2">
                {library.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900/60 p-3 transition-colors hover:border-slate-600"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] font-bold text-slate-100">
                        {entry.label}
                      </div>
                      <div className="mt-0.5 text-[10.5px] text-slate-500">
                        {entry.buildings} دار · {entry.roads} طريق
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void openFromLibrary(entry)}
                      className="shrink-0 rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-1.5 text-[11px] font-bold text-slate-200 transition-colors hover:bg-slate-700 disabled:opacity-50"
                    >
                      {busy ? 'جارٍ التحميل…' : 'فتح'}
                    </button>
                    {isDev && (
                      <button
                        type="button"
                        disabled={devBusy}
                        onClick={() => void removeFromLibrary(entry)}
                        title="حذف الخريطة من مكتبة جميع المستخدمين"
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-red-950/50 hover:text-red-400 disabled:opacity-40"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* لوحة المطور: رفع ملف GeoJSON إلى المكتبة باسم من اختياره —
           * تظهر لحساب المطور فقط، والضمانة النهائية سياسات RLS */}
          {isDev && (
            <div className="rounded-xl border border-amber-700/50 bg-amber-950/20 p-4">
              <button
                type="button"
                onClick={() => setDevOpen((v) => !v)}
                aria-expanded={devOpen}
                className="flex w-full items-center gap-1.5 text-[11.5px] font-bold text-amber-300 transition-colors hover:text-amber-200"
              >
                <Wrench size={13} />
                لوحة المطور — إضافة خريطة إلى المكتبة
              </button>
              {devOpen && (
                <form
                  className="mt-3 space-y-2.5"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void uploadToLibrary();
                  }}
                >
                  <div className="text-[11px] leading-relaxed text-slate-400">
                    دلّل على ملف GeoJSON من جهازك، أعطه اسماً، واضغط استيراد —
                    يُرفع إلى قاعدة البيانات فيظهر في «مكتبة الخرائط المشتركة»
                    لجميع المستخدمين فوراً دون إعادة نشر.
                  </div>
                  <input
                    value={dpLabel}
                    onChange={(e) => setDpLabel(e.target.value)}
                    maxLength={80}
                    required
                    placeholder="اسم الخريطة (مثال: حي السلام — كربلاء)"
                    className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-[12px] text-slate-100 outline-none focus:border-amber-500"
                  />
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => openPicker(devFileInput.current)}
                      className="shrink-0 rounded-lg border border-amber-700/60 bg-amber-900/30 px-3 py-2 text-[11.5px] font-bold text-amber-300 transition-colors hover:bg-amber-900/60"
                    >
                      اختيار ملف GeoJSON
                    </button>
                    <span className="min-w-0 flex-1 truncate text-[11px] text-slate-500">
                      {dpFile ? dpFile.name : 'لم يُحدد ملف بعد'}
                    </span>
                  </div>
                  <input
                    ref={devFileInput}
                    type="file"
                    accept={ACCEPT}
                    className="hidden"
                    onChange={(e) => onPickDevFile(e.target.files)}
                  />
                  <button
                    type="submit"
                    disabled={devBusy || !dpFile}
                    className="w-full rounded-lg bg-amber-600 px-3 py-2 text-[12px] font-bold text-white transition-colors hover:bg-amber-500 disabled:opacity-50"
                  >
                    {devBusy ? 'جارٍ الاستيراد…' : 'استيراد إلى المكتبة'}
                  </button>
                </form>
              )}
            </div>
          )}

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

          {/* خرائط النظام المدمجة */}
          <div>
            <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-500">
              خرائط النظام المدمجة
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

          {/* الخرائط المستوردة (محلياً في هذا المتصفح) */}
          <div>
            <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-500">
              خرائط مستوردة ({imported.length})
            </div>
            {imported.length === 0 ? (
              <p className="rounded-lg border border-slate-800 bg-slate-900/30 px-3 py-3 text-center text-[12px] leading-relaxed text-slate-600">
                لا توجد خرائط مستوردة بعد.
                <br />
                استورد ملف GeoJSON من الأعلى أو افتح خريطة من المكتبة —
                وحين تحفظ مشروعك تُخزَّن الخريطة معه في قاعدة البيانات.
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
