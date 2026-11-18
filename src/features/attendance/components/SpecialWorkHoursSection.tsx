import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../../../lib/supabase';
import { useGovernorate } from '../../../context/GovernorateContext';
import { EmployeeSearch } from '../../../components/shared/EmployeeSearch';
import { 
  Clock, 
  Trash2, 
  Edit3, 
  X, 
  Save, 
  Copy, 
  Sparkles, 
  AlertTriangle,
  ArrowUpDown
} from 'lucide-react';
import { toast } from 'react-hot-toast';

interface DayScheduleRow {
  day_of_week: number;
  day_name: string;
  is_rest_day: boolean;
  start_time: string;
  end_time: string;
}

const DEFAULT_DAYS: DayScheduleRow[] = [
  { day_of_week: 0, day_name: 'الأحد', is_rest_day: false, start_time: '08:00', end_time: '15:00' },
  { day_of_week: 1, day_name: 'الإثنين', is_rest_day: false, start_time: '08:00', end_time: '15:00' },
  { day_of_week: 2, day_name: 'الثلاثاء', is_rest_day: false, start_time: '08:00', end_time: '15:00' },
  { day_of_week: 3, day_name: 'الأربعاء', is_rest_day: false, start_time: '08:00', end_time: '15:00' },
  { day_of_week: 4, day_name: 'الخميس', is_rest_day: false, start_time: '08:00', end_time: '15:00' },
  { day_of_week: 5, day_name: 'الجمعة', is_rest_day: true, start_time: '', end_time: '' },
  { day_of_week: 6, day_name: 'السبت', is_rest_day: true, start_time: '', end_time: '' },
];

export default function SpecialWorkHoursSection() {
  const { activeGovernorate } = useGovernorate();

  // State
  const [selectedEmployee, setSelectedEmployee] = useState<any>(null);
  const [days, setDays] = useState<DayScheduleRow[]>(DEFAULT_DAYS);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Pre-check Modal State
  const [showPrecheckModal, setShowPrecheckModal] = useState(false);
  const [existingSpecialSchedule, setExistingSpecialSchedule] = useState<any>(null);

  // List of active special schedule employees
  const [specialEmployees, setSpecialEmployees] = useState<any[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  // ── 1. Load All Special Employees ───────────────────────────────────────────
  const loadSpecialEmployees = useCallback(async () => {
    setLoadingList(true);
    try {
      let query = supabase
        .from('work_schedules')
        .select(`
          id,
          name,
          type,
          employee_id,
          created_at,
          days:work_schedule_days(*),
          employee:profiles!work_schedules_employee_id_fkey(
            id, full_name, job_number, department_id, governorate,
            departments:departments!profiles_department_id_fkey(name)
          ),
          creator:profiles!work_schedules_created_by_fkey(
            id, full_name
          )
        `)
        .eq('type', 'special')
        .not('employee_id', 'is', null)
        .order('created_at', { ascending: false });

      const { data, error } = await query;
      if (error) throw error;

      let filtered = (data as any) || [];
      if (activeGovernorate && activeGovernorate !== 'all') {
        filtered = filtered.filter((s: any) => s.employee?.governorate === activeGovernorate);
      }
      setSpecialEmployees(filtered);
    } catch (err: any) {
      toast.error('فشل تحميل قائمة الدوام الخاص: ' + err.message);
    } finally {
      setLoadingList(false);
    }
  }, [activeGovernorate]);

  useEffect(() => {
    loadSpecialEmployees();
  }, [loadSpecialEmployees]);

  // ── 2. Handle Employee Selection & Pre-Check ────────────────────────────────
  const handleSelectEmployee = async (emp: any) => {
    if (!emp?.id) return;
    setSelectedEmployee(emp);

    try {
      // Check if employee already has a special schedule
      const { data: existing, error } = await supabase
        .from('work_schedules')
        .select(`
          id,
          name,
          type,
          employee_id,
          created_at,
          days:work_schedule_days(*),
          creator:profiles!work_schedules_created_by_fkey(full_name)
        `)
        .eq('employee_id', emp.id)
        .eq('type', 'special')
        .maybeSingle();

      if (error) throw error;

      if (existing) {
        setExistingSpecialSchedule(existing);
        setShowPrecheckModal(true);
      } else {
        // Reset days to default template
        setDays(DEFAULT_DAYS);
        setExistingSpecialSchedule(null);
      }
    } catch (err: any) {
      toast.error('فشل فحص جدول الموظف: ' + err.message);
    }
  };

  // ── 3. Edit Existing Schedule from Modal or List ────────────────────────────
  const handleLoadScheduleIntoForm = (schedule: any, emp?: any) => {
    if (emp) setSelectedEmployee(emp);
    else if (selectedEmployee) setSelectedEmployee(selectedEmployee);

    const sortedDays = (schedule.days || []).sort((a: any, b: any) => a.day_of_week - b.day_of_week);
    const newDays = DEFAULT_DAYS.map((def) => {
      const found = sortedDays.find((d: any) => d.day_of_week === def.day_of_week);
      if (found) {
        return {
          day_of_week: def.day_of_week,
          day_name: def.day_name,
          is_rest_day: found.is_rest_day,
          start_time: found.start_time ? found.start_time.substring(0, 5) : '',
          end_time: found.end_time ? found.end_time.substring(0, 5) : '',
        };
      }
      return def;
    });

    setDays(newDays);
    setShowPrecheckModal(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    toast('تم تحميل أوقات الموظف في النموذج للتحرير', { icon: '✏️' });
  };

  // ── 4. Delete Special Schedule and Revert to Default Morning ────────────────
  const handleDeleteSpecialSchedule = async (employeeId: string, empName: string) => {
    if (!window.confirm(`هل أنت متأكد من حذف الدوام الخاص للموظف (${empName}) وإعادته للدوام الصباحي الافتراضي؟`)) {
      return;
    }

    try {
      const { data, error } = await supabase.rpc('remove_employee_special_schedule', {
        p_employee_id: employeeId
      });

      if (error) throw error;

      toast.success(data?.message || 'تم حذف الدوام الخاص وإعادة الموظف إلى الدوام الصباحي الافتراضي');
      setShowPrecheckModal(false);
      setExistingSpecialSchedule(null);
      setSelectedEmployee(null);
      setDays(DEFAULT_DAYS);
      loadSpecialEmployees();
    } catch (err: any) {
      toast.error('فشل حذف الدوام الخاص: ' + err.message);
    }
  };

  // ── 5. Quick Presets & Copy Helper ──────────────────────────────────────────
  const applyPreset = (start: string, end: string) => {
    setDays(prev => prev.map(d => ({
      ...d,
      start_time: d.is_rest_day ? '' : start,
      end_time: d.is_rest_day ? '' : end,
    })));
    toast.success(`تم تطبيق الأوقات (${start} إلى ${end}) على أيام العمل النشطة`);
  };

  const copyFirstDayTimesToAll = () => {
    const firstActive = days.find(d => !d.is_rest_day && d.start_time && d.end_time);
    if (!firstActive) {
      toast.error('يرجى تحديد وقت البدء والنهاية ليوم واحد على الأقل لنسخه');
      return;
    }
    setDays(prev => prev.map(d => ({
      ...d,
      start_time: d.is_rest_day ? '' : firstActive.start_time,
      end_time: d.is_rest_day ? '' : firstActive.end_time,
    })));
    toast.success(`تم نسخ توقيت (${firstActive.day_name}) لجميع أيام الدوام`);
  };

  // ── 6. Save Special Schedule ────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedEmployee?.id) {
      toast.error('يرجى اختيار الموظف أولاً');
      return;
    }

    // Validate that non-rest days have start and end times
    const activeWorkDays = days.filter(d => !d.is_rest_day);
    if (activeWorkDays.length === 0) {
      toast.error('يجب أن يحتوي الجدول على يوم دوام واحد على الأقل (ليست جميع الأيام استراحة)');
      return;
    }

    for (const d of activeWorkDays) {
      if (!d.start_time || !d.end_time) {
        toast.error(`يرجى تحديد وقت الحضور والانصراف ليوم (${d.day_name})`);
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const payload = days.map(d => ({
        day_of_week: d.day_of_week,
        is_rest_day: d.is_rest_day,
        start_time: d.is_rest_day ? null : d.start_time,
        end_time: d.is_rest_day ? null : d.end_time,
      }));

      const { data, error } = await supabase.rpc('save_employee_special_schedule', {
        p_employee_id: selectedEmployee.id,
        p_days: payload
      });

      if (error) throw error;

      toast.success(data?.message || 'تم حفظ الدوام الخاص للموظف بنجاح');
      setSelectedEmployee(null);
      setDays(DEFAULT_DAYS);
      loadSpecialEmployees();
    } catch (err: any) {
      toast.error('فشل حفظ الدوام الخاص: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* ── Form Card ── */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/90 dark:border-slate-700/80 p-5 sm:p-6 shadow-xs">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-3 mb-5">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 flex items-center justify-center font-bold">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                تخصيص دوام خاص لموظف (Special Work Hours)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                تحديد أوقات دوام مخصصة (كالخدمات والنظافة أو العقود) خارج جدول الدوام الصباحي الافتراضي
              </p>
            </div>
          </div>
          {selectedEmployee && (
            <button
              type="button"
              onClick={() => {
                setSelectedEmployee(null);
                setDays(DEFAULT_DAYS);
              }}
              className="text-xs px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
            >
              إلغاء التحديد
            </button>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Employee Search */}
          <div className="space-y-1.5">
            <label className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1">
              <span>الموظف المعني بالدوام الخاص</span>
              <span className="text-rose-500 font-extrabold">*</span>
              {selectedEmployee && (
                <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 mr-2">
                  (تم اختيار: {selectedEmployee.full_name})
                </span>
              )}
            </label>
            <EmployeeSearch
              onSelect={handleSelectEmployee}
              placeholder="ابحث بالاسم أو الرقم الوظيفي..."
              governorate={activeGovernorate && activeGovernorate !== 'all' ? activeGovernorate : undefined}
              className="w-full"
            />
          </div>

          {/* Quick Presets & Copy Toolbar */}
          <div className="bg-slate-50 dark:bg-slate-750 p-3 rounded-xl border border-slate-200/80 dark:border-slate-700 flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <span className="font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                قوالب سريعة:
              </span>
              <button
                type="button"
                onClick={() => applyPreset('06:30', '13:00')}
                className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:border-amber-500 font-medium transition-colors"
              >
                نظافة وخدمات (06:30 - 13:00)
              </button>
              <button
                type="button"
                onClick={() => applyPreset('08:30', '13:00')}
                className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:border-amber-500 font-medium transition-colors"
              >
                عقود (08:30 - 13:00)
              </button>
              <button
                type="button"
                onClick={() => applyPreset('08:00', '15:00')}
                className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:border-amber-500 font-medium transition-colors"
              >
                صباحي كامل (08:00 - 15:00)
              </button>
            </div>

            <button
              type="button"
              onClick={copyFirstDayTimesToAll}
              className="px-3 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 text-xs font-bold hover:bg-blue-100 transition-colors flex items-center gap-1.5 shrink-0"
              title="نسخ توقيت أول يوم دوام لجميع الأيام النشطة"
            >
              <Copy className="w-3.5 h-3.5" />
              نسخ الأوقات لجميع أيام الدوام
            </button>
          </div>

          {/* 7 Days Table */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="grid grid-cols-12 bg-slate-100 dark:bg-slate-750 p-2.5 text-xs font-bold text-slate-700 dark:text-slate-200 border-b border-slate-200 dark:border-slate-700">
              <div className="col-span-3 sm:col-span-3">اليوم</div>
              <div className="col-span-3 sm:col-span-3 text-center">استراحة أسبوعية</div>
              <div className="col-span-3 sm:col-span-3 text-center">من (الحضور)</div>
              <div className="col-span-3 sm:col-span-3 text-center">إلى (الانصراف)</div>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-750 bg-white dark:bg-slate-800">
              {days.map((row, idx) => (
                <div 
                  key={row.day_of_week} 
                  className={`grid grid-cols-12 items-center p-2.5 text-xs transition-colors ${
                    row.is_rest_day ? 'bg-slate-50/60 dark:bg-slate-900/30' : 'hover:bg-slate-50 dark:hover:bg-slate-750/50'
                  }`}
                >
                  {/* Day Name */}
                  <div className="col-span-3 sm:col-span-3 font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                    <span>{row.day_name}</span>
                  </div>

                  {/* Rest Checkbox */}
                  <div className="col-span-3 sm:col-span-3 flex justify-center">
                    <label className="flex items-center gap-1.5 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={row.is_rest_day}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setDays(prev => prev.map((d, i) => i === idx ? {
                            ...d,
                            is_rest_day: checked,
                            start_time: checked ? '' : (d.start_time || '08:00'),
                            end_time: checked ? '' : (d.end_time || '15:00'),
                          } : d));
                        }}
                        className="w-4 h-4 rounded-sm text-blue-600 border-slate-300 focus:ring-blue-500 cursor-pointer"
                      />
                      <span className="text-[11px] font-medium text-slate-600 dark:text-slate-400">
                        استراحة
                      </span>
                    </label>
                  </div>

                  {/* Time From */}
                  <div className="col-span-3 sm:col-span-3 flex justify-center px-1">
                    {row.is_rest_day ? (
                      <span className="text-slate-400 dark:text-slate-500 font-medium text-[11px] py-1.5">
                        —
                      </span>
                    ) : (
                      <input
                        type="time"
                        value={row.start_time}
                        onChange={(e) => {
                          const val = e.target.value;
                          setDays(prev => prev.map((d, i) => i === idx ? { ...d, start_time: val } : d));
                        }}
                        required
                        className="w-full max-w-[130px] px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-xs font-mono font-bold text-center focus:ring-2 focus:ring-blue-500/30"
                      />
                    )}
                  </div>

                  {/* Time To */}
                  <div className="col-span-3 sm:col-span-3 flex justify-center px-1">
                    {row.is_rest_day ? (
                      <span className="text-slate-400 dark:text-slate-500 font-medium text-[11px] py-1.5">
                        —
                      </span>
                    ) : (
                      <input
                        type="time"
                        value={row.end_time}
                        onChange={(e) => {
                          const val = e.target.value;
                          setDays(prev => prev.map((d, i) => i === idx ? { ...d, end_time: val } : d));
                        }}
                        required
                        className="w-full max-w-[130px] px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-xs font-mono font-bold text-center focus:ring-2 focus:ring-blue-500/30"
                      />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Submit Button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting || !selectedEmployee}
              className="w-full py-2.5 px-5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs sm:text-sm transition-all shadow-md shadow-amber-600/20 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Save className="w-4 h-4" />
              {isSubmitting ? 'جاري الحفظ...' : 'حفظ وتثبيت الدوام الخاص'}
            </button>
          </div>
        </form>
      </div>

      {/* ── List of Current Employees on Special Schedules (4 Rows Constrained) ── */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/90 dark:border-slate-700/80 p-5 space-y-3 shadow-xs">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-2.5">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-600" />
            <h4 className="text-sm font-bold text-slate-900 dark:text-white">
              الموظفون الخاضعون لدوام خاص حالياً ({specialEmployees.length})
            </h4>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <ArrowUpDown className="w-3.5 h-3.5" />
            <span>تنقل حر بعجلة الماوس والكيبورد (4 صفوف كحد أعلى)</span>
          </div>
        </div>

        {loadingList ? (
          <div className="text-center py-8 text-xs text-slate-500">جاري تحميل قائمة الدوام الخاص...</div>
        ) : specialEmployees.length === 0 ? (
          <div className="text-center py-8 text-xs text-slate-500 dark:text-slate-400 font-medium bg-slate-50 dark:bg-slate-900/30 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
            لا يوجد أي موظف محدد له دوام خاص حالياً في هذه المحافظة.
          </div>
        ) : (
          <div
            ref={listRef}
            tabIndex={0}
            onKeyDown={(e) => {
              if (specialEmployees.length === 0) return;
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setFocusedIndex(prev => Math.min(prev + 1, specialEmployees.length - 1));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setFocusedIndex(prev => Math.max(prev - 1, 0));
              } else if (e.key === 'Enter') {
                e.preventDefault();
                const cur = specialEmployees[focusedIndex];
                if (cur) handleLoadScheduleIntoForm(cur, cur.employee);
              }
            }}
            className="max-h-[290px] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-750 rounded-xl border border-slate-100 dark:border-slate-700 focus:outline-hidden focus:ring-1 focus:ring-amber-500/40"
          >
            {specialEmployees.map((sch, index) => {
              const emp = sch.employee;
              const isFocused = index === focusedIndex;
              const firstWorkDay = (sch.days || []).find((d: any) => !d.is_rest_day);
              const hoursSummary = firstWorkDay 
                ? `من ${firstWorkDay.start_time?.substring(0, 5)} إلى ${firstWorkDay.end_time?.substring(0, 5)}`
                : 'أوقات متغيرة';

              return (
                <div
                  key={sch.id}
                  onClick={() => {
                    setFocusedIndex(index);
                    handleLoadScheduleIntoForm(sch, emp);
                  }}
                  className={`p-3 transition-colors flex items-center justify-between gap-3 cursor-pointer ${
                    isFocused 
                      ? 'bg-amber-50/70 dark:bg-amber-950/40' 
                      : 'hover:bg-slate-50 dark:hover:bg-slate-700/40'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 flex items-center justify-center font-bold text-xs shrink-0">
                      {index + 1}
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white truncate hover:underline">
                        {emp?.full_name || 'موظف'}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                        <span className="font-mono font-bold text-amber-700 dark:text-amber-300">
                          {hoursSummary}
                        </span>
                        {emp?.departments?.name && (
                          <>
                            <span>•</span>
                            <span className="truncate">{emp.departments.name}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={() => handleLoadScheduleIntoForm(sch, emp)}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40 transition-colors"
                      title="تحرير جدول هذا الموظف"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteSpecialSchedule(emp.id, emp?.full_name || 'الموظف')}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                      title="حذف الدوام الخاص والعودة للدوام الصباحي الافتراضي"
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

      {/* ── Pre-Check Floating Modal (تنبيه مسبق بوجود دوام خاص مع أزرار تعديل، حذف، وإغلاق) ── */}
      {showPrecheckModal && existingSpecialSchedule && selectedEmployee && (
        <div 
          onClick={() => setShowPrecheckModal(false)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-slate-800 rounded-2xl max-w-lg w-full border border-slate-200 dark:border-slate-700 shadow-2xl p-5 sm:p-6 space-y-4 text-right animate-in zoom-in-95 duration-150"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-3">
              <div className="flex items-center gap-2.5">
                <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
                <div>
                  <h4 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white">
                    تنبيه: يوجد دوام خاص محدد مسبقاً
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    إن الموظف <strong className="text-slate-800 dark:text-slate-200 font-bold">({selectedEmployee.full_name})</strong> محدد له دوام خاص بالفعل
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowPrecheckModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Days Preview Table */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden text-xs">
              <div className="grid grid-cols-3 bg-slate-100 dark:bg-slate-750 p-2 font-bold text-slate-700 dark:text-slate-200">
                <div>اليوم</div>
                <div className="text-center">الحالة</div>
                <div className="text-left">ساعات الدوام</div>
              </div>
              <div className="divide-y divide-slate-100 dark:divide-slate-700 bg-white dark:bg-slate-800 max-h-48 overflow-y-auto">
                {(existingSpecialSchedule.days || [])
                  .sort((a: any, b: any) => a.day_of_week - b.day_of_week)
                  .map((d: any) => {
                    const dayObj = DEFAULT_DAYS.find(df => df.day_of_week === d.day_of_week);
                    return (
                      <div key={d.id || d.day_of_week} className="grid grid-cols-3 p-2 items-center">
                        <span className="font-bold text-slate-800 dark:text-slate-200">
                          {dayObj?.day_name || `يوم ${d.day_of_week}`}
                        </span>
                        <div className="text-center">
                          {d.is_rest_day ? (
                            <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-500 font-bold text-[10px]">
                              استراحة
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-700 font-bold text-[10px]">
                              دوام
                            </span>
                          )}
                        </div>
                        <div className="text-left font-mono font-bold text-slate-700 dark:text-slate-300">
                          {d.is_rest_day ? '—' : `${d.start_time?.substring(0, 5)} إلى ${d.end_time?.substring(0, 5)}`}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>

            {/* Supervisor Info */}
            {existingSpecialSchedule.creator?.full_name && (
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                أُدخل بواسطة المشرف: <strong className="text-slate-700 dark:text-slate-300">{existingSpecialSchedule.creator.full_name}</strong>
              </p>
            )}

            {/* 3 Buttons: Edit | Delete and Revert to Default | Close */}
            <div className="flex flex-col sm:flex-row items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => handleLoadScheduleIntoForm(existingSpecialSchedule)}
                className="w-full sm:flex-1 py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition-colors flex items-center justify-center gap-1.5 shadow-xs"
              >
                <Edit3 className="w-3.5 h-3.5" />
                تعديل هذا الجدول
              </button>

              <button
                type="button"
                onClick={() => handleDeleteSpecialSchedule(selectedEmployee.id, selectedEmployee.full_name)}
                className="w-full sm:flex-1 py-2 px-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition-colors flex items-center justify-center gap-1.5 shadow-xs"
                title="حذف هذا الدوام الخاص ونقل الموظف فورياً إلى الدوام الصباحي الافتراضي"
              >
                <Trash2 className="w-3.5 h-3.5" />
                حذف والعودة للافتراضي
              </button>

              <button
                type="button"
                onClick={() => setShowPrecheckModal(false)}
                className="w-full sm:w-auto py-2 px-4 rounded-xl border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 font-bold text-xs transition-colors"
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
