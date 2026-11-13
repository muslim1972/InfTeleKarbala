import { supabase } from '../../../lib/supabase';
import { startOfMonth, endOfMonth } from 'date-fns';

export const timesheetService = {
  async getMonthlyTimesheets(year: number, month: number, departmentId?: string, employeeId?: string, governorate?: string) {
    // month is 1-indexed (1 = Jan, 12 = Dec)
    const start = startOfMonth(new Date(year, month - 1)).toISOString();
    const end = endOfMonth(new Date(year, month - 1)).toISOString();

    let query = supabase
      .from('attendance_records')
      .select(`
        *,
        employee:profiles!inner!attendance_records_employee_id_fkey(id, full_name, job_number, department_id, work_schedule_id, governorate),
        department:departments(name, governorate)
      `)
      .gte('check_in', start)
      .lte('check_in', end)
      .order('check_in', { ascending: true });

    if (departmentId && departmentId !== 'all') {
      query = query.eq('department_id', departmentId);
    }
    
    if (employeeId && employeeId !== 'all') {
      query = query.eq('employee_id', employeeId);
    }

    if (governorate && governorate !== 'all') {
      query = query.eq('employee.governorate', governorate);
    }

    const { data, error } = await query;
    if (error) throw error;
    
    return data || [];
  },

  async getDepartments(governorate?: string) {
    let query = supabase.from('departments').select('id, name, governorate').order('name');
    if (governorate && governorate !== 'all') {
      query = query.eq('governorate', governorate);
    }
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  async getEmployees(departmentId?: string, governorate?: string) {
    let query = supabase
      .from('profiles')
      .select('id, full_name, job_number, department_id, work_schedule_id, governorate')
      .order('full_name');
    if (departmentId && departmentId !== 'all') {
      query = query.eq('department_id', departmentId);
    }
    if (governorate && governorate !== 'all') {
      query = query.eq('governorate', governorate);
    }
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  async getWorkSchedules() {
    const { data, error } = await supabase
      .from('work_schedules')
      .select('*, days:work_schedule_days(*)');
    if (error) throw error;
    return data || [];
  }
};
