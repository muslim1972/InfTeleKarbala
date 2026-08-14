import { useState } from 'react';
import { X, Save, Clock, Calendar, Sun, Sunset, Moon, ShieldCheck } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { toast } from 'react-hot-toast';

interface WorkScheduleFormProps {
  schedule?: any;
  onClose: () => void;
  onSave: () => void;
}

export default function WorkScheduleForm({ schedule, onClose, onSave }: WorkScheduleFormProps) {
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState(schedule?.name || '');
  const [scheduleType, setScheduleType] = useState<'fixed' | 'roster'>(schedule?.type === 'roster' ? 'roster' : 'fixed');
  const [isDefault, setIsDefault] = useState(schedule?.is_default || false);
  const [gracePeriod, setGracePeriod] = useState(schedule?.grace_period_minutes || 15);

  const defaultDays = Array.from({ length: 7 }).map((_, i) => ({
    day_of_week: i,
    is_rest_day: i === 5 || i === 6,
    is_morning: i !== 5 && i !== 6,
    is_evening: false,
    is_night: false,
    start_time: '08:00',
    end_time: '15:00'
  }));

  const initialDays = schedule?.days?.map((d: any) => ({
    ...d,
    is_morning: d.is_morning ?? (!d.is_rest_day && (!d.start_time || d.start_time.startsWith('08'))),
    is_evening: d.is_evening ?? (d.start_time?.startsWith('14') || d.end_time?.startsWith('20')),
    is_night: d.is_night ?? (d.start_time?.startsWith('20') || d.end_time?.startsWith('08'))
  })) || defaultDays;

  const [days, setDays] = useState<any[]>(initialDays);

  const getDayName = (dayIndex: number) => {
    const daysArr = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
    return daysArr[dayIndex];
  };

  const handleToggleShift = (index: number, shiftType: 'morning' | 'evening' | 'night') => {
    const newDays = [...days];
    const current = { ...newDays[index] };
    
    if (shiftType === 'morning') current.is_morning = !current.is_morning;
    if (shiftType === 'evening') current.is_evening = !current.is_evening;
    if (shiftType === 'night') current.is_night = !current.is_night;

    const hasAnyShift = current.is_morning || current.is_evening || current.is_night;
    current.is_rest_day = !hasAnyShift;

    // Compute start & end time
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

    newDays[index] = current;
    setDays(newDays);
  };

  const handleStandardDayChange = (index: number, field: string, value: any) => {
    const newDays = [...days];
    newDays[index] = { ...newDays[index], [field]: value };
    if (field === 'is_rest_day') {
      newDays[index].is_morning = !value;
      if (value) {
        newDays[index].is_evening = false;
        newDays[index].is_night = false;
      }
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
            type: scheduleType, 
            is_default: isDefault, 
            grace_period_minutes: gracePeriod 
          })
          .eq('id', scheduleId);
        if (scheduleError) throw scheduleError;

        // Update days
        for (const day of days) {
          const { error: dayError } = await supabase
            .from('work_schedule_days')
            .update({
              is_rest_day: day.is_rest_day,
              is_morning: !!day.is_morning,
              is_evening: !!day.is_evening,
              is_night: !!day.is_night,
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
            type: scheduleType, 
            is_default: isDefault, 
            grace_period_minutes: gracePeriod 
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
          is_morning: !!d.is_morning,
          is_evening: !!d.is_evening,
          is_night: !!d.is_night,
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
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl">
        <div className="flex justify-between items-center p-6 border-b border-slate-100 dark:border-slate-800">
          <h2 className="text-xl font-bold flex items-center gap-2 text-slate-800 dark:text-white">
            <Calendar className="w-5 h-5 text-blue-500" />
            {schedule ? 'تعديل جدول العمل' : 'إضافة جدول عمل جديد'}
          </h2>
          <div className="flex items-center gap-3">
            <button
              type="submit"
              form="schedule-form"
              disabled={loading}
              className="px-4 py-2 rounded-lg font-medium text-white bg-blue-600 hover:bg-blue-700 flex items-center gap-2 transition-colors disabled:opacity-70 text-sm shadow-sm"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              حفظ التعديلات
            </button>
            <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-500 bg-slate-50 dark:bg-slate-800/50">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-6 pb-12 custom-scrollbar">
          <form id="schedule-form" onSubmit={handleSubmit} className="space-y-8">
            {/* Basic Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">اسم الجدول</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 dark:bg-slate-800 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-800 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                  placeholder="مثال: الدوام الصباحي الأساسي أو جدول مناوبة التسويق"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">فترة السماح للتأخير (بالدقائق للدوام الصباحي)</label>
                <div className="relative">
                  <Clock className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="number"
                    value={gracePeriod}
                    onChange={(e) => setGracePeriod(parseInt(e.target.value) || 0)}
                    min="0"
                    className="w-full bg-slate-50 border border-slate-200 dark:bg-slate-800 dark:border-slate-700 rounded-xl pr-10 pl-4 py-3 text-slate-800 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    required
                  />
                </div>
              </div>
            </div>

            {/* Schedule Type Selection */}
            <div className="bg-slate-50 dark:bg-slate-800/40 p-5 rounded-2xl border border-slate-100 dark:border-slate-700">
              <label className="block text-sm font-bold text-slate-800 dark:text-white mb-3">نوع نظام الدوام</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setScheduleType('fixed')}
                  className={`p-4 rounded-xl border text-right transition-all flex items-start gap-3 ${
                    scheduleType === 'fixed'
                      ? 'bg-blue-50/80 border-blue-500 dark:bg-blue-900/20 dark:border-blue-500 ring-2 ring-blue-500/20'
                      : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-slate-300'
                  }`}
                >
                  <Sun className={`w-6 h-6 shrink-0 mt-0.5 ${scheduleType === 'fixed' ? 'text-blue-600' : 'text-slate-400'}`} />
                  <div>
                    <div className="font-bold text-slate-800 dark:text-white text-sm">دوام اعتيادي (صباحي يومي)</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      دوام صباحي ثابت يومياً (08:00 ص - 03:00 م) يتأثر بالعطل الرسمية وعطلة نهاية الأسبوع.
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setScheduleType('roster')}
                  className={`p-4 rounded-xl border text-right transition-all flex items-start gap-3 ${
                    scheduleType === 'roster'
                      ? 'bg-blue-50/80 border-blue-500 dark:bg-blue-900/20 dark:border-blue-500 ring-2 ring-blue-500/20'
                      : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-slate-300'
                  }`}
                >
                  <ShieldCheck className={`w-6 h-6 shrink-0 mt-0.5 ${scheduleType === 'roster' ? 'text-blue-600' : 'text-slate-400'}`} />
                  <div>
                    <div className="font-bold text-slate-800 dark:text-white text-sm">دوام مناوب (شفتات متعددة)</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      جدول أسبوعي مخصص يجمع (صباحي / مسائي / خفر)، لا يتأثر بالعطل، والأيام الخالية تُحسب تعويضية.
                    </div>
                  </div>
                </button>
              </div>
            </div>

            <div className="flex gap-6 items-center">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isDefault}
                  onChange={(e) => setIsDefault(e.target.checked)}
                  className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500 border-slate-300"
                />
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">تعيين كجدول افتراضي للموظفين الجدد</span>
              </label>
            </div>

            {/* Days Settings */}
            <div>
              <div className="flex justify-between items-center mb-4 border-b border-slate-100 dark:border-slate-800 pb-2">
                <h3 className="text-lg font-bold text-slate-800 dark:text-white">
                  {scheduleType === 'roster' ? 'جدول توزيع الشفتات الأسبوعي للمناوب' : 'أوقات الدوام الأسبوعية'}
                </h3>
                {scheduleType === 'roster' && (
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    اختر الشفتات المطلوبة لكل يوم، والأيام غير المحددة تُعتبر (تعويضية).
                  </div>
                )}
              </div>

              {scheduleType === 'roster' ? (
                /* Roster Matrix View */
                <div className="space-y-3">
                  {days.map((day, index) => {
                    const hasShifts = day.is_morning || day.is_evening || day.is_night;
                    return (
                      <div 
                        key={day.day_of_week} 
                        className={`p-4 rounded-xl border transition-all ${
                          hasShifts 
                            ? 'bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 shadow-xs' 
                            : 'bg-emerald-50/40 dark:bg-emerald-950/10 border-emerald-100 dark:border-emerald-900/30'
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="flex items-center gap-3 w-32">
                            <span className="font-bold text-slate-800 dark:text-slate-200">{getDayName(day.day_of_week)}</span>
                            {!hasShifts && (
                              <span className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 text-xs px-2 py-0.5 rounded-md font-bold">
                                تعويضية
                              </span>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-2 flex-1 sm:justify-end">
                            {/* Morning Shift Button */}
                            <button
                              type="button"
                              onClick={() => handleToggleShift(index, 'morning')}
                              className={`px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                                day.is_morning
                                  ? 'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-300 border border-amber-300 dark:border-amber-700 shadow-xs'
                                  : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-transparent hover:bg-slate-200 dark:hover:bg-slate-700'
                              }`}
                            >
                              <Sun className="w-3.5 h-3.5" />
                              صباحي (08:00 - 15:00)
                            </button>

                            {/* Evening Shift Button */}
                            <button
                              type="button"
                              onClick={() => handleToggleShift(index, 'evening')}
                              className={`px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                                day.is_evening
                                  ? 'bg-orange-100 text-orange-900 dark:bg-orange-900/40 dark:text-orange-300 border border-orange-300 dark:border-orange-700 shadow-xs'
                                  : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-transparent hover:bg-slate-200 dark:hover:bg-slate-700'
                              }`}
                            >
                              <Sunset className="w-3.5 h-3.5" />
                              مسائي (14:30 - 20:00)
                            </button>

                            {/* Night/Guard Shift Button */}
                            <button
                              type="button"
                              onClick={() => handleToggleShift(index, 'night')}
                              className={`px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                                day.is_night
                                  ? 'bg-indigo-100 text-indigo-900 dark:bg-indigo-900/40 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-700 shadow-xs'
                                  : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-transparent hover:bg-slate-200 dark:hover:bg-slate-700'
                              }`}
                            >
                              <Moon className="w-3.5 h-3.5" />
                              خفر (20:00 - 08:00ص)
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                /* Standard Fixed View */
                <div className="space-y-4">
                  {days.map((day, index) => (
                    <div key={day.day_of_week} className="flex flex-col md:flex-row gap-4 items-center bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-100 dark:border-slate-700/50">
                      <div className="w-full md:w-32 font-bold text-slate-700 dark:text-slate-300">
                        {getDayName(day.day_of_week)}
                      </div>
                      
                      <div className="flex-1 flex gap-4 w-full">
                        <label className="flex items-center gap-2 cursor-pointer shrink-0">
                          <input
                            type="checkbox"
                            checked={day.is_rest_day}
                            onChange={(e) => handleStandardDayChange(index, 'is_rest_day', e.target.checked)}
                            className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 border-slate-300"
                          />
                          <span className="text-sm font-medium text-slate-600 dark:text-slate-400">عطلة</span>
                        </label>

                        {!day.is_rest_day && (
                          <div className="flex gap-4 flex-1">
                            <div className="flex-1">
                              <input
                                type="time"
                                value={day.start_time?.substring(0, 5) || '08:00'}
                                onChange={(e) => handleStandardDayChange(index, 'start_time', e.target.value)}
                                className="w-full bg-white border border-slate-200 dark:bg-slate-900 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-800 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                required={!day.is_rest_day}
                              />
                            </div>
                            <span className="text-slate-400 self-center">إلى</span>
                            <div className="flex-1">
                              <input
                                type="time"
                                value={day.end_time?.substring(0, 5) || '15:00'}
                                onChange={(e) => handleStandardDayChange(index, 'end_time', e.target.value)}
                                className="w-full bg-white border border-slate-200 dark:bg-slate-900 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-800 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                required={!day.is_rest_day}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
