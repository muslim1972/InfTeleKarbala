import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { 
  Calendar, Clock, Sun, Sunset, Moon, ShieldCheck, 
  Save, X, Check, Users, Plus, AlertCircle, Info
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { EmployeeSearch } from '../../../components/shared/EmployeeSearch';

interface EmployeeRosterModalProps {
  employee: any;
  locationName?: string;
  onClose: () => void;
  onSave: () => void;
}

// Helper to format Date to YYYY-MM-DD in local time
function formatDateToLocalYMD(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Helper to parse YYYY-MM-DD string into local noon Date (avoids timezone day shifting)
function parseLocalYMD(ymdStr: string): Date {
  const [y, m, d] = ymdStr.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0);
}

// Helper to get Sunday of current or given week
function getSundayOfWeek(d: Date = new Date()): string {
  const date = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0);
  const day = date.getDay(); // 0 is Sunday
  date.setDate(date.getDate() - day);
  return formatDateToLocalYMD(date);
}

// Helper to get Saturday after N weeks
function getSaturdayAfterWeeks(sundayStr: string, weeksCount: number = 1): string {
  const d = parseLocalYMD(sundayStr);
  d.setDate(d.getDate() + (weeksCount * 7 - 1));
  return formatDateToLocalYMD(d);
}

// Helper to get day name in Arabic from YYYY-MM-DD
function getDayNameFromYMD(ymdStr: string): string {
  if (!ymdStr) return '';
  const d = parseLocalYMD(ymdStr);
  const daysArr = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
  return daysArr[d.getDay()] || '';
}

export default function EmployeeRosterModal({
  employee,
  locationName,
  onClose,
  onSave
}: EmployeeRosterModalProps) {
  const [saving, setSaving] = useState(false);
  const [loadingSchedule, setLoadingSchedule] = useState(true);

  // Period / Validity state (Starts on Sunday, Ends on Saturday)
  const defaultSunday = getSundayOfWeek();
  const defaultSaturday = getSaturdayAfterWeeks(defaultSunday, 1);
  const [validFrom, setValidFrom] = useState<string>(defaultSunday);
  const [validUntil, setValidUntil] = useState<string>(defaultSaturday);

  // Multi-employee assignment
  const [additionalEmployees, setAdditionalEmployees] = useState<any[]>([]);
  const [initialEmployeeIds, setInitialEmployeeIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // 7 days matrix (Sunday=0 to Saturday=6)
  const defaultDays = Array.from({ length: 7 }).map((_, i) => ({
    day_of_week: i,
    is_rest_day: true, // Default to تعويضية
    is_morning: false,
    is_evening: false,
    is_night: false,
    start_time: null as string | null,
    end_time: null as string | null
  }));

  const [days, setDays] = useState<any[]>(defaultDays);
  const [scheduleId, setScheduleId] = useState<string | null>(null);

  const getDayName = (dayIndex: number) => {
    const daysArr = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
    return daysArr[dayIndex];
  };

  useEffect(() => {
    loadEmployeeSchedule();
  }, [employee]);

  const loadEmployeeSchedule = async () => {
    setLoadingSchedule(true);
    try {
      if (employee.work_schedule_id) {
        const { data: sch, error: schErr } = await supabase
          .from('work_schedules')
          .select('*, days:work_schedule_days(*)')
          .eq('id', employee.work_schedule_id)
          .single();

        if (sch && !schErr && sch.type === 'roster') {
          setScheduleId(sch.id);
          if (sch.valid_from) setValidFrom(sch.valid_from);
          if (sch.valid_until) setValidUntil(sch.valid_until);

          // Find other employees sharing this same roster schedule
          const { data: siblingEmps } = await supabase
            .from('profiles')
            .select('id, full_name, job_number, department_id')
            .eq('work_schedule_id', sch.id)
            .neq('id', employee.id);

          if (siblingEmps && siblingEmps.length > 0) {
            setAdditionalEmployees(siblingEmps);
            setInitialEmployeeIds(siblingEmps.map((e: any) => e.id));
          } else {
            setAdditionalEmployees([]);
            setInitialEmployeeIds([]);
          }

          const populatedDays = Array.from({ length: 7 }).map((_, i) => {
            const found = sch.days?.find((d: any) => d.day_of_week === i);
            if (found) {
              const isMorning = found.is_morning ?? (!found.is_rest_day && found.start_time?.startsWith('08'));
              const isEvening = found.is_evening ?? (found.start_time?.startsWith('14') || found.end_time?.startsWith('20'));
              const isNight = found.is_night ?? (found.start_time?.startsWith('20') || found.end_time?.startsWith('08'));
              const hasShifts = isMorning || isEvening || isNight;
              return {
                day_of_week: i,
                is_rest_day: found.is_rest_day ?? !hasShifts,
                is_morning: isMorning,
                is_evening: isEvening,
                is_night: isNight,
                start_time: found.start_time?.substring(0, 5) || null,
                end_time: found.end_time?.substring(0, 5) || null
              };
            }
            return {
              day_of_week: i,
              is_rest_day: true,
              is_morning: false,
              is_evening: false,
              is_night: false,
              start_time: null,
              end_time: null
            };
          });
          setDays(populatedDays);
          setLoadingSchedule(false);
          return;
        }
      }

      setDays(defaultDays);
    } catch (err: any) {
      console.error(err);
      setDays(defaultDays);
    } finally {
      setLoadingSchedule(false);
    }
  };

  const handleToggleRestDay = (dayIndex: number, isRest: boolean) => {
    const updated = [...days];
    const current = { ...updated[dayIndex] };
    current.is_rest_day = isRest;

    if (isRest) {
      // Turn off all shifts when marked as تعويضية
      current.is_morning = false;
      current.is_evening = false;
      current.is_night = false;
      current.start_time = null;
      current.end_time = null;
    } else {
      // Default to morning if no shift was selected
      if (!current.is_morning && !current.is_evening && !current.is_night) {
        current.is_morning = true;
        current.start_time = '08:00';
        current.end_time = '15:00';
      }
    }

    updated[dayIndex] = current;
    setDays(updated);
  };

  const handleToggleShift = (dayIndex: number, shiftType: 'morning' | 'evening' | 'night') => {
    const updated = [...days];
    const current = { ...updated[dayIndex] };

    if (shiftType === 'morning') current.is_morning = !current.is_morning;
    if (shiftType === 'evening') current.is_evening = !current.is_evening;
    if (shiftType === 'night') current.is_night = !current.is_night;

    const hasAnyShift = current.is_morning || current.is_evening || current.is_night;
    current.is_rest_day = !hasAnyShift;

    if (!hasAnyShift) {
      current.start_time = null;
      current.end_time = null;
    } else {
      // Flexible shifts combinations:
      if (current.is_morning && current.is_evening && current.is_night) {
        // Full 24 hours duty (e.g. million visits / remote staff)
        current.start_time = '08:00';
        current.end_time = '08:00';
      } else if (current.is_morning && current.is_evening) {
        // Morning + Evening (08:00 to 20:00)
        current.start_time = '08:00';
        current.end_time = '20:00';
      } else if (current.is_evening && current.is_night) {
        // Evening + Khafr (14:30 to 08:00 next day)
        current.start_time = '14:30';
        current.end_time = '08:00';
      } else if (current.is_morning && current.is_night) {
        // Morning + Night
        current.start_time = '08:00';
        current.end_time = '08:00';
      } else if (current.is_morning) {
        current.start_time = '08:00';
        current.end_time = '15:00';
      } else if (current.is_evening) {
        current.start_time = '14:30';
        current.end_time = '20:00';
      } else if (current.is_night) {
        current.start_time = '20:00';
        current.end_time = '08:00';
      }
    }

    updated[dayIndex] = current;
    setDays(updated);
  };

  const getShiftDescription = (d: any) => {
    if (d.is_rest_day) return 'تعويضية (استراحة)';
    if (d.is_morning && d.is_evening && d.is_night) return 'نوبة كاملة 24 ساعة (08:00 إلى 08:00 ص)';
    if (d.is_morning && d.is_evening) return 'صباحي + مسائي (08:00 إلى 20:00)';
    if (d.is_evening && d.is_night) return 'مسائي + خفر (14:30 إلى 08:00 ص)';
    if (d.is_morning && d.is_night) return 'صباحي + خفر (08:00 إلى 08:00 ص)';
    if (d.is_morning) return 'صباحي (08:00 إلى 15:00)';
    if (d.is_evening) return 'مسائي (14:30 إلى 20:00)';
    if (d.is_night) return 'خفر (20:00 إلى 08:00 ص)';
    return 'تعويضية';
  };

  const handleApplyPresetWeeks = (weeks: number) => {
    const baseDate = validFrom ? parseLocalYMD(validFrom) : new Date();
    const start = getSundayOfWeek(baseDate);
    setValidFrom(start);
    setValidUntil(getSaturdayAfterWeeks(start, weeks));
  };

  const handleAddEmployee = (emp: any) => {
    setSearchQuery('');
    if (!emp || emp.id === employee.id) {
      toast.error('هذا هو الموظف الأساسي بالفعل');
      return;
    }
    if (additionalEmployees.some(e => e.id === emp.id)) {
      toast.error('تمت إضافة هذا الموظف مسبقاً');
      return;
    }
    setAdditionalEmployees([...additionalEmployees, emp]);
    toast.success(`تمت إضافة الموظف ${emp.full_name} للمناوبة`);
  };

  const handleRemoveEmployee = (empId: string) => {
    setAdditionalEmployees(additionalEmployees.filter(e => e.id !== empId));
  };

  const handleSave = async () => {
    // Validate period
    if (!validFrom || !validUntil) {
      toast.error('يرجى تحديد فترة سريان جدول المناوبة');
      return;
    }

    const startDate = parseLocalYMD(validFrom);
    const endDate = parseLocalYMD(validUntil);

    if (startDate.getDay() !== 0) {
      const actualDay = getDayNameFromYMD(validFrom);
      toast.error(`تاريخ البدء (${validFrom}) هو يوم ${actualDay}. يجب أن يبدأ أسبوع المناوبة بيوم الأحد.`);
      return;
    }

    if (endDate.getDay() !== 6) {
      const actualDay = getDayNameFromYMD(validUntil);
      toast.error(`تاريخ الانتهاء (${validUntil}) هو يوم ${actualDay}. يجب أن ينتهي أسبوع المناوبة بيوم السبت.`);
      return;
    }

    if (endDate.getTime() <= startDate.getTime()) {
      toast.error('تاريخ الانتهاء يجب أن يكون بعد تاريخ البدء');
      return;
    }

    const diffDays = Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 3600 * 24));
    if (diffDays < 6) {
      toast.error('فترة سريان الجدول يجب أن تكون أسبوعاً كاملاً على الأقل (من الأحد إلى السبت)');
      return;
    }

    setSaving(true);
    try {
      const scheduleName = `مناوب - ${employee.full_name}${additionalEmployees.length > 0 ? ` (+${additionalEmployees.length})` : ''}`;
      let targetScheduleId = scheduleId;

      if (targetScheduleId) {
        // Update existing roster schedule
        const { error: schErr } = await supabase
          .from('work_schedules')
          .update({ 
            name: scheduleName, 
            type: 'roster', 
            valid_from: validFrom,
            valid_until: validUntil,
            updated_at: new Date().toISOString() 
          })
          .eq('id', targetScheduleId);
        if (schErr) throw schErr;
      } else {
        // Create new roster schedule
        const { data: newSch, error: schErr } = await supabase
          .from('work_schedules')
          .insert({
            name: scheduleName,
            type: 'roster',
            is_default: false,
            valid_from: validFrom,
            valid_until: validUntil,
            grace_period_minutes: 0
          })
          .select()
          .single();
        if (schErr) throw schErr;
        targetScheduleId = newSch.id;
      }

      // Re-create all 7 days cleanly
      await supabase
        .from('work_schedule_days')
        .delete()
        .eq('schedule_id', targetScheduleId);

      const daysToInsert = days.map(d => ({
        schedule_id: targetScheduleId,
        day_of_week: d.day_of_week,
        is_rest_day: d.is_rest_day,
        is_morning: d.is_morning,
        is_evening: d.is_evening,
        is_night: d.is_night,
        start_time: d.is_rest_day ? null : d.start_time,
        end_time: d.is_rest_day ? null : d.end_time
      }));

      const { error: daysErr } = await supabase
        .from('work_schedule_days')
        .insert(daysToInsert);
      if (daysErr) throw daysErr;

      // Link primary employee + all current additional employees
      const currentAdditionalIds = additionalEmployees.map(e => e.id);
      const allEmpIds = [employee.id, ...currentAdditionalIds];
      const { error: profErr } = await supabase
        .from('profiles')
        .update({ work_schedule_id: targetScheduleId })
        .in('id', allEmpIds);
      if (profErr) throw profErr;

      // Unlink any employee that was removed from this roster
      const removedEmpIds = initialEmployeeIds.filter(id => !currentAdditionalIds.includes(id));
      if (removedEmpIds.length > 0) {
        const { data: defSch } = await supabase
          .from('work_schedules')
          .select('id')
          .eq('is_default', true)
          .maybeSingle();

        await supabase
          .from('profiles')
          .update({ work_schedule_id: defSch?.id || null })
          .in('id', removedEmpIds);
      }

      const totalCount = allEmpIds.length;
      toast.success(
        totalCount === 1 
          ? `تم حفظ وتعميم جدول المناوبة لـ ${employee.full_name} بنجاح`
          : `تم حفظ وتعميم جدول المناوبة لـ ${totalCount} موظفين بنجاح`
      );
      onSave();
      onClose();
    } catch (err: any) {
      toast.error('حدث خطأ أثناء الحفظ: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[99999] flex items-center justify-center p-3 sm:p-6 pb-24 pt-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-4xl max-h-[82vh] mb-12 sm:mb-8 flex flex-col shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden my-auto">
        {/* Header */}
        <div className="flex justify-between items-center p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 shrink-0">
          <div>
            <h3 className="text-base font-bold text-slate-800 dark:text-white flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-purple-600" />
              تخصيص جدول المناوبة والشفتات
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              الموظف الأساسي: <span className="font-bold text-slate-800 dark:text-slate-200">{employee.full_name}</span>
              <span className="mx-2">|</span>
              الرقم الوظيفي: <span className="font-mono font-bold text-slate-700 dark:text-slate-300">{employee.job_number || '---'}</span>
              {locationName && (
                <span className="mr-3">| الموقع: <span className="font-bold text-blue-600 dark:text-blue-400">{locationName}</span></span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 rounded-xl font-bold text-white bg-purple-600 hover:bg-purple-700 flex items-center gap-2 transition-colors disabled:opacity-70 text-xs shadow-sm"
            >
              {saving ? (
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Save className="w-3.5 h-3.5" />
              )}
              حفظ الجدول
            </button>
            <button onClick={onClose} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors text-slate-500">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 pb-48 space-y-5 custom-scrollbar">
          
          {/* Section 1: Validity Period */}
          <div className="bg-purple-50/50 dark:bg-purple-950/20 border border-purple-100 dark:border-purple-900/40 rounded-2xl p-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
              <div className="flex items-center gap-2 text-purple-900 dark:text-purple-300 font-bold text-xs">
                <Calendar className="w-4 h-4 text-purple-600" />
                <span>فترة سريان الجدول (أسبوع كحد أدنى من الأحد إلى السبت):</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-slate-500 ml-1">تحديد سريع:</span>
                <button
                  type="button"
                  onClick={() => handleApplyPresetWeeks(1)}
                  className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300 hover:bg-purple-100/50 transition-colors"
                >
                  أسبوع
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyPresetWeeks(2)}
                  className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300 hover:bg-purple-100/50 transition-colors"
                >
                  أسبوعان
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyPresetWeeks(4)}
                  className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300 hover:bg-purple-100/50 transition-colors"
                >
                  شهر (4 أسابيع)
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                    تاريخ البدء (يبدأ بيوم الأحد):
                  </label>
                  {validFrom && (
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                      parseLocalYMD(validFrom).getDay() === 0
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                        : 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300'
                    }`}>
                      {getDayNameFromYMD(validFrom)} {parseLocalYMD(validFrom).getDay() === 0 ? '✓' : '⚠️ ليس أحداً'}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  <input
                    type="date"
                    value={validFrom}
                    onChange={(e) => setValidFrom(e.target.value)}
                    className="flex-1 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 outline-none font-mono text-slate-800 dark:text-slate-200 focus:border-purple-500"
                  />
                  {validFrom && parseLocalYMD(validFrom).getDay() !== 0 && (
                    <button
                      type="button"
                      onClick={() => setValidFrom(getSundayOfWeek(parseLocalYMD(validFrom)))}
                      className="text-[10px] bg-amber-100 text-amber-900 hover:bg-amber-200 px-2 py-2 rounded-xl font-bold whitespace-nowrap"
                      title="ضبط للأحد الأقرب"
                    >
                      ضبط للأحد
                    </button>
                  )}
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                    تاريخ الانتهاء (ينتهي بيوم السبت):
                  </label>
                  {validUntil && (
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                      parseLocalYMD(validUntil).getDay() === 6
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                        : 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300'
                    }`}>
                      {getDayNameFromYMD(validUntil)} {parseLocalYMD(validUntil).getDay() === 6 ? '✓' : '⚠️ ليس سبتاً'}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  <input
                    type="date"
                    value={validUntil}
                    onChange={(e) => setValidUntil(e.target.value)}
                    className="flex-1 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 outline-none font-mono text-slate-800 dark:text-slate-200 focus:border-purple-500"
                  />
                  {validFrom && validUntil && parseLocalYMD(validUntil).getDay() !== 6 && (
                    <button
                      type="button"
                      onClick={() => setValidUntil(getSaturdayAfterWeeks(validFrom, 1))}
                      className="text-[10px] bg-amber-100 text-amber-900 hover:bg-amber-200 px-2 py-2 rounded-xl font-bold whitespace-nowrap"
                      title="ضبط لسبت الأسبوع"
                    >
                      ضبط للسبت
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-2.5 flex items-center gap-1.5 text-[11px] text-purple-800 dark:text-purple-300">
              <Info className="w-3.5 h-3.5 shrink-0 text-purple-600" />
              <span>
                قبل انتهاء الفترة المحددة صباح كل خميس، سيُرسل تنبيه ذكي لتذكيرك بتحديث الجدول أو اعتماده تلقائياً للفترة القادمة.
              </span>
            </div>
          </div>

          {/* Section 2: Multi-Employee Assignment */}
          <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/60 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-slate-800 dark:text-slate-200 font-bold text-xs">
                <Users className="w-4 h-4 text-blue-600" />
                <span>الموظفون المشمولون بهذا الجدول (إسناد جماعي وديناميكي):</span>
              </div>
              <span className="text-[11px] text-slate-500 font-bold">
                الإجمالي: {1 + additionalEmployees.length} موظف
              </span>
            </div>

            {/* Employee tags */}
            <div className="flex flex-wrap items-center gap-2 mb-3">
              {/* Primary Employee */}
              <div className="flex items-center gap-1.5 bg-purple-100 text-purple-900 dark:bg-purple-900/40 dark:text-purple-300 px-3 py-1 rounded-xl text-xs font-bold border border-purple-200 dark:border-purple-800">
                <ShieldCheck className="w-3.5 h-3.5 text-purple-600" />
                <span>{employee.full_name}</span>
                <span className="text-[10px] bg-purple-200/80 dark:bg-purple-800 px-1.5 py-0.2 rounded-md">الأساسي</span>
              </div>

              {/* Additional Employees */}
              {additionalEmployees.map((emp) => (
                <div
                  key={emp.id}
                  className="flex items-center gap-1.5 bg-blue-50 text-blue-900 dark:bg-blue-950/40 dark:text-blue-300 px-2.5 py-1 rounded-xl text-xs font-bold border border-blue-200 dark:border-blue-800"
                >
                  <span>{emp.full_name}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveEmployee(emp.id)}
                    className="p-0.5 hover:bg-blue-200 dark:hover:bg-blue-800 rounded-full transition-colors text-blue-700 dark:text-blue-400"
                    title="إزالة الموظف من هذا الجدول"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>

            {/* Global Employee Search */}
            <div className="relative">
              <EmployeeSearch
                value={searchQuery}
                onChange={setSearchQuery}
                clearOnSelect={true}
                placeholder="ابحث بالاسم أو الرقم الوظيفي لإضافة موظف آخر لنفس هذا الجدول..."
                onSelect={handleAddEmployee}
                portalClassName="z-[100000]"
                inputClassName="bg-white dark:bg-slate-900 text-xs py-2 rounded-xl"
              />
            </div>
          </div>

          {/* Section 3: Days Matrix */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-bold text-xs text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-purple-600" />
                <span>جدول شفتات أيام الأسبوع (يقبل أي مزيج للشفتات بما فيها الـ 24 ساعة):</span>
              </h4>
              <span className="text-[11px] text-slate-500">
                أي يوم غير مؤشر فيه شفت يُعتبر <strong>استراحة تعويضية</strong>
              </span>
            </div>

            {loadingSchedule ? (
              <div className="py-12 text-center text-slate-400">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-2" />
                جاري تحميل بيانات الشفتات...
              </div>
            ) : (
              <div className="space-y-2.5">
                {days.map((day, index) => {
                  const isRest = day.is_rest_day;

                  return (
                    <div
                      key={day.day_of_week}
                      className={`p-3.5 rounded-2xl border transition-all ${
                        isRest
                          ? 'bg-emerald-50/30 dark:bg-emerald-950/10 border-emerald-100 dark:border-emerald-900/30'
                          : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-xs'
                      }`}
                    >
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                        {/* Day Name and Rest Checkbox */}
                        <div className="flex items-center gap-2.5 w-48 shrink-0">
                          <span className="font-bold text-xs text-slate-800 dark:text-slate-200 w-16">
                            {getDayName(day.day_of_week)}
                          </span>

                          <label className="flex items-center gap-1.5 cursor-pointer bg-slate-50 dark:bg-slate-900 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700">
                            <input
                              type="checkbox"
                              checked={isRest}
                              onChange={(e) => handleToggleRestDay(index, e.target.checked)}
                              className="w-3.5 h-3.5 text-emerald-600 rounded focus:ring-emerald-500 border-slate-300 cursor-pointer"
                            />
                            <span className={`text-[11px] font-bold ${isRest ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-500'}`}>
                              تعويضية
                            </span>
                          </label>

                          {!isRest && (
                            <span className="text-[10px] text-purple-700 dark:text-purple-300 font-mono hidden sm:inline-block">
                              {day.start_time} - {day.end_time}
                            </span>
                          )}
                        </div>

                        {/* Shifts Checkboxes / Buttons */}
                        <div className="flex flex-wrap items-center gap-2 flex-1 md:justify-end">
                          {isRest ? (
                            <div className="text-xs font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-100/70 dark:bg-emerald-900/30 px-3 py-1 rounded-xl">
                              تعويضية (راحة تامة بدون دوام)
                            </div>
                          ) : (
                            <>
                              {/* Morning */}
                              <label className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-bold cursor-pointer transition-all ${
                                day.is_morning
                                  ? 'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-300 border-amber-300 dark:border-amber-700 shadow-xs'
                                  : 'bg-slate-50 dark:bg-slate-900/50 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-slate-300'
                              }`}>
                                <input
                                  type="checkbox"
                                  checked={day.is_morning}
                                  onChange={() => handleToggleShift(index, 'morning')}
                                  className="w-3.5 h-3.5 text-amber-600 rounded focus:ring-amber-500 border-slate-300"
                                />
                                <Sun className="w-3.5 h-3.5 text-amber-500" />
                                <span>صباحي (08:00 - 15:00)</span>
                              </label>

                              {/* Evening */}
                              <label className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-bold cursor-pointer transition-all ${
                                day.is_evening
                                  ? 'bg-orange-100 text-orange-900 dark:bg-orange-900/40 dark:text-orange-300 border-orange-300 dark:border-orange-700 shadow-xs'
                                  : 'bg-slate-50 dark:bg-slate-900/50 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-slate-300'
                              }`}>
                                <input
                                  type="checkbox"
                                  checked={day.is_evening}
                                  onChange={() => handleToggleShift(index, 'evening')}
                                  className="w-3.5 h-3.5 text-orange-600 rounded focus:ring-orange-500 border-slate-300"
                                />
                                <Sunset className="w-3.5 h-3.5 text-orange-500" />
                                <span>مسائي (14:30 - 20:00)</span>
                              </label>

                              {/* Night */}
                              <label className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-bold cursor-pointer transition-all ${
                                day.is_night
                                  ? 'bg-indigo-100 text-indigo-900 dark:bg-indigo-900/40 dark:text-indigo-300 border-indigo-300 dark:border-indigo-700 shadow-xs'
                                  : 'bg-slate-50 dark:bg-slate-900/50 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-slate-300'
                              }`}>
                                <input
                                  type="checkbox"
                                  checked={day.is_night}
                                  onChange={() => handleToggleShift(index, 'night')}
                                  className="w-3.5 h-3.5 text-indigo-600 rounded focus:ring-indigo-500 border-slate-300"
                                />
                                <Moon className="w-3.5 h-3.5 text-indigo-500" />
                                <span>خفر (20:00 - 08:00ص)</span>
                              </label>

                              {/* Smart Description Pill */}
                              <span className="text-[10px] font-bold bg-purple-100/70 text-purple-900 dark:bg-purple-900/30 dark:text-purple-300 px-2 py-1 rounded-lg">
                                {getShiftDescription(day)}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Bottom Save Action Bar */}
            <div className="pt-6 pb-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-200 dark:border-slate-800">
              <span className="text-xs text-slate-500 text-center sm:text-right">
                تأكد من مراجعة الشفتات لكل يوم من الأحد إلى السبت ثم اضغط حفظ واعتماد.
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="px-5 py-2.5 rounded-xl font-bold text-white bg-purple-600 hover:bg-purple-700 flex items-center gap-2 transition-colors disabled:opacity-70 text-xs shadow-md"
                >
                  {saving ? (
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Save className="w-3.5 h-3.5" />
                  )}
                  <span>حفظ واعتماد جدول المناوبة</span>
                </button>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
