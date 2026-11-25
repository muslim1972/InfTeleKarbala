import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Clock, Calendar, FileText, Building2, Save, Edit3,
  Plus, CheckCircle2, AlertCircle, Search, ShieldCheck, Sun, Sunset, Moon
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useAuth } from '../../../context/AuthContext';
import { useGovernorate } from '../../../context/GovernorateContext';
import {
  temporaryWorkHoursService,
  type TemporaryWorkHourOverride
} from '../services/temporaryWorkHoursService';
import { normalizeHHMM } from '../utils/shiftScheduleUtils';
import { getBaghdadDateStr } from '../utils/shiftRules';

export default function WorkHoursModificationTab() {
  const { user } = useAuth();
  const { activeGovernorate } = useGovernorate();
  const gov = activeGovernorate || user?.governorate || 'karbala';

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isDirector, setIsDirector] = useState(false);

  const [overrides, setOverrides] = useState<TemporaryWorkHourOverride[]>([]);
  const [issuingEntities, setIssuingEntities] = useState<string[]>([]);

  // وضع النموذج: 'new' (إنشاء جديد)، 'saved_view' (محفوظ — زر تعديل مفعّل)، 'editing' (تعديل أمر محفوظ)
  const [formMode, setFormMode] = useState<'new' | 'saved_view' | 'editing'>('new');
  const [selectedOverrideId, setSelectedOverrideId] = useState<string | null>(null);

  const [baseDefaults, setBaseDefaults] = useState({
    morningStart: '08:00',
    morningEnd: '15:00',
    eveningStart: '14:30',
    eveningEnd: '20:00',
    nightStart: '20:00',
    nightEnd: '08:00',
  });

  // حقول النموذج
  const [startDate, setStartDate] = useState(() => getBaghdadDateStr());
  const [endDate, setEndDate] = useState(() => getBaghdadDateStr());
  const [morningStart, setMorningStart] = useState('08:00');
  const [morningEnd, setMorningEnd] = useState('15:00');
  const [eveningStart, setEveningStart] = useState('14:30');
  const [eveningEnd, setEveningEnd] = useState('20:00');
  const [nightStart, setNightStart] = useState('20:00');
  const [nightEnd, setNightEnd] = useState('08:00');
  const [bookNumber, setBookNumber] = useState('');
  const [bookDate, setBookDate] = useState(() => getBaghdadDateStr());
  const [issuingEntity, setIssuingEntity] = useState('');

  // قائمة الذاكرة التلقائية للجهة المصدرة
  const [showEntityDropdown, setShowEntityDropdown] = useState(false);
  const entityContainerRef = useRef<HTMLDivElement>(null);

  const applyRecordToForm = (rec: TemporaryWorkHourOverride, mode: 'saved_view' | 'editing' = 'saved_view') => {
    setSelectedOverrideId(rec.id);
    setStartDate(rec.start_date);
    setEndDate(rec.end_date);
    setMorningStart(normalizeHHMM(rec.morning_start, baseDefaults.morningStart));
    setMorningEnd(normalizeHHMM(rec.morning_end, baseDefaults.morningEnd));
    setEveningStart(normalizeHHMM(rec.evening_start, baseDefaults.eveningStart));
    setEveningEnd(normalizeHHMM(rec.evening_end, baseDefaults.eveningEnd));
    setNightStart(normalizeHHMM(rec.night_start, baseDefaults.nightStart));
    setNightEnd(normalizeHHMM(rec.night_end, baseDefaults.nightEnd));
    setBookNumber(rec.book_number || '');
    setBookDate(rec.book_date || getBaghdadDateStr());
    setIssuingEntity(rec.issuing_entity || '');
    setFormMode(mode);
  };

  const resetToNewOrder = (defs = baseDefaults) => {
    const today = getBaghdadDateStr();
    setSelectedOverrideId(null);
    setStartDate(today);
    setEndDate(today);
    setMorningStart(defs.morningStart);
    setMorningEnd(defs.morningEnd);
    setEveningStart(defs.eveningStart);
    setEveningEnd(defs.eveningEnd);
    setNightStart(defs.nightStart);
    setNightEnd(defs.nightEnd);
    setBookNumber('');
    setBookDate(today);
    setIssuingEntity('');
    setFormMode('new');
  };

  const loadAll = async (preserveSelectedId?: string | null) => {
    setLoading(true);
    try {
      const [list, entities, defs, directorFlag] = await Promise.all([
        temporaryWorkHoursService.listOverrides(gov),
        temporaryWorkHoursService.listIssuingEntities(gov),
        temporaryWorkHoursService.getBaseShiftDefaults(),
        temporaryWorkHoursService.checkIsGovernorateDirector(gov),
      ]);

      setOverrides(list);
      setIssuingEntities(entities);
      setBaseDefaults(defs);
      setIsDirector(directorFlag);

      if (preserveSelectedId) {
        const found = list.find((o) => o.id === preserveSelectedId);
        if (found) {
          applyRecordToForm(found, 'saved_view');
          return;
        }
      }

      // إذا وُجد أمر حالي ساري أو معلق حديث، نعرضه في وضع القراءة لتمكين زر «تعديل» مباشرة
      const today = getBaghdadDateStr();
      const activeOrLatest =
        list.find((o) => o.status === 'approved' && o.start_date <= today && o.end_date >= today) ||
        list.find((o) => o.status === 'pending_director') ||
        list[0];

      if (activeOrLatest) {
        applyRecordToForm(activeOrLatest, 'saved_view');
      } else {
        resetToNewOrder(defs);
      }
    } catch (err: any) {
      toast.error('فشل تحميل بيانات تعديل ساعات الدوام: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, [gov]);

  // إغلاق قائمة الذاكرة عند النقر خارج الحقل
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (entityContainerRef.current && !entityContainerRef.current.contains(e.target as Node)) {
        setShowEntityDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // فلترة الجهات من أول حرف
  const filteredEntities = useMemo(() => {
    const q = issuingEntity.trim().toLowerCase();
    if (!q) return issuingEntities;
    // يعرض الجهات التي تبدأ بالحروف أولاً ثم التي تحتويها
    const startsWith = issuingEntities.filter((item) => item.toLowerCase().startsWith(q));
    const contains = issuingEntities.filter(
      (item) => !item.toLowerCase().startsWith(q) && item.toLowerCase().includes(q)
    );
    return [...startsWith, ...contains];
  }, [issuingEntity, issuingEntities]);

  const selectedRecord = useMemo(
    () => overrides.find((o) => o.id === selectedOverrideId) || null,
    [overrides, selectedOverrideId]
  );

  const isInputsReadOnly = formMode === 'saved_view';
  const canEditSelected = formMode === 'saved_view' && Boolean(selectedOverrideId);
  const canSave = formMode === 'new' || formMode === 'editing';

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSave) return;

    if (!startDate || !endDate) {
      toast.error('يرجى تحديد تاريخ من وتاريخ إلى');
      return;
    }
    if (endDate < startDate) {
      toast.error('تاريخ غاية التأثير (إلى) يجب أن يكون مساوياً أو بعد تاريخ البداية');
      return;
    }
    if (!bookNumber.trim()) {
      toast.error('يرجى إدخال رقم الكتاب');
      return;
    }
    if (!bookDate) {
      toast.error('يرجى تحديد تاريخ الكتاب');
      return;
    }
    if (!issuingEntity.trim()) {
      toast.error('يرجى إدخال الجهة المصدرة للكتاب');
      return;
    }

    setSaving(true);
    try {
      const res = await temporaryWorkHoursService.saveOverride({
        overrideId: formMode === 'editing' ? selectedOverrideId : null,
        governorate: gov,
        startDate,
        endDate,
        morningStart,
        morningEnd,
        eveningStart,
        eveningEnd,
        nightStart,
        nightEnd,
        bookNumber: bookNumber.trim(),
        bookDate,
        issuingEntity: issuingEntity.trim(),
      });

      toast.success(res.message);
      await loadAll(res.id);
    } catch (err: any) {
      toast.error(err.message || 'حدث خطأ أثناء حفظ تعديل ساعات الدوام');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3">
        <div className="w-9 h-9 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-xs font-bold text-slate-500">جاري تحميل إعدادات تعديل ساعات الدوام...</span>
      </div>
    );
  }

  const todayStr = getBaghdadDateStr();

  return (
    <div className="space-y-4 animate-in fade-in duration-200 pb-2">
      {/* شريط العنوان والحالة + زر أمر جديد */}
      <div className="bg-white/95 dark:bg-slate-800/95 rounded-2xl border border-slate-200/90 dark:border-slate-700 p-3.5 sm:p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-sm shrink-0">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-black text-slate-800 dark:text-white flex items-center gap-2 flex-wrap">
              <span>تعديل ساعات الدوام المؤقتة</span>
              {selectedRecord && formMode !== 'new' && (
                <span
                  className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
                    selectedRecord.pending_revision
                      ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700'
                      : selectedRecord.status === 'approved'
                        ? selectedRecord.end_date < todayStr
                          ? 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600'
                          : 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-700'
                        : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700'
                  }`}
                >
                  {selectedRecord.pending_revision
                    ? 'السابق سارٍ • التعديل بانتظار موافقة مدير المديرية'
                    : selectedRecord.status === 'approved'
                      ? selectedRecord.end_date < todayStr
                        ? 'منتهي الصلاحية'
                        : selectedRecord.start_date > todayStr
                          ? 'معتمد (مجدول مستقبلاً)'
                          : 'معتمد وساري المفعول'
                      : 'بانتظار موافقة السيد مدير المديرية'}
                </span>
              )}
            </h2>
            <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              {isDirector ? (
                <span>حساب السيد مدير المديرية: يُنفذ التعديل فورياً دون إشعار اعتماد.</span>
              ) : (
                <span>عند الحفظ أو التعديل ينطلق إشعار اعتماد فوري إلى السيد مدير المديرية قبل التنفيذ.</span>
              )}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => resetToNewOrder()}
          className="flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 text-xs font-bold transition-all active:scale-95 shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>أمر تعديل جديد</span>
        </button>
      </div>

      {/* تنبيه في حال وجود تعديل معلق على هذا الأمر */}
      {selectedRecord?.pending_revision && formMode !== 'new' && (
        <div className="bg-amber-50/90 dark:bg-amber-950/30 border border-amber-300/80 dark:border-amber-700/70 rounded-2xl p-3 flex items-start gap-2.5 text-xs text-amber-900 dark:text-amber-200">
          <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <p className="font-bold">
              يوجد تعديل مقترح بانتظار موافقة السيد مدير المديرية (الفترة الجديدة: من {selectedRecord.pending_revision.start_date} إلى {selectedRecord.pending_revision.end_date} — كتاب {selectedRecord.pending_revision.book_number}).
            </p>
            <p className="text-[11px] opacity-80">يستمر العمل بالأمر المعتمد الحالي لحين موافقة المدير العام.</p>
          </div>
        </div>
      )}

      {/* النموذج الرئيسي */}
      <form onSubmit={handleSave} className="space-y-3.5">
        {/* 1. فترة تأثير التعديل */}
        <div className="bg-white/95 dark:bg-slate-800/95 rounded-2xl border border-slate-200 dark:border-slate-700 p-3.5 sm:p-4 shadow-xs space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700/80 pb-2">
            <span className="text-xs sm:text-sm font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              فترة تأثير التعديل (مؤقت)
            </span>
            <span className="text-[10px] sm:text-[11px] font-semibold text-slate-500 dark:text-slate-400">
              قبل وبعد هذه الفترة يعتمد النظام على جداول العمل الأصلية
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                تاريخ من
              </label>
              <input
                type="date"
                value={startDate}
                disabled={isInputsReadOnly}
                onChange={(e) => setStartDate(e.target.value)}
                required
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50/70 dark:bg-slate-900 text-slate-900 dark:text-white text-xs sm:text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-70"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                تاريخ إلى (غاية التأثير)
              </label>
              <input
                type="date"
                value={endDate}
                disabled={isInputsReadOnly}
                min={startDate}
                onChange={(e) => setEndDate(e.target.value)}
                required
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50/70 dark:bg-slate-900 text-slate-900 dark:text-white text-xs sm:text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-70"
              />
            </div>
          </div>
        </div>

        {/* 2. المجاميع الثلاث للدوامات (صباحي / مسائي / خفر) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* أ. الدوام الصباحي */}
          <div className="bg-gradient-to-br from-blue-50/80 to-white dark:from-blue-950/30 dark:to-slate-800/95 rounded-2xl border border-blue-200/80 dark:border-blue-800/60 p-3.5 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs sm:text-sm font-black text-blue-900 dark:text-blue-200 flex items-center gap-1.5">
                <Sun className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                الصباحي
              </span>
              <span className="text-[10px] font-bold text-blue-600/80 dark:text-blue-300/70 bg-blue-100/70 dark:bg-blue-900/40 px-2 py-0.5 rounded-full">
                الأصل: {baseDefaults.morningStart} - {baseDefaults.morningEnd}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 block">بداية الدوام</label>
                <input
                  type="time"
                  value={morningStart}
                  disabled={isInputsReadOnly}
                  onChange={(e) => setMorningStart(e.target.value)}
                  required
                  dir="ltr"
                  className="w-full px-2.5 py-2 rounded-xl border border-blue-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs sm:text-sm font-black text-center outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-70"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 block">نهاية الدوام</label>
                <input
                  type="time"
                  value={morningEnd}
                  disabled={isInputsReadOnly}
                  onChange={(e) => setMorningEnd(e.target.value)}
                  required
                  dir="ltr"
                  className="w-full px-2.5 py-2 rounded-xl border border-blue-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs sm:text-sm font-black text-center outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-70"
                />
              </div>
            </div>
          </div>

          {/* ب. الدوام المسائي */}
          <div className="bg-gradient-to-br from-amber-50/80 to-white dark:from-amber-950/25 dark:to-slate-800/95 rounded-2xl border border-amber-200/80 dark:border-amber-800/60 p-3.5 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs sm:text-sm font-black text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                <Sunset className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                المسائي
              </span>
              <span className="text-[10px] font-bold text-amber-700/80 dark:text-amber-300/70 bg-amber-100/70 dark:bg-amber-900/40 px-2 py-0.5 rounded-full">
                الأصل: {baseDefaults.eveningStart} - {baseDefaults.eveningEnd}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 block">بداية الدوام</label>
                <input
                  type="time"
                  value={eveningStart}
                  disabled={isInputsReadOnly}
                  onChange={(e) => setEveningStart(e.target.value)}
                  required
                  dir="ltr"
                  className="w-full px-2.5 py-2 rounded-xl border border-amber-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs sm:text-sm font-black text-center outline-none focus:ring-2 focus:ring-amber-500 disabled:opacity-70"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 block">نهاية الدوام</label>
                <input
                  type="time"
                  value={eveningEnd}
                  disabled={isInputsReadOnly}
                  onChange={(e) => setEveningEnd(e.target.value)}
                  required
                  dir="ltr"
                  className="w-full px-2.5 py-2 rounded-xl border border-amber-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs sm:text-sm font-black text-center outline-none focus:ring-2 focus:ring-amber-500 disabled:opacity-70"
                />
              </div>
            </div>
          </div>

          {/* ج. دوام الخفر */}
          <div className="bg-gradient-to-br from-indigo-50/80 to-white dark:from-indigo-950/30 dark:to-slate-800/95 rounded-2xl border border-indigo-200/80 dark:border-indigo-800/60 p-3.5 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs sm:text-sm font-black text-indigo-900 dark:text-indigo-200 flex items-center gap-1.5">
                <Moon className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                الخفر
              </span>
              <span className="text-[10px] font-bold text-indigo-700/80 dark:text-indigo-300/70 bg-indigo-100/70 dark:bg-indigo-900/40 px-2 py-0.5 rounded-full">
                الأصل: {baseDefaults.nightStart} - {baseDefaults.nightEnd}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 block">بداية الدوام</label>
                <input
                  type="time"
                  value={nightStart}
                  disabled={isInputsReadOnly}
                  onChange={(e) => setNightStart(e.target.value)}
                  required
                  dir="ltr"
                  className="w-full px-2.5 py-2 rounded-xl border border-indigo-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs sm:text-sm font-black text-center outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-70"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 block">نهاية الدوام</label>
                <input
                  type="time"
                  value={nightEnd}
                  disabled={isInputsReadOnly}
                  onChange={(e) => setNightEnd(e.target.value)}
                  required
                  dir="ltr"
                  className="w-full px-2.5 py-2 rounded-xl border border-indigo-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs sm:text-sm font-black text-center outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-70"
                />
              </div>
            </div>
          </div>
        </div>

        {/* 3. تفاصيل الكتاب الرسمي والجهة المصدرة (ذات ذاكرة) */}
        <div className="bg-white/95 dark:bg-slate-800/95 rounded-2xl border border-slate-200 dark:border-slate-700 p-3.5 sm:p-4 shadow-xs space-y-3">
          <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-700/80 pb-2">
            <FileText className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span className="text-xs sm:text-sm font-black text-slate-800 dark:text-slate-100">
              السند الإداري والكتاب الرسمي
            </span>
          </div>

          {/* السطر الأول: حسب الكتاب المرقم + رقم الكتاب + بتاريخ + تاريخ الكتاب */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 whitespace-nowrap shrink-0">
                حسب الكتاب المرقم
              </label>
              <input
                type="text"
                value={bookNumber}
                disabled={isInputsReadOnly}
                onChange={(e) => setBookNumber(e.target.value)}
                placeholder="أدخل رقم الكتاب..."
                required
                className="flex-1 min-w-0 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50/70 dark:bg-slate-900 text-slate-900 dark:text-white text-xs sm:text-sm font-bold outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-70"
              />
            </div>

            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 whitespace-nowrap shrink-0">
                بتاريخ
              </label>
              <input
                type="date"
                value={bookDate}
                disabled={isInputsReadOnly}
                onChange={(e) => setBookDate(e.target.value)}
                required
                className="flex-1 min-w-0 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50/70 dark:bg-slate-900 text-slate-900 dark:text-white text-xs sm:text-sm font-bold outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-70"
              />
            </div>
          </div>

          {/* السطر الثاني: الصادر من + حقل كتابة الجهة المصدرة ذو الذاكرة */}
          <div ref={entityContainerRef} className="relative flex items-center gap-2">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 whitespace-nowrap shrink-0 flex items-center gap-1">
              <Building2 className="w-3.5 h-3.5 text-slate-500" />
              <span>الصادر من</span>
            </label>
            <div className="relative flex-1 min-w-0">
              <input
                type="text"
                value={issuingEntity}
                disabled={isInputsReadOnly}
                onFocus={() => {
                  if (!isInputsReadOnly && issuingEntities.length > 0) {
                    setShowEntityDropdown(true);
                  }
                }}
                onChange={(e) => {
                  setIssuingEntity(e.target.value);
                  if (!isInputsReadOnly) setShowEntityDropdown(true);
                }}
                placeholder="اكتب الجهة المصدرة للكتاب (مثال: الأمانة العامة لمجلس الوزراء، مكتب السيد المحافظ...)"
                required
                autoComplete="off"
                className="w-full px-3 py-2 pl-8 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50/70 dark:bg-slate-900 text-slate-900 dark:text-white text-xs sm:text-sm font-bold outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-70"
              />
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />

              {/* قائمة الفلترة الفورية من الذاكرة */}
              {showEntityDropdown && !isInputsReadOnly && filteredEntities.length > 0 && (
                <div className="absolute z-40 right-0 left-0 mt-1 max-h-48 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredEntities.map((entity) => (
                    <button
                      key={entity}
                      type="button"
                      onClick={() => {
                        setIssuingEntity(entity);
                        setShowEntityDropdown(false);
                      }}
                      className="w-full text-right px-3 py-2 text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-200 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors flex items-center justify-between cursor-pointer"
                    >
                      <span>{entity}</span>
                      <span className="text-[10px] text-slate-400">محفوظة</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 4. زرا الحفظ والتعديل في النهاية */}
        <div className="flex items-center gap-2.5 pt-1">
          <button
            type="submit"
            disabled={!canSave || saving}
            className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold text-xs sm:text-sm shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 transition-all active:scale-98 disabled:opacity-45 disabled:cursor-not-allowed cursor-pointer"
          >
            {saving ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            <span>{formMode === 'editing' ? 'حفظ التعديلات' : 'حفظ'}</span>
          </button>

          <button
            type="button"
            disabled={!canEditSelected || saving}
            onClick={() => setFormMode('editing')}
            className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold text-xs sm:text-sm shadow-md shadow-amber-500/20 flex items-center justify-center gap-2 transition-all active:scale-98 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            title={canEditSelected ? 'تعديل الأمر المحفوظ وتغيير تاريخ غاية التأثير' : 'يتفعّل بعد حفظ الأمر'}
          >
            <Edit3 className="w-4 h-4" />
            <span>تعديل</span>
          </button>

          {formMode === 'editing' && selectedRecord && (
            <button
              type="button"
              onClick={() => applyRecordToForm(selectedRecord, 'saved_view')}
              className="py-2.5 px-3.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-bold text-xs sm:text-sm transition-colors cursor-pointer"
            >
              إلغاء
            </button>
          )}
        </div>
      </form>

      {/* سجل الأوامر المحفوظة للرجوع إليها وتقليص أو تعديل غاية التأثير */}
      {overrides.length > 0 && (
        <div className="bg-white/90 dark:bg-slate-800/90 rounded-2xl border border-slate-200 dark:border-slate-700 p-3.5 shadow-xs space-y-2.5">
          <div className="flex items-center justify-between">
            <h3 className="text-xs sm:text-sm font-black text-slate-700 dark:text-slate-200">
              سجل أوامر تعديل ساعات الدوام ({overrides.length})
            </h3>
            <span className="text-[10px] text-slate-400">انقر على أي أمر لعرضه أو الضغط على «تعديل»</span>
          </div>

          <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar pr-0.5">
            {overrides.map((item) => {
              const isSelected = item.id === selectedOverrideId && formMode !== 'new';
              const isCurrent = item.status === 'approved' && item.start_date <= todayStr && item.end_date >= todayStr;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => applyRecordToForm(item, 'saved_view')}
                  className={`w-full text-right p-2.5 sm:p-3 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-2 cursor-pointer ${
                    isSelected
                      ? 'bg-blue-50/90 dark:bg-blue-950/40 border-blue-400 dark:border-blue-600 ring-1 ring-blue-400/50'
                      : 'bg-slate-50/70 dark:bg-slate-900/50 border-slate-200/80 dark:border-slate-700 hover:bg-slate-100/70 dark:hover:bg-slate-800'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-black text-slate-800 dark:text-white">
                        من {item.start_date} إلى {item.end_date}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          item.status === 'pending_director'
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
                            : isCurrent
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                              : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                        }`}
                      >
                        {item.status === 'pending_director'
                          ? 'بانتظار موافقة مدير المديرية'
                          : isCurrent
                            ? 'ساري المفعول'
                            : item.start_date > todayStr
                              ? 'مجدول مستقبلاً'
                              : 'منتهي'}
                      </span>
                      {item.pending_revision && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300">
                          طلب تعديل معلق
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400 font-medium">
                      الكتاب المرقم ({item.book_number}) بتاريخ ({item.book_date}) — الصادر من: {item.issuing_entity}
                    </p>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400" dir="ltr" style={{ textAlign: 'right' }}>
                      صباحي: {normalizeHHMM(item.morning_start)}-{normalizeHHMM(item.morning_end)} | مسائي: {normalizeHHMM(item.evening_start)}-{normalizeHHMM(item.evening_end)} | خفر: {normalizeHHMM(item.night_start)}-{normalizeHHMM(item.night_end)}
                    </p>
                  </div>

                  {isSelected && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 dark:text-blue-400 shrink-0">
                      <CheckCircle2 className="w-4 h-4" />
                      محدد
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
