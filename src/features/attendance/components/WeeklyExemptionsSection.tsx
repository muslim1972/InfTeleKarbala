import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../../../lib/supabase';
import { useGovernorate } from '../../../context/GovernorateContext';
import { EmployeeSearch } from '../../../components/shared/EmployeeSearch';
import { 
  FileText, 
  Check, 
  Trash2, 
  Edit3, 
  Calendar, 
  Clock, 
  X, 
  ShieldCheck, 
  User,
  ArrowUpDown
} from 'lucide-react';
import { toast } from 'react-hot-toast';

interface WeeklyExemptionRecord {
  id: string;
  employee_id: string;
  governorate: string;
  day_of_week: number;
  order_number: string;
  order_date: string;
  valid_until: string;
  notes?: string | null;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
  employee?: {
    id: string;
    full_name: string;
    job_number?: string;
    department_id?: string;
    departments?: { name: string };
  };
  creator?: {
    id: string;
    full_name: string;
  };
}

const DAYS_OF_WEEK = [
  { index: 0, name: 'الأحد', short: 'أحد' },
  { index: 1, name: 'الإثنين', short: 'إثنين' },
  { index: 2, name: 'الثلاثاء', short: 'ثلاثاء' },
  { index: 3, name: 'الأربعاء', short: 'أربعاء' },
  { index: 4, name: 'الخميس', short: 'خميس' },
  { index: 5, name: 'الجمعة', short: 'جمعة' },
  { index: 6, name: 'السبت', short: 'سبت' },
];

export default function WeeklyExemptionsSection() {
  const { activeGovernorate } = useGovernorate();

  // Form State
  const [selectedEmployee, setSelectedEmployee] = useState<any>(null);
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [orderNumber, setOrderNumber] = useState('');
  const [orderDate, setOrderDate] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingExemptionId, setEditingExemptionId] = useState<string | null>(null);

  // Data State
  const [exemptions, setExemptions] = useState<WeeklyExemptionRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal State for Inspection
  const [inspectExemption, setInspectExemption] = useState<WeeklyExemptionRecord | null>(null);

  // Keyboard navigation focus index for the 4-item list
  const [focusedRowIndex, setFocusedRowIndex] = useState<number>(0);
  const listRef = useRef<HTMLDivElement>(null);

  // ── 1. Load Exemptions ───────────────────────────────────────────────────────
  const loadExemptions = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('employee_weekly_exemptions')
        .select(`
          *,
          employee:profiles!employee_weekly_exemptions_employee_id_fkey(
            id, full_name, job_number, department_id,
            departments:departments!profiles_department_id_fkey(name)
          ),
          creator:profiles!employee_weekly_exemptions_created_by_fkey(
            id, full_name
          )
        `)
        .order('created_at', { ascending: false });

      if (activeGovernorate && activeGovernorate !== 'all') {
        query = query.eq('governorate', activeGovernorate);
      }

      const { data, error } = await query;
      if (error) throw error;
      setExemptions((data as any) || []);
    } catch (err: any) {
      toast.error('فشل تحميل قائمة التفرغ: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [activeGovernorate]);

  useEffect(() => {
    loadExemptions();
  }, [loadExemptions]);

  // ── 2. Day Toggle ───────────────────────────────────────────────────────────
  const toggleDay = (dayIndex: number) => {
    setSelectedDays(prev => 
      prev.includes(dayIndex) 
        ? prev.filter(d => d !== dayIndex) 
        : [...prev, dayIndex].sort((a, b) => a - b)
    );
  };

  // ── 3. Submit Handler (All fields mandatory) ─────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedEmployee?.id) {
      toast.error('يرجى تحديد الموظف أولاً');
      return;
    }
    if (selectedDays.length === 0) {
      toast.error('يرجى تحديد يوم التفرغ من الأسبوع على الأقل');
      return;
    }
    if (!orderNumber.trim()) {
      toast.error('يرجى إدخال رقم الأمر الإداري');
      return;
    }
    if (!orderDate) {
      toast.error('يرجى إدخال تاريخ صدور الأمر الإداري');
      return;
    }
    if (!validUntil) {
      toast.error('يرجى إدخال تاريخ نهاية نفاذ أمر التفرغ (ساري المفعول لغاية)');
      return;
    }

    if (new Date(validUntil) < new Date(orderDate)) {
      toast.error('تاريخ نهاية السريان لا يمكن أن يكون قبل تاريخ الأمر');
      return;
    }

    setIsSubmitting(true);
    try {
      const gov = activeGovernorate && activeGovernorate !== 'all' 
        ? activeGovernorate 
        : (selectedEmployee.governorate || 'karbala');

      const { data, error } = await supabase.rpc('save_employee_weekly_exemption', {
        p_employee_id: selectedEmployee.id,
        p_governorate: gov,
        p_days: selectedDays,
        p_order_number: orderNumber.trim(),
        p_order_date: orderDate,
        p_valid_until: validUntil,
        p_notes: notes.trim() || null
      });

      if (error) throw error;
      toast.success(data?.message || 'تم تسجيل وتثبيت أمر التفرغ بنجاح');

      // Reset form
      setSelectedEmployee(null);
      setSelectedDays([]);
      setOrderNumber('');
      setOrderDate('');
      setValidUntil('');
      setNotes('');
      setEditingExemptionId(null);
      loadExemptions();
    } catch (err: any) {
      toast.error('حدث خطأ أثناء الحفظ: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── 4. Edit Action ──────────────────────────────────────────────────────────
  const handleEdit = (rec: WeeklyExemptionRecord) => {
    setEditingExemptionId(rec.id);
    setSelectedEmployee(rec.employee || { id: rec.employee_id, full_name: 'موظف' });
    setSelectedDays([rec.day_of_week]);
    setOrderNumber(rec.order_number);
    setOrderDate(rec.order_date);
    setValidUntil(rec.valid_until);
    setNotes(rec.notes || '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // ── 5. Delete Action ────────────────────────────────────────────────────────
  const handleDelete = async (id: string, empName: string, dayName: string) => {
    if (!window.confirm(`هل أنت متأكد من حذف تفرغ (${empName}) ليوم (${dayName})؟`)) {
      return;
    }
    try {
      const { data, error } = await supabase.rpc('remove_employee_weekly_exemption', {
        p_exemption_id: id
      });

      if (error) throw error;
      toast.success(data?.message || 'تم حذف أمر التفرغ بنجاح');
      if (editingExemptionId === id) {
        setEditingExemptionId(null);
        setSelectedEmployee(null);
        setSelectedDays([]);
        setOrderNumber('');
        setOrderDate('');
        setValidUntil('');
      }
      loadExemptions();
    } catch (err: any) {
      toast.error('فشل الحذف: ' + err.message);
    }
  };

  // ── 6. Keyboard navigation for the 4-item list ──────────────────────────────
  const handleListKeyDown = (e: React.KeyboardEvent) => {
    if (exemptions.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusedRowIndex(prev => Math.min(prev + 1, exemptions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusedRowIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const current = exemptions[focusedRowIndex];
      if (current) setInspectExemption(current);
    }
  };

  const getDayName = (dow: number) => {
    return DAYS_OF_WEEK.find(d => d.index === dow)?.name || `يوم ${dow}`;
  };

  const isExpired = (dateStr: string) => {
    const today = new Date().toISOString().split('T')[0];
    return dateStr < today;
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* ── Form Card ── */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/90 dark:border-slate-700/80 p-5 sm:p-6 shadow-xs">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-3 mb-5">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {editingExemptionId ? 'تعديل أمر تفرغ أسبوعي' : 'تسجيل أمر تفرغ جديد للموظف'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                إعفاء الموظف من البصمة في يوم أو أكثر أسبوعياً استناداً لأمر إداري رسمي محدد الصلاحية
              </p>
            </div>
          </div>
          {editingExemptionId && (
            <button
              type="button"
              onClick={() => {
                setEditingExemptionId(null);
                setSelectedEmployee(null);
                setSelectedDays([]);
                setOrderNumber('');
                setOrderDate('');
                setValidUntil('');
                setNotes('');
              }}
              className="text-xs px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
            >
              إلغاء التعديل
            </button>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Row 1: Employee Selection via Global EmployeeSearch */}
          <div className="space-y-1.5">
            <label className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1">
              <span>الموظف المعني بالتفرغ</span>
              <span className="text-rose-500 font-extrabold">*</span>
              {selectedEmployee && (
                <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 mr-2">
                  (تم اختيار: {selectedEmployee.full_name})
                </span>
              )}
            </label>
            <EmployeeSearch
              onSelect={(emp) => setSelectedEmployee(emp)}
              placeholder="ابحث بالاسم أو الرقم الوظيفي لاختيار الموظف..."
              governorate={activeGovernorate && activeGovernorate !== 'all' ? activeGovernorate : undefined}
              className="w-full"
            />
          </div>

          {/* Row 2: Day of Week Selection (Pills) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                <span>تحديد يوم التفرغ من كل أسبوع</span>
                <span className="text-rose-500 font-extrabold">*</span>
              </label>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                يمكن تحديد يوم واحد أو يومين حسب كتاب التفرغ
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
              {DAYS_OF_WEEK.map((day) => {
                const isSelected = selectedDays.includes(day.index);
                const isWeekend = day.index === 5 || day.index === 6;
                return (
                  <button
                    key={day.index}
                    type="button"
                    onClick={() => toggleDay(day.index)}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                      isSelected
                        ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                        : isWeekend
                        ? 'bg-slate-50 dark:bg-slate-900/40 text-slate-400 border-slate-200 dark:border-slate-800'
                        : 'bg-white dark:bg-slate-700/60 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-600 hover:border-blue-400'
                    }`}
                  >
                    {isSelected && <Check className="w-3.5 h-3.5" />}
                    <span>{day.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Row 3: Order Details (رقم الأمر، تاريخ الأمر، ساري لغاية) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                <span>رقم الأمر الإداري</span>
                <span className="text-rose-500 font-extrabold">*</span>
              </label>
              <input
                type="text"
                value={orderNumber}
                onChange={(e) => setOrderNumber(e.target.value)}
                placeholder="مثال: 1245 / إدارية"
                required
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-xs sm:text-sm font-medium focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                <span>تاريخ الأمر</span>
                <span className="text-rose-500 font-extrabold">*</span>
              </label>
              <input
                type="date"
                value={orderDate}
                onChange={(e) => setOrderDate(e.target.value)}
                required
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-xs sm:text-sm font-medium focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                <span>ساري المفعول لغاية</span>
                <span className="text-rose-500 font-extrabold">*</span>
              </label>
              <input
                type="date"
                value={validUntil}
                onChange={(e) => setValidUntil(e.target.value)}
                required
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-xs sm:text-sm font-medium focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
              />
            </div>
          </div>

          {/* Row 4: Notes */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-800 dark:text-slate-200">
              ملاحظات الغرض من التفرغ (اختياري)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="مثال: تفرغ دراسي (ماجستير هندسة اتصالات)، تفرغ نقابي، عضوية لجنة خارجية..."
              className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-xs sm:text-sm font-medium focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
            />
          </div>

          {/* Submit Button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 px-5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs sm:text-sm transition-all shadow-md shadow-blue-600/20 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <ShieldCheck className="w-4 h-4" />
              {isSubmitting ? 'جاري الحفظ...' : (editingExemptionId ? 'حفظ التعديلات' : 'موافقة وحفظ أمر التفرغ')}
            </button>
          </div>
        </form>
      </div>

      {/* ── 4-Item Constrained List Container ── */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/90 dark:border-slate-700/80 p-5 space-y-3 shadow-xs">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-2.5">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-blue-600" />
            <h4 className="text-sm font-bold text-slate-900 dark:text-white">
              قائمة الموظفين المفرغين المعتمدة ({exemptions.length})
            </h4>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <ArrowUpDown className="w-3.5 h-3.5" />
            <span>يمكن استخدام أسهم الكيبورد وعجلة الماوس للتنقل</span>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-8 text-xs text-slate-500">جاري تحميل سجلات التفرغ...</div>
        ) : exemptions.length === 0 ? (
          <div className="text-center py-8 text-xs text-slate-500 dark:text-slate-400 font-medium bg-slate-50 dark:bg-slate-900/30 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
            لا توجد أي أوامر تفرغ مسجلة حالياً في هذه المحافظة.
          </div>
        ) : (
          /* Exactly max 4 rows visible in height (~290px), keyboard-navigable */
          <div 
            ref={listRef}
            tabIndex={0}
            onKeyDown={handleListKeyDown}
            className="max-h-[290px] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700/70 rounded-xl border border-slate-100 dark:border-slate-700 focus:outline-hidden focus:ring-1 focus:ring-blue-500/40"
          >
            {exemptions.map((rec, index) => {
              const expired = isExpired(rec.valid_until);
              const isFocused = index === focusedRowIndex;
              const empName = rec.employee?.full_name || 'موظف';
              const dayName = getDayName(rec.day_of_week);

              return (
                <div
                  key={rec.id}
                  onClick={() => {
                    setFocusedRowIndex(index);
                    setInspectExemption(rec);
                  }}
                  className={`p-3 transition-colors flex items-center justify-between gap-3 cursor-pointer ${
                    isFocused 
                      ? 'bg-blue-50/70 dark:bg-blue-950/40' 
                      : 'hover:bg-slate-50 dark:hover:bg-slate-700/40'
                  }`}
                >
                  {/* Left Info: Name & Day */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 flex items-center justify-center font-bold text-xs shrink-0">
                      {index + 1}
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white truncate hover:underline">
                        {empName}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                        <span className="font-bold text-blue-600 dark:text-blue-400">
                          {dayName}
                        </span>
                        <span>•</span>
                        <span>أمر رقم: {rec.order_number}</span>
                        <span>•</span>
                        <span>بتاريخ: {rec.order_date}</span>
                      </div>
                    </div>
                  </div>

                  {/* Right Status & Actions */}
                  <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      expired 
                        ? 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400' 
                        : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                    }`}>
                      {expired ? 'منتهي السريان' : `سارٍ لغاية ${rec.valid_until}`}
                    </span>

                    <button
                      type="button"
                      onClick={() => handleEdit(rec)}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors"
                      title="تعديل هذا الأمر"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDelete(rec.id, empName, dayName)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                      title="حذف هذا التفرغ"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Floating Modal for Inspection (واجهة عائمة قابلة للإغلاق بـ X أو النقر خارجها) ── */}
      {inspectExemption && (
        <div 
          onClick={() => setInspectExemption(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-slate-800 rounded-2xl max-w-md w-full border border-slate-200 dark:border-slate-700 shadow-2xl p-5 sm:p-6 space-y-4 text-right animate-in zoom-in-95 duration-150"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-blue-600" />
                <h4 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white">
                  تفاصيل أمر التفرغ الإداري
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setInspectExemption(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="space-y-2.5 text-xs sm:text-[13px] bg-slate-50 dark:bg-slate-750 p-4 rounded-xl border border-slate-200/80 dark:border-slate-700 font-medium">
              <div className="flex justify-between items-center">
                <span className="text-slate-500 dark:text-slate-400">اسم الموظف:</span>
                <span className="font-bold text-slate-900 dark:text-white">
                  {inspectExemption.employee?.full_name || 'غير معروف'}
                </span>
              </div>

              {inspectExemption.employee?.departments?.name && (
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 dark:text-slate-400">القسم / التشكيل:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {inspectExemption.employee.departments.name}
                  </span>
                </div>
              )}

              <div className="flex justify-between items-center">
                <span className="text-slate-500 dark:text-slate-400">يوم التفرغ الأسبوعي:</span>
                <span className="font-bold text-blue-600 dark:text-blue-400">
                  {getDayName(inspectExemption.day_of_week)} من كل أسبوع
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-slate-500 dark:text-slate-400">رقم الأمر الإداري:</span>
                <span className="font-bold font-mono text-slate-900 dark:text-white">
                  {inspectExemption.order_number}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-slate-500 dark:text-slate-400">تاريخ صدور الأمر:</span>
                <span className="font-mono text-slate-800 dark:text-slate-200">
                  {inspectExemption.order_date}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-slate-500 dark:text-slate-400">ساري المفعول لغاية:</span>
                <span className={`font-mono font-bold ${
                  isExpired(inspectExemption.valid_until) 
                    ? 'text-rose-600 dark:text-rose-400' 
                    : 'text-emerald-600 dark:text-emerald-400'
                }`}>
                  {inspectExemption.valid_until}
                </span>
              </div>

              {inspectExemption.notes && (
                <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
                  <span className="text-slate-500 dark:text-slate-400 block mb-0.5">الغرض والملاحظات:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {inspectExemption.notes}
                  </span>
                </div>
              )}

              {/* Audit tracking info */}
              <div className="pt-2.5 border-t border-slate-200 dark:border-slate-700 text-[11px] text-slate-500 dark:text-slate-400 space-y-0.5">
                <div className="flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                  <span>
                    أُدخل بواسطة المشرف: <strong className="text-slate-700 dark:text-slate-300 font-bold">{inspectExemption.creator?.full_name || 'مشرف النظام'}</strong>
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span>
                    تاريخ الإدخال: {new Date(inspectExemption.created_at).toLocaleString('ar-IQ')}
                  </span>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  handleEdit(inspectExemption);
                  setInspectExemption(null);
                }}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition-colors flex items-center gap-1.5"
              >
                <Edit3 className="w-3.5 h-3.5" />
                تعديل هذا الأمر
              </button>
              <button
                type="button"
                onClick={() => setInspectExemption(null)}
                className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 font-bold text-xs transition-colors"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
