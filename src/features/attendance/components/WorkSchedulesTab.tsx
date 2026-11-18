import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { Calendar, Clock, Edit2, FileText } from 'lucide-react';
import { toast } from 'react-hot-toast';
import WorkScheduleForm from './WorkScheduleForm';
import WeeklyExemptionsSection from './WeeklyExemptionsSection';
import SpecialWorkHoursSection from './SpecialWorkHoursSection';

type SubTabKey = 'general' | 'exemptions' | 'special_hours';

export default function WorkSchedulesTab() {
  const [activeSubTab, setActiveSubTab] = useState<SubTabKey>('general');
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

  return (
    <div className="space-y-3 animate-in fade-in duration-200">
      {/* ── Sub-tabs Navigation Bar (1. الجداول العامة | 2. التفرغ | 3. دوام خاص) ── */}
      <div className="flex items-center gap-2 p-1.5 bg-slate-100 dark:bg-slate-800/90 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xs">
        <button
          type="button"
          onClick={() => setActiveSubTab('general')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all ${
            activeSubTab === 'general'
              ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs ring-1 ring-slate-200 dark:ring-slate-600'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Calendar className="w-4 h-4 shrink-0" />
          <span>1. الجداول العامة</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('exemptions')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all ${
            activeSubTab === 'exemptions'
              ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs ring-1 ring-slate-200 dark:ring-slate-600'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <FileText className="w-4 h-4 shrink-0" />
          <span>2. التفرغ</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('special_hours')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all ${
            activeSubTab === 'special_hours'
              ? 'bg-white dark:bg-slate-700 text-amber-600 dark:text-amber-400 shadow-xs ring-1 ring-slate-200 dark:ring-slate-600'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Clock className="w-4 h-4 shrink-0" />
          <span>3. دوام خاص</span>
        </button>
      </div>

      {/* ── Tab Content ── */}
      {activeSubTab === 'general' && (
        <div className="space-y-3">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {schedules
                .filter(s => 
                  s.type !== 'roster' && 
                  s.type !== 'special' && 
                  !s.employee_id && 
                  !s.name?.startsWith('مناوب') && 
                  !s.name?.includes('مناوب') &&
                  !s.name?.includes('دوام خاص')
                )
                .map((schedule) => {
                  const isRoster = schedule.type === 'roster';
                  const nameLower = (schedule.name || '').toLowerCase();
                  const isEvening = nameLower.includes('مسائي') || schedule.days?.some((d: any) => d.is_evening || d.start_time?.startsWith('14'));
                  const isNight = nameLower.includes('خفر') || schedule.days?.some((d: any) => d.is_night || d.start_time?.startsWith('20'));

                  let typeBadgeText = 'دوام صباحي (08:00 - 15:00)';
                  let typeBadgeClass = 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
                  let showGrace = true;

                  if (isRoster) {
                    typeBadgeText = 'دوام مناوب (شفتات)';
                    typeBadgeClass = 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300 font-bold';
                    showGrace = false;
                  } else if (isEvening) {
                    typeBadgeText = 'دوام مسائي (14:30 - 20:00)';
                    typeBadgeClass = 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300 font-bold';
                    showGrace = false;
                  } else if (isNight) {
                    typeBadgeText = 'دوام خفر (20:00 - 08:00ص)';
                    typeBadgeClass = 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300 font-bold';
                    showGrace = false;
                  }

                  return (
                    <div key={schedule.id} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/90 dark:border-slate-700/80 overflow-hidden shadow-xs">
                      {/* Compact Schedule Header */}
                      <div className="px-4 py-2.5 sm:px-5 sm:py-3 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 flex justify-between items-center">
                        <div>
                          <div className="flex items-center gap-2.5">
                            <h3 className="text-base sm:text-lg font-bold text-slate-800 dark:text-white">{schedule.name}</h3>
                            {schedule.is_default && (
                              <span className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 text-[11px] sm:text-xs px-2.5 py-0.5 rounded-full font-bold">
                                الافتراضي
                              </span>
                            )}
                            <span className={`text-[11px] sm:text-xs px-2.5 py-0.5 rounded-full font-medium ${typeBadgeClass}`}>
                              {typeBadgeText}
                            </span>
                          </div>
                          {showGrace ? (
                            <p className="text-xs sm:text-sm text-slate-500 mt-1 flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5 text-slate-400" />
                              فترة السماح للتأخير: <strong className="text-slate-700 dark:text-slate-300">{schedule.grace_period_minutes} دقيقة</strong>
                            </p>
                          ) : (
                            <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5 text-amber-500" />
                              الالتزام بموعد البداية والنهاية بدقة (بدون فترة سماحية)
                            </p>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <button 
                            onClick={() => { setEditingSchedule(schedule); setIsFormOpen(true); }}
                            className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors cursor-pointer"
                            title="تعديل هذا الجدول"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Compact Days Container (Zero Gap - Full Width on Mobile) */}
                      <div className="p-2.5 sm:p-3.5">
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-7 gap-2 sm:gap-2.5">
                          {schedule.days?.map((day: any) => {
                            const isRest = day.is_rest_day;

                            return (
                              <div 
                                key={day.id || day.day_of_week} 
                                className={`flex items-center justify-between px-3.5 py-2.5 sm:px-3 sm:py-2 rounded-xl border transition-all ${
                                  isRest 
                                    ? 'bg-slate-50/90 border-slate-200/80 dark:bg-slate-900/50 dark:border-slate-800'
                                    : 'bg-blue-50/40 border-blue-100 hover:border-blue-200 dark:bg-blue-950/20 dark:border-blue-900/30'
                                }`}
                              >
                                {/* اسم اليوم */}
                                <div className="flex items-center gap-2">
                                  <span className={`w-2 h-2 rounded-full shrink-0 ${isRest ? 'bg-slate-300 dark:bg-slate-600' : 'bg-blue-500 dark:bg-blue-400'}`}></span>
                                  <span className="font-bold text-sm sm:text-base text-slate-800 dark:text-slate-100 whitespace-nowrap">
                                    {getDayName(day.day_of_week)}
                                  </span>
                                </div>
                                
                                {/* التوقيتات أو العطلة على نفس السطر */}
                                {isRest ? (
                                  <span className="text-xs sm:text-sm font-bold px-2.5 py-1 rounded-lg text-slate-500 dark:text-slate-400 bg-slate-200/80 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 whitespace-nowrap">
                                    {day.day_of_week === 5 || day.day_of_week === 6 ? 'عطلة أسبوعية' : 'عطلة'}
                                  </span>
                                ) : (
                                  <div className="flex items-center gap-1.5 bg-white dark:bg-slate-800 px-2.5 py-1 rounded-lg border border-blue-100 dark:border-slate-700 shadow-2xs font-mono">
                                    <span className="text-sm sm:text-base font-bold text-blue-600 dark:text-blue-400">
                                      {day.start_time?.substring(0, 5) || '08:00'}
                                    </span>
                                    <span className="text-xs text-slate-400 dark:text-slate-500 font-sans font-medium px-0.5">إلى</span>
                                    <span className="text-sm sm:text-base font-bold text-blue-600 dark:text-blue-400">
                                      {day.end_time?.substring(0, 5) || '15:00'}
                                    </span>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      )}

      {activeSubTab === 'exemptions' && (
        <WeeklyExemptionsSection />
      )}

      {activeSubTab === 'special_hours' && (
        <SpecialWorkHoursSection />
      )}

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
