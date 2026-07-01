import { supabase } from '../../../lib/supabase';
import type {
  FingerprintTemplate,
  AttendanceRecord,
  AttendanceDevice,
  AttendanceException,
  AttendanceStats,
  BiometricVerificationResult
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
    
    // Get department from employee profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('department_id')
      .eq('id', employeeId)
      .single();

    const { data, error } = await supabase
      .from('attendance_records')
      .insert({
        employee_id: employeeId,
        department_id: profile?.department_id,
        check_in: now,
        check_in_location: location,
        check_in_device_id: deviceId,
        check_in_verified_by_biometric: verifiedByBiometric,
        status: 'present'
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

    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('attendance_records')
      .update({
        check_out: now,
        check_out_location: location,
        check_out_device_id: deviceId,
        check_out_verified_by_biometric: verifiedByBiometric
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

// =============================================
// Biometric Verification Service (Client-side only)
// =============================================

export const biometricVerificationService = {
  // التحقق من دعم الجهاز للمصادقة البيومترية
  async isSupported(): Promise<boolean> {
    if (!window.PublicKeyCredential) return false;
    try {
      return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    } catch {
      return false;
    }
  },

  // التحقق من هوية المستخدم باستخدام البيومترية (بصمة/وجه/رمز PIN)
  async verify(): Promise<BiometricVerificationResult> {
    const supported = await this.isSupported();
    if (!supported) {
      return {
        success: false,
        confidence: 0,
        message: 'جهازك لا يدعم المصادقة البيومترية. يرجى استخدام جهاز يدعم بصمة الإصبع أو التعرف على الوجه.'
      };
    }

    try {
      // إنشاء تحدي للمصادقة عبر WebAuthn
      const challenge = crypto.getRandomValues(new Uint8Array(32));
      const userId = crypto.getRandomValues(new Uint8Array(16));

      const credential = await navigator.credentials.create({
        publicKey: {
          challenge,
          rp: { name: 'نظام الحضور والانصراف - مديرية اتصالات كربلاء', id: window.location.hostname },
          user: {
            id: userId,
            name: 'employee',
            displayName: 'موظف'
          },
          pubKeyCredParams: [
            { type: 'public-key', alg: -7 },   // ES256
            { type: 'public-key', alg: -257 }  // RS256
          ],
          authenticatorSelection: {
            authenticatorAttachment: 'platform',
            userVerification: 'required',
            residentKey: 'discouraged'
          },
          timeout: 60000,
          attestation: 'none'
        }
      });

      if (credential) {
        return {
          success: true,
          confidence: 1.0,
          message: 'تم التحقق من هويتك بنجاح ✓'
        };
      }

      return {
        success: false,
        confidence: 0,
        message: 'فشل التحقق من الهوية. يرجى المحاولة مرة أخرى.'
      };
    } catch (error: any) {
      if (error.name === 'NotAllowedError') {
        return {
          success: false,
          confidence: 0,
          message: 'تم إلغاء عملية التحقق. يرجى المحاولة مرة أخرى والسماح بالمصادقة.'
        };
      }
      return {
        success: false,
        confidence: 0,
        message: `حدث خطأ أثناء التحقق: ${error.message || 'خطأ غير معروف'}`
      };
    }
  }
};
