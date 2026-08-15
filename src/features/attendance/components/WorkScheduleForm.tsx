import React, { useState } from 'react';
import { X, Save, Clock, Calendar, Sun, Sunset, Moon } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { toast } from 'react-hot-toast';

interface WorkScheduleFormProps {
  schedule?: any;
  onClose: () => void;
  onSave: () => void;
}

type ShiftPreset = 'morning' | 'evening' | 'night' | 'custom';

export default function WorkScheduleForm({ schedule, onClose, onSave }: WorkScheduleFormProps) {
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState(schedule?.name || '');
  const [isDefault, setIsDefault] = useState(schedule?.is_default || false);
  const [gracePeriod, setGracePeriod] = useState(schedule?.grace_period_minutes || 15);

  // Detect preset from initial times
  const detectPreset = (): ShiftPreset => {
    if (!schedule) return 'morning';
    const firstWorkDay = schedule.days?.find((d: any) => !d.is_rest_day);
    if (!firstWorkDay) return 'morning';
    if (firstWorkDay.start_time?.startsWith('14') || firstWorkDay.end_time?.startsWith('20')) return 'evening';
    if (firstWorkDay.start_time?.startsWith('20') || firstWorkDay.end_time?.startsWith('08')) return 'night';
    if (firstWorkDay.start_time?.startsWith('08')) return 'morning';
    return 'custom';
  };

  const [preset, setPreset] = useState<ShiftPreset>(detectPreset());

  const getPresetTimes = (p: ShiftPreset) => {
    switch (p) {
      case 'morning': return { start: '08:00', end: '15:00', grace: 30 };
      case 'evening': return { start: '14:30', end: '20:00', grace: 0 };
      case 'night': return { start: '20:00', end: '08:00', grace: 0 };
      default: return { start: '08:00', end: '15:00', grace: 15 };
    }
  };

  const defaultDays = Array.from({ length: 7 }).map((_, i) => {
    const isWeekend = i === 5 || i === 6; // Friday & Saturday
    const times = getPresetTimes(preset);
    return {
      day_of_week: i,
      is_rest_day: isWeekend,
      start_time: isWeekend ? null : times.start,
      end_time: isWeekend ? null : times.end
    };
  });

  const initialDays = schedule?.days?.map((d: any) => ({
    day_of_week: d.day_of_week,
    is_rest_day: d.is_rest_day,
    start_time: d.start_time?.substring(0, 5) || null,
    end_time: d.end_time?.substring(0, 5) || null
  })) || defaultDays;

  const [days, setDays] = useState<any[]>(initialDays);

  const getDayName = (dayIndex: number) => {
    const daysArr = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
    return daysArr[dayIndex];
  };

  const handlePresetChange = (newPreset: ShiftPreset) => {
    setPreset(newPreset);
    const times = getPresetTimes(newPreset);
    if (newPreset !== 'custom') {
      setGracePeriod(times.grace);
      if (!schedule) {
        if (newPreset === 'morning') setName('الدوام الصباحي الأساسي');
        if (newPreset === 'evening') setName('الدوام المسائي');
        if (newPreset === 'night') setName('دوام الخفر');
      }

      setDays(prev => prev.map(d => ({
        ...d,
        start_time: d.is_rest_day ? null : times.start,
        end_time: d.is_rest_day ? null : times.end
      })));
    }
  };

  const handleDayChange = (index: number, field: string, value: any) => {
    const newDays = [...days];
    newDays[index] = { ...newDays[index], [field]: value };
    if (field === 'is_rest_day' && !value && !newDays[index].start_time) {
      const times = getPresetTimes(preset);
      newDays[index].start_time = times.start;
      newDays[index].end_time = times.end;
    }
    setDays(newDays);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return toast.error('يرجى إدخال اسم الجدول');
    
    setLoading(true);
    try {
      let scheduleId = schedule?.id;

      if (scheduleId) {
        // Update schedule
        const { error: scheduleError } = await supabase
          .from('work_schedules')
          .update({ 
            name, 
            type: 'fixed', 
            is_default: isDefault, 
            grace_period_minutes: preset === 'morning' ? gracePeriod : 0
          })
          .eq('id', scheduleId);
        if (scheduleError) throw scheduleError;

        // Update days
        for (const day of days) {
          const { error: dayError } = await supabase
            .from('work_schedule_days')
            .update({
              is_rest_day: day.is_rest_day,
              is_morning: !day.is_rest_day && (day.start_time?.startsWith('08') || preset === 'morning'),
              is_evening: !day.is_rest_day && (day.start_time?.startsWith('14') || preset === 'evening'),
              is_night: !day.is_rest_day && (day.start_time?.startsWith('20') || preset === 'night'),
              start_time: day.is_rest_day ? null : day.start_time,
              end_time: day.is_rest_day ? null : day.end_time
            })
            .eq('schedule_id', scheduleId)
            .eq('day_of_week', day.day_of_week);
          if (dayError) throw dayError;
        }
      } else {
        // Create new schedule
        const { data: newSchedule, error: scheduleError } = await supabase
          .from('work_schedules')
          .insert({ 
            name, 
            type: 'fixed', 
            is_default: isDefault, 
            grace_period_minutes: preset === 'morning' ? gracePeriod : 0
          })
          .select()
          .single();
        if (scheduleError) throw scheduleError;
        scheduleId = newSchedule.id;

        // Create days
        const daysToInsert = days.map(d => ({
          schedule_id: scheduleId,
          day_of_week: d.day_of_week,
          is_rest_day: d.is_rest_day,
          is_morning: !d.is_rest_day && (d.start_time?.startsWith('08') || preset === 'morning'),
          is_evening: !d.is_rest_day && (d.start_time?.startsWith('14') || preset === 'evening'),
          is_night: !d.is_rest_day && (d.start_time?.startsWith('20') || preset === 'night'),
          start_time: d.is_rest_day ? null : d.start_time,
          end_time: d.is_rest_day ? null : d.end_time
        }));
        
        const { error: daysError } = await supabase
          .from('work_schedule_days')
          .insert(daysToInsert);
        if (daysError) throw daysError;
      }

      toast.success(scheduleId ? 'تم تحديث الجدول بنجاح' : 'تم إضافة الجدول بنجاح');
      onSave();
    } catch (err: any) {
      toast.error('حدث خطأ: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[99999] flex items-center justify-center p-4 sm:p-6 pb-28 pt-8 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-3xl max-h-[75vh] flex flex-col shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden my-auto">
        {/* Header */}
        <div className="flex justify-between items-center p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 shrink-0">
          <h2 className="text-lg font-bold flex items-center gap-2 text-slate-800 dark:text-white">
            <Calendar className="w-5 h-5 text-blue-500" />
            {schedule ? 'تعديل جدول العمل العام' : 'إضافة جدول عمل عام جديد'}
          </h2>
          <div className="flex items-center gap-2">
            <button
              type="submit"
              form="schedule-form"
              disabled={loading}
              className="px-4 py-2 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-700 flex items-center gap-2 transition-colors disabled:opacity-70 text-sm shadow-sm"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              حفظ الجدول
            </button>
            <button onClick={onClose} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors text-slate-500">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Form Body with Smooth Scrolling */}
        <div className="flex-1 min-h-0 overflow-y-auto p-6 pb-28 space-y-6 custom-scrollbar">
          <form id="schedule-form" onSubmit={handleSubmit} className="space-y-6">
            
            {/* Quick Shift Presets */}
            <div>
              <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">نوع شفت الدوام العام</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <button
                  type="button"
                  onClick={() => handlePresetChange('morning')}
                  className={`p-3 rounded-xl border text-center transition-all flex flex-col items-center gap-1.5 ${
                    preset === 'morning'
                      ? 'bg-amber-50 border-amber-500 dark:bg-amber-950/30 text-amber-900 dark:text-amber-300 ring-2 ring-amber-500/20'
                      : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-slate-300'
                  }`}
                >
                  <Sun className="w-5 h-5 text-amber-500" />
                  <span className="font-bold text-xs">دوام صباحي</span>
                  <span className="text-[10px] text-slate-500">08:00 - 15:00</span>
                </button>

                <button
                  type="button"
                  onClick={() => handlePresetChange('evening')}
                  className={`p-3 rounded-xl border text-center transition-all flex flex-col items-center gap-1.5 ${
                    preset === 'evening'
                      ? 'bg-orange-50 border-orange-500 dark:bg-orange-950/30 text-orange-900 dark:text-orange-300 ring-2 ring-orange-500/20'
                      : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-slate-300'
                  }`}
                >
                  <Sunset className="w-5 h-5 text-orange-500" />
                  <span className="font-bold text-xs">دوام مسائي</span>
                  <span className="text-[10px] text-slate-500">14:30 - 20:00</span>
                </button>

                <button
                  type="button"
                  onClick={() => handlePresetChange('night')}
                  className={`p-3 rounded-xl border text-center transition-all flex flex-col items-center gap-1.5 ${
                    preset === 'night'
                      ? 'bg-indigo-50 border-indigo-500 dark:bg-indigo-950/30 text-indigo-900 dark:text-indigo-300 ring-2 ring-indigo-500/20'
                      : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-slate-300'
                  }`}
                >
                  <Moon className="w-5 h-5 text-indigo-500" />
                  <span className="font-bold text-xs">دوام خفر</span>
                  <span className="text-[10px] text-slate-500">20:00 - 08:00ص</span>
                </button>

                <button
                  type="button"
                  onClick={() => handlePresetChange('custom')}
                  className={`p-3 rounded-xl border text-center transition-all flex flex-col items-center gap-1.5 ${
                    preset === 'custom'
                      ? 'bg-blue-50 border-blue-500 dark:bg-blue-950/30 text-blue-900 dark:text-blue-300 ring-2 ring-blue-500/20'
                      : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-slate-300'
                  }`}
                >
                  <Calendar className="w-5 h-5 text-blue-500" />
                  <span className="font-bold text-xs">مخصص</span>
                  <span className="text-[10px] text-slate-500">أوقات يدوية</span>
                </button>
              </div>
            </div>

            {/* Basic Info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">اسم جدول العمل</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 dark:bg-slate-800 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm text-slate-800 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="مثال: الدوام الصباحي الأساسي"
                  required
                />
              </div>

              {preset === 'morning' ? (
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">فترة السماح للتأخير (بالدقائق)</label>
                  <div className="relative">
                    <Clock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="number"
                      value={gracePeriod}
                      onChange={(e) => setGracePeriod(parseInt(e.target.value) || 0)}
                      min="0"
                      className="w-full bg-slate-50 border border-slate-200 dark:bg-slate-800 dark:border-slate-700 rounded-xl pr-9 pl-4 py-2.5 text-sm text-slate-800 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                      required
                    />
                  </div>
                </div>
              ) : (
                <div className="flex items-center">
                  <div className="text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-100 dark:border-slate-700/60 w-full">
                    <span className="font-bold text-amber-600 dark:text-amber-400 block mb-0.5">بدون سماحية</span>
                    الدوام المسائي والخفر يتطلب الالتزام الدقيق بموعد البداية والنهاية لضمان تسليم الموقع.
                  </div>
                </div>
              )}
            </div>

            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={isDefault}
                onChange={(e) => setIsDefault(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 border-slate-300"
              />
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">تعيين كجدول افتراضي للموظفين</span>
            </label>

            {/* Days Settings */}
            <div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-white mb-3">أوقات وأيام الدوام الأسبوعية</h3>
              <div className="space-y-2.5">
                {days.map((day, index) => (
                  <div 
                    key={day.day_of_week} 
                    className={`flex flex-col sm:flex-row gap-3 items-center p-3 rounded-xl border transition-all ${
                      day.is_rest_day 
                        ? 'bg-slate-50 dark:bg-slate-800/30 border-slate-200 dark:border-slate-700/60' 
                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-xs'
                    }`}
                  >
                    <div className="w-full sm:w-28 font-bold text-xs text-slate-700 dark:text-slate-300">
                      {getDayName(day.day_of_week)}
                    </div>
                    
                    <div className="flex-1 flex gap-3 w-full items-center">
                      <label className="flex items-center gap-2 cursor-pointer shrink-0">
                        <input
                          type="checkbox"
                          checked={day.is_rest_day}
                          onChange={(e) => handleDayChange(index, 'is_rest_day', e.target.checked)}
                          className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 border-slate-300"
                        />
                        <span className="text-xs font-bold text-slate-500">عطلة (Rest Day)</span>
                      </label>

                      {!day.is_rest_day ? (
                        <div className="flex gap-2 flex-1 items-center">
                          <div className="flex-1">
                            <input
                              type="time"
                              value={day.start_time?.substring(0, 5) || '08:00'}
                              onChange={(e) => handleDayChange(index, 'start_time', e.target.value)}
                              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 dark:text-white font-mono"
                              required={!day.is_rest_day}
                            />
                          </div>
                          <span className="text-slate-400 text-xs">إلى</span>
                          <div className="flex-1">
                            <input
                              type="time"
                              value={day.end_time?.substring(0, 5) || '15:00'}
                              onChange={(e) => handleDayChange(index, 'end_time', e.target.value)}
                              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 dark:text-white font-mono"
                              required={!day.is_rest_day}
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="text-xs text-slate-400 font-medium">
                          {day.day_of_week === 5 || day.day_of_week === 6 ? 'عطلة نهاية الأسبوع' : 'عطلة أسبوعية'}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
