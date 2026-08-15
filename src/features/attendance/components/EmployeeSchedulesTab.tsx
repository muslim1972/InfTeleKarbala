import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../../lib/supabase';
import { 
  Users, Search, Calendar, Clock, Sun, Sunset, Moon, ShieldCheck, 
  CheckCircle2, Edit2, Save, X, RefreshCw, Check
} from 'lucide-react';
import { toast } from 'react-hot-toast';

export default function EmployeeSchedulesTab() {
  const [employees, setEmployees] = useState<any[]>([]);
  const [workSchedules, setWorkSchedules] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('all');
  const [scheduleFilter, setScheduleFilter] = useState('all');

  // Modal State
  const [editingEmployee, setEditingEmployee] = useState<any | null>(null);
  const [saving, setSaving] = useState(false);
  const [assignmentMode, setAssignmentMode] = useState<'preset' | 'roster'>('roster');
  const [selectedPresetId, setSelectedPresetId] = useState<string>('');

  // Roster 7-day matrix for editing
  const defaultRosterDays = Array.from({ length: 7 }).map((_, i) => ({
    day_of_week: i,
    is_morning: false,
    is_evening: false,
    is_night: false,
    is_rest_day: true,
    start_time: null as string | null,
    end_time: null as string | null
  }));

  const [rosterDays, setRosterDays] = useState<any[]>(defaultRosterDays);

  const getDayName = (dayIndex: number) => {
    const daysArr = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
    return daysArr[dayIndex];
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      // 1. Load schedules with days
      const { data: schData, error: schErr } = await supabase
        .from('work_schedules')
        .select('*, days:work_schedule_days(*)');
      if (schErr) throw schErr;
      setWorkSchedules(schData || []);

      // 2. Load departments
      const { data: depData } = await supabase.from('departments').select('id, name').order('name');
      setDepartments(depData || []);

      // 3. Load employees
      const { data: empData, error: empErr } = await supabase
        .from('profiles')
        .select(`
          id,
          full_name,
          job_number,
          role,
          department_id,
          department:departments(name),
          work_schedule_id
        `)
        .order('full_name');
      if (empErr) throw empErr;
      setEmployees(empData || []);
    } catch (err: any) {
      toast.error('فشل تحميل البيانات: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const openEditModal = (emp: any) => {
    setEditingEmployee(emp);
    const empSchedule = workSchedules.find(s => s.id === emp.work_schedule_id);

    if (empSchedule && empSchedule.type === 'roster') {
      setAssignmentMode('roster');
      setSelectedPresetId('');

      // Populate roster days
      const daysArr = Array.from({ length: 7 }).map((_, i) => {
        const found = empSchedule.days?.find((d: any) => d.day_of_week === i);
        if (found) {
          const isMorning = found.is_morning ?? (!found.is_rest_day && found.start_time?.startsWith('08'));
          const isEvening = found.is_evening ?? (found.start_time?.startsWith('14') || found.end_time?.startsWith('20'));
          const isNight = found.is_night ?? (found.start_time?.startsWith('20') || found.end_time?.startsWith('08'));
          const hasShifts = isMorning || isEvening || isNight;
          return {
            day_of_week: i,
            is_morning: isMorning,
            is_evening: isEvening,
            is_night: isNight,
            is_rest_day: !hasShifts,
            start_time: found.start_time?.substring(0, 5) || null,
            end_time: found.end_time?.substring(0, 5) || null
          };
        }
        return {
          day_of_week: i,
          is_morning: false,
          is_evening: false,
          is_night: false,
          is_rest_day: true,
          start_time: null,
          end_time: null
        };
      });
      setRosterDays(daysArr);
    } else {
      setAssignmentMode('preset');
      setSelectedPresetId(emp.work_schedule_id || (workSchedules.find(s => s.is_default)?.id || ''));
      setRosterDays(defaultRosterDays);
    }
  };

  const handleToggleRosterShift = (dayIndex: number, shiftType: 'morning' | 'evening' | 'night') => {
    const updated = [...rosterDays];
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
    setRosterDays(updated);
  };

  const handleSaveEmployeeSchedule = async () => {
    if (!editingEmployee) return;
    setSaving(true);
    try {
      if (assignmentMode === 'preset') {
        // Assign existing standard preset
        const { error } = await supabase
          .from('profiles')
          .update({ work_schedule_id: selectedPresetId || null })
          .eq('id', editingEmployee.id);
        if (error) throw error;

        toast.success(`تم تعيين الدوام لـ ${editingEmployee.full_name} بنجاح`);
      } else {
        // Roster Schedule
        const existingSchedule = workSchedules.find(s => s.id === editingEmployee.work_schedule_id && s.type === 'roster');
        let scheduleId = existingSchedule?.id;

        const scheduleName = `مناوب - ${editingEmployee.full_name}`;

        if (scheduleId) {
          // Update existing roster schedule
          const { error: updateSchErr } = await supabase
            .from('work_schedules')
            .update({ name: scheduleName, type: 'roster', updated_at: new Date().toISOString() })
            .eq('id', scheduleId);
          if (updateSchErr) throw updateSchErr;

          // Update days
          for (const d of rosterDays) {
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
              .eq('schedule_id', scheduleId)
              .eq('day_of_week', d.day_of_week);
            if (dayErr) throw dayErr;
          }
        } else {
          // Create new roster schedule
          const { data: newSch, error: createSchErr } = await supabase
            .from('work_schedules')
            .insert({
              name: scheduleName,
              type: 'roster',
              is_default: false,
              grace_period_minutes: 0
            })
            .select()
            .single();
          if (createSchErr) throw createSchErr;
          scheduleId = newSch.id;

          const daysToInsert = rosterDays.map(d => ({
            schedule_id: scheduleId,
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
          .update({ work_schedule_id: scheduleId })
          .eq('id', editingEmployee.id);
        if (profErr) throw profErr;

        toast.success(`تم حفظ وتعميم جدول المناوبة لـ ${editingEmployee.full_name} بنجاح`);
      }

      setEditingEmployee(null);
      loadInitialData();
    } catch (err: any) {
      toast.error('حدث خطأ أثناء الحفظ: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  // Filtered employees
  const filteredEmployees = useMemo(() => {
    return employees.filter(emp => {
      const matchesSearch = 
        !searchQuery.trim() || 
        emp.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
        emp.job_number?.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesDept = selectedDepartment === 'all' || emp.department_id === selectedDepartment;

      const empSchedule = workSchedules.find(s => s.id === emp.work_schedule_id);
      let matchesSchedule = true;

      if (scheduleFilter !== 'all') {
        if (scheduleFilter === 'roster') matchesSchedule = empSchedule?.type === 'roster';
        else if (scheduleFilter === 'none') matchesSchedule = !emp.work_schedule_id;
        else if (scheduleFilter === 'morning') matchesSchedule = empSchedule?.type !== 'roster' && (!empSchedule?.name || empSchedule.name.includes('صباحي'));
        else if (scheduleFilter === 'evening') matchesSchedule = empSchedule?.name?.includes('مسائي');
        else if (scheduleFilter === 'night') matchesSchedule = empSchedule?.name?.includes('خفر');
      }

      return matchesSearch && matchesDept && matchesSchedule;
    });
  }, [employees, workSchedules, searchQuery, selectedDepartment, scheduleFilter]);

  const getScheduleBadge = (emp: any) => {
    const schedule = workSchedules.find(s => s.id === emp.work_schedule_id);
    if (!schedule) {
      return (
        <span className="bg-slate-100 dark:bg-slate-800 text-slate-500 text-xs px-2.5 py-1 rounded-lg font-medium">
          غير محدد (الافتراضي)
        </span>
      );
    }

    if (schedule.type === 'roster') {
      return (
        <span className="bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300 text-xs px-2.5 py-1 rounded-lg font-bold flex items-center gap-1">
          <ShieldCheck className="w-3.5 h-3.5" />
          مناوب (شفتات أسبوعية)
        </span>
      );
    }

    const name = schedule.name || '';
    if (name.includes('مسائي')) {
      return (
        <span className="bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300 text-xs px-2.5 py-1 rounded-lg font-bold flex items-center gap-1">
          <Sunset className="w-3.5 h-3.5" />
          مسائي (14:30 - 20:00)
        </span>
      );
    }
    if (name.includes('خفر')) {
      return (
        <span className="bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300 text-xs px-2.5 py-1 rounded-lg font-bold flex items-center gap-1">
          <Moon className="w-3.5 h-3.5" />
          خفر (20:00 - 08:00ص)
        </span>
      );
    }

    return (
      <span className="bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 text-xs px-2.5 py-1 rounded-lg font-bold flex items-center gap-1">
        <Sun className="w-3.5 h-3.5" />
        صباحي (08:00 - 15:00)
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <Users className="w-6 h-6 text-blue-600" />
            إعداد وتخصيص دوام الموظفين (Employee Schedules)
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            تحديد الدوام الافتراضي أو تخصيص جدول المناوبة والشفتات الأسبوعية لكل موظف.
          </p>
        </div>
        <button
          onClick={loadInitialData}
          disabled={loading}
          className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors flex items-center gap-2 text-xs font-bold self-start sm:self-auto"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          تحديث البيانات
        </button>
      </div>

      {/* Filter Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Search */}
        <div className="relative">
          <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="بحث بالاسم أو الرقم الوظيفي..."
            className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pr-10 pl-4 py-2.5 text-xs text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 transition-all"
          />
        </div>

        {/* Department Filter */}
        <select
          value={selectedDepartment}
          onChange={(e) => setSelectedDepartment(e.target.value)}
          className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">كافة الأقسام والشعب</option>
          {departments.map(d => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>

        {/* Schedule Type Filter */}
        <select
          value={scheduleFilter}
          onChange={(e) => setScheduleFilter(e.target.value)}
          className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">كافة أنواع الدوام</option>
          <option value="roster">المناوبون فقط (شفتات)</option>
          <option value="morning">الدوام الصباحي</option>
          <option value="evening">الدوام المسائي</option>
          <option value="night">دوام الخفر</option>
          <option value="none">بدون جدول محدد</option>
        </select>
      </div>

      {/* Employees Table */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
                <th className="py-3.5 px-4 font-bold text-xs text-slate-600 dark:text-slate-300">اسم الموظف</th>
                <th className="py-3.5 px-4 font-bold text-xs text-slate-600 dark:text-slate-300">الرقم الوظيفي</th>
                <th className="py-3.5 px-4 font-bold text-xs text-slate-600 dark:text-slate-300">القسم / الشعبة</th>
                <th className="py-3.5 px-4 font-bold text-xs text-slate-600 dark:text-slate-300">نظام الدوام الحالي</th>
                <th className="py-3.5 px-4 font-bold text-xs text-slate-600 dark:text-slate-300 text-center">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50 text-xs">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2" />
                    جاري تحميل بيانات الموظفين...
                  </td>
                </tr>
              ) : filteredEmployees.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400">
                    لا يوجد موظفون يطابقون خيارات البحث
                  </td>
                </tr>
              ) : (
                filteredEmployees.map((emp) => (
                  <tr key={emp.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-700/30 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-slate-800 dark:text-slate-200">
                      {emp.full_name}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-600 dark:text-slate-400">
                      {emp.job_number || '---'}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 dark:text-slate-400">
                      {emp.department?.name || 'عام'}
                    </td>
                    <td className="py-3.5 px-4">
                      {getScheduleBadge(emp)}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <button
                        onClick={() => openEditModal(emp)}
                        className="px-3 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100 font-bold transition-all flex items-center gap-1.5 mx-auto"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        تخصيص الدوام
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Editing Modal */}
      {editingEmployee && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 sm:p-6 pb-20">
          <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden">
            {/* Modal Header */}
            <div className="flex justify-between items-center p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
              <div>
                <h3 className="text-base font-bold text-slate-800 dark:text-white flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-blue-500" />
                  تخصيص دوام: {editingEmployee.full_name}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  الرقم الوظيفي: <span className="font-mono">{editingEmployee.job_number || '---'}</span> | القسم: {editingEmployee.department?.name || 'عام'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleSaveEmployeeSchedule}
                  disabled={saving}
                  className="px-4 py-2 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-700 flex items-center gap-2 transition-colors disabled:opacity-70 text-xs shadow-sm"
                >
                  {saving ? (
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Save className="w-3.5 h-3.5" />
                  )}
                  حفظ التعديلات
                </button>
                <button onClick={() => setEditingEmployee(null)} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors text-slate-500">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-6 custom-scrollbar">
              {/* Mode Switcher */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setAssignmentMode('roster')}
                  className={`p-4 rounded-xl border text-right transition-all flex items-start gap-3 ${
                    assignmentMode === 'roster'
                      ? 'bg-purple-50/80 border-purple-500 dark:bg-purple-900/20 dark:border-purple-500 ring-2 ring-purple-500/20'
                      : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-slate-300'
                  }`}
                >
                  <ShieldCheck className={`w-5 h-5 shrink-0 mt-0.5 ${assignmentMode === 'roster' ? 'text-purple-600' : 'text-slate-400'}`} />
                  <div>
                    <div className="font-bold text-slate-800 dark:text-white text-xs">جدول مناوب أسبوعي مخصص (Roster)</div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      تحديد الشفتات (صباحي / مسائي / خفر) لكل يوم، والأيام الخالية تُحسب تعويضية.
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setAssignmentMode('preset')}
                  className={`p-4 rounded-xl border text-right transition-all flex items-start gap-3 ${
                    assignmentMode === 'preset'
                      ? 'bg-blue-50/80 border-blue-500 dark:bg-blue-900/20 dark:border-blue-500 ring-2 ring-blue-500/20'
                      : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-slate-300'
                  }`}
                >
                  <Sun className={`w-5 h-5 shrink-0 mt-0.5 ${assignmentMode === 'preset' ? 'text-blue-600' : 'text-slate-400'}`} />
                  <div>
                    <div className="font-bold text-slate-800 dark:text-white text-xs">تعيين جدول دوام عام جاهز</div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      اختيار جدول قياسي (مثل: الصباحي الافتراضي، أو المسائي، أو الخفر).
                    </div>
                  </div>
                </button>
              </div>

              {assignmentMode === 'preset' ? (
                /* Preset Selection */
                <div className="space-y-3">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">اختر جدول العمل المطلوب تعيينه للموظف</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {workSchedules.filter(s => s.type !== 'roster').map(s => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setSelectedPresetId(s.id)}
                        className={`p-3.5 rounded-xl border text-right transition-all flex justify-between items-center ${
                          selectedPresetId === s.id
                            ? 'bg-blue-50 border-blue-500 dark:bg-blue-900/30 text-blue-900 dark:text-blue-200 font-bold ring-2 ring-blue-500/20'
                            : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        <div>
                          <div className="text-xs font-bold">{s.name}</div>
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            {s.is_default ? 'الجدول الافتراضي للمديرية' : 'جدول عمل قياسي'}
                          </div>
                        </div>
                        {selectedPresetId === s.id && <Check className="w-4 h-4 text-blue-600" />}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                /* Roster Matrix Editor */
                <div className="space-y-3">
                  <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-2">
                    <h4 className="text-xs font-bold text-slate-800 dark:text-white">
                      مصفوفة الشفتات الأسبوعية للمناوب
                    </h4>
                    <span className="text-[11px] text-slate-500">
                      اليوم غير المؤشر يُعتبر تلقائياً (تعويضية)
                    </span>
                  </div>

                  <div className="space-y-2.5">
                    {rosterDays.map((day, index) => {
                      const hasShifts = day.is_morning || day.is_evening || day.is_night;
                      return (
                        <div
                          key={day.day_of_week}
                          className={`p-3 rounded-xl border transition-all ${
                            hasShifts
                              ? 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-xs'
                              : 'bg-emerald-50/40 dark:bg-emerald-950/10 border-emerald-100 dark:border-emerald-900/30'
                          }`}
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                            <div className="flex items-center gap-2.5 w-28">
                              <span className="font-bold text-xs text-slate-800 dark:text-slate-200">
                                {getDayName(day.day_of_week)}
                              </span>
                              {!hasShifts && (
                                <span className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 text-[10px] px-2 py-0.5 rounded-md font-bold">
                                  تعويضية
                                </span>
                              )}
                            </div>

                            <div className="flex flex-wrap items-center gap-1.5 flex-1 sm:justify-end">
                              {/* Morning Shift Button */}
                              <button
                                type="button"
                                onClick={() => handleToggleRosterShift(index, 'morning')}
                                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-all ${
                                  day.is_morning
                                    ? 'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-300 border border-amber-300 dark:border-amber-700 shadow-xs'
                                    : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-transparent hover:bg-slate-200 dark:hover:bg-slate-700'
                                }`}
                              >
                                <Sun className="w-3 h-3 text-amber-500" />
                                صباحي (08:00 - 15:00)
                              </button>

                              {/* Evening Shift Button */}
                              <button
                                type="button"
                                onClick={() => handleToggleRosterShift(index, 'evening')}
                                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-all ${
                                  day.is_evening
                                    ? 'bg-orange-100 text-orange-900 dark:bg-orange-900/40 dark:text-orange-300 border border-orange-300 dark:border-orange-700 shadow-xs'
                                    : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-transparent hover:bg-slate-200 dark:hover:bg-slate-700'
                                }`}
                              >
                                <Sunset className="w-3 h-3 text-orange-500" />
                                مسائي (14:30 - 20:00)
                              </button>

                              {/* Night Shift Button */}
                              <button
                                type="button"
                                onClick={() => handleToggleRosterShift(index, 'night')}
                                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-all ${
                                  day.is_night
                                    ? 'bg-indigo-100 text-indigo-900 dark:bg-indigo-900/40 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-700 shadow-xs'
                                    : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-transparent hover:bg-slate-200 dark:hover:bg-slate-700'
                                }`}
                              >
                                <Moon className="w-3 h-3 text-indigo-500" />
                                خفر (20:00 - 08:00ص)
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
