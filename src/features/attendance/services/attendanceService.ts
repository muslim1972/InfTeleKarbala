import { supabase } from '../../../lib/supabase';
import type {
  FingerprintTemplate,
  AttendanceRecord,
  AttendanceDevice,
  AttendanceException,
  AttendanceStats
} from '../types';

// =============================================
// Fingerprint Template Services
// =============================================

export const fingerprintTemplateService = {
  async create(template: Omit<FingerprintTemplate, 'id' | 'created_at' | 'updated_at'>) {
    const { data, error } = await supabase
      .from('fingerprint_templates')
      .insert(template)
      .select()
      .single();
    if (error) throw error;
    return data as FingerprintTemplate;
  },

  async getByEmployeeId(employeeId: string) {
    const { data, error } = await supabase
      .from('fingerprint_templates')
      .select('*')
      .eq('employee_id', employeeId)
      .eq('is_active', true)
      .order('template_version', { ascending: false });
    if (error) throw error;
    return data as FingerprintTemplate[];
  },

  async deactivate(id: string) {
    const { data, error } = await supabase
      .from('fingerprint_templates')
      .update({ is_active: false })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data as FingerprintTemplate;
  },

  async delete(id: string) {
    const { error } = await supabase
      .from('fingerprint_templates')
      .delete()
      .eq('id', id);
    if (error) throw error;
  }
};

// =============================================
// Attendance Record Services
// =============================================

export const attendanceRecordService = {
  async create(record: Partial<AttendanceRecord>) {
    const { data, error } = await supabase
      .from('attendance_records')
      .insert(record)
      .select()
      .single();
    if (error) throw error;
    return data as AttendanceRecord;
  },

  async update(id: string, updates: Partial<AttendanceRecord>) {
    const { data, error } = await supabase
      .from('attendance_records')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data as AttendanceRecord;
  },

  async getByEmployeeId(employeeId: string, startDate?: string, endDate?: string) {
    let query = supabase
      .from('attendance_records')
      .select('*')
      .eq('employee_id', employeeId)
      .order('created_at', { ascending: false });

    if (startDate) {
      query = query.gte('created_at', startDate);
    }
    if (endDate) {
      query = query.lte('created_at', endDate);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data as AttendanceRecord[];
  },

  async timeLeaveOut(employeeId: string, _location?: string, _deviceId?: string, _verifiedByBiometric: boolean = false) {
    const todayRecord = await this.getTodayByEmployeeId(employeeId);
    if (!todayRecord) throw new Error('لم يتم تسجيل الحضور اليوم');

    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('attendance_records')
      .update({
        time_leave_out: now,
      })
      .eq('id', todayRecord.id)
      .select()
      .single();

    if (error) throw error;
    return data as AttendanceRecord;
  },

  async timeLeaveReturn(employeeId: string, _location?: string, _deviceId?: string, _verifiedByBiometric: boolean = false) {
    const todayRecord = await this.getTodayByEmployeeId(employeeId);
    if (!todayRecord) throw new Error('لم يتم تسجيل الحضور اليوم');
    if (!todayRecord.time_leave_out) throw new Error('لم يتم تسجيل خروج زمني مسبقاً');

    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('attendance_records')
      .update({
        time_leave_return: now,
      })
      .eq('id', todayRecord.id)
      .select()
      .single();

    if (error) throw error;
    return data as AttendanceRecord;
  },

  async getByDate(date: string) {
    const { data, error } = await supabase
      .from('attendance_records')
      .select('*')
      .gte('created_at', `${date}T00:00:00`)
      .lte('created_at', `${date}T23:59:59`)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data as AttendanceRecord[];
  },

  async getTodayByEmployeeId(employeeId: string) {
    const today = new Date().toISOString().split('T')[0];
    const { data, error } = await supabase
      .from('attendance_records')
      .select('*')
      .eq('employee_id', employeeId)
      .gte('created_at', `${today}T00:00:00`)
      .lte('created_at', `${today}T23:59:59`)
      .order('created_at', { ascending: false })
      .limit(1);
    if (error) throw error;
    return data[0] as AttendanceRecord | undefined;
  },

  async checkIn(employeeId: string, location?: string, deviceId?: string, verifiedByBiometric: boolean = false) {
    const now = new Date().toISOString();
    
    // Get department, device info, and work schedule from employee profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('department_id, primary_device_id, work_schedule_id')
      .eq('id', employeeId)
      .single();

    let isDevicePending = false;

    // 1. If primary_device_id is null, set it to the current deviceId
    if (!profile?.primary_device_id && deviceId) {
      await supabase
        .from('profiles')
        .update({ primary_device_id: deviceId })
        .eq('id', employeeId);
    } 
    // 2. If primary_device_id exists and doesn't match deviceId, it's a pending device
    else if (profile?.primary_device_id && profile.primary_device_id !== deviceId) {
      isDevicePending = true;
      
      // Check if a pending request already exists
      const { data: existingReq } = await supabase
        .from('device_change_requests')
        .select('id')
        .eq('employee_id', employeeId)
        .eq('new_device_id', deviceId)
        .eq('status', 'pending')
        .single();
        
      if (!existingReq) {
        // Create a device change request
        await supabase
          .from('device_change_requests')
          .insert({
            employee_id: employeeId,
            old_device_id: profile.primary_device_id,
            new_device_id: deviceId,
            status: 'pending'
          });
      }
    }

    // --- Calculate Lateness Based on Work Schedule ---
    let initialStatus = 'present';
    
    // Fetch schedule if assigned, otherwise use default
    let scheduleQuery = supabase.from('work_schedules').select('*');
    if (profile?.work_schedule_id) {
      scheduleQuery = scheduleQuery.eq('id', profile.work_schedule_id);
    } else {
      scheduleQuery = scheduleQuery.eq('is_default', true);
    }
    
    const { data: scheduleData } = await scheduleQuery.limit(1).single();
    
    if (scheduleData) {
      const today = new Date();
      // Check if weekend (0 = Sunday, 1 = Monday... 5 = Friday, 6 = Saturday in JS, but depends on array in DB)
      // scheduleData.weekend_days usually contains ['Friday', 'Saturday']
      const dayName = new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(today);
      const isWeekend = scheduleData.weekend_days?.includes(dayName);
      
      if (!isWeekend) {
        // Build expected start time Date object
        const [hours, minutes] = scheduleData.start_time.split(':').map(Number);
        const expectedStart = new Date(today);
        expectedStart.setHours(hours, minutes, 0, 0);
        
        // Add grace period
        const gracePeriodMs = (scheduleData.grace_period_minutes || 0) * 60000;
        const allowedStart = new Date(expectedStart.getTime() + gracePeriodMs);
        
        if (today > allowedStart) {
          initialStatus = 'late';
        }
      }
    }

    const { data, error } = await supabase
      .from('attendance_records')
      .insert({
        employee_id: employeeId,
        department_id: profile?.department_id,
        check_in: now,
        check_in_location: location,
        check_in_device_id: deviceId,
        check_in_verified_by_biometric: verifiedByBiometric,
        status: initialStatus,
        is_device_pending: isDevicePending
      })
      .select()
      .single();

    if (error) throw error;
    return data as AttendanceRecord;
  },

  async checkOut(employeeId: string, location?: string, deviceId?: string, verifiedByBiometric: boolean = false) {
    const todayRecord = await this.getTodayByEmployeeId(employeeId);
    if (!todayRecord) {
      throw new Error('لم يتم تسجيل الحضور اليوم');
    }

    // Check device match
    const { data: profile } = await supabase
      .from('profiles')
      .select('primary_device_id')
      .eq('id', employeeId)
      .single();

    let isDevicePending = false;

    if (!profile?.primary_device_id && deviceId) {
      await supabase
        .from('profiles')
        .update({ primary_device_id: deviceId })
        .eq('id', employeeId);
    } else if (profile?.primary_device_id && profile.primary_device_id !== deviceId) {
      isDevicePending = true;
      
      const { data: existingReq } = await supabase
        .from('device_change_requests')
        .select('id')
        .eq('employee_id', employeeId)
        .eq('new_device_id', deviceId)
        .eq('status', 'pending')
        .single();
        
      if (!existingReq) {
         await supabase.from('device_change_requests').insert({
            employee_id: employeeId,
            old_device_id: profile.primary_device_id,
            new_device_id: deviceId,
            status: 'pending'
         });
      }
    }

    const now = new Date().toISOString();
    
    // We only update is_device_pending to true if it is true now, we don't clear it if it was true in check-in
    const updatedStatus = isDevicePending || todayRecord.is_device_pending;

    const { data, error } = await supabase
      .from('attendance_records')
      .update({
        check_out: now,
        check_out_location: location,
        check_out_device_id: deviceId,
        check_out_verified_by_biometric: verifiedByBiometric,
        is_device_pending: updatedStatus
      })
      .eq('id', todayRecord.id)
      .select()
      .single();

    if (error) throw error;
    return data as AttendanceRecord;
  },

  async getStats(employeeId: string, startDate: string, endDate: string) {
    const records = await this.getByEmployeeId(employeeId, startDate, endDate);
    
    const stats: AttendanceStats = {
      total_present: records.filter(r => r.status === 'present').length,
      total_absent: records.filter(r => r.status === 'absent').length,
      total_late: records.filter(r => r.status === 'late').length,
      total_early_leave: records.filter(r => r.status === 'early_leave').length,
      attendance_rate: 0
    };

    const total = records.length;
    stats.attendance_rate = total > 0 ? (stats.total_present / total) * 100 : 0;

    return stats;
  }
};

// =============================================
// Attendance Device Services
// =============================================

export const attendanceDeviceService = {
  async getAll() {
    const { data, error } = await supabase
      .from('attendance_devices')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data as AttendanceDevice[];
  },

  async create(device: Omit<AttendanceDevice, 'id' | 'created_at' | 'updated_at'>) {
    const { data, error } = await supabase
      .from('attendance_devices')
      .insert(device)
      .select()
      .single();
    if (error) throw error;
    return data as AttendanceDevice;
  },

  async update(id: string, updates: Partial<AttendanceDevice>) {
    const { data, error } = await supabase
      .from('attendance_devices')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data as AttendanceDevice;
  },

  async delete(id: string) {
    const { error } = await supabase
      .from('attendance_devices')
      .delete()
      .eq('id', id);
    if (error) throw error;
  }
};

// =============================================
// Attendance Exception Services
// =============================================

export const attendanceExceptionService = {
  async create(exception: Omit<AttendanceException, 'id' | 'created_at' | 'updated_at'>) {
    const { data, error } = await supabase
      .from('attendance_exceptions')
      .insert(exception)
      .select()
      .single();
    if (error) throw error;
    return data as AttendanceException;
  },

  async getByEmployeeId(employeeId: string) {
    const { data, error } = await supabase
      .from('attendance_exceptions')
      .select('*')
      .eq('employee_id', employeeId)
      .order('exception_date', { ascending: false });
    if (error) throw error;
    return data as AttendanceException[];
  },

  async updateStatus(id: string, status: 'approved' | 'rejected', approvedBy: string) {
    const { data, error } = await supabase
      .from('attendance_exceptions')
      .update({
        status,
        approved_by: approvedBy,
        approved_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data as AttendanceException;
  },

  async getAllPending() {
    const { data, error } = await supabase
      .from('attendance_exceptions')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data as AttendanceException[];
  }
};

// Biometric Verification Service has been moved to webauthnService.ts
