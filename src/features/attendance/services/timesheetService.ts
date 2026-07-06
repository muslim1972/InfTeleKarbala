import { supabase } from '../../../lib/supabase';
import { startOfMonth, endOfMonth } from 'date-fns';

export const timesheetService = {
  async getMonthlyTimesheets(year: number, month: number, departmentId?: string, employeeId?: string) {
    // month is 1-indexed (1 = Jan, 12 = Dec)
    const start = startOfMonth(new Date(year, month - 1)).toISOString();
    const end = endOfMonth(new Date(year, month - 1)).toISOString();

    let query = supabase
      .from('attendance_records')
      .select(`
        *,
        employee:profiles!inner(id, full_name, job_number, department_id),
        department:departments(name)
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

    const { data, error } = await query;
    if (error) throw error;
    
    return data || [];
  },

  async getDepartments() {
    const { data, error } = await supabase.from('departments').select('id, name').order('name');
    if (error) throw error;
    return data || [];
  },

  async getEmployees(departmentId?: string) {
    let query = supabase.from('profiles').select('id, full_name, job_number').order('full_name');
    if (departmentId && departmentId !== 'all') {
      query = query.eq('department_id', departmentId);
    }
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }
};
