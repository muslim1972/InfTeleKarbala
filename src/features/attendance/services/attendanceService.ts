import { supabase } from '../../../lib/supabase';
import { sendPushNotification } from '../../../services/notifications';
import {
  evaluateTimeLeavePunches,
  buildLeaveDayOvertimeNote,
  mergeNote,
  LEAVE_TYPE_LABELS,
  LeaveDayPunchWarning,
  type TimeLeaveInfo,
  type LeaveRequestLite
} from './leaveIntegrationService';
import { resolvePunchRequestContext, OFFICIAL_DUTY_TYPES } from './attendanceRequestEngine';
import type {
  FingerprintTemplate,
  AttendanceRecord,
  AttendanceDevice,
  AttendanceException,
  AttendanceStats
} from '../types';
import { getBaghdadDate } from '../utils/shiftRules';

async function notifyAdminsForDeviceChange(employeeName: string) {
  try {
    await supabase.rpc('notify_admins_new_device', { p_employee_name: employeeName });

    const supervisorIdsSet = new Set<string>();
    try {
      const { data: rpcProfiles } = await supabase.rpc('get_available_profiles');
      if (rpcProfiles && Array.isArray(rpcProfiles)) {
        rpcProfiles.forEach((p: any) => {
          if (
            p.admin_role === 'general' ||
            p.admin_role === 'developer' ||
            p.admin_role === 'biometric' ||
            p.admin_role === 'attendance_supervisor'
          ) {
            if (p.id) supervisorIdsSet.add(p.id);
          }
        });
      }
    } catch (e) {
      console.error('Error fetching via get_available_profiles:', e);
    }

    const supervisorIds = Array.from(supervisorIdsSet);

    if (supervisorIds.length > 0) {
      const title = 'تسجيل جهاز جديد';
      const content = `قام الموظف (${employeeName}) بتسجيل جهازه لأول مرة بنجاح.`;
      const pushPromises = supervisorIds.map(supId =>
        sendPushNotification(supId, content, { title })
      );
      await Promise.allSettled(pushPromises);
    }
  } catch (err) {
    console.error('Error notifying admins for new device:', err);
  }
}

/** جمع معرّفات المشرفين: الإداريون العامون + مدير قسم الموظف المباشر */
async function collectSupervisorIds(employeeId: string): Promise<string[]> {
  const supervisorIdsSet = new Set<string>();
  try {
    const { data: empProfile } = await supabase.from('profiles').select('governorate, department_id').eq('id', employeeId).single();
    if (empProfile?.governorate) {
      const { data: admins } = await supabase.from('profiles')
        .select('id')
        .eq('governorate', empProfile.governorate)
        .in('admin_role', ['general', 'developer', 'biometric', 'attendance_supervisor']);
      if (admins) {
        admins.forEach(a => supervisorIdsSet.add(a.id));
      }
    }

    if (empProfile?.department_id) {
      const { data: dept } = await supabase
        .from('departments')
        .select('manager_id')
        .eq('id', empProfile.department_id)
        .single();
      if (dept?.manager_id && dept.manager_id !== employeeId) {
        supervisorIdsSet.add(dept.manager_id);
      }
    }
  } catch (err) {
    console.error('Error finding supervisors:', err);
  }

  return Array.from(supervisorIdsSet);
}

/**
 * تنبيه المشرفين عند بصمة في يوم إجازة صارم (اعتيادية/مرضية/طويلة):
 * metadata تحمل employee_id + record_date ليُنفّذ زر «موافق» من مركز
 * الإشعارات مباشرة (وسم السجل + عدم احتساب الساعات + إشعار الموظف).
 * ويُدرج إشعار موازٍ للموظف نفسه ليكون على علم أن المشرفين بُلِّغوا.
 */
async function notifySupervisorsOfLeavePunch(employeeId: string, employeeName: string, leaveLabel: string, recordDate: string) {
  try {
    const supervisorIds = await collectSupervisorIds(employeeId);

    if (supervisorIds.length > 0) {
      const title = '⚠️ تنبيه ذكي: بصمة أثناء إجازة رسمية';
      const content = `الموظف (${employeeName}) قام بتسجيل بصمة حضور بتاريخ اليوم على الرغم من تمتعه بـ (${leaveLabel}) معتمدة. يمكنك اعتمادها كساعات غير محتسبة عبر زر «موافق».`;

      // 1. Insert in system_notifications
      const notifRows = supervisorIds.map(supId => ({
        recipient_id: supId,
        type: 'system',
        title,
        content,
        is_read: false,
        metadata: {
          type: 'leave_punch_alert',
          employee_id: employeeId,
          employee_name: employeeName,
          leave_label: leaveLabel,
          record_date: recordDate
        }
      }));
      const { error: supNotifErr } = await supabase.from('system_notifications').insert(notifRows);
      if (supNotifErr) console.warn(supNotifErr);

      // 2. Send Push Notifications
      const pushPromises = supervisorIds.map(supId =>
        sendPushNotification(supId, content, { title })
      );
      await Promise.allSettled(pushPromises);
    }

    // 3. إشعار الموظف نفسه (قاعدة البيانات فقط — هو داخل التطبيق الآن)
    const { error: empNotifErr } = await supabase.from('system_notifications').insert({
      recipient_id: employeeId,
      type: 'system',
      title: '📝 تم تثبيت بصمتك في يوم إجازة',
      content: `ثبتت بصمة حضور في يوم (${leaveLabel}) معتمد لديك. سيُحتسب الدوام إضافياً في يوم الإجازة، وأُبلغ المشرفون بذلك.`,
      is_read: false,
      metadata: {
        type: 'employee_leave_punch_notice',
        employee_id: employeeId,
        record_date: recordDate
      }
    });
    if (empNotifErr) console.warn(empNotifErr);
  } catch (err) {
    console.error('Error in notifySupervisorsOfLeavePunch:', err);
  }
}

/**
 * إشعار علمي للمشرفين عند دوام في يوم (واجب رسمي/إيفاد) معتمد — دون أي عائق
 * على الموظف لأن الدوام هو الغاية من الإجازة الرسمية.
 */
async function notifySupervisorsOfOfficialDutyPunch(employeeId: string, employeeName: string, leaveLabel: string, recordDate: string) {
  try {
    const supervisorIds = await collectSupervisorIds(employeeId);
    if (supervisorIds.length === 0) return;

    const title = '📋 دوام في يوم إجازة رسمية معتمد';
    const content = `الموظف (${employeeName}) ثبت بصمته اليوم وهو في (${leaveLabel}) معتمد — الوضع طبيعي ومتوقع.`;
    const notifRows = supervisorIds.map(supId => ({
      recipient_id: supId,
      type: 'system',
      title,
      content,
      is_read: false,
      metadata: {
        type: 'official_duty_punch',
        employee_id: employeeId,
        employee_name: employeeName,
        leave_label: leaveLabel,
        record_date: recordDate
      }
    }));
    const { error: dutyNotifErr } = await supabase.from('system_notifications').insert(notifRows);
    if (dutyNotifErr) console.warn(dutyNotifErr);
    const pushPromises = supervisorIds.map(supId =>
      sendPushNotification(supId, content, { title })
    );
    await Promise.allSettled(pushPromises);
  } catch (err) {
    console.error('Error in notifySupervisorsOfOfficialDutyPunch:', err);
  }
}

/**
 * إشعار المشرفين عند بصمة موظف لديه طلب إجازة (يوم كامل أو زمنية) قيد المراجعة:
 * كل إشعار يحمل request_id ليفتح زر «مراجعة الطلب» نموذج الاعتماد مباشرة.
 */
async function notifySupervisorsOfPendingRequestPunch(
  employeeId: string,
  employeeName: string,
  requests: LeaveRequestLite[]
) {
  try {
    const supervisorIds = await collectSupervisorIds(employeeId);
    if (supervisorIds.length === 0) return;

    const title = '🕓 بصمة موظف لديه طلب قيد المراجعة';
    const notifRows: any[] = [];
    for (const req of requests) {
      const label = LEAVE_TYPE_LABELS[req.leave_type] || 'إجازة';
      const dur = req.leave_type === 'time_off' ? ` (${req.time_duration_minutes || 0} دقيقة)` : '';
      const content = `الموظف (${employeeName}) ثبت بصمته ولديه طلب (${label})${dur} قيد المراجعة والخاص بيوم اليوم.`;
      for (const supId of supervisorIds) {
        notifRows.push({
          recipient_id: supId,
          type: 'system',
          title,
          content,
          is_read: false,
          metadata: {
            type: 'pending_request_punch',
            request_id: req.id,
            employee_id: employeeId,
            employee_name: employeeName,
            leave_label: label
          }
        });
      }
    }

    // منع التكرار: بصمات لاحقة لنفس الطلب لا تولّد إشعاراً جديداً ما دام
    // الإشعار السابق غير مقروء لدى المشرف نفسه
    if (notifRows.length > 0) {
      const reqIds = requests.map(r => r.id);
      const { data: existingNotifs } = await supabase
        .from('system_notifications')
        .select('recipient_id, metadata')
        .eq('is_read', false)
        .in('recipient_id', supervisorIds)
        .filter('metadata->>request_id', 'in', `(${reqIds.join(',')})`);
      const alreadyNotified = new Set<string>(
        (existingNotifs || []).map((n: any) => `${n.recipient_id}|${n.metadata?.request_id}`)
      );
      const freshRows = notifRows.filter(r => !alreadyNotified.has(`${r.recipient_id}|${r.metadata.request_id}`));
      if (freshRows.length === 0) return;
      const { error: pendNotifErr } = await supabase.from('system_notifications').insert(freshRows);
      if (pendNotifErr) console.warn(pendNotifErr);
      const notifiedSupIds = [...new Set(freshRows.map(r => r.recipient_id))];
      const pushPromises = notifiedSupIds.map(supId =>
        sendPushNotification(supId, `لدى (${employeeName}) طلب إجازة قيد المراجعة وثبّت بصمته اليوم`, { title })
      );
      await Promise.allSettled(pushPromises);
    }
  } catch (err) {
    console.error('Error in notifySupervisorsOfPendingRequestPunch:', err);
  }
}

/** إشعار علمي: موظف ثبت بصمته بعد رفض طلب إجازة يبدأ اليوم */
async function notifySupervisorsOfRejectedLeavePunch(
  employeeId: string,
  employeeName: string,
  requests: LeaveRequestLite[]
) {
  try {
    const supervisorIds = await collectSupervisorIds(employeeId);
    if (supervisorIds.length === 0) return;

    const title = '↩️ بصمة بعد رفض طلب إجازة';
    const notifRows: any[] = [];
    for (const req of requests) {
      const label = LEAVE_TYPE_LABELS[req.leave_type] || 'إجازة';
      const content = `الموظف (${employeeName}) ثبت بصمته اليوم بعد رفض طلبه لـ(${label}) — للعلم والمتابعة.`;
      for (const supId of supervisorIds) {
        notifRows.push({
          recipient_id: supId,
          type: 'system',
          title,
          content,
          is_read: false,
          metadata: {
            type: 'rejected_leave_punch',
            request_id: req.id,
            employee_id: employeeId,
            employee_name: employeeName,
            leave_label: label
          }
        });
      }
    }

    if (notifRows.length > 0) {
      const { error: rejNotifErr } = await supabase.from('system_notifications').insert(notifRows);
      if (rejNotifErr) console.warn(rejNotifErr);
    }
  } catch (err) {
    console.error('Error in notifySupervisorsOfRejectedLeavePunch:', err);
  }
}

/** إشعار المشرفين عند نقص بصمات الخروج/العودة المطلوبة لإجازة زمنية معتمدة */
async function notifySupervisorsOfMissingTimeLeavePunches(employeeId: string, message: string) {
  try {
    const supervisorIds = await collectSupervisorIds(employeeId);
    if (supervisorIds.length === 0) return;

    let employeeName = 'موظف';
    try {
      const { data: p } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', employeeId)
        .single();
      if (p?.full_name) employeeName = p.full_name;
    } catch { /* الاسم الافتراضي كافٍ */ }

    const title = '⏱️ نقص بصمات إجازة زمنية';
    const content = `الموظف (${employeeName}): ${message}.`;
    const notifRows = supervisorIds.map(supId => ({
      recipient_id: supId,
      type: 'system',
      title,
      content,
      is_read: false,
      metadata: {
        type: 'time_leave_missing',
        employee_id: employeeId,
        employee_name: employeeName,
        message
      }
    }));
    const { error: tlNotifErr } = await supabase.from('system_notifications').insert(notifRows);
    if (tlNotifErr) console.warn(tlNotifErr);
    const pushPromises = supervisorIds.map(supId =>
      sendPushNotification(supId, content, { title })
    );
    await Promise.allSettled(pushPromises);
  } catch (err) {
    console.error('Error in notifySupervisorsOfMissingTimeLeavePunches:', err);
  }
}

async function notifySupervisorsOfDeviceMismatch(
  employeeId: string,
  oldDeviceId: string,
  newDeviceId: string | undefined
) {
  console.log('[DeviceMismatch] ▶ START notifySupervisorsOfDeviceMismatch', { employeeId, oldDeviceId, newDeviceId });
  try {
    // 1. Safe insert into device_change_requests via SECURITY DEFINER RPC
    try {
      const { error: dcrError } = await supabase.rpc('submit_device_change_request', {
        p_employee_id: employeeId,
        p_old_device_id: oldDeviceId || 'unknown',
        p_new_device_id: newDeviceId || 'unknown'
      });
      if (dcrError) {
        console.warn('[DeviceMismatch] submit_device_change_request RPC error:', dcrError);
      } else {
        console.log('[DeviceMismatch] ✅ submit_device_change_request succeeded');
      }
    } catch (dcrErr) {
      console.warn('[DeviceMismatch] submit_device_change_request threw:', dcrErr);
    }

    // 2. Insert system notifications via dedicated RPC (SECURITY DEFINER, bypasses RLS)
    console.log('[DeviceMismatch] Calling notify_device_mismatch RPC...');
    const { data: notifyResult, error: notifyError } = await supabase.rpc('notify_device_mismatch', {
      p_employee_id: employeeId
    });

    if (notifyError) {
      console.error('[DeviceMismatch] ❌ notify_device_mismatch RPC FAILED:', notifyError);
    } else {
      console.log('[DeviceMismatch] ✅ notify_device_mismatch succeeded, notifications inserted count:', notifyResult);
    }

    // 3. Optional Push Notifications via OneSignal Edge Function
    try {
      let employeeName = 'موظف';
      let employeeGov = '';
      const { data: userProfile } = await supabase
        .from('profiles')
        .select('full_name, governorate')
        .eq('id', employeeId)
        .maybeSingle();

      if (userProfile?.full_name) {
        employeeName = userProfile.full_name;
      }
      if (userProfile?.governorate) {
        employeeGov = userProfile.governorate;
      }

      let query = supabase
        .from('profiles')
        .select('id')
        .in('admin_role', ['general', 'biometric'])
        .neq('id', employeeId);

      if (employeeGov) {
        query = query.eq('governorate', employeeGov);
      }

      const { data: directProfiles } = await query;

      const supervisorIds: string[] = (directProfiles || []).map(p => p.id);

      if (supervisorIds.length > 0) {
        const title = 'تنبيه: تسجيل من جهاز غير معتمد';
        const content = `قام الموظف (${employeeName}) بتسجيل البصمة من جهاز غير معتمد، يرجى المراجعة.`;

        const pushPromises = supervisorIds.map(supId =>
          sendPushNotification(supId, content, {
            title,
            url: `${window.location.origin}/admin`
          })
        );
        await Promise.allSettled(pushPromises);
      }
    } catch (pushErr) {
      console.warn('[DeviceMismatch] Push notification error (non-critical):', pushErr);
    }

    console.log('[DeviceMismatch] ▶ END notifySupervisorsOfDeviceMismatch');
  } catch (err) {
    console.error('[DeviceMismatch] ❌ FATAL error:', err);
  }
}

export function extractDeviceHash(deviceStr: string | null | undefined): string {
  if (!deviceStr) return '';
  const match = deviceStr.match(/\[([a-f0-9\-]{16,64})\]/i);
  if (match) return match[1].toLowerCase();
  return deviceStr.trim().toLowerCase();
}

export function isSameDevice(stored: string | null | undefined, current: string | null | undefined): boolean {
  if (!stored || !current) return false;
  if (stored.trim().toLowerCase() === current.trim().toLowerCase()) return true;
  const hash1 = extractDeviceHash(stored);
  const hash2 = extractDeviceHash(current);
  return hash1 !== '' && hash1 === hash2;
}

export async function verifyAndAuthorizeDevice(
  employeeId: string,
  deviceId: string | undefined,
  profile: { primary_device_id?: string | null; full_name?: string | null } | null
): Promise<boolean> {
  if (!deviceId) return true;

  // 1. أول تسجيل لجهاز الموظف (إذا لم يكن لديه أي جهاز معتمد مسبقاً)
  if (!profile?.primary_device_id) {
    supabase.from('profiles').update({ 
      primary_device_id: deviceId 
    }).eq('id', employeeId).then(() => {}, (err) => console.warn(err));
    notifyAdminsForDeviceChange(profile?.full_name || 'موظف').catch(console.warn);
    return true;
  }

  // 2. مطابقة صارمة مع الجهاز الأساسي المعتمد فقط (جهاز واحد فقط لا غير)
  if (isSameDevice(profile.primary_device_id, deviceId)) {
    return true;
  }

  // 3. أي جهاز آخر يُعتبر غير معتمد لمنع استخدام أكثر من جهاز للبصمة
  return false;
}

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

// ─── أدوات التاريخ المحلي لحدود يوم البصمة (توقيت بغداد UTC+3) ───
import { 
  determineShiftType, 
  validateEarlyCheckIn, 
  getBaghdadDateStr, 
  countRealPunches 
} from '../utils/shiftRules';
import { 
  getServerNow, 
  getServerLocalDateStr, 
  checkClockTampering, 
  syncServerTime 
} from './serverTimeService';

/** تاريخ اليوم المحلي بصيغة YYYY-MM-DD وفق توقيت بغداد المعتمد على السيرفر */
export function getLocalDateStr(d: Date = getServerNow()): string {
  return getBaghdadDateStr(d);
}

/** حدود اليوم المحلي (00:00 و23:59:59 محلياً) محوّلة إلى UTC ISO للاستعلام من timestamptz */
function localDayRangeUTC(dateStr: string): { start: string; end: string } {
  const [y, m, d] = dateStr.split('-').map(Number);
  const start = new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0) - (3 * 3600 * 1000));
  const end = new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999) - (3 * 3600 * 1000));
  return { start: start.toISOString(), end: end.toISOString() };
}

export const attendanceRecordService = {
  async saveSecure(employeeId: string, recordId?: string | null, updates: Partial<AttendanceRecord> = {}) {
    const { data, error } = await supabase.rpc('submit_attendance_record_secure', {
      p_employee_id: employeeId,
      p_record_id: recordId || null,
      p_updates: updates
    });
    if (error) throw error;
    return data as AttendanceRecord;
  },

  async create(record: Partial<AttendanceRecord>) {
    if (!record.employee_id) throw new Error('employee_id is required');
    return await this.saveSecure(record.employee_id, null, record);
  },

  async update(id: string, updates: Partial<AttendanceRecord>) {
    let empId = updates.employee_id;
    if (!empId) {
      const user = (await supabase.auth.getUser()).data.user;
      empId = user?.id;
    }
    if (!empId) throw new Error('User not authenticated');
    return await this.saveSecure(empId, id, updates);
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
    await syncServerTime();
    const todayRecord = await this.getTodayByEmployeeId(employeeId);
    if (!todayRecord) throw new Error('لم يتم تسجيل الحضور اليوم');

    const now = getServerNow().toISOString();
    return await this.saveSecure(employeeId, todayRecord.id, {
      time_leave_out: now,
    });
  },

  async timeLeaveReturn(employeeId: string, _location?: string, _deviceId?: string, _verifiedByBiometric: boolean = false) {
    await syncServerTime();
    const todayRecord = await this.getTodayByEmployeeId(employeeId);
    if (!todayRecord) throw new Error('لم يتم تسجيل الحضور اليوم');
    if (!todayRecord.time_leave_out) throw new Error('لم يتم تسجيل خروج زمني مسبقاً');

    const now = getServerNow();
    const timeLeaveOutTime = new Date(todayRecord.time_leave_out);
    const actualMinutesSpent = Math.max(0, Math.floor((now.getTime() - timeLeaveOutTime.getTime()) / 60000));

    // Record the return punch via secure RPC
    const data = await this.saveSecure(employeeId, todayRecord.id, {
      time_leave_return: now.toISOString(),
    });

    // ----- Penalty Logic -----
    try {
      const todayStr = now.toISOString().split('T')[0];
      // Get today's approved time_off request
      const { data: leaveReqs } = await supabase
        .from('leave_requests')
        .select('*')
        .eq('user_id', employeeId)
        .eq('leave_type', 'time_off')
        .eq('start_date', todayStr)
        .eq('status', 'approved')
        .order('created_at', { ascending: false })
        .limit(1);

      if (leaveReqs && leaveReqs.length > 0) {
        const leaveReq = leaveReqs[0];
        const requestedMinutes = leaveReq.time_duration_minutes || 0;
        const delay = actualMinutesSpent - requestedMinutes;

        if (delay > 0) {
          let penalty = 0;
          let isForcedLeave = false;

          if (delay <= 5) penalty = 15;
          else if (delay <= 10) penalty = 30;
          else if (delay <= 15) penalty = 60;
          else isForcedLeave = true;

          const newDuration = requestedMinutes + penalty;
          if (newDuration > 120) isForcedLeave = true;

          if (isForcedLeave) {
            // Convert to a full day regular leave
            await supabase.from('leave_requests').update({
              leave_type: 'regular',
              time_duration_minutes: null,
              days_count: 1,
              reason: `${leaveReq.reason || ''} [تم تحويله لإجازة يوم كامل بسبب تجاوز الحد الزمني]`
            }).eq('id', leaveReq.id);

            // Notify user
            await supabase.from('system_notifications').insert({
              recipient_id: employeeId,
              type: 'system',
              title: 'تجاوز الإجازة الزمنية',
              content: `تم تحويل إجازتك الزمنية إلى إجازة يوم كامل بسبب تأخرك لفترة طويلة.`
            });

            // Notify supervisor
            if (leaveReq.supervisor_id) {
              const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', employeeId).single();
              await supabase.from('system_notifications').insert({
                recipient_id: leaveReq.supervisor_id,
                type: 'system',
                title: 'تحويل إجازة زمنية إجبارياً',
                content: `تم تحويل الإجازة الزمنية للموظف ${profile?.full_name || ''} إلى إجازة يوم كامل لتجاوزه الحد الزمني.`
              });
            }
          } else {
            // Update time_duration_minutes
            await supabase.from('leave_requests').update({
              time_duration_minutes: newDuration
            }).eq('id', leaveReq.id);

            // Notify user
            await supabase.from('system_notifications').insert({
              recipient_id: employeeId,
              type: 'system',
              title: 'خصم تأخير من الرصيد الزمني',
              content: `بسبب تأخرك لمدة ${delay} دقيقة عن الإجازة الزمنية، تم خصم ${penalty} دقيقة إضافية من رصيدك (المدة الجديدة: ${newDuration} دقيقة).`
            });
          }
        }
      }
    } catch (penaltyError) {
      console.error('Error applying time leave return penalty:', penaltyError);
    }

    return data as AttendanceRecord;
  },

  async getByDate(date: string) {
    // حدود اليوم المطلوب محلياً بصيغة UTC — نفس منطق بطاقة اليوم
    const range = localDayRangeUTC(date);
    const { data, error } = await supabase
      .from('attendance_records')
      .select('*')
      .gte('created_at', range.start)
      .lte('created_at', range.end)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data as AttendanceRecord[];
  },

  async getTodayByEmployeeId(employeeId: string) {
    // حدود اليوم المحلي بصيغة UTC — كانت UTC صرفة فتبقى سجلات الأمس ظاهرة حتى 03:00
    const range = localDayRangeUTC(getLocalDateStr());
    const { data, error } = await supabase
      .from('attendance_records')
      .select('*')
      .eq('employee_id', employeeId)
      .gte('created_at', range.start)
      .lte('created_at', range.end)
      .order('created_at', { ascending: false })
      .limit(1);
    if (error) throw error;
    
    const record = data?.[0] as AttendanceRecord | undefined;
    if (record && Array.isArray(record.raw_punches) && record.raw_punches.length > 0) {
      const { categorizePunches } = await import('../utils/punchCategorizer');
      const recat = categorizePunches(record.raw_punches);
      
      // Auto-heal only if a missing slot was discovered, without erasing existing fields
      const needsHeal = 
        (!record.check_in && recat.check_in) ||
        (!record.time_leave_out && recat.time_leave_out) ||
        (!record.time_leave_return && recat.time_leave_return) ||
        (!record.check_out && recat.check_out);

      if (needsHeal) {
        const healUpdates: Partial<AttendanceRecord> = { ...recat };
        if (record.check_in) healUpdates.check_in = record.check_in;
        if (record.check_out) healUpdates.check_out = record.check_out;
        if (record.time_leave_out) healUpdates.time_leave_out = record.time_leave_out;
        if (record.time_leave_return) healUpdates.time_leave_return = record.time_leave_return;
        healUpdates.raw_punches = record.raw_punches;

        const updatedData = await this.saveSecure(employeeId, record.id, healUpdates);
        if (updatedData) return updatedData as AttendanceRecord;
      }
    }
    return record;
  },

  async registerPunch(
    employeeId: string,
    location?: string,
    deviceId?: string,
    verifiedByBiometric: boolean = false,
    snapshotUrl?: string,
    notes?: string,
    bypassLeaveWarning: boolean = false,
    targetSlot?: 'check_in' | 'time_leave_out' | 'time_leave_return' | 'check_out' | 'update_check_out',
    options?: { skipDeviceCheck?: boolean }
  ) {
    const { categorizePunches } = await import('../utils/punchCategorizer');

    // مزامنة التوقيت الرسمي مع الخادم وفحص سلامة ساعة الجهاز ضد أي تلاعب يدوي
    await syncServerTime();
    const tamper = checkClockTampering();
    if (tamper.isTampered) {
      const tamperNote = `(تنبيه أمني: ساعة الجهاز غير متطابقة مع السيرفر بفارق ${tamper.diffSeconds} ثانية)`;
      notes = notes ? `${notes} - ${tamperNote}` : tamperNote;
    }

    // 1. Get today's record (تاريخ محلي وفق توقيت بغداد المعتمد على السيرفر)
    const today = getLocalDateStr();
    let record = await this.getTodayByEmployeeId(employeeId);

    // ─── المحرك الذكي: فحص إجازات وطلبات اليوم قبل تثبيت أول بصمة حضور ───
    // (اعتيادية/مرضية → تحذير واعتماد | واجب/إيفاد → مرور مباشر | معلّق/مرفوض → إشعار مشرف)
    const leaveCtx = await resolvePunchRequestContext(employeeId, today);
    if (leaveCtx.strictDayLeave && !record && !bypassLeaveWarning) {
      throw new LeaveDayPunchWarning(leaveCtx.dayLeave!);
    }

    // 2. Fetch profile & schedule to determine shift type
    const { data: profile } = await supabase
      .from('profiles')
      .select('department_id, primary_device_id, work_schedule_id, full_name')
      .eq('id', employeeId)
      .single();

    let workSchedule = null;
    let isRestDay = false;
    if (profile?.work_schedule_id) {
      const { data: ws } = await supabase
        .from('work_schedules')
        .select('*')
        .eq('id', profile.work_schedule_id)
        .single();
      workSchedule = ws;

      const dateObj = new Date(`${today}T00:00:00`);
      const dayOfWeek = dateObj.getDay();

      const { data: sd } = await supabase
        .from('work_schedule_days')
        .select('is_rest_day')
        .eq('schedule_id', profile.work_schedule_id)
        .eq('day_of_week', dayOfWeek)
        .maybeSingle();
        
      if (sd && sd.is_rest_day) {
        isRestDay = true;
      }
    }

    const shiftType = determineShiftType(profile, workSchedule);

    if (!isRestDay && shiftType !== 'shift') {
        const { isHolidayOrWeekend, dayTypeLabel } = await import('../../../lib/attendanceHelpers').then(m => m.fetchDailyAttendanceStats(today, 'all'));
        if (isHolidayOrWeekend) {
            isRestDay = true;
            if (!record && !bypassLeaveWarning) {
                throw new LeaveDayPunchWarning({
                    id: 'weekend_holiday',
                    leaveType: 'rest',
                    label: dayTypeLabel,
                    warningMessage: `هذا اليوم مخصص كـ ${dayTypeLabel}`
                });
            }
        }
    }

    if (isRestDay && shiftType === 'shift' && !record && !bypassLeaveWarning) {
      throw new LeaveDayPunchWarning({
        id: 'rest_day',
        leaveType: 'rest',
        label: 'استراحة',
        warningMessage: 'اليوم هو يوم استراحة في جدول مناوبتك المعتمد'
      });
    }

    // 3. Load yesterday's record for night-shift logic (حدود يوم أمس المحلي بتوقيت بغداد المعتمد على السيرفر)
    const yesterdayDateStr = getBaghdadDateStr(new Date(getServerNow().getTime() - 86400000));
    const yesterdayRange = localDayRangeUTC(yesterdayDateStr);
    const { data: yesterdayData } = await supabase
      .from('attendance_records')
      .select('*')
      .eq('employee_id', employeeId)
      .gte('created_at', yesterdayRange.start)
      .lte('created_at', yesterdayRange.end)
      .order('created_at', { ascending: false })
      .limit(1);
      
    const yesterdayRecord = yesterdayData?.[0] as AttendanceRecord | undefined;
    const yesterdayRealCount = yesterdayRecord ? countRealPunches(yesterdayRecord.raw_punches) : 0;
    const yesterdayWasOdd = yesterdayRealCount % 2 === 1 || (yesterdayRecord?.check_in && !yesterdayRecord?.check_out);

    // فحص ما إذا كانت البصمة الحالية هي استكمال لخفر/مناوبة الأمس
    const isFollowUpOvernight = shiftType === 'shift' && Boolean(yesterdayWasOdd) && (!record || !record.raw_punches || record.raw_punches.length === 0);

    // 4. قيد الحضور المبكر (قبل 6:30 ص) استناداً لوقت السيرفر
    const earlyCheck = validateEarlyCheckIn(shiftType, getServerNow(), isFollowUpOvernight);
    if (!earlyCheck.allowed && !record) {
      throw new Error(earlyCheck.message || 'لا يسمح بتثبيت الحضور قبل 6:30ص');
    }

    // 5. إذا كان الموظف مناوباً ولديه خفر ممتد: إغلاق سجل الأمس تلقائياً عند 23:59
    if (isFollowUpOvernight && yesterdayRecord && !yesterdayRecord.check_out) {
      const virtualOutTime = `${yesterdayDateStr}T23:59:00.000Z`;
      const updatedNotes = mergeNote(yesterdayRecord.notes, '(خروج نهائي افتراضي)');
      await this.saveSecure(employeeId, yesterdayRecord.id, {
        check_out: virtualOutTime,
        notes: updatedNotes
      }).catch(console.warn);
    }

    const nowServer = getServerNow();
    const nowIso = nowServer.toISOString();

    // فحص مهلة الأمان (3 دقائق = 180 ثانية) بين البصمات لمنع التكرار العرضي
    if (record && Array.isArray(record.raw_punches) && record.raw_punches.length > 0 && !notes?.includes('تجاوز المهلة')) {
      const lastPunchTime = new Date(record.raw_punches[record.raw_punches.length - 1].time).getTime();
      const elapsedSeconds = Math.floor((nowServer.getTime() - lastPunchTime) / 1000);
      if (elapsedSeconds < 180 && !bypassLeaveWarning) {
        const remaining = 180 - elapsedSeconds;
        throw new Error(`يرجى الانتظار ${remaining} ثانية قبل تسجيل بصمة جديدة (مهلة الأمان بين البصمات لمنع التكرار العرضي)`);
      }
    }

    // 6. فحص اعتماد الجهاز (Device Authorization Check)
    // الكيوسك: جهاز ثابت مشترك معتمد مركزياً — لا يخضع لفحص جهاز الموظف الشخصي
    const isAuthorized = options?.skipDeviceCheck
      ? true
      : await verifyAndAuthorizeDevice(employeeId, deviceId, profile);

    const hasExistingPunches = Boolean(
      (record && Array.isArray(record.raw_punches) && record.raw_punches.length > 0) ||
      record?.check_in
    );

    let isDevicePending = false;
    if (!isAuthorized) {
      // إذا كان للموظف بصمة سابقة اليوم، يُمنع تماماً قبول بصمة ثانية أو لاحقة من جهاز غير معتمد
      if (hasExistingPunches) {
        throw new Error('لا يمكن تسجيل بصمة إضافية من جهاز غير معتمد. لقد تم قبول بصمتك الأولى استثنائياً، ويجب مراجعة مسؤول البصمة لاعتماد جهازك قبل المتابعة.');
      }

      // البصمة الأولى فقط من جهاز غير معتمد: تُقبل استثنائياً باللون الأحمر مع إشعار المشرف
      isDevicePending = true;
      notifySupervisorsOfDeviceMismatch(employeeId, profile?.primary_device_id || 'unknown', deviceId).catch(console.warn);
    } else {
      isDevicePending = false;
    }

    // 7. وقت البصمة يُستخرج حصرياً من توقيت السيرفر المحصن getServerNow() لمنع أي تلاعب
    const newPunch = {
      time: nowIso,
      location,
      device_id: deviceId,
      snapshot_url: snapshotUrl,
      notes,
      verified_by_biometric: verifiedByBiometric,
      target_slot: targetSlot
    };

    // 8. Update raw_punches
    let rawPunches: any[] = [];
    if (record && record.raw_punches) {
      rawPunches = Array.isArray(record.raw_punches) ? [...record.raw_punches] : [];
    }
    rawPunches.push(newPunch);

    // 9. Run categorizer with shift rules
    const updates = categorizePunches(rawPunches, yesterdayRecord, today, shiftType, false);
    if (!updates.raw_punches || updates.raw_punches.length === 0) {
      updates.raw_punches = rawPunches;
    }

    // إيقاف ميزة تعيين الخانات الصريحة (targetSlot) بناءً على طلب المستخدم واسترجاع التوزيع الذكي
    // تم إلغاء كود targetSlot === 'check_in' وغيرها ليعمل النظام بذكاء وتلقائية بالكامل


    // ─── المحرك الذكي (2): بصمة في يوم إجازة/طلب → ملاحظات + إشعارات حسب الحالة ───
    // واجب/إيفاد → إشعار علمي بلا إنذار وساعات أصليّة | اعتيادية/مرضية → تنبيه + زر «موافق»
    if (leaveCtx.dayLeave) {
      const isOfficialDuty = OFFICIAL_DUTY_TYPES.includes(leaveCtx.dayLeave.leaveType);
      if (!isOfficialDuty) {
        const baseNotes = record?.notes || updates.notes || notes;
        updates.notes = mergeNote(baseNotes, buildLeaveDayOvertimeNote(leaveCtx.dayLeave.label));
      }
      const empName = profile?.full_name || 'موظف';
      if (isOfficialDuty) {
        notifySupervisorsOfOfficialDutyPunch(employeeId, empName, leaveCtx.dayLeave.label, today).catch(console.warn);
      } else {
        notifySupervisorsOfLeavePunch(employeeId, empName, leaveCtx.dayLeave.label, today).catch(console.warn);
      }
    }
    // طلب معلّق يغطي اليوم → بصمة عادية + إشعار مشرف يحمل request_id لزر «مراجعة الطلب»
    if (leaveCtx.pendingRequests.length > 0) {
      notifySupervisorsOfPendingRequestPunch(employeeId, profile?.full_name || 'موظف', leaveCtx.pendingRequests).catch(console.warn);
    }
    // طلب مرفوض يبدأ اليوم → بصمة عادية + إشعار علمي للمشرف
    if (leaveCtx.rejectedToday.length > 0) {
      notifySupervisorsOfRejectedLeavePunch(employeeId, profile?.full_name || 'موظف', leaveCtx.rejectedToday).catch(console.warn);
    }

    if (!isAuthorized) {
      const mismatchNote = '(دخول: جهاز غير معتمد)';
      if (updates.notes) {
        if (!updates.notes.includes(mismatchNote)) {
          updates.notes = updates.notes + ' - ' + mismatchNote;
        }
      } else if (notes) {
        updates.notes = notes + ' - ' + mismatchNote;
      } else {
        updates.notes = mismatchNote;
      }
    }
    updates.is_device_pending = isDevicePending;

    let savedRecord: AttendanceRecord;
    if (record) {
      // Update existing record via secure RPC
      savedRecord = await this.saveSecure(employeeId, record.id, updates);
    } else {
      // Create new record via secure RPC
      updates.employee_id = employeeId;
      updates.department_id = profile?.department_id;
      updates.work_schedule_id = profile?.work_schedule_id;
      updates.status = 'present'; // Default
      savedRecord = await this.saveSecure(employeeId, null, updates);
    }

    try {
      // فقط إذا كانت البصمة انصرافاً نهائياً أو لم يُحدد نوعها
      if (targetSlot === 'check_out' || !targetSlot) {
        await this.enforceMandatoryPenalties(employeeId, today, savedRecord);
      }
    } catch (e) {
      console.error('Error applying mandatory penalties:', e);
    }
    // ─── تكامل الإجازات (3): تحذيرات بصمات الإجازة الزمنية ───
    return await this.applyTimeLeavePunchWarnings(savedRecord, leaveCtx.timeLeaves);
  },

  /**
   * تكامل الإجازات (3): عند إغلاق اليوم (تسجيل الانصراف) تُقيَّم التزامات
   * الإجازات الزمنية المعتمدة — إن لم يُثبت الموظف بصمة الخروج/العودة
   * المطلوبة يُضاف تحذير دقيق إلى ملاحظات السجل ليظهر في السجلات والتقارير.
   * لا تُقيَّم الحالة قبل الانصراف حتى لا يظهر تحذير مبكر أثناء الدوام.
   */
  async applyTimeLeavePunchWarnings(record: AttendanceRecord, timeLeaves: TimeLeaveInfo[]): Promise<AttendanceRecord> {
    try {
      if (!timeLeaves.length || !record.check_out) return record;
      const status = evaluateTimeLeavePunches(record, timeLeaves);
      if (!status?.message) return record;
      const newNotes = mergeNote(record.notes, status.message);
      if (newNotes === record.notes) return record;
      // المحرك الذكي: إشعار المشرفين فوراً بنقص بصمات الخروج/العودة المطلوبة
      notifySupervisorsOfMissingTimeLeavePunches(record.employee_id, status.message).catch(console.warn);
      return await this.saveSecure(record.employee_id, record.id, { notes: newNotes });
    } catch (err) {
      console.error('[LeaveIntegration] فشل إضافة تحذير بصمات الإجازة الزمنية:', err);
      return record;
    }
  },

  async enforceMandatoryPenalties(employeeId: string, dateStr: string, record: AttendanceRecord) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('work_schedule_id, full_name, governorate, department_id')
      .eq('id', employeeId)
      .single();

    let scheduleQuery = supabase
      .from('work_schedules')
      .select('*, days:work_schedule_days(*)');
    if (profile?.work_schedule_id) scheduleQuery = scheduleQuery.eq('id', profile.work_schedule_id);
    else scheduleQuery = scheduleQuery.eq('is_default', true);

    const { data: schedule } = await scheduleQuery.limit(1).single();
    if (!schedule) return;

    const isRoster = schedule.type === 'roster';
    const checkInDate = record.check_in ? new Date(record.check_in) : (record.created_at ? new Date(record.created_at) : getServerNow());
    const today = checkInDate;
    const bIn = getBaghdadDate(checkInDate);
    const dayOfWeek = bIn.getDay();

    const daySchedule: any = schedule.days?.find((d: any) => d.day_of_week === dayOfWeek);
    if (daySchedule && daySchedule.is_rest_day) return; // يوم استراحة أو عطلة أسبوعية

    // إذا لم يوجد جدول يومي مخصص للدوام الثابت، الجمعة والسبت عطلة افتراضية
    if (!isRoster && !daySchedule && (dayOfWeek === 5 || dayOfWeek === 6)) return;

    // Fetch all approved leaves and time_offs covering dateStr
    const { data: allLeavesData } = await supabase
      .from('leave_requests')
      .select('id, time_off_subtype, time_duration_minutes, with_request, is_mandatory, leave_type, reason, leave_start_time, leave_end_time, start_date, end_date, days_count')
      .eq('user_id', employeeId)
      .eq('status', 'approved')
      .lte('start_date', dateStr)
      .or(`end_date.gte.${dateStr},end_date.is.null`);

    const allTimeOffs = allLeavesData || [];

    // ─── الانزياح الذكي (Auto-Shift) للإجازات الزمنية الوسطية ونهاية الدوام ───
    if (allTimeOffs) {
       for (const timeOff of allTimeOffs) {
          if (timeOff.leave_type === 'time_off' && timeOff.with_request && timeOff.leave_start_time) {
             let actualOutDate: Date | null = null;
             
             if (timeOff.time_off_subtype === 'mid_shift' && record.time_leave_out) {
                 actualOutDate = new Date(record.time_leave_out);
             } else if (timeOff.time_off_subtype === 'shift_end' && record.check_out) {
                 actualOutDate = new Date(record.check_out);
             }

             if (actualOutDate) {
                 const [lh, lm] = timeOff.leave_start_time.split(':').map(Number);
                 const expectedOut = new Date(today);
                 expectedOut.setHours(lh, lm, 0, 0);

                 // إذا خرج الموظف قبل وقت الإجازة المحدد بأكثر من 5 دقائق (تجاوز السماحية)
                 const diffMins = Math.floor((expectedOut.getTime() - actualOutDate.getTime()) / 60000);
                 
                 if (diffMins > 5) {
                     // تشفيت البداية إلى الوراء (لتطابق وقت الخروج الفعلي)
                     expectedOut.setMinutes(expectedOut.getMinutes() - diffMins);
                     const newStartStr = `${expectedOut.getHours().toString().padStart(2, '0')}:${expectedOut.getMinutes().toString().padStart(2, '0')}:00`;
                     
                     // حساب النهاية الجديدة بناءً على المدة الأصلية
                     const newEnd = new Date(expectedOut);
                     newEnd.setMinutes(newEnd.getMinutes() + (timeOff.time_duration_minutes || 0));
                     const newEndStr = `${newEnd.getHours().toString().padStart(2, '0')}:${newEnd.getMinutes().toString().padStart(2, '0')}:00`;

                     if (newStartStr !== timeOff.leave_start_time) {
                         const updatePayload = {
                             leave_start_time: newStartStr,
                             leave_end_time: newEndStr,
                             reason: (timeOff.reason || '') + ` [تم الانزياح الذكي: خرج مبكراً بـ ${diffMins} دقيقة]`
                         };
                         await supabase.from('leave_requests').update(updatePayload).eq('id', timeOff.id);
                         
                         // إشعار الموظف بالتشفيت
                         await supabase.from('system_notifications').insert({
                            recipient_id: employeeId,
                            sender_id: employeeId,
                            type: 'system',
                            title: 'تعديل آلي لوقت الإجازة الزمنية (انزياح ذكي)',
                            content: `قمت بالخروج المبكر بـ ${diffMins} دقيقة عن بداية إجازتك المعتمدة. تم تشفيت وقت الإجازة لتبدأ من ${newStartStr} وتنتهي في ${newEndStr} آلياً. يرجى الالتزام بوقت العودة.`,
                            metadata: { request_id: timeOff.id },
                            created_at: getServerNow().toISOString()
                         });
                         
                         timeOff.leave_start_time = newStartStr;
                         timeOff.leave_end_time = newEndStr;
                     }
                 }
             }
          }
       }
    }

    // Find requested (not mandatory) shift_start and shift_end
    const requestedShiftStart = allTimeOffs?.find(r => r.time_off_subtype === 'shift_start' && r.with_request && r.leave_type === 'time_off');
    const requestedShiftEnd = allTimeOffs?.find(r => r.time_off_subtype === 'shift_end' && r.with_request && r.leave_type === 'time_off');

    const lateLeave = allTimeOffs?.find(l => (!l.with_request || l.is_mandatory) && (l.time_off_subtype === 'shift_start' || (l.leave_type === 'regular' && l.reason?.includes('تأخير'))));
    const earlyLeave = allTimeOffs?.find(l => (!l.with_request || l.is_mandatory) && (l.time_off_subtype === 'shift_end' || (l.leave_type === 'regular' && l.reason?.includes('خروج مبكر'))));

    const calculateTotalTimeOff = (excludeId?: string) => {
        return allTimeOffs?.filter(r => r.leave_type === 'time_off' && r.id !== excludeId)
            .reduce((sum, req) => sum + (req.time_duration_minutes || 0), 0) || 0;
    };

    // Helper notification for penalties
    const sendPenaltyAlert = async (
      penaltyType: 'time_off_30' | 'time_off_60' | 'regular_day',
      reasonText: string,
      isLate: boolean,
      minutesVal: number
    ) => {
      try {
        const empName = profile?.full_name || 'موظف';
        const penaltyLabel = penaltyType === 'regular_day' 
          ? 'إجازة اعتيادية إجبارية (يوم كامل)' 
          : (penaltyType === 'time_off_60' ? 'إجازة زمنية إجبارية (ساعة كاملة)' : 'إجازة زمنية إجبارية (نصف ساعة)');

        const title = isLate ? '⚠️ تنبيه: تأخير وإجازة إجبارية' : '⚠️ تنبيه: خروج مبكر وإجازة إجبارية';
        const empContent = `تم تسجيل ${isLate ? 'تأخير' : 'خروج مبكر'} بـ (${minutesVal} دقيقة) في سجلك لتاريخ ${dateStr}، وتقييد (${penaltyLabel}) أصولياً في النظام.`;
        const supContent = `الموظف (${empName}) تم تسجيل ${isLate ? 'تأخير' : 'خروج مبكر'} بـ (${minutesVal} دقيقة) له لتاريخ ${dateStr}، وتم تقييد (${penaltyLabel}) تلقائياً.`;

        // 1. Notify Employee
        await supabase.from('system_notifications').insert({
          recipient_id: employeeId,
          type: 'penalty_notice',
          title,
          content: empContent,
          is_read: false,
          metadata: {
            type: 'mandatory_penalty',
            penalty_type: penaltyType,
            record_date: dateStr,
            minutes: minutesVal,
            is_late: isLate,
            reason: reasonText
          }
        });
        sendPushNotification(employeeId, empContent, { title }).catch(console.warn);

        // 2. Notify Biometric Supervisors only (not finance)
        let supQuery = supabase
          .from('profiles')
          .select('id')
          .in('admin_role', ['biometric', 'attendance_supervisor', 'general'])
          .neq('id', employeeId);

        if (profile?.governorate) {
          supQuery = supQuery.eq('governorate', profile.governorate);
        }

        const { data: sups } = await supQuery;
        if (sups && sups.length > 0) {
          const rows = sups.map(s => ({
            recipient_id: s.id,
            type: 'biometric_alert',
            title,
            content: supContent,
            is_read: false,
            metadata: {
              type: 'mandatory_penalty_supervisor',
              employee_id: employeeId,
              employee_name: empName,
              penalty_type: penaltyType,
              record_date: dateStr,
              minutes: minutesVal,
              is_late: isLate,
              reason: reasonText
            }
          }));
          await supabase.from('system_notifications').insert(rows);
          sups.forEach(s => sendPushNotification(s.id, supContent, { title }).catch(console.warn));
        }

        // 3. Notify Direct Manager (Department Manager)
        if (profile?.department_id) {
          const { data: dept } = await supabase
            .from('departments')
            .select('manager_id')
            .eq('id', profile.department_id)
            .single();

          if (dept?.manager_id && dept.manager_id !== employeeId) {
            const mgrTitle = isLate ? '⚠️ تنبيه تأخير موظف في قسمك' : '⚠️ تنبيه انصراف مبكر لموظف في قسمك';
            const mgrContent = `الموظف (${empName}) في قسمك تم تسجيل ${isLate ? 'تأخير' : 'خروج مبكر'} بـ (${minutesVal} دقيقة) له لتاريخ ${dateStr}، وتم تقييد (${penaltyLabel}) تلقائياً.`;
            await supabase.from('system_notifications').insert({
              recipient_id: dept.manager_id,
              type: 'system',
              title: mgrTitle,
              content: mgrContent,
              is_read: false,
              metadata: {
                type: 'mandatory_penalty_manager',
                employee_id: employeeId,
                employee_name: empName,
                penalty_type: penaltyType,
                record_date: dateStr,
                minutes: minutesVal,
                is_late: isLate,
                reason: reasonText
              }
            });
            sendPushNotification(dept.manager_id, mgrContent, { title: mgrTitle }).catch(console.warn);
          }
        }
      } catch (err) {
        console.error('Error sending penalty alert:', err);
      }
    };

    // Late Check-in
    if (record.check_in) {
      const checkInDate = new Date(record.check_in);
      const bIn = getBaghdadDate(checkInDate);
      const checkInMinutes = bIn.getHours() * 60 + bIn.getMinutes();

      let expectedStart = new Date(today);
      let morningGracePeriod = 0;
      let startHoursStr = '08:00:00';
      let expectedStartMins = 8 * 60;

      if (isRoster && daySchedule) {
        // ─── Flowchart 2 Roster Leave Shift Exemption ───
        // إذا كان لدى المناوب إجازة اعتيادية/مرضية معتمدة:
        // كل يوم إجازة يُسقط شفت واحد بالترتيب الزمني (الصباحي أولاً ثم المسائي ثم الخفر)
        const approvedDayLeave = allTimeOffs.find(l => 
          ['regular', 'long_regular', 'sick'].includes(l.leave_type) && 
          l.with_request !== false && 
          !l.is_mandatory
        );

        const dayShifts: Array<{ type: 'morning' | 'evening' | 'night'; startHour: number; startMin: number; startStr: string }> = [];
        if (daySchedule.is_morning) dayShifts.push({ type: 'morning', startHour: 8, startMin: 0, startStr: '08:00:00' });
        if (daySchedule.is_evening) dayShifts.push({ type: 'evening', startHour: 14, startMin: 30, startStr: '14:30:00' });
        if (daySchedule.is_night) dayShifts.push({ type: 'night', startHour: 20, startMin: 0, startStr: '20:00:00' });

        if (approvedDayLeave) {
          const canceledCount = approvedDayLeave.days_count || 1;
          if (canceledCount >= dayShifts.length) {
            // جميع شفتات اليوم معفاة بالإجازة المعتمدة وفق Flowchart 2
            return;
          }

          const remainingShifts = dayShifts.slice(canceledCount);
          if (remainingShifts.length === 0) return;

          const nextShift = remainingShifts[0];
          const nextShiftMins = nextShift.startHour * 60 + nextShift.startMin;

          // إذا بصم قبل أو أثناء موعد الشفت المطلوب التالي فلا تأخير إطلاقاً
          if (checkInMinutes <= nextShiftMins) {
            return;
          }

          startHoursStr = nextShift.startStr;
          expectedStart.setHours(nextShift.startHour, nextShift.startMin, 0, 0);
          expectedStartMins = nextShiftMins;
          morningGracePeriod = nextShift.type === 'morning' ? 30 : 0;
        } else {
          if (daySchedule.is_evening && (checkInMinutes >= 800 && checkInMinutes < 1140)) {
            // المسائي: 14:30 - بدون أي سماحية
            startHoursStr = '14:30:00';
            expectedStart.setHours(14, 30, 0, 0);
            expectedStartMins = 14 * 60 + 30;
            morningGracePeriod = 0;
          } else if (daySchedule.is_night && (checkInMinutes >= 1140 || checkInMinutes < 400)) {
            // الخفر: 20:00 - بدون أي سماحية
            startHoursStr = '20:00:00';
            if (checkInMinutes < 400) {
              expectedStart.setDate(expectedStart.getDate() - 1);
            }
            expectedStart.setHours(20, 0, 0, 0);
            expectedStartMins = 20 * 60;
            morningGracePeriod = 0;
          } else {
            // الصباحي: 08:00 - سماحية 30 دقيقة
            startHoursStr = '08:00:00';
            expectedStart.setHours(8, 0, 0, 0);
            expectedStartMins = 8 * 60;
            morningGracePeriod = 30;
          }
        }
      } else {
        const startTimeStr = daySchedule?.start_time || schedule.start_time || '08:00';
        const [sh, sm] = startTimeStr.split(':').map(Number);
        startHoursStr = `${sh.toString().padStart(2, '0')}:${sm.toString().padStart(2, '0')}:00`;
        expectedStart.setHours(sh, sm, 0, 0);
        expectedStartMins = sh * 60 + sm;
        morningGracePeriod = schedule.grace_period_minutes ?? 30; // سماحية الصباحي 30 دقيقة
      }

      // Offset by requested shift_start time off
      if (requestedShiftStart && requestedShiftStart.time_duration_minutes) {
        expectedStart.setMinutes(expectedStart.getMinutes() + requestedShiftStart.time_duration_minutes);
        expectedStartMins += requestedShiftStart.time_duration_minutes;
      }

      const rawDelayMins = (isRoster && daySchedule?.is_night && checkInMinutes < 400)
        ? (checkInMinutes + 1440) - expectedStartMins
        : (checkInMinutes - expectedStartMins);
      const delayMins = rawDelayMins - morningGracePeriod;

      if (delayMins >= 5) {
        if (record.id && record.status !== 'late') {
          await supabase.from('attendance_records').update({ status: 'late' }).eq('id', record.id);
          record.status = 'late';
        }
        let penaltyMins = 0;
        let isFullDay = false;

        if (delayMins <= 30) penaltyMins = 30; // تأخير 5-30 دقيقة = نصف ساعة
        else if (delayMins <= 60) penaltyMins = 60; // تأخير 31-60 دقيقة = ساعة
        else isFullDay = true; // أكثر من 60 دقيقة (ولغاية 120 دقيقة وما بعدها) = إجازة يوم كامل

        const currentTotal = calculateTotalTimeOff(lateLeave?.id);
        if (!isFullDay && (currentTotal + penaltyMins > 120)) {
          isFullDay = true;
        }

        if (isFullDay) {
          if (!lateLeave || lateLeave.leave_type !== 'regular') {
            if (lateLeave) await supabase.from('leave_requests').delete().eq('id', lateLeave.id);

            await supabase.from('leave_requests')
              .update({ status: 'rejected', reason: 'ألغيت بسبب تحويل اليوم لإجازة اعتيادية لتأخير' })
              .eq('user_id', employeeId)
              .eq('start_date', dateStr)
              .eq('leave_type', 'time_off');

            await supabase.from('leave_requests').insert({
              user_id: employeeId,
              leave_type: 'regular',
              start_date: dateStr,
              end_date: dateStr,
              days_count: 1,
              reason: `تأخير (${delayMins} دقيقة) - إجازة اعتيادية إجبارية`,
              status: 'approved',
              is_mandatory: true,
              with_request: false
            });

            await sendPenaltyAlert(
              'regular_day',
              `تأخير (${delayMins} دقيقة) - إجازة اعتيادية إجبارية`,
              true,
              delayMins
            );
          }
        } else {
          // حساب وقت البداية والنهاية للزمنية الإجبارية
          const penaltyEnd = new Date(expectedStart);
          penaltyEnd.setMinutes(penaltyEnd.getMinutes() + penaltyMins);
          const endHoursStr = `${penaltyEnd.getHours().toString().padStart(2, '0')}:${penaltyEnd.getMinutes().toString().padStart(2, '0')}:00`;

          if (!lateLeave) {
            await supabase.from('leave_requests').insert({
              user_id: employeeId,
              leave_type: 'time_off',
              start_date: dateStr,
              end_date: dateStr,
              leave_start_time: startHoursStr,
              leave_end_time: endHoursStr,
              time_duration_minutes: penaltyMins,
              reason: `تأخير (${delayMins} دقيقة) - إجازة زمنية إجبارية (${penaltyMins === 30 ? 'نصف ساعة' : 'ساعة كاملة'})`,
              status: 'approved',
              is_mandatory: true,
              time_off_subtype: 'shift_start',
              with_request: false
            });

            await sendPenaltyAlert(
              penaltyMins === 30 ? 'time_off_30' : 'time_off_60',
              `تأخير (${delayMins} دقيقة) - إجازة زمنية إجبارية (${penaltyMins} دقيقة)`,
              true,
              delayMins
            );
          } else if (lateLeave.leave_type === 'time_off' && lateLeave.time_duration_minutes !== penaltyMins) {
            await supabase.from('leave_requests').update({
              time_duration_minutes: penaltyMins,
              leave_start_time: startHoursStr,
              leave_end_time: endHoursStr,
              reason: `تأخير (${delayMins} دقيقة) - إجازة زمنية إجبارية (${penaltyMins === 30 ? 'نصف ساعة' : 'ساعة كاملة'})`,
              time_off_subtype: 'shift_start',
              with_request: false
            }).eq('id', lateLeave.id);

            await sendPenaltyAlert(
              penaltyMins === 30 ? 'time_off_30' : 'time_off_60',
              `تأخير (${delayMins} دقيقة) - إجازة زمنية إجبارية (${penaltyMins} دقيقة)`,
              true,
              delayMins
            );
          }
        }
      } else {
        if (lateLeave) await supabase.from('leave_requests').delete().eq('id', lateLeave.id);
        if (record.id && record.status === 'late') {
          await supabase.from('attendance_records').update({ status: 'present' }).eq('id', record.id);
          record.status = 'present';
        }
      }
    }

    // Early Check-out
    if (record.check_out) {
      const checkOutDate = new Date(record.check_out);
      const bOut = getBaghdadDate(checkOutDate);
      const checkOutMinutes = bOut.getHours() * 60 + bOut.getMinutes();

      let expectedEnd = new Date(today);
      let eveningGracePeriod = 0;
      let endHoursStr = '15:00:00';
      let expectedEndMins = 15 * 60;

      if (isRoster && daySchedule) {
        if (daySchedule.is_night) {
          // الخفر ينتهي 08:00 ص من اليوم التالي - بدون سماحية
          endHoursStr = '08:00:00';
          expectedEnd = new Date(today);
          expectedEnd.setDate(expectedEnd.getDate() + 1);
          expectedEnd.setHours(8, 0, 0, 0);
          expectedEndMins = 8 * 60;
          eveningGracePeriod = 0;
        } else if (daySchedule.is_evening) {
          // المسائي ينتهي 20:00 - بدون سماحية
          endHoursStr = '20:00:00';
          expectedEnd.setHours(20, 0, 0, 0);
          expectedEndMins = 20 * 60;
          eveningGracePeriod = 0;
        } else {
          endHoursStr = '15:00:00';
          expectedEnd.setHours(15, 0, 0, 0);
          expectedEndMins = 15 * 60;
          eveningGracePeriod = requestedShiftEnd ? 0 : (schedule.grace_period_minutes || 0);
        }
      } else {
        const endTimeStr = daySchedule?.end_time || schedule.end_time || '15:00';
        const [eh, em] = endTimeStr.split(':').map(Number);
        endHoursStr = `${eh.toString().padStart(2, '0')}:${em.toString().padStart(2, '0')}:00`;
        expectedEnd.setHours(eh, em, 0, 0);
        expectedEndMins = eh * 60 + em;
        eveningGracePeriod = requestedShiftEnd ? 0 : (schedule.grace_period_minutes || 0);
      }

      // Offset by requested shift_end time off
      if (requestedShiftEnd && requestedShiftEnd.time_duration_minutes) {
        expectedEnd.setMinutes(expectedEnd.getMinutes() - requestedShiftEnd.time_duration_minutes);
        expectedEndMins -= requestedShiftEnd.time_duration_minutes;
      }

      const rawEarlyMins = (isRoster && daySchedule?.is_night)
        ? Math.floor((expectedEnd.getTime() - checkOutDate.getTime()) / 60000)
        : (expectedEndMins - checkOutMinutes);
      const earlyMins = rawEarlyMins - eveningGracePeriod;

      if (earlyMins >= 5) {
        let penaltyMins = 0;
        let isFullDay = false;

        if (earlyMins <= 30) penaltyMins = 30; // خروج مبكر 5-30 دقيقة = نصف ساعة
        else if (earlyMins <= 60) penaltyMins = 60; // خروج مبكر 31-60 دقيقة = ساعة
        else isFullDay = true; // أكثر من 60 دقيقة = إجازة يوم كامل

        const currentTotal = calculateTotalTimeOff(earlyLeave?.id);
        if (!isFullDay && (currentTotal + penaltyMins > 120)) {
          isFullDay = true;
        }

        if (isFullDay) {
          if (!earlyLeave || earlyLeave.leave_type !== 'regular') {
            if (earlyLeave) await supabase.from('leave_requests').delete().eq('id', earlyLeave.id);

            await supabase.from('leave_requests')
              .update({ status: 'rejected', reason: 'ألغيت بسبب تحويل اليوم لإجازة اعتيادية لخروج مبكر' })
              .eq('user_id', employeeId)
              .eq('start_date', dateStr)
              .eq('leave_type', 'time_off');

            await supabase.from('leave_requests').insert({
              user_id: employeeId,
              leave_type: 'regular',
              start_date: dateStr,
              end_date: dateStr,
              days_count: 1,
              reason: `خروج مبكر (${earlyMins} دقيقة) - إجازة اعتيادية إجبارية`,
              status: 'approved',
              is_mandatory: true,
              with_request: false
            });

            await sendPenaltyAlert(
              'regular_day',
              `خروج مبكر (${earlyMins} دقيقة) - إجازة اعتيادية إجبارية`,
              false,
              earlyMins
            );
          }
        } else {
          // حساب وقت البداية والنهاية للزمنية الإجبارية (بالسالب قبل نهاية الشفت)
          const penaltyStart = new Date(expectedEnd);
          penaltyStart.setMinutes(penaltyStart.getMinutes() - penaltyMins);
          const startHoursStr = `${penaltyStart.getHours().toString().padStart(2, '0')}:${penaltyStart.getMinutes().toString().padStart(2, '0')}:00`;

          if (!earlyLeave) {
            await supabase.from('leave_requests').insert({
              user_id: employeeId,
              leave_type: 'time_off',
              start_date: dateStr,
              end_date: dateStr,
              leave_start_time: startHoursStr,
              leave_end_time: endHoursStr,
              time_duration_minutes: penaltyMins,
              reason: `خروج مبكر (${earlyMins} دقيقة) - إجازة زمنية إجبارية (${penaltyMins === 30 ? 'نصف ساعة' : 'ساعة كاملة'})`,
              status: 'approved',
              is_mandatory: true,
              time_off_subtype: 'shift_end',
              with_request: false
            });

            await sendPenaltyAlert(
              penaltyMins === 30 ? 'time_off_30' : 'time_off_60',
              `خروج مبكر (${earlyMins} دقيقة) - إجازة زمنية إجبارية (${penaltyMins} دقيقة)`,
              false,
              earlyMins
            );
          } else if (earlyLeave.leave_type === 'time_off' && earlyLeave.time_duration_minutes !== penaltyMins) {
            await supabase.from('leave_requests').update({
              time_duration_minutes: penaltyMins,
              leave_start_time: startHoursStr,
              leave_end_time: endHoursStr,
              reason: `خروج مبكر (${earlyMins} دقيقة) - إجازة زمنية إجبارية (${penaltyMins === 30 ? 'نصف ساعة' : 'ساعة كاملة'})`,
              time_off_subtype: 'shift_end',
              with_request: false
            }).eq('id', earlyLeave.id);

            await sendPenaltyAlert(
              penaltyMins === 30 ? 'time_off_30' : 'time_off_60',
              `خروج مبكر (${earlyMins} دقيقة) - إجازة زمنية إجبارية (${penaltyMins} دقيقة)`,
              false,
              earlyMins
            );
          }
        }
      } else {
        if (earlyLeave) await supabase.from('leave_requests').delete().eq('id', earlyLeave.id);
      }
    } else {
      if (earlyLeave) await supabase.from('leave_requests').delete().eq('id', earlyLeave.id);
    }
  },

  async checkIn(employeeId: string, location?: string, deviceId?: string, verifiedByBiometric: boolean = false, snapshotUrl?: string, notes?: string) {
    await syncServerTime();
    const now = getServerNow().toISOString();
    
    // Get department, device info, and work schedule from employee profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('department_id, primary_device_id, work_schedule_id, full_name')
      .eq('id', employeeId)
      .single();

    let isDevicePending = false;
    const isAuthorized = await verifyAndAuthorizeDevice(employeeId, deviceId, profile);
    if (!isAuthorized) {
      isDevicePending = true;
      await notifySupervisorsOfDeviceMismatch(employeeId, profile?.primary_device_id || 'unknown', deviceId);
    } else {
      isDevicePending = false;
    }

    // --- Calculate Lateness Based on Work Schedule ---
    let initialStatus = 'present';
    
    // Fetch schedule if assigned, otherwise use default
    let scheduleQuery = supabase.from('work_schedules').select('*, days:work_schedule_days(*)');
    if (profile?.work_schedule_id) {
      scheduleQuery = scheduleQuery.eq('id', profile.work_schedule_id);
    } else {
      scheduleQuery = scheduleQuery.eq('is_default', true);
    }
    
    const { data: scheduleData } = await scheduleQuery.limit(1).single();
    
    if (scheduleData) {
      const today = getServerNow();
      if (scheduleData.type === 'roster') {
        const bDate = getBaghdadDate(today);
        const dayOfWeek = bDate.getDay();
        const daySchedule = scheduleData.days?.find((d: any) => d.day_of_week === dayOfWeek);
        if (daySchedule && !daySchedule.is_rest_day) {
          const currentMins = bDate.getHours() * 60 + bDate.getMinutes();
          // المسائي يبدأ 14:30، الخفر 20:00، الصباحي 08:00
          if (daySchedule.is_evening && currentMins >= 870 && currentMins < 1200) {
            if (currentMins > 870) initialStatus = 'late';
          } else if (daySchedule.is_night && (currentMins >= 1200 || currentMins < 480)) {
            if (currentMins > 1200) initialStatus = 'late';
          } else if (daySchedule.is_morning && currentMins >= 480 && currentMins < 870) {
            if (currentMins > 510) initialStatus = 'late'; // 30m grace
          }
        }
      } else {
        const bDate = getBaghdadDate(today);
        const dayOfWeek = bDate.getDay();
        const daySchedule = scheduleData.days?.find((d: any) => d.day_of_week === dayOfWeek);
        const isRestDay = daySchedule ? daySchedule.is_rest_day : (dayOfWeek === 5 || dayOfWeek === 6);
        
        if (!isRestDay) {
          const startTimeStr = daySchedule?.start_time || scheduleData.start_time || '08:00';
          const [hours, minutes] = startTimeStr.split(':').map(Number);
          const currentMins = bDate.getHours() * 60 + bDate.getMinutes();
          const startMins = hours * 60 + minutes;
          const graceMins = scheduleData.grace_period_minutes ?? 30;
          
          if (currentMins > startMins + graceMins) {
            initialStatus = 'late';
          }
        }
      }
    }

    const { data, error } = await supabase
      .from('attendance_records')
      .insert({
        employee_id: employeeId,
        department_id: profile?.department_id,
        work_schedule_id: profile?.work_schedule_id,
        check_in: now,
        check_in_location: location,
        check_in_device_id: deviceId,
        check_in_verified_by_biometric: verifiedByBiometric,
        check_in_snapshot_url: snapshotUrl,
        notes: isDevicePending ? (notes ? `${notes} - (تم التسجيل من جهاز غير معتمد)` : '(تم التسجيل من جهاز غير معتمد)') : notes,
        status: initialStatus,
        is_device_pending: isDevicePending
      })
      .select()
      .single();

    if (error) throw error;
    
    const savedRecord = data as AttendanceRecord;
    try {
      const todayStr = getServerLocalDateStr();
      await this.enforceMandatoryPenalties(employeeId, todayStr, savedRecord);
    } catch (e) {
      console.error('Error applying mandatory penalties in checkIn:', e);
    }
    
    return savedRecord;
  },

  async checkOut(employeeId: string, location?: string, deviceId?: string, verifiedByBiometric: boolean = false, snapshotUrl?: string, additionalNotes?: string) {
    await syncServerTime();
    const todayRecord = await this.getTodayByEmployeeId(employeeId);
    if (!todayRecord) {
      throw new Error('لم يتم تسجيل الحضور اليوم');
    }

    // Check device match
    const { data: profile } = await supabase
      .from('profiles')
      .select('primary_device_id, full_name')
      .eq('id', employeeId)
      .single();
    const isAuthorized = await verifyAndAuthorizeDevice(employeeId, deviceId, profile);
    if (!isAuthorized) {
      throw new Error('لا يمكن تسجيل الانصراف من جهاز غير معتمد. لقد تم تسجيل بصمة الحضور، ويجب مراجعة مسؤول البصمة لاعتماد جهازك قبل المتابعة.');
    }
    const isDevicePending = false;

    const now = getServerNow().toISOString();
    
    // We only update is_device_pending to true if it is true now, we don't clear it if it was true in check-in
    const updatedStatus = isDevicePending || todayRecord.is_device_pending;

    const { data, error } = await supabase
      .from('attendance_records')
      .update({
        check_out: now,
        check_out_location: location,
        check_out_device_id: deviceId,
        check_out_verified_by_biometric: verifiedByBiometric,
        check_out_snapshot_url: snapshotUrl,
        notes: isDevicePending 
          ? (additionalNotes ? (todayRecord.notes ? `${todayRecord.notes} | ${additionalNotes} - (تم التسجيل من جهاز غير معتمد)` : `${additionalNotes} - (تم التسجيل من جهاز غير معتمد)`) : (todayRecord.notes ? `${todayRecord.notes} - (تم التسجيل من جهاز غير معتمد)` : '(تم التسجيل من جهاز غير معتمد)'))
          : (additionalNotes ? (todayRecord.notes ? `${todayRecord.notes} | ${additionalNotes}` : additionalNotes) : todayRecord.notes),
        is_device_pending: updatedStatus
      })
      .eq('id', todayRecord.id)
      .select()
      .single();

    if (error) throw error;
    
    const savedRecord = data as AttendanceRecord;
    try {
      const todayStr = now.split('T')[0];
      await this.enforceMandatoryPenalties(employeeId, todayStr, savedRecord);
    } catch (e) {
      console.error('Error applying mandatory penalties in checkOut:', e);
    }
    
    return savedRecord;

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


