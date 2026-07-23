import { useState } from 'react';
import { X, Save, Clock, Calendar } from 'lucide-react';
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
  const [type, _setType] = useState(schedule?.type || 'fixed');
  const [isDefault, setIsDefault] = useState(schedule?.is_default || false);
  const [gracePeriod, setGracePeriod] = useState(schedule?.grace_period_minutes || 15);

  const defaultDays = Array.from({ length: 7 }).map((_, i) => ({
    day_of_week: i,
    is_rest_day: i === 5 || i === 6,
    start_time: '08:00',
    end_time: '15:00'
  }));

  const [days, setDays] = useState<any[]>(schedule?.days || defaultDays);

  const getDayName = (dayIndex: number) => {
    const daysArr = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
    return daysArr[dayIndex];
  };

  const handleDayChange = (index: number, field: string, value: any) => {
    const newDays = [...days];
    newDays[index] = { ...newDays[index], [field]: value };
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
          .update({ name, type, is_default: isDefault, grace_period_minutes: gracePeriod })
          .eq('id', scheduleId);
        if (scheduleError) throw scheduleError;

        // Update days
        for (const day of days) {
          const { error: dayError } = await supabase
            .from('work_schedule_days')
            .update({
              is_rest_day: day.is_rest_day,
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
          .insert({ name, type, is_default: isDefault, grace_period_minutes: gracePeriod })
          .select()
          .single();
        if (scheduleError) throw scheduleError;
        scheduleId = newSchedule.id;

        // Create days
        const daysToInsert = days.map(d => ({
          schedule_id: scheduleId,
          day_of_week: d.day_of_week,
          is_rest_day: d.is_rest_day,
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
              className="px-4 py-2 rounded-lg font-medium text-white bg-blue-600 hover:bg-blue-700 flex items-center gap-2 transition-colors disabled:opacity-70 text-sm"
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
                  placeholder="مثال: الدوام الصباحي الأساسي"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">فترة السماح للتأخير (بالدقائق)</label>
                <div className="relative">
                  <Clock className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="number"
                    value={gracePeriod}
                    onChange={(e) => setGracePeriod(parseInt(e.target.value))}
                    min="0"
                    className="w-full bg-slate-50 border border-slate-200 dark:bg-slate-800 dark:border-slate-700 rounded-xl pr-10 pl-4 py-3 text-slate-800 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    required
                  />
                </div>
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
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">تعيين كجدول افتراضي</span>
              </label>
            </div>

            {/* Days Settings */}
            <div>
              <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4 border-b border-slate-100 dark:border-slate-800 pb-2">أوقات الدوام الأسبوعية</h3>
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
                          onChange={(e) => handleDayChange(index, 'is_rest_day', e.target.checked)}
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
                              onChange={(e) => handleDayChange(index, 'start_time', e.target.value)}
                              className="w-full bg-white border border-slate-200 dark:bg-slate-900 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-800 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                              required={!day.is_rest_day}
                            />
                          </div>
                          <span className="text-slate-400 self-center">إلى</span>
                          <div className="flex-1">
                            <input
                              type="time"
                              value={day.end_time?.substring(0, 5) || '15:00'}
                              onChange={(e) => handleDayChange(index, 'end_time', e.target.value)}
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
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
