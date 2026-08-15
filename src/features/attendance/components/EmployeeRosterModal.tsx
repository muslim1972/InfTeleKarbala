import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { 
  Calendar, Clock, Sun, Sunset, Moon, ShieldCheck, 
  Save, X, Check
} from 'lucide-react';
import { toast } from 'react-hot-toast';

interface EmployeeRosterModalProps {
  employee: any;
  locationName?: string;
  onClose: () => void;
  onSave: () => void;
}

export default function EmployeeRosterModal({
  employee,
  locationName,
  onClose,
  onSave
}: EmployeeRosterModalProps) {
  const [saving, setSaving] = useState(false);
  const [loadingSchedule, setLoadingSchedule] = useState(true);

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
      let start = '08:00';
      let end = '15:00';

      if (current.is_morning) {
        start = '08:00';
        if (current.is_night) end = '08:00';
        else if (current.is_evening) end = '20:00';
        else end = '15:00';
      } else if (current.is_evening) {
        start = '14:30';
        if (current.is_night) end = '08:00';
        else end = '20:00';
      } else if (current.is_night) {
        start = '20:00';
        end = '08:00';
      }

      current.start_time = start;
      current.end_time = end;
    }

    updated[dayIndex] = current;
    setDays(updated);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const scheduleName = `مناوب - ${employee.full_name}`;
      let targetScheduleId = scheduleId;

      if (targetScheduleId) {
        // Update existing roster schedule
        const { error: schErr } = await supabase
          .from('work_schedules')
          .update({ name: scheduleName, type: 'roster', updated_at: new Date().toISOString() })
          .eq('id', targetScheduleId);
        if (schErr) throw schErr;

        // Update days
        for (const d of days) {
          const { error: dayErr } = await supabase
            .from('work_schedule_days')
            .update({
              is_rest_day: d.is_rest_day,
              is_morning: d.is_morning,
              is_evening: d.is_evening,
              is_night: d.is_night,
              start_time: d.is_rest_day ? null : d.start_time,
              end_time: d.is_rest_day ? null : d.end_time
            })
            .eq('schedule_id', targetScheduleId)
            .eq('day_of_week', d.day_of_week);
          if (dayErr) throw dayErr;
        }
      } else {
        // Create new roster schedule
        const { data: newSch, error: schErr } = await supabase
          .from('work_schedules')
          .insert({
            name: scheduleName,
            type: 'roster',
            is_default: false,
            grace_period_minutes: 0
          })
          .select()
          .single();
        if (schErr) throw schErr;
        targetScheduleId = newSch.id;

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
      }

      // Link profile to this roster schedule
      const { error: profErr } = await supabase
        .from('profiles')
        .update({ work_schedule_id: targetScheduleId })
        .eq('id', employee.id);
      if (profErr) throw profErr;

      toast.success(`تم حفظ وتعميم جدول المناوبة لـ ${employee.full_name} بنجاح`);
      onSave();
      onClose();
    } catch (err: any) {
      toast.error('حدث خطأ أثناء الحفظ: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[99999] flex items-center justify-center p-4 sm:p-6 pb-28 pt-8 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-3xl max-h-[75vh] flex flex-col shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden my-auto">
        {/* Header */}
        <div className="flex justify-between items-center p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 shrink-0">
          <div>
            <h3 className="text-base font-bold text-slate-800 dark:text-white flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-purple-600" />
              تخصيص جدول المناوبة والشفتات للموظف: {employee.full_name}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
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

        {/* Body with Smooth Scrolling & Bottom Breathing Space */}
        <div className="flex-1 min-h-0 overflow-y-auto p-6 pb-28 space-y-4 custom-scrollbar">
          <div className="bg-purple-50/60 dark:bg-purple-950/20 border border-purple-100 dark:border-purple-900/30 p-3.5 rounded-xl text-xs text-purple-900 dark:text-purple-300 flex items-center justify-between">
            <span>
              حدد أيام العمل والشفتات المناسبة لهذا الموظف. الأيام المؤشر عليها كـ <strong>(تعويضية)</strong> تُسجل راحة للمناوب ولا تُحسب كغياب.
            </span>
          </div>

          {loadingSchedule ? (
            <div className="py-12 text-center text-slate-400">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-2" />
              جاري تحميل جدول الموظف...
            </div>
          ) : (
            <div className="space-y-3">
              {days.map((day, index) => {
                const isRest = day.is_rest_day;

                return (
                  <div
                    key={day.day_of_week}
                    className={`p-3.5 rounded-xl border transition-all ${
                      isRest
                        ? 'bg-emerald-50/40 dark:bg-emerald-950/15 border-emerald-100 dark:border-emerald-900/30'
                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-xs'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      {/* Day Name and Rest Checkbox */}
                      <div className="flex items-center gap-3 w-44">
                        <span className="font-bold text-xs text-slate-800 dark:text-slate-200 w-16">
                          {getDayName(day.day_of_week)}
                        </span>

                        <label className="flex items-center gap-1.5 cursor-pointer bg-slate-50 dark:bg-slate-900/80 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700">
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
                      </div>

                      {/* Shifts Checkboxes / Buttons */}
                      <div className="flex flex-wrap items-center gap-2 flex-1 sm:justify-end">
                        {isRest ? (
                          <div className="text-xs font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-100/70 dark:bg-emerald-900/30 px-3 py-1 rounded-lg">
                            تعويضية (راحة تامة بدون دوام)
                          </div>
                        ) : (
                          <>
                            {/* Morning */}
                            <label className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-bold cursor-pointer transition-all ${
                              day.is_morning
                                ? 'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-300 border-amber-300 dark:border-amber-700'
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
                            <label className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-bold cursor-pointer transition-all ${
                              day.is_evening
                                ? 'bg-orange-100 text-orange-900 dark:bg-orange-900/40 dark:text-orange-300 border-orange-300 dark:border-orange-700'
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
                            <label className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-bold cursor-pointer transition-all ${
                              day.is_night
                                ? 'bg-indigo-100 text-indigo-900 dark:bg-indigo-900/40 dark:text-indigo-300 border-indigo-300 dark:border-indigo-700'
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
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
