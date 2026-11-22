/**
 * SupervisedDutyRoster.tsx
 * تبويبة إشراف المستقلة لتحديد وتعديل دوام موظفي التشكيلات (أقسام / شُعب / مجمعات / وحدات)
 * مديرية اتصالات ومعلوماتية كربلاء — إطار عمل B.R.I.C.K (النواة المعمارية FE-ATT-01 / OPS-03)
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  ShieldCheck,
  Users,
  Edit2,
  Save,
  X,
  Loader2,
  Building2,
  AlertCircle
} from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../../lib/supabase';
import { workLocationService } from '../services/workLocationService';
import EmployeeRosterModal from './EmployeeRosterModal';

interface SupervisedDutyRosterProps {
  user: any;
}

interface ManagedDepartment {
  id: string;
  name: string;
  role: 'manager' | 'deputy';
}

interface ManagedEmployee {
  id: string;
  full_name: string;
  job_number?: string | null;
  work_schedule_id?: string | null;
  work_schedule?: any;
}

export const SupervisedDutyRoster: React.FC<SupervisedDutyRosterProps> = ({ user }) => {
  const [loading, setLoading] = useState(true);
  const [managedDepts, setManagedDepts] = useState<ManagedDepartment[]>([]);
  const [selectedDeptId, setSelectedDeptId] = useState<string>('');
  const [employees, setEmployees] = useState<ManagedEmployee[]>([]);
  const [workSchedules, setWorkSchedules] = useState<any[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);

  // حالة التعديل الفوري
  const [editingEmpId, setEditingEmpId] = useState<string | null>(null);
  const [editDutyType, setEditDutyType] = useState<'morning' | 'roster'>('morning');
  const [editScheduleId, setEditScheduleId] = useState<string>('');
  const [savingShift, setSavingShift] = useState(false);

  // حالة مودال تخصيص شفتات المناوبة
  const [rosterEmployee, setRosterEmployee] = useState<any | null>(null);

  // مرجع الحاوية للتحكم بالتمرير وأسهم الكيبورد
  const containerRef = useRef<HTMLDivElement>(null);

  // 1. جلب التشكيلات التي يكون المستخدم مسؤولاً عنها أو نائباً/بديلاً لها
  const loadManagedDepartments = useCallback(async () => {
    if (!user?.id) return;
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('departments')
        .select('id, name, manager_id, deputy_manager_id')
        .or(`manager_id.eq.${user.id},deputy_manager_id.eq.${user.id}`)
        .order('name');

      if (error) throw error;

      const mapped: ManagedDepartment[] = (data || []).map(d => ({
        id: d.id,
        name: d.name,
        role: d.manager_id === user.id ? 'manager' : 'deputy'
      }));

      setManagedDepts(mapped);
      if (mapped.length > 0) {
        setSelectedDeptId(mapped[0].id);
      }
    } catch (err: any) {
      console.error('Failed to load managed departments:', err);
      toast.error('تعذر جلب بيانات التشكيلات الإشرافية');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  // 2. جلب جداول الدوام العامة والمعتمدة
  const loadWorkSchedules = useCallback(async () => {
    try {
      const { data } = await supabase.from('work_schedules').select('*');
      if (data) {
        setWorkSchedules(data);
        return data;
      }
      return [];
    } catch (err) {
      console.warn('Failed to load work schedules:', err);
      return [];
    }
  }, []);

  // 3. جلب موظفي التشكيل المحدد حالياً
  const loadDepartmentEmployees = useCallback(async (deptId: string, customSchedules?: any[]) => {
    if (!deptId) return;
    try {
      setLoadingEmployees(true);
      const activeSchedules = customSchedules || workSchedules;

      let empRows: any[] = [];
      const { data: rpcData, error: rpcError } = await supabase
        .rpc('get_supervised_department_employees', { p_department_id: deptId });

      if (!rpcError && rpcData) {
        empRows = rpcData;
      } else {
        // خط دفاع احتياطي
        const { data: directData, error: directError } = await supabase
          .from('profiles')
          .select('id, full_name, job_number, work_schedule_id')
          .eq('department_id', deptId)
          .neq('id', user?.id)
          .order('full_name');

        if (directError) throw directError;
        empRows = directData || [];
      }

      const formatted: ManagedEmployee[] = empRows
        .filter((p: any) => p.id !== user?.id)
        .map((p: any) => ({
          id: p.id,
          full_name: p.full_name,
          job_number: p.job_number,
          work_schedule_id: p.work_schedule_id,
          work_schedule: activeSchedules.find(s => s.id === p.work_schedule_id) || null
        }));

      setEmployees(formatted);
    } catch (err: any) {
      console.error('Failed to load department employees:', err);
      toast.error('تعذر جلب أسماء موظفي التشكيل');
    } finally {
      setLoadingEmployees(false);
    }
  }, [workSchedules]);

  useEffect(() => {
    loadManagedDepartments();
    loadWorkSchedules();
  }, [loadManagedDepartments, loadWorkSchedules]);

  useEffect(() => {
    if (selectedDeptId) {
      loadDepartmentEmployees(selectedDeptId);
      setEditingEmpId(null);
    }
  }, [selectedDeptId, loadDepartmentEmployees]);

  // التشكيل المحدد حالياً
  const currentDept = useMemo(() => {
    return managedDepts.find(d => d.id === selectedDeptId);
  }, [managedDepts, selectedDeptId]);

  // حفظ تعديل نوع الدوام (صباحي / مناوب)
  const handleSaveDutyShift = async (empId: string) => {
    try {
      setSavingShift(true);
      let targetScheduleId: string | null = null;

      if (editDutyType === 'morning') {
        const defaultMorning = workSchedules.find(s => s.is_default) || workSchedules.find(s => s.name?.includes('صباحي'));
        targetScheduleId = defaultMorning?.id || null;
      } else {
        // نوع الدوام 'roster'
        const currentEmp = employees.find(e => e.id === empId);
        const currentSchedId = editScheduleId || currentEmp?.work_schedule_id;
        const currentSched = currentEmp?.work_schedule || workSchedules.find(s => s.id === currentSchedId);

        if (currentSched?.type === 'roster' || currentSchedId) {
          targetScheduleId = currentSchedId ?? null;
        } else {
          // البحث عن جدول مناوبة مسبق باسم الموظف
          const existingRoster = workSchedules.find(s => s.type === 'roster' && s.name?.includes(currentEmp?.full_name));
          if (existingRoster) {
            targetScheduleId = existingRoster.id;
          } else {
            toast('يرجى تخصيص جدول المناوبة وشفتات الأسبوع للموظف أولاً', { icon: 'ℹ️' });
            setRosterEmployee({
              ...(currentEmp || {}),
              id: empId
            });
            setSavingShift(false);
            return;
          }
        }
      }

      const { error: rpcUpdateErr } = await supabase
        .rpc('update_supervised_employee_schedule', {
          p_employee_id: empId,
          p_schedule_id: targetScheduleId
        });

      if (rpcUpdateErr) {
        console.warn('Fallback to workLocationService on schedule update:', rpcUpdateErr);
        await workLocationService.updateEmployeeSchedule(empId, targetScheduleId);
      }
      toast.success('تم تحديث نوع دوام الموظف بنجاح');
      setEditingEmpId(null);
      await loadDepartmentEmployees(selectedDeptId);
    } catch (err: any) {
      console.error('Failed to update employee schedule:', err);
      toast.error('حدث خطأ أثناء حفظ جدول دوام الموظف');
    } finally {
      setSavingShift(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-3xl p-10 text-center shadow-sm border border-slate-100 dark:border-slate-700">
        <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-600 mb-3" />
        <p className="text-slate-500 font-bold text-sm">جاري جلب بيانات التشكيل الإشرافي وموظفيكم...</p>
      </div>
    );
  }

  if (managedDepts.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-3xl p-8 text-center shadow-sm border border-slate-100 dark:border-slate-700">
        <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-3" />
        <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-2">لا توجد صلاحيات إشرافية مرتبطة</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          حسابك غير مسجل حالياً كمسؤول أو كبديل لأي تشكيل إداري (قسم / شعبة / مجمع / وحدة).
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* رأس التبويبة والتشكيل */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700/60 p-5">
        <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
          <div>
            <h2 className="text-xl font-black text-slate-800 dark:text-white flex items-center gap-2">
              <ShieldCheck className="w-6 h-6 text-blue-600" />
              تحديد دوام الموظفين
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              إدارة وتعديل جدول الدوام (صباحي / مناوب) وتخصيص شفتات العمل لموظفي تشكيلك الإداري المباشر
            </p>
          </div>

          {/* محدد التشكيل إن كان مسؤولاً عن أكثر من تشكيل */}
          {managedDepts.length > 1 ? (
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500">التشكيل:</span>
              <select
                value={selectedDeptId}
                onChange={e => setSelectedDeptId(e.target.value)}
                className="text-xs font-bold bg-slate-50 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 dark:bg-slate-900 text-slate-800 dark:text-white outline-none"
              >
                {managedDepts.map(d => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.role === 'manager' ? 'مسؤول' : 'بديل مسؤول'})
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="inline-flex items-center gap-1.5 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs px-3.5 py-1.5 rounded-xl font-bold border border-blue-100 dark:border-blue-800/50 self-start md:self-auto">
              <Building2 className="w-4 h-4 text-blue-600" />
              <span>{currentDept?.name}</span>
              <span className="opacity-60 text-[10px]">
                ({currentDept?.role === 'manager' ? 'المسؤول المباشر' : 'بديل المسؤول'})
              </span>
            </div>
          )}
        </div>
      </div>

      {/* حاوية الموظفين مقيدة بـ 5 أسماء كحد أعلى مع شريط تمرير ناعم ومحافظة كاملة على أبعاد الصفحة */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-100 dark:border-slate-700/60 p-5 flex flex-col">
        <div className="flex items-center justify-between pb-3 mb-2 border-b border-slate-100 dark:border-slate-700/50">
          <h3 className="font-bold text-sm text-slate-800 dark:text-white flex items-center gap-2">
            <Users className="w-4 h-4 text-slate-500" />
            قائمة موظفي التشكيل ({employees.length})
          </h3>
          <span className="text-[11px] text-slate-400">
            (استخدم عجلة الماوس أو أسهم الكيبورد للتمرير عند تجاوز 5 موظفين)
          </span>
        </div>

        {loadingEmployees ? (
          <div className="py-14 text-center">
            <Loader2 className="w-7 h-7 animate-spin mx-auto text-blue-600 mb-2" />
            <p className="text-xs text-slate-500">جاري تحميل موظفي التشكيل...</p>
          </div>
        ) : employees.length === 0 ? (
          <div className="py-12 text-center text-slate-500">
            <Users className="w-10 h-10 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
            <p className="text-xs font-bold">لا يوجد موظفون مسجلون ضمن هذا التشكيل حالياً.</p>
          </div>
        ) : (
          <div
            ref={containerRef}
            tabIndex={0}
            className="divide-y divide-slate-100 dark:divide-slate-700/50 max-h-[385px] overflow-y-auto custom-scrollbar pr-1 outline-none focus:ring-1 focus:ring-blue-500/20 rounded-xl"
            title="قائمة الموظفين — يمكنك التنقل بالسهم لأعلى وأسفل"
          >
            {employees.map((emp) => {
              const isEditing = editingEmpId === emp.id;
              const empSchedule = emp.work_schedule || workSchedules.find(s => s.id === emp.work_schedule_id);
              const isRoster = empSchedule?.type === 'roster';

              let scheduleBadge = (
                <span className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 text-[11px] px-2.5 py-0.5 rounded-md font-bold">
                  دوام صباحي (08:00 - 15:00)
                </span>
              );

              if (isRoster) {
                scheduleBadge = (
                  <div className="flex items-center gap-1.5">
                    <span className="bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300 text-[11px] px-2.5 py-0.5 rounded-md font-bold">
                      دوام مناوب (شفتات أسبوعية)
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setRosterEmployee({
                          ...emp,
                          work_schedule_id: emp.work_schedule_id
                        });
                      }}
                      className="text-[11px] bg-purple-50 hover:bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 px-2.5 py-0.5 rounded-lg font-bold transition-colors flex items-center gap-1 border border-purple-200 dark:border-purple-800 shadow-2xs"
                      title="تعديل جدول شفتات المناوبة لهذا الموظف"
                    >
                      <ShieldCheck className="w-3.5 h-3.5 text-purple-600" />
                      تعديل الجدول
                    </button>
                  </div>
                );
              }

              return (
                <div
                  key={emp.id}
                  className="py-3.5 px-3 rounded-xl transition-all flex flex-col md:flex-row justify-between md:items-center gap-2 hover:bg-slate-50/60 dark:hover:bg-slate-755/30"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-sm text-slate-800 dark:text-slate-100">
                        {emp.full_name}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 mt-1">
                      <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                        الرقم الوظيفي: {emp.job_number || '---'}
                      </p>

                      {isEditing ? (
                        <div className="flex flex-wrap items-center gap-2 mt-1 md:mt-0">
                          <select
                            value={editDutyType}
                            onChange={e => setEditDutyType(e.target.value as 'morning' | 'roster')}
                            className="text-xs bg-slate-50 border rounded-lg px-2.5 py-1 dark:bg-slate-900 dark:border-slate-700 font-bold text-slate-800 dark:text-slate-200 outline-none"
                          >
                            <option value="morning">دوام صباحي (08:00 - 15:00)</option>
                            <option value="roster">دوام مناوب (شفتات متغيرة)</option>
                          </select>

                          {editDutyType === 'roster' && (
                            <button
                              type="button"
                              onClick={() => {
                                setRosterEmployee({
                                  ...emp,
                                  work_schedule_id: emp.work_schedule_id
                                });
                              }}
                              className="text-xs bg-purple-100 hover:bg-purple-200 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300 px-2.5 py-1 rounded-lg font-bold transition-colors flex items-center gap-1 shadow-2xs"
                            >
                              <ShieldCheck className="w-3.5 h-3.5 text-purple-600" />
                              تخصيص جدول المناوبة (شفتات)
                            </button>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-slate-400">نوع الدوام:</span>
                          {scheduleBadge}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* إجراءات التعديل والحفظ */}
                  <div className="flex items-center gap-2 shrink-0 self-end md:self-auto">
                    {isEditing ? (
                      <>
                        <button
                          onClick={() => handleSaveDutyShift(emp.id)}
                          disabled={savingShift}
                          className="text-emerald-500 hover:text-emerald-600 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/20 dark:hover:bg-emerald-900/40 p-2 rounded-xl transition-all disabled:opacity-50"
                          title="حفظ التعديل"
                        >
                          {savingShift ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        </button>
                        <button
                          onClick={() => setEditingEmpId(null)}
                          disabled={savingShift}
                          className="text-slate-500 hover:text-slate-600 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 p-2 rounded-xl transition-all disabled:opacity-50"
                          title="إلغاء"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => {
                          setEditingEmpId(emp.id);
                          const isRost = (emp.work_schedule?.type === 'roster') || (empSchedule?.type === 'roster');
                          setEditDutyType(isRost ? 'roster' : 'morning');
                          setEditScheduleId(emp.work_schedule_id || '');
                        }}
                        className="text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/40 px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 text-xs font-bold"
                        title="تعديل نوع الدوام"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        تعديل
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* مودال تخصيص شفتات المناوبة الأسبوعية المعتمد في النظام */}
      {rosterEmployee && (
        <EmployeeRosterModal
          employee={rosterEmployee}
          locationName={currentDept?.name}
          onClose={() => setRosterEmployee(null)}
          onSave={async () => {
            setRosterEmployee(null);
            setEditingEmpId(null);
            await loadWorkSchedules();
            if (selectedDeptId) await loadDepartmentEmployees(selectedDeptId);
          }}
        />
      )}
    </div>
  );
};
