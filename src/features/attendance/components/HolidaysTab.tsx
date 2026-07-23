import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { Plus, Trash2, Calendar, Settings, Edit2, Save, X, Activity } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { format } from 'date-fns';
import { arSA } from 'date-fns/locale';

export default function HolidaysTab() {
  const [holidays, setHolidays] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState<any>(null);

  // Modal states
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [holidayName, setHolidayName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  // Settings edit state
  const [isEditingSettings, setIsEditingSettings] = useState(false);
  const [workDays, setWorkDays] = useState<string[]>([]);
  const [weekendDays, setWeekendDays] = useState<string[]>([]);

  const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dayNamesArabic: Record<string, string> = {
    'Sunday': 'الأحد',
    'Monday': 'الإثنين',
    'Tuesday': 'الثلاثاء',
    'Wednesday': 'الأربعاء',
    'Thursday': 'الخميس',
    'Friday': 'الجمعة',
    'Saturday': 'السبت'
  };

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load Holidays
      const { data: holidaysData, error: hError } = await supabase
        .from('official_holidays')
        .select('*')
        .order('start_date', { ascending: false });
      
      if (hError) throw hError;
      setHolidays(holidaysData || []);

      // Load Settings
      const { data: settingsData, error: sError } = await supabase
        .from('attendance_settings')
        .select('*')
        .eq('id', 1)
        .single();
      
      if (sError && sError.code !== 'PGRST116') throw sError;
      
      if (settingsData) {
        setSettings(settingsData);
        setWorkDays(settingsData.work_days || []);
        setWeekendDays(settingsData.weekend_days || []);
      }
    } catch (error: any) {
      toast.error('حدث خطأ أثناء جلب البيانات: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    try {
      const { error } = await supabase
        .from('attendance_settings')
        .upsert({
          id: 1,
          work_days: workDays,
          weekend_days: weekendDays
        });
      
      if (error) throw error;
      toast.success('تم حفظ الإعدادات الافتراضية بنجاح');
      setIsEditingSettings(false);
      loadData();
    } catch (error: any) {
      toast.error('فشل حفظ الإعدادات: ' + error.message);
    }
  };

  const handleSubmitHoliday = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!holidayName || !startDate || !endDate) {
      return toast.error('يرجى ملء جميع الحقول');
    }
    
    if (new Date(startDate) > new Date(endDate)) {
      return toast.error('تاريخ البداية يجب أن يكون قبل أو يساوي تاريخ النهاية');
    }

    try {
      if (editingId) {
        const { error } = await supabase
          .from('official_holidays')
          .update({
            name: holidayName,
            start_date: startDate,
            end_date: endDate
          })
          .eq('id', editingId);
        if (error) throw error;
        toast.success('تم تعديل العطلة بنجاح');
      } else {
        const { error } = await supabase
          .from('official_holidays')
          .insert([{
            name: holidayName,
            start_date: startDate,
            end_date: endDate
          }]);
        if (error) throw error;
        toast.success('تمت إضافة العطلة بنجاح');
      }
      
      setShowForm(false);
      loadData();
    } catch (error: any) {
      toast.error('فشل حفظ العطلة: ' + error.message);
    }
  };

  const handleDeleteHoliday = async (id: string) => {
    if (!window.confirm('هل أنت متأكد من حذف هذه العطلة؟')) return;
    try {
      const { error } = await supabase.from('official_holidays').delete().eq('id', id);
      if (error) throw error;
      toast.success('تم حذف العطلة');
      loadData();
    } catch (error: any) {
      toast.error('فشل الحذف: ' + error.message);
    }
  };

  const openAddForm = () => {
    setEditingId(null);
    setHolidayName('');
    setStartDate('');
    setEndDate('');
    setShowForm(true);
  };

  const openEditForm = (holiday: any) => {
    setEditingId(holiday.id);
    setHolidayName(holiday.name);
    setStartDate(holiday.start_date);
    setEndDate(holiday.end_date);
    setShowForm(true);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Global Settings Section */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-100 dark:bg-blue-900/30 text-blue-600 rounded-xl">
              <Settings className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800 dark:text-white">إعدادات الدوام الافتراضية</h2>
              <p className="text-sm text-slate-500 mt-1">تحديد أيام العمل وأيام العطل الأسبوعية الافتراضية للمديرية.</p>
            </div>
          </div>
          {!isEditingSettings ? (
            <button
              onClick={() => setIsEditingSettings(true)}
              className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600 rounded-lg transition-colors font-medium"
            >
              <Edit2 className="w-4 h-4" />
              تعديل الإعدادات
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setIsEditingSettings(false);
                  if (settings) {
                    setWorkDays(settings.work_days || []);
                    setWeekendDays(settings.weekend_days || []);
                  }
                }}
                className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600 rounded-lg transition-colors font-medium"
              >
                إلغاء
              </button>
              <button
                onClick={handleSaveSettings}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white hover:bg-emerald-700 rounded-lg transition-colors font-medium shadow-sm"
              >
                <Save className="w-4 h-4" />
                حفظ التغييرات
              </button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div>
            <h3 className="font-bold text-slate-700 dark:text-slate-300 mb-4 flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-500" />
              أيام العمل الأسبوعية الافتراضية
            </h3>
            <div className="flex flex-wrap gap-2">
              {daysOfWeek.map(day => {
                const isSelected = workDays.includes(day);
                return (
                  <button
                    key={day}
                    disabled={!isEditingSettings}
                    onClick={() => {
                      if (isSelected) {
                        setWorkDays(prev => prev.filter(d => d !== day));
                      } else {
                        setWorkDays(prev => [...prev, day]);
                        setWeekendDays(prev => prev.filter(d => d !== day)); // Remove from weekend if added to work
                      }
                    }}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors border ${
                      isSelected 
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-900/30 dark:border-emerald-800 dark:text-emerald-400' 
                        : 'bg-white border-slate-200 text-slate-600 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400 opacity-60'
                    } ${!isEditingSettings ? 'cursor-default' : 'hover:border-emerald-300 cursor-pointer'}`}
                  >
                    {dayNamesArabic[day]}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <h3 className="font-bold text-slate-700 dark:text-slate-300 mb-4 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-rose-500" />
              أيام العطل الأسبوعية الافتراضية
            </h3>
            <div className="flex flex-wrap gap-2">
              {daysOfWeek.map(day => {
                const isSelected = weekendDays.includes(day);
                return (
                  <button
                    key={day}
                    disabled={!isEditingSettings}
                    onClick={() => {
                      if (isSelected) {
                        setWeekendDays(prev => prev.filter(d => d !== day));
                      } else {
                        setWeekendDays(prev => [...prev, day]);
                        setWorkDays(prev => prev.filter(d => d !== day)); // Remove from work if added to weekend
                      }
                    }}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors border ${
                      isSelected 
                        ? 'bg-rose-50 border-rose-200 text-rose-700 dark:bg-rose-900/30 dark:border-rose-800 dark:text-rose-400' 
                        : 'bg-white border-slate-200 text-slate-600 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400 opacity-60'
                    } ${!isEditingSettings ? 'cursor-default' : 'hover:border-rose-300 cursor-pointer'}`}
                  >
                    {dayNamesArabic[day]}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Official Holidays Section */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-amber-100 dark:bg-amber-900/30 text-amber-600 rounded-xl">
              <Calendar className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800 dark:text-white">العطل الرسمية العامة</h2>
              <p className="text-sm text-slate-500 mt-1">تحديد أيام العطل الرسمية كالأعياد والمناسبات العامة.</p>
            </div>
          </div>
          <button
            onClick={openAddForm}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg transition-colors font-medium shadow-sm"
          >
            <Plus className="w-5 h-5" />
            إضافة عطلة
          </button>
        </div>

        {loading ? (
          <div className="text-center py-12 text-slate-500">جاري التحميل...</div>
        ) : holidays.length === 0 ? (
          <div className="text-center py-12 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl text-slate-500 dark:text-slate-400">
            <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>لا توجد عطل رسمية مضافة حالياً.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {holidays.map(holiday => (
              <div key={holiday.id} className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4 flex flex-col justify-between hover:border-blue-300 dark:hover:border-blue-700 transition-colors">
                <div>
                  <h3 className="font-bold text-lg text-slate-800 dark:text-white mb-2">{holiday.name}</h3>
                  <div className="text-sm text-slate-600 dark:text-slate-400 space-y-1">
                    <p>
                      <span className="font-medium text-slate-500">من:</span>{' '}
                      {format(new Date(holiday.start_date), 'dd MMMM yyyy', { locale: arSA })}
                    </p>
                    <p>
                      <span className="font-medium text-slate-500">إلى:</span>{' '}
                      {format(new Date(holiday.end_date), 'dd MMMM yyyy', { locale: arSA })}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2 mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                  <button 
                    onClick={() => openEditForm(holiday)}
                    className="flex-1 px-3 py-1.5 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/40 rounded-lg transition-colors"
                  >
                    تعديل
                  </button>
                  <button 
                    onClick={() => handleDeleteHoliday(holiday.id)}
                    className="px-3 py-1.5 text-sm font-medium text-rose-600 bg-rose-50 hover:bg-rose-100 dark:bg-rose-900/20 dark:hover:bg-rose-900/40 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4 mx-auto" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Holiday Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-md p-6 animate-scale-up shadow-2xl">
            <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-6">
              {editingId ? 'تعديل العطلة' : 'إضافة عطلة جديدة'}
            </h3>
            
            <form onSubmit={handleSubmitHoliday} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">اسم العطلة</label>
                <input 
                  type="text" 
                  value={holidayName}
                  onChange={(e) => setHolidayName(e.target.value)}
                  placeholder="مثال: عطلة عيد الفطر المبارك"
                  className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">تاريخ البداية</label>
                  <input 
                    type="date" 
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">تاريخ النهاية</label>
                  <input 
                    type="date" 
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 mt-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 rounded-lg text-slate-600 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 transition-colors font-medium"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg text-white bg-blue-600 hover:bg-blue-700 transition-colors font-medium flex items-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  حفظ العطلة
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
