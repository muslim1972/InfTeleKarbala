import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { Calendar, Clock, Plus, Trash2, Edit2 } from 'lucide-react';
import { toast } from 'react-hot-toast';
import WorkScheduleForm from './WorkScheduleForm';

export default function WorkSchedulesTab() {
  const [schedules, setSchedules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingSchedule, setEditingSchedule] = useState<any>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);

  // Load schedules
  const loadSchedules = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('work_schedules')
        .select(`
          *,
          days:work_schedule_days(*)
        `)
        .order('is_default', { ascending: false });

      if (error) throw error;
      
      // Sort days for each schedule (Sunday = 0 to Saturday = 6)
      const sortedData = data?.map(sch => ({
        ...sch,
        days: sch.days.sort((a: any, b: any) => a.day_of_week - b.day_of_week)
      }));
      
      setSchedules(sortedData || []);
    } catch (err: any) {
      toast.error('فشل تحميل جداول العمل: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSchedules();
  }, []);

  const getDayName = (dayIndex: number) => {
    const days = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
    return days[dayIndex];
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-100 dark:border-slate-700">
        <div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <Calendar className="w-6 h-6 text-blue-500" />
            جداول العمل (Work Schedules)
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            إدارة أوقات الدوام وأيام العطل لمختلف أقسام وفئات الموظفين.
          </p>
        </div>
        <button 
          onClick={() => { setEditingSchedule(null); setIsFormOpen(true); }}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl flex items-center gap-2 transition-colors"
        >
          <Plus className="w-5 h-5" />
          إضافة جدول جديد
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {schedules.map((schedule) => (
          <div key={schedule.id} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 overflow-hidden shadow-sm">
            <div className="p-6 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 flex justify-between items-start">
              <div>
                <div className="flex items-center gap-3">
                  <h3 className="text-lg font-bold text-slate-800 dark:text-white">{schedule.name}</h3>
                  {schedule.is_default && (
                    <span className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 text-xs px-2.5 py-0.5 rounded-full font-medium">
                      الافتراضي
                    </span>
                  )}
                  <span className="bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300 text-xs px-2.5 py-0.5 rounded-full font-medium">
                    {schedule.type === 'fixed' ? 'دوام ثابت' : 'دوام مرن'}
                  </span>
                </div>
                <p className="text-sm text-slate-500 mt-2 flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  فترة السماح للتأخير: <strong className="text-slate-700 dark:text-slate-300">{schedule.grace_period_minutes} دقيقة</strong>
                </p>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => { setEditingSchedule(schedule); setIsFormOpen(true); }}
                  className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                {!schedule.is_default && (
                  <button 
                    onClick={async () => {
                      if(window.confirm('هل أنت متأكد من حذف هذا الجدول؟')) {
                        try {
                          const { error } = await supabase.from('work_schedules').delete().eq('id', schedule.id);
                          if(error) throw error;
                          toast.success('تم حذف الجدول بنجاح');
                          loadSchedules();
                        } catch(err: any) {
                          toast.error('فشل الحذف: ' + err.message);
                        }
                      }
                    }}
                    className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            <div className="p-6">
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
                {schedule.days?.map((day: any) => (
                  <div 
                    key={day.id} 
                    className={`p-3 rounded-xl border text-center ${
                      day.is_rest_day 
                        ? 'bg-slate-50 border-slate-100 dark:bg-slate-900/50 dark:border-slate-800' 
                        : 'bg-blue-50/30 border-blue-100 dark:bg-blue-900/10 dark:border-blue-900/30'
                    }`}
                  >
                    <div className="font-bold text-sm mb-2 text-slate-700 dark:text-slate-300">
                      {getDayName(day.day_of_week)}
                    </div>
                    {day.is_rest_day ? (
                      <div className="text-xs font-medium text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 py-1 rounded-lg">
                        عطلة (Rest Day)
                      </div>
                    ) : (
                      <div className="flex items-center justify-center gap-1.5 mt-2 bg-white dark:bg-slate-800 py-1.5 rounded-lg border border-blue-50 dark:border-slate-700">
                        <div className="text-[11px] font-mono font-bold text-blue-600 dark:text-blue-400">
                          {day.start_time?.substring(0, 5)}
                        </div>
                        <div className="text-slate-400 dark:text-slate-500 text-[10px] font-medium px-1">إلى</div>
                        <div className="text-[11px] font-mono font-bold text-blue-600 dark:text-blue-400">
                          {day.end_time?.substring(0, 5)}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {isFormOpen && (
        <WorkScheduleForm 
          schedule={editingSchedule}
          onClose={() => setIsFormOpen(false)}
          onSave={() => {
            setIsFormOpen(false);
            loadSchedules();
          }}
        />
      )}
    </div>
  );
}
