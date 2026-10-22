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

async function notifyAdminsForDeviceChange(employeeName: string, employeeGov: string = 'karbala') {
  try {
    await supabase.rpc('notify_admins_new_device', { p_employee_name: employeeName });

    const supervisorIdsSet = new Set<string>();
    try {
      const targetGov = employeeGov || 'karbala';
      const { data: admins } = await supabase
        .from('profiles')
        .select('id')
        .eq('governorate', targetGov)
        .in('admin_role', ['general', 'developer', 'biometric', 'attendance_supervisor']);
      if (admins && Array.isArray(admins)) {
        admins.forEach((p: any) => {
          if (p.id) supervisorIdsSet.add(p.id);
        });
      }
    } catch (e) {
      console.error('Error fetching admins for device change:', e);
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
    const targetGov = empProfile?.governorate || 'karbala';
    const { data: admins } = await supabase.from('profiles')
      .select('id')
      .eq('governorate', targetGov)
      .in('admin_role', ['general', 'developer', 'biometric', 'attendance_supervisor']);
    if (admins) {
      admins.forEach(a => supervisorIdsSet.add(a.id));
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

      const targetGov = employeeGov || 'karbala';
      const query = supabase
        .from('profiles')
        .select('id')
        .in('admin_role', ['general', 'biometric'])
        .eq('governorate', targetGov)
        .neq('id', employeeId);

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
    const result = await this.saveSecure(employeeId, todayRecord.id, {
      time_leave_out: now,
    });

    // مطالبة الموظف البديل بالبصمة فور تثبيت مغادرة الأصيل
    try {
      const todayStr = getServerLocalDateStr();
      const { data: timeOffReq } = await supabase
        .from('leave_requests')
        .select('id, substitute_id, leave_type, time_off_subtype')
        .eq('user_id', employeeId)
        .eq('status', 'approved')
        .eq('start_date', todayStr)
        .not('substitute_id', 'is', null)
        .maybeSingle();

      if (timeOffReq?.substitute_id) {
        const { data: empProf } = await supabase.from('profiles').select('full_name').eq('id', employeeId).maybeSingle();
        const empName = empProf?.full_name || 'الزميل الأصيل';
        await supabase.from('system_notifications').insert({
          recipient_id: timeOffReq.substitute_id,
          sender_id: employeeId,
          type: 'substitute_action_prompt',
          title: '⚠️ مطالبة بالبصمة — بدء تغطية المناوبة كبديل',
          content: `قام الزميل الأصيل (${empName}) بتثبيت بصمة مغادرة لبدء إجازته الزمنية. يرجى تثبيت بصمة حضورك لتغطية مقر المناوبة فوراً.`,
          metadata: { request_id: timeOffReq.id, role: 'substitute', action: 'check_in' },
          created_at: now
        });
      }
    } catch (subErr) {
      console.warn('Error notifying substitute on timeLeaveOut:', subErr);
    }

    return result;
  },

  async timeLeaveReturn(employeeId: string, _location?: string, _deviceId?: string, _verifiedByBiometric: boolean = false) {
    await syncServerTime();
    const todayRecord = await this.getTodayByEmployeeId(employeeId);
    if (!todayRecord) throw new Error('لم يتم تسجيل الحضور اليوم');
    if (!todayRecord.time_leave_out) throw new Error('لم يتم تسجيل خروج زمني مسبقاً');

    const now = getServerNow();

    // Record the return punch via secure RPC
    await this.saveSecure(employeeId, todayRecord.id, {
      time_leave_return: now.toISOString(),
    });

    const savedRecord = { ...todayRecord, time_leave_return: now.toISOString() } as AttendanceRecord;
    try {
      const todayStr = getServerLocalDateStr();
      await this.enforceMandatoryPenalties(employeeId, todayStr, savedRecord);

      // إشعار الموظف البديل بعودة الأصيل ومطالبته ببصمة الانصراف
      const { data: timeOffReq } = await supabase
        .from('leave_requests')
        .select('id, substitute_id')
        .eq('user_id', employeeId)
        .eq('status', 'approved')
        .eq('start_date', todayStr)
        .not('substitute_id', 'is', null)
        .maybeSingle();

      if (timeOffReq?.substitute_id) {
        const { data: empProf } = await supabase.from('profiles').select('full_name').eq('id', employeeId).maybeSingle();
        const empName = empProf?.full_name || 'الزميل الأصيل';
        await supabase.from('system_notifications').insert({
          recipient_id: timeOffReq.substitute_id,
          sender_id: employeeId,
          type: 'substitute_action_prompt',
          title: '✅ عودة الزميل الأصيل — تثبيت بصمة الانصراف',
          content: `عاد الزميل الأصيل (${empName}) وثبّت بصمة عودته من الإجازة الزمنية. يرجى تثبيت بصمة انصرافك لإنهاء فترة التغطية كبديل.`,
          metadata: { request_id: timeOffReq.id, role: 'substitute', action: 'check_out' },
          created_at: now.toISOString()
        });
      }
    } catch (e) {
      console.error('Error in timeLeaveReturn post actions:', e);
    }

    return savedRecord;
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
    const record = await this.getTodayByEmployeeId(employeeId);

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
    let hasConnectedShifts = false;
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
        .select('is_rest_day, is_morning, is_evening, is_night')
        .eq('schedule_id', profile.work_schedule_id)
        .eq('day_of_week', dayOfWeek)
        .maybeSingle();
        
      if (sd && sd.is_rest_day) {
        isRestDay = true;
      }
      if (sd && (workSchedule?.type === 'roster' || (workSchedule?.name || '').includes('مناوب') || (workSchedule?.name || '').includes('خفر'))) {
        const activeShiftsCount = [sd.is_morning, sd.is_evening, sd.is_night].filter(Boolean).length;
        if (activeShiftsCount > 1) {
          hasConnectedShifts = true;
        }
      }
    }

    const shiftType = determineShiftType(profile, workSchedule);

    if (!isRestDay && shiftType !== 'shift') {
        const { isHolidayOrWeekend, dayTypeLabel } = await import('../../../lib/attendanceHelpers').then(m => m.fetchDayType(today));
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

    // 5. إغلاق سجل الأمس المفتوح وفق قاعدة الزوجي/الفردي (flowcharts-attendance-1):
    //    - فردي (داخل الدوام ولم يثبت خروج): بصمة حمراء افتراضية بنهاية الشفت + إشعارات (داخل دالة SQL الآمنة)
    //    - زوجي (خارج المقر ولم يثبت خروج نهائي): آخر بصمة = مغادرة مبكرة → تُحاسب العقوبات بعدها
    //    - استكمال خفر الأمس: خروج الأمس بتوقيت بصمة اليوم (بصمة حقيقية)
    if (yesterdayRecord && !yesterdayRecord.check_out && (yesterdayRealCount > 0 || yesterdayRecord.check_in)) {
      const baghdadHourNow = getBaghdadDate(getServerNow()).getHours();
      const isKhafarFollowup = isFollowUpOvernight && baghdadHourNow <= 12;
      try {
        const { data: coResult } = await supabase.rpc('closeout_prev_day_attendance', {
          p_employee_id: employeeId,
          p_followup: isKhafarFollowup
        });
        const co = coResult as any;
        if (co?.action === 'derived_out' && co.record) {
          await this.enforceMandatoryPenalties(employeeId, yesterdayDateStr, co.record as AttendanceRecord);
        }
      } catch (e) {
        console.warn('closeout_prev_day_attendance failed:', e);
      }
    }

    const nowServer = getServerNow();
    const nowIso = nowServer.toISOString();

    // فحص مهلة الأمان (180 ثانية للمعتاد، و60 ثانية للمناوب بالشفتات المتصلة) بين البصمات لمنع التكرار العرضي
    if (record && Array.isArray(record.raw_punches) && record.raw_punches.length > 0 && !notes?.includes('تجاوز المهلة')) {
      const lastPunchTime = new Date(record.raw_punches[record.raw_punches.length - 1].time).getTime();
      const elapsedSeconds = Math.floor((nowServer.getTime() - lastPunchTime) / 1000);
      const cooldownSeconds = (shiftType === 'shift' && hasConnectedShifts) ? 60 : 180;
      if (elapsedSeconds < cooldownSeconds && !bypassLeaveWarning) {
        const remaining = cooldownSeconds - elapsedSeconds;
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

    // إذا كانت هناك بصمة افتراضية سابقة، والبصمة الجديدة حقيقية:
    // يتم تنظيف البصمة الافتراضية واعتماد البصمة الحقيقية بدلاً منها
    const hasVirtualOut = rawPunches.some(p => p.is_virtual || p.notes?.includes('افتراضي'));
    if (hasVirtualOut) {
      rawPunches = rawPunches.filter(p => !p.is_virtual && !p.notes?.includes('افتراضي'));
      if (record?.notes?.includes('خروج نهائي افتراضي') || record?.check_out_is_virtual) {
        let cleanedNotes = (record?.notes || '')
          .replace(/\|?\s*\(?خروج نهائي افتراضي\)?/g, '')
          .replace(/\|?\s*\(?بصمة خروج افتراضية حمراء[^\)]*\)?/g, '')
          .trim();
        if (cleanedNotes.startsWith('|')) cleanedNotes = cleanedNotes.substring(1).trim();
        if (cleanedNotes.endsWith('|')) cleanedNotes = cleanedNotes.substring(0, cleanedNotes.length - 1).trim();
        if (record) record.notes = cleanedNotes;
      }
      if (record) {
        record.check_out_is_virtual = false;
        record.check_out_virtual_reason = undefined;
      }
    }

    rawPunches.push(newPunch);

    // 9. Run categorizer with shift rules
    const updates = categorizePunches(rawPunches, yesterdayRecord, today, shiftType, false, hasConnectedShifts);
    if (!updates.raw_punches || updates.raw_punches.length === 0) {
      updates.raw_punches = rawPunches;
    }

    // إذا تم استبدال خروج افتراضي ببصمة حقيقية، نضمن إزالة أعلام الافتراضي من التحديثات
    if (hasVirtualOut) {
      updates.check_out_is_virtual = false;
      updates.check_out_virtual_reason = undefined;
    }

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
      // تطبيق العقوبات الإلزامية ومعادلات الحضور والانصراف فورياً على كل بصمة
      await this.enforceMandatoryPenalties(employeeId, today, savedRecord);
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
    if (isRoster) {
      // استدعاء تقييم المناوبة الشامل في قاعدة البيانات بالتوازي دون إيقاف تقييم بصمة الحضور الحالية
      await supabase.rpc('roster_evaluate_me');
    }
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

    // Find requested (not mandatory) shift_start, mid_shift, and shift_end
    const requestedShiftStart = allTimeOffs?.find(r => r.time_off_subtype === 'shift_start' && r.with_request && r.leave_type === 'time_off');
    const requestedMidShift = allTimeOffs?.find(r => r.time_off_subtype === 'mid_shift' && r.with_request && r.leave_type === 'time_off');
    const requestedShiftEnd = allTimeOffs?.find(r => r.time_off_subtype === 'shift_end' && r.with_request && r.leave_type === 'time_off');

    const lateLeave = allTimeOffs?.find(l => (!l.with_request || l.is_mandatory) && (l.time_off_subtype === 'shift_start' || (l.leave_type === 'regular' && l.reason?.includes('تأخير'))));
    const midLeave = allTimeOffs?.find(l => (!l.with_request || l.is_mandatory) && (l.time_off_subtype === 'mid_shift' || (l.leave_type === 'regular' && l.reason?.includes('وسط الدوام'))));
    const earlyLeave = allTimeOffs?.find(l => (!l.with_request || l.is_mandatory) && (l.time_off_subtype === 'shift_end' || (l.leave_type === 'regular' && l.reason?.includes('خروج مبكر'))));
    const fullDayPenalty = allTimeOffs?.find(l => (!l.with_request || l.is_mandatory) && l.leave_type === 'regular' && (l.reason?.includes('إجازة اعتيادية إجبارية') || l.reason?.includes('تجاوز مجموع') || l.reason?.includes('تأخير') || l.reason?.includes('خروج مبكر') || l.reason?.includes('وسط الدوام')));

    // Helper notification for penalties
    const sendPenaltyAlert = async (
      penaltyMins: number | 'day' | 'day_double',
      reasonText: string,
      isLate: boolean,
      minutesVal: number
    ) => {
      try {
        const empName = profile?.full_name || 'موظف';
        const penaltyLabel = penaltyMins === 'day_double'
          ? 'إجازة اعتيادية إجبارية (يومان لشفت الخفر)'
          : penaltyMins === 'day'
            ? 'إجازة اعتيادية إجبارية (يوم كامل)'
            : `إجازة زمنية إجبارية (${penaltyMins >= 60 && penaltyMins % 60 === 0 ? `${penaltyMins / 60} ساعة` : `${penaltyMins} دقيقة`})`;

        const isFullDayPenalty = penaltyMins === 'day' || penaltyMins === 'day_double';
        const daysCountVal = penaltyMins === 'day_double' ? 2 : 1;

        const title = isFullDayPenalty
          ? '⚠️ تنبيه إداري: تأخر تجاوز الساعتين وإجازة إجبارية'
          : (isLate ? '⚠️ تنبيه: تأخير وإجازة إجبارية' : '⚠️ تنبيه: خروج مبكر وإجازة إجبارية');

        const empContent = isFullDayPenalty
          ? `تم تسجيل حضورك متأخراً بـ (${minutesVal} دقيقة) لتاريخ ${dateStr} وهو يتجاوز حد الساعتين. تم تقييد (${penaltyLabel}) أصولياً في النظام، وإشعار مسؤولك المباشر لاعتمادها أو تحويلها لغياب رسمي.`
          : `تم تسجيل ${isLate ? 'تأخير' : 'خروج مبكر'} بـ (${minutesVal} دقيقة) في سجلك لتاريخ ${dateStr}، وتقييد (${penaltyLabel}) أصولياً في النظام.`;

        const supContent = `الموظف (${empName}) تم تسجيل ${isLate ? 'تأخير' : 'خروج مبكر'} بـ (${minutesVal} دقيقة) له لتاريخ ${dateStr}، وتم تقييد (${penaltyLabel}) تلقائياً.`;

        // 1. Notify Employee (إشعار واحد موحد وشامل دون تكرار)
        await supabase.from('system_notifications').insert({
          recipient_id: employeeId,
          type: 'penalty_notice',
          title,
          content: empContent,
          is_read: false,
          metadata: {
            type: isFullDayPenalty ? 'employee_penalty_notice' : 'mandatory_penalty',
            penalty_type: penaltyMins,
            record_date: dateStr,
            minutes: minutesVal,
            days_count: daysCountVal,
            is_late: isLate,
            reason: reasonText
          }
        });
        sendPushNotification(employeeId, empContent, { title }).catch(console.warn);

        // 2. Notify Biometric Supervisors only (not finance)
        const targetGov = profile?.governorate || 'karbala';
        const { data: sups } = await supabase
          .from('profiles')
          .select('id')
          .in('admin_role', ['biometric', 'attendance_supervisor', 'general'])
          .eq('governorate', targetGov)
          .neq('id', employeeId);
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
              penalty_type: penaltyMins,
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
            const isFullDayPenalty = penaltyMins === 'day' || penaltyMins === 'day_double';
            const daysCountVal = penaltyMins === 'day_double' ? 2 : 1;
            const mgrTitle = isFullDayPenalty
              ? `🚨 قرار مطلوب: تأخير يتجاوز الساعتين (${empName})`
              : (isLate ? '⚠️ تنبيه تأخير موظف في قسمك' : '⚠️ تنبيه انصراف مبكر لموظف في قسمك');

            const mgrContent = isFullDayPenalty
              ? `الموظف (${empName}) حضر بتأخر (${minutesVal} دقيقة) لتاريخ ${dateStr} وتجاوز حد الساعتين. تم قيده مبدئياً كإجازة اعتيادية إجبارية (${daysCountVal} يوم). يرجى اعتماد الإجازة أو تحويلها لغياب رسمي بدون راتب.`
              : `الموظف (${empName}) في قسمك تم تسجيل ${isLate ? 'تأخير' : 'خروج مبكر'} بـ (${minutesVal} دقيقة) له لتاريخ ${dateStr}، وتم تقييد (${penaltyLabel}) تلقائياً.`;

            await supabase.from('system_notifications').insert({
              recipient_id: dept.manager_id,
              type: 'system',
              title: mgrTitle,
              content: mgrContent,
              is_read: false,
              metadata: {
                type: isFullDayPenalty ? 'mandatory_penalty_decision' : 'mandatory_penalty_manager',
                employee_id: employeeId,
                employee_name: empName,
                penalty_type: penaltyMins,
                record_date: dateStr,
                minutes: minutesVal,
                is_late: isLate,
                days_count: daysCountVal,
                reason: reasonText,
                requires_decision: isFullDayPenalty
              }
            });
            sendPushNotification(dept.manager_id, mgrContent, { title: mgrTitle }).catch(console.warn);
          }
        }
      } catch (err) {
        console.error('Error sending penalty alert:', err);
      }
    };

    let morningPenalty: number | 'day' | 'day_double' = 0;
    let morningReason = '';
    let morningStartStr = '08:00:00';
    let morningEndStr = '08:30:00';
    let morningDelayMinutes = 0;

    // --- حساب التأخير الصباحي ---
    if (record.check_in) {
      const checkInDate = new Date(record.check_in);
      const bIn = getBaghdadDate(checkInDate);
      const checkInMinutes = bIn.getHours() * 60 + bIn.getMinutes();

      if (isRoster && daySchedule) {
        const formatHM = (mins: number) => {
          const h = Math.floor(mins / 60) % 24;
          const m = mins % 60;
          return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
        };
        const formatHMS = (mins: number) => `${formatHM(mins)}:00`;

        // 1. تحديد شفتات اليوم مع بداياتها وأوزانها الرسمية
        const dayShifts: Array<{ type: 'morning' | 'evening' | 'night'; startMins: number; startStr: string; weight: number }> = [];
        if (daySchedule.is_morning) dayShifts.push({ type: 'morning', startMins: 8 * 60, startStr: '08:00:00', weight: 1 });
        if (daySchedule.is_evening) dayShifts.push({ type: 'evening', startMins: 15 * 60, startStr: '15:00:00', weight: 1 });
        if (daySchedule.is_night) dayShifts.push({ type: 'night', startMins: 20 * 60, startStr: '20:00:00', weight: 2 });

        // فحص إعفاء الشفت عبر إجازة اعتيادية/مرضية معتمدة
        const approvedDayLeave = allTimeOffs.find(l => 
          ['regular', 'long_regular', 'sick'].includes(l.leave_type) && 
          l.with_request !== false && 
          !l.is_mandatory
        );

        let activeShifts = dayShifts;
        if (approvedDayLeave) {
          const canceledCount = approvedDayLeave.days_count || 1;
          activeShifts = dayShifts.slice(canceledCount);
        }

        // 2. تحديد الشفت المستهدف بناءً على وقت الحضور checkInMinutes
        let currentShift: { type: 'morning' | 'evening' | 'night'; startMins: number; startStr: string; weight: number } | null = null;
        if (activeShifts.some(s => s.type === 'night') && (checkInMinutes >= 19 * 60 + 30 || checkInMinutes < 7 * 60)) {
          currentShift = activeShifts.find(s => s.type === 'night') || null;
        } else if (activeShifts.some(s => s.type === 'evening') && checkInMinutes >= 13 * 60 + 30 && checkInMinutes < 19 * 60 + 30) {
          currentShift = activeShifts.find(s => s.type === 'evening') || null;
        } else if (activeShifts.some(s => s.type === 'morning') && checkInMinutes >= 6 * 60 + 30 && checkInMinutes < 13 * 60 + 30) {
          currentShift = activeShifts.find(s => s.type === 'morning') || null;
        } else {
          currentShift = activeShifts[0] || null;
        }

        if (currentShift) {
          // فحص غياب الشفت المسائي المنتهي عند الحضور في شفت الخفر
          if (currentShift.type === 'night' && dayShifts.some(s => s.type === 'evening') && profile?.department_id) {
            try {
              const hasEveningExemption = allTimeOffs.some(l => 
                ['regular', 'long_regular', 'sick'].includes(l.leave_type)
              );
              if (!hasEveningExemption) {
                const { data: dept } = await supabase.from('departments').select('manager_id').eq('id', profile.department_id).single();
                if (dept?.manager_id && dept.manager_id !== employeeId) {
                  const { data: existingEveningNotif } = await supabase
                    .from('system_notifications')
                    .select('id')
                    .eq('recipient_id', dept.manager_id)
                    .eq('metadata->>type', 'shift_absence_resolution')
                    .eq('metadata->>employee_id', employeeId)
                    .eq('metadata->>record_date', dateStr)
                    .eq('metadata->>shift_type', 'evening')
                    .maybeSingle();

                  if (!existingEveningNotif) {
                    await supabase.from('system_notifications').insert({
                      recipient_id: dept.manager_id,
                      type: 'system',
                      title: `🚨 قرار مطلوب: غياب الشفت المسائي (${profile.full_name || 'موظف'})`,
                      content: `الموظف (${profile.full_name || 'موظف'}) لم يسجل حضوراً في الشفت المسائي (15:00 - 20:00) ليوم ${dateStr}. يرجى اتخاذ القرار الإداري لاعتماد الغياب رسمياً بدون راتب أو تحويله إلى إجازة اعتيادية (1 يوم).`,
                      is_read: false,
                      metadata: {
                        type: 'shift_absence_resolution',
                        employee_id: employeeId,
                        employee_name: profile.full_name,
                        record_date: dateStr,
                        shift_type: 'evening',
                        days_count: 1,
                        requires_decision: true
                      }
                    });

                    // إشعار فوري للموظف بالعلم
                    await supabase.from('system_notifications').insert({
                      recipient_id: employeeId,
                      sender_id: employeeId,
                      type: 'system',
                      title: 'تنبيه إداري: عدم حضور الشفت المسائي',
                      content: `للعلم: لم يتم تسجيل حضور لك في الشفت المسائي ليوم (${dateStr}). تم إشعار مسؤولك المباشر لاتخاذ القرار الإداري باعتماده إجازة اعتيادية أو غياباً رسمياً.`,
                      metadata: {
                        type: 'employee_shift_absence_notice',
                        record_date: dateStr,
                        shift_type: 'evening',
                        days_count: 1
                      }
                    });
                  }
                }
              }
            } catch (eveningAbsErr) {
              console.error('Error handling evening absence notification:', eveningAbsErr);
            }
          }

          // 3. البحث عن إجازة بداية الشفت (نوع A) المعتمدة لهذا الشفت بعينه
          const rosterShiftLeave = allTimeOffs.find(l => {
            if (l.leave_type !== 'time_off' || !l.with_request || l.time_off_subtype !== 'shift_start') return false;
            const st = l.leave_start_time || '';
            if (currentShift!.type === 'morning') return st >= '07:00:00' && st < '14:00:00';
            if (currentShift!.type === 'evening') return st >= '14:00:00' && st < '19:30:00';
            if (currentShift!.type === 'night') return st >= '19:30:00' || st < '07:00:00';
            return false;
          });

          if (!rosterShiftLeave) {
            // لا توجد إجازة زمنية معتمدة لهذا الشفت: المحاسبة على التأخير المباشر
            const rawMins = (currentShift.type === 'night' && checkInMinutes < 7 * 60)
              ? (checkInMinutes + 1440) - currentShift.startMins
              : checkInMinutes - currentShift.startMins;

            if (rawMins > 5) {
              if (rawMins <= 120) {
                morningDelayMinutes = rawMins;
                morningPenalty = rawMins;
                morningReason = `تأخير مناوب في شفت ${currentShift.type === 'evening' ? 'المسائي' : currentShift.type === 'night' ? 'الخفر' : 'الصباحي'} (${rawMins} دقيقة)`;
                morningStartStr = currentShift.startStr;
                const endH = Math.floor((currentShift.startMins + rawMins) / 60) % 24;
                const endM = (currentShift.startMins + rawMins) % 60;
                morningEndStr = `${endH.toString().padStart(2, '0')}:${endM.toString().padStart(2, '0')}:00`;
              } else {
                // تجاوز الساعتين: تحويل الشفت لاعتيادية إجبارية بوزنه القانوني (1 للمسائي/الصباحي، 2 للخفر)
                morningPenalty = currentShift.weight === 2 ? 'day_double' : 'day';
                morningReason = `تأخير مناوب تجاوز الساعتين في شفت ${currentShift.type === 'evening' ? 'المسائي' : currentShift.type === 'night' ? 'الخفر' : 'الصباحي'} (${rawMins} دقيقة) - إجازة اعتيادية إجبارية (${currentShift.weight} يوم)`;
              }
            } else {
              morningPenalty = 0;
              morningDelayMinutes = 0;
            }
          } else {
            // يوجد طلب إجازة زمنية بداية شفت (نوع A) معتمد للشفت
            const approvedDuration = rosterShiftLeave.time_duration_minutes || 0;
            const approvedEndMins = currentShift.startMins + approvedDuration;

            // الحالة 1: الحضور في بداية الشفت (ضمن 5 دقائق من بدايته) -> إلغاء وتصفير لحفظ الرصيد
            if (checkInMinutes <= currentShift.startMins + 5) {
              if (approvedDuration > 0) {
                const note = ` [أُلغيت لعدم الاستخدام والحضور في بداية الشفت ${formatHM(checkInMinutes)}]`;
                await supabase.from('leave_requests').update({
                  time_duration_minutes: 0,
                  leave_end_time: rosterShiftLeave.leave_start_time || currentShift.startStr,
                  reason: (rosterShiftLeave.reason || '') + note
                }).eq('id', rosterShiftLeave.id);

                rosterShiftLeave.time_duration_minutes = 0;
                rosterShiftLeave.leave_end_time = rosterShiftLeave.leave_start_time || currentShift.startStr;

                await supabase.from('system_notifications').insert({
                  recipient_id: employeeId,
                  sender_id: employeeId,
                  type: 'system',
                  title: 'إلغاء احتساب الإجازة الزمنية (حضور بداية الشفت)',
                  content: `نظراً لتسجيل حضورك في بداية الشفت (${formatHM(checkInMinutes)})، تم إلغاء احتساب دقائق الإجازة الزمنية (${approvedDuration} دقيقة) حفاظاً على رصيدك.`,
                  metadata: { request_id: rosterShiftLeave.id },
                  created_at: getServerNow().toISOString()
                });
              }
              morningPenalty = 0;
              morningDelayMinutes = 0;
            }
            // الحالة 2: الحضور المبكر قبل انتهاء الإجازة بأكثر من 5 دقائق -> تقليص ذكي لنفس الطلب
            else if (checkInMinutes < approvedEndMins - 5) {
              const actualUsedMins = Math.max(0, checkInMinutes - currentShift.startMins);
              if (actualUsedMins < approvedDuration) {
                const newEndStr = formatHMS(checkInMinutes);
                const note = ` [تم تقليص المدة من ${approvedDuration} إلى ${actualUsedMins} دقيقة للحضور المبكر ${formatHM(checkInMinutes)}]`;
                await supabase.from('leave_requests').update({
                  time_duration_minutes: actualUsedMins,
                  leave_end_time: newEndStr,
                  reason: (rosterShiftLeave.reason || '') + note
                }).eq('id', rosterShiftLeave.id);

                rosterShiftLeave.time_duration_minutes = actualUsedMins;
                rosterShiftLeave.leave_end_time = newEndStr;

                await supabase.from('system_notifications').insert({
                  recipient_id: employeeId,
                  sender_id: employeeId,
                  type: 'system',
                  title: 'تقليص مدة الإجازة الزمنية (حضور مبكر)',
                  content: `تم تقليص مدة إجازتك الزمنية لشفت ${currentShift.type === 'evening' ? 'المسائي' : currentShift.type === 'night' ? 'الخفر' : 'الصباحي'} إلى (${actualUsedMins} دقيقة) بدلاً من (${approvedDuration} دقيقة) لحضورك المبكر وحفظاً لرصيدك.`,
                  metadata: { request_id: rosterShiftLeave.id },
                  created_at: getServerNow().toISOString()
                });
              }
              morningPenalty = 0;
              morningDelayMinutes = 0;
            }
            // الحالة 3: الحضور في الموعد المحدد (ضمن نافذة ±5 دقائق من نهاية الإجازة)
            else if (checkInMinutes <= approvedEndMins + 5) {
              morningPenalty = 0;
              morningDelayMinutes = 0;
            }
            // الحالة 4 و 5: التأخر بعد انتهاء الإجازة وسماحية الـ 5 دقائق
            else {
              const totalAbsenceMins = (currentShift.type === 'night' && checkInMinutes < 7 * 60)
                ? (checkInMinutes + 1440) - currentShift.startMins
                : checkInMinutes - currentShift.startMins;

              // إذا تجاوز الغياب الكلي عن بداية الشفت ساعتين (120 دقيقة)
              if (totalAbsenceMins > 120) {
                morningPenalty = currentShift.weight === 2 ? 'day_double' : 'day';
                morningReason = `تأخير شفت ${currentShift.type === 'evening' ? 'المسائي' : currentShift.type === 'night' ? 'الخفر' : 'الصباحي'} تجاوز الساعتين (${formatHM(checkInMinutes)} - غياب ${totalAbsenceMins} دقيقة) - إجازة اعتيادية إجبارية (${currentShift.weight} يوم)`;

                // تصفير الإجازة الزمنية فوراً منعاً للازدواجية في الخصم
                if (approvedDuration > 0) {
                  const note = ` [أُلغيت واستبدلت بإجازة اعتيادية إجبارية (${currentShift.weight} يوم) لتجاوز الساعتين وحضور ${formatHM(checkInMinutes)}]`;
                  await supabase.from('leave_requests').update({
                    time_duration_minutes: 0,
                    leave_end_time: rosterShiftLeave.leave_start_time || currentShift.startStr,
                    reason: (rosterShiftLeave.reason || '') + note
                  }).eq('id', rosterShiftLeave.id);

                  rosterShiftLeave.time_duration_minutes = 0;
                }
              } else {
                // التأخر الإضافي ضمن الساعتين (<= 120 دقيقة):
                // تطبيق قاعدة التعديل والتمديد لنفس الطلب الأصلي دون فتح أي طلب إضافي!
                const newEndStr = formatHMS(checkInMinutes);
                const note = ` [تم تمديد المدة تلقائياً من ${approvedDuration} إلى ${totalAbsenceMins} دقيقة لتغطية تأخر الحضور حتى ${formatHM(checkInMinutes)}]`;
                await supabase.from('leave_requests').update({
                  time_duration_minutes: totalAbsenceMins,
                  leave_end_time: newEndStr,
                  reason: (rosterShiftLeave.reason || '') + note
                }).eq('id', rosterShiftLeave.id);

                rosterShiftLeave.time_duration_minutes = totalAbsenceMins;
                rosterShiftLeave.leave_end_time = newEndStr;

                await supabase.from('system_notifications').insert({
                  recipient_id: employeeId,
                  sender_id: employeeId,
                  type: 'system',
                  title: 'تمديد الإجازة الزمنية (تأخر في العودة)',
                  content: `تم تمديد مدة إجازتك الزمنية لشفت ${currentShift.type === 'evening' ? 'المسائي' : currentShift.type === 'night' ? 'الخفر' : 'الصباحي'} تلقائياً إلى (${totalAbsenceMins} دقيقة) بدلاً من (${approvedDuration} دقيقة) لتغطية حضورك الساعة (${formatHM(checkInMinutes)}) دون تسجيل عقوبة إضافية.`,
                  metadata: { request_id: rosterShiftLeave.id },
                  created_at: getServerNow().toISOString()
                });

                morningPenalty = 0;
                morningDelayMinutes = 0;
              }
            }
          }
        }
      } else {
        // الدوام الصباحي الثابت (08:00 إلى 15:00)
        const officialStartMins = 8 * 60; // 480 (08:00)
        const officialGraceEndMins = officialStartMins + 30; // 510 (08:30)

        const formatHM = (mins: number) => {
          const h = Math.floor(mins / 60);
          const m = mins % 60;
          return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
        };
        const formatHMS = (mins: number) => `${formatHM(mins)}:00`;

        if (!requestedShiftStart) {
          // الموظف بدون إجازة زمنية مسبقة: المنطق النظامي للدوام الصباحي
          morningDelayMinutes = Math.max(0, checkInMinutes - officialStartMins);

          if (checkInMinutes <= officialGraceEndMins) {
            // سماحية الحضور (08:00 إلى 08:30): حضور نظامي بلا عقوبة
            morningPenalty = 0;
          } else if (checkInMinutes <= officialStartMins + 60) {
            // الشريحة الأولى (08:31 إلى 09:00): زمنية نصف ساعة (30 دقيقة)
            morningPenalty = 30;
            morningReason = `تأخير صباحي (${formatHM(checkInMinutes)}) - إجازة زمنية إجبارية (30 دقيقة)`;
            morningStartStr = formatHMS(officialStartMins);
            morningEndStr = formatHMS(officialStartMins + 30);
          } else if (checkInMinutes <= officialStartMins + 90) {
            // الشريحة الثانية (09:01 إلى 09:30): زمنية ساعة كاملة (60 دقيقة)
            morningPenalty = 60;
            morningReason = `تأخير صباحي (${formatHM(checkInMinutes)}) - إجازة زمنية إجبارية (ساعة كاملة)`;
            morningStartStr = formatHMS(officialStartMins);
            morningEndStr = formatHMS(officialStartMins + 60);
          } else if (checkInMinutes <= officialStartMins + 120) {
            // الشريحة الثالثة (09:31 إلى 10:00): زمنية ساعتان (120 دقيقة)
            morningPenalty = 120;
            morningReason = `تأخير صباحي (${formatHM(checkInMinutes)}) - إجازة زمنية إجبارية (ساعتان كاملتان)`;
            morningStartStr = formatHMS(officialStartMins);
            morningEndStr = formatHMS(officialStartMins + 120);
          } else {
            // الشريحة الرابعة (10:01 فما بعد): إجازة اعتيادية إجبارية يوم كامل
            morningPenalty = 'day';
            morningReason = `تأخير صباحي (${formatHM(checkInMinutes)} - تجاوز 10:00) - إجازة اعتيادية إجبارية (يوم كامل)`;
          }
        } else {
          // الموظف لديه إجازة زمنية بداية دوام معتمدة بطلب (نوع A)
          const approvedDuration = requestedShiftStart.time_duration_minutes || 0;
          // احتساب وقت نهاية الإجازة يبدأ من نهاية وقت السماحية الصباحية (08:30 = 510 دقيقة)
          const approvedEndMins = officialGraceEndMins + approvedDuration;

          // الحالة 1: الحضور في بداية الدوام الطبيعية والسماحية (08:00 إلى 08:30)
          if (checkInMinutes <= officialGraceEndMins) {
            if (approvedDuration > 0) {
              const note = ` [أُلغيت لعدم الاستخدام والحضور في بداية الدوام الطبيعية ${formatHM(checkInMinutes)}]`;
              await supabase.from('leave_requests').update({
                time_duration_minutes: 0,
                leave_end_time: requestedShiftStart.leave_start_time || '08:30:00',
                reason: (requestedShiftStart.reason || '') + note
              }).eq('id', requestedShiftStart.id);

              requestedShiftStart.time_duration_minutes = 0;
              requestedShiftStart.leave_end_time = requestedShiftStart.leave_start_time || '08:30:00';

              // إشعار الموظف بحفظ رصيده
              await supabase.from('system_notifications').insert({
                recipient_id: employeeId,
                sender_id: employeeId,
                type: 'system',
                title: 'إلغاء احتساب الإجازة الزمنية (حضور نظامي)',
                content: `نظراً لتسجيل حضورك في بداية الدوام الطبيعية (${formatHM(checkInMinutes)})، تم إلغاء احتساب دقائق الإجازة الزمنية (${approvedDuration} دقيقة) حفاظاً على رصيدك.`,
                metadata: { request_id: requestedShiftStart.id },
                created_at: getServerNow().toISOString()
              });
            }
            morningPenalty = 0;
            morningDelayMinutes = 0;
          }
          // الحالة 2: الحضور المبكر قبل انتهاء وقت الإجازة المصرح بها (بأكثر من 5 دقائق)
          else if (checkInMinutes < approvedEndMins - 5) {
            const actualUsedMins = Math.max(0, checkInMinutes - officialGraceEndMins);
            if (actualUsedMins < approvedDuration) {
              const newEndStr = formatHMS(checkInMinutes);
              const note = ` [تم تقليص المدة من ${approvedDuration} إلى ${actualUsedMins} دقيقة للحضور المبكر ${formatHM(checkInMinutes)}]`;
              await supabase.from('leave_requests').update({
                time_duration_minutes: actualUsedMins,
                leave_end_time: newEndStr,
                reason: (requestedShiftStart.reason || '') + note
              }).eq('id', requestedShiftStart.id);

              requestedShiftStart.time_duration_minutes = actualUsedMins;
              requestedShiftStart.leave_end_time = newEndStr;

              // إشعار الموظف بالتقليص
              await supabase.from('system_notifications').insert({
                recipient_id: employeeId,
                sender_id: employeeId,
                type: 'system',
                title: 'تقليص مدة الإجازة الزمنية (حضور مبكر)',
                content: `تم تقليص مدة إجازتك الزمنية إلى (${actualUsedMins} دقيقة) بدلاً من (${approvedDuration} دقيقة) لحضورك المبكر الساعة (${formatHM(checkInMinutes)}) وحفظاً لرصيدك.`,
                metadata: { request_id: requestedShiftStart.id },
                created_at: getServerNow().toISOString()
              });
            }
            morningPenalty = 0;
            morningDelayMinutes = 0;
          }
          // الحالة 3: الحضور في الموعد المحدد بدقة (مع سماحية بصمة 5 دقائق قبل و 5 دقائق بعد)
          else if (checkInMinutes <= approvedEndMins + 5) {
            morningPenalty = 0;
            morningDelayMinutes = 0;
          }
          // الحالة 4 و 5: التأخر بعد انتهاء الإجازة المصرح بها وسماحية الـ 5 دقائق
          else {
            const totalAbsenceMins = checkInMinutes - officialGraceEndMins;
            const extraDelayMins = checkInMinutes - approvedEndMins;
            morningDelayMinutes = extraDelayMins;

            // إذا تجاوز الغياب الكلي بعد السماحية ساعتين (120 دقيقة، أي بعد 10:30 صباحاً)
            if (totalAbsenceMins > 120 || checkInMinutes > 10 * 60 + 30) {
              morningPenalty = 'day';
              morningReason = `تأخير صباحي تجاوز الساعتين (${formatHM(checkInMinutes)} - إجمالي غياب بعد السماحية ${totalAbsenceMins} دقيقة) - إجازة اعتيادية إجبارية (يوم كامل)`;
              
              // تصفير الإجازة الزمنية فوراً منعاً للازدواجية
              if (approvedDuration > 0) {
                const note = ` [أُلغيت واستبدلت بإجازة اعتيادية إجبارية لتجاوز الساعتين وحضور ${formatHM(checkInMinutes)}]`;
                await supabase.from('leave_requests').update({
                  time_duration_minutes: 0,
                  leave_end_time: requestedShiftStart.leave_start_time || '08:30:00',
                  reason: (requestedShiftStart.reason || '') + note
                }).eq('id', requestedShiftStart.id);

                requestedShiftStart.time_duration_minutes = 0;
              }
            } else {
              // التأخر الإضافي ضمن الساعتين: تمديد نفس الطلب الأصلي لتغطية التأخر وحفظ السجل نظيفاً دون فتح أي طلب جديد
              const actualUsedMins = Math.max(0, checkInMinutes - officialGraceEndMins);
              const newEndStr = formatHMS(checkInMinutes);
              const note = ` [تم تمديد المدة تلقائياً من ${approvedDuration} إلى ${actualUsedMins} دقيقة لتغطية تأخر الحضور حتى ${formatHM(checkInMinutes)}]`;
              await supabase.from('leave_requests').update({
                time_duration_minutes: actualUsedMins,
                leave_end_time: newEndStr,
                reason: (requestedShiftStart.reason || '') + note
              }).eq('id', requestedShiftStart.id);

              requestedShiftStart.time_duration_minutes = actualUsedMins;
              requestedShiftStart.leave_end_time = newEndStr;

              // إشعار الموظف بتمديد الإجازة الزمنية
              await supabase.from('system_notifications').insert({
                recipient_id: employeeId,
                sender_id: employeeId,
                type: 'system',
                title: 'تمديد الإجازة الزمنية (تأخر في العودة)',
                content: `تم تمديد مدة إجازتك الزمنية تلقائياً إلى (${actualUsedMins} دقيقة) بدلاً من (${approvedDuration} دقيقة) لتغطية حضورك الساعة (${formatHM(checkInMinutes)}) دون تسجيل عقوبة إضافية.`,
                metadata: { request_id: requestedShiftStart.id },
                created_at: getServerNow().toISOString()
              });

              morningPenalty = 0;
              morningDelayMinutes = 0;
            }
          }
        }
      }
    }

    let midShiftPenalty: number | 'day' = 0;
    let midShiftReason = '';
    let midShiftStartStr = '11:00:00';
    let midShiftEndStr = '12:00:00';
    let midShiftDelayMinutes = 0;

    // --- حساب الإجازة الزمنية وسط الدوام (نوع B) ---
    if (requestedMidShift) {
      const approvedDuration = requestedMidShift.time_duration_minutes || 0;
      const [lh, lm] = (requestedMidShift.leave_start_time || '11:00:00').split(':').map(Number);
      const [leh, lem] = (requestedMidShift.leave_end_time || '12:00:00').split(':').map(Number);
      const approvedStartMins = lh * 60 + lm;
      const approvedEndMins = leh * 60 + lem;

      const formatHM = (mins: number) => {
        const h = Math.floor(mins / 60);
        const m = mins % 60;
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
      };
      const formatHMS = (mins: number) => `${formatHM(mins)}:00`;

      // الحالة 1: عدم الخروج إطلاقاً والبقاء في الدوام حتى الانصراف
      if (!record.time_leave_out && !record.time_leave_return && record.check_out) {
        if (approvedDuration > 0) {
          const note = ` [أُلغيت لعدم الاستخدام وعدم تسجيل خروج زمني والبقاء في الدوام]`;
          await supabase.from('leave_requests').update({
            time_duration_minutes: 0,
            leave_end_time: requestedMidShift.leave_start_time,
            reason: (requestedMidShift.reason || '') + note
          }).eq('id', requestedMidShift.id);

          requestedMidShift.time_duration_minutes = 0;

          await supabase.from('system_notifications').insert({
            recipient_id: employeeId,
            sender_id: employeeId,
            type: 'system',
            title: 'إلغاء احتساب الإجازة الزمنية الوسطية',
            content: `نظراً لاستمرارك في الدوام وعدم تسجيل خروج زمني، تم إلغاء احتساب دقائق الإجازة الزمنية (${approvedDuration} دقيقة) حفاظاً على رصيدك.`,
            metadata: { request_id: requestedMidShift.id },
            created_at: getServerNow().toISOString()
          });
        }
        midShiftPenalty = 0;
      }
      // الحالة 2: خرج وبصم خروج وعودة
      else if (record.time_leave_out && record.time_leave_return) {
        const outD = getBaghdadDate(new Date(record.time_leave_out));
        const retD = getBaghdadDate(new Date(record.time_leave_return));
        const outMinutes = outD.getHours() * 60 + outD.getMinutes();
        const returnMinutes = retD.getHours() * 60 + retD.getMinutes();
        const actualSpentMinutes = Math.max(0, Math.floor((retD.getTime() - outD.getTime()) / 60000));

        let effectiveStartMins = approvedStartMins;
        let effectiveEndMins = approvedEndMins;

        // انزياح ذكي لوقت البداية إذا خرج مبكراً بأكثر من 5 دقائق
        if (approvedStartMins - outMinutes > 5) {
          effectiveStartMins = outMinutes;
          effectiveEndMins = effectiveStartMins + approvedDuration;
          await supabase.from('leave_requests').update({
            leave_start_time: formatHMS(effectiveStartMins),
            leave_end_time: formatHMS(effectiveEndMins),
            reason: (requestedMidShift.reason || '') + ` [انزياح ذكي: خرج ${formatHM(outMinutes)}]`
          }).eq('id', requestedMidShift.id);
          requestedMidShift.leave_start_time = formatHMS(effectiveStartMins);
          requestedMidShift.leave_end_time = formatHMS(effectiveEndMins);
        }

        // عودة مبكرة قبل انتهاء وقت الإجازة (بأكثر من 5 دقائق)
        if (returnMinutes < effectiveEndMins - 5) {
          if (actualSpentMinutes < approvedDuration) {
            const newEndStr = formatHMS(returnMinutes);
            const note = ` [تم تقليص المدة من ${approvedDuration} إلى ${actualSpentMinutes} دقيقة للعودة المبكرة ${formatHM(returnMinutes)}]`;
            await supabase.from('leave_requests').update({
              time_duration_minutes: actualSpentMinutes,
              leave_end_time: newEndStr,
              reason: (requestedMidShift.reason || '') + note
            }).eq('id', requestedMidShift.id);

            requestedMidShift.time_duration_minutes = actualSpentMinutes;
            requestedMidShift.leave_end_time = newEndStr;

            await supabase.from('system_notifications').insert({
              recipient_id: employeeId,
              sender_id: employeeId,
              type: 'system',
              title: 'تقليص مدة الإجازة الزمنية الوسطية',
              content: `تم تقليص مدة إجازتك الزمنية إلى (${actualSpentMinutes} دقيقة) لعودتك المبكرة الساعة (${formatHM(returnMinutes)}) وحفظاً لرصيدك.`,
              metadata: { request_id: requestedMidShift.id },
              created_at: getServerNow().toISOString()
            });
          }
          midShiftPenalty = 0;
        }
        // عودة في الموعد (± 5 دقائق)
        else if (returnMinutes <= effectiveEndMins + 5) {
          midShiftPenalty = 0;
        }
        // تأخر في العودة
        else {
          const extraDelayMins = returnMinutes - effectiveEndMins;
          midShiftDelayMinutes = extraDelayMins;

          if (actualSpentMinutes > 120) {
            midShiftPenalty = 'day';
            midShiftReason = `تجاوز الإجازة الزمنية حاجز الساعتين (مدة الغياب: ${actualSpentMinutes} دقيقة) - إجازة اعتيادية إجبارية (يوم كامل)`;

            if (approvedDuration > 0) {
              await supabase.from('leave_requests').update({
                time_duration_minutes: 0,
                leave_end_time: requestedMidShift.leave_start_time,
                reason: (requestedMidShift.reason || '') + ` [أُلغيت واستبدلت بإجازة اعتيادية إجبارية لتجاوز الساعتين]`
              }).eq('id', requestedMidShift.id);
              requestedMidShift.time_duration_minutes = 0;
            }
          } else {
            const remainingCap = Math.max(0, 120 - approvedDuration);
            let penaltyVal = 30;
            if (extraDelayMins > 30) penaltyVal = Math.min(extraDelayMins <= 60 ? 60 : 120, remainingCap);
            midShiftPenalty = penaltyVal;
            midShiftReason = `تأخر في العودة من الإجازة الزمنية (${formatHM(returnMinutes)} بتأخر ${extraDelayMins} دقيقة) - إجازة زمنية إجبارية (${penaltyVal} دقيقة)`;
            midShiftStartStr = formatHMS(effectiveEndMins);
            midShiftEndStr = formatHMS(effectiveEndMins + penaltyVal);
          }
        }
      }
      // الحالة 3: خروج زمني دون عودة طوال اليوم
      else if (record.time_leave_out && !record.time_leave_return && (record.check_out || record.notes?.includes('خروج نهائي افتراضي'))) {
        midShiftPenalty = 'day';
        midShiftReason = `خروج زمني دون إثبات بصمة عودة - تحويل إلى إجازة اعتيادية إجبارية (يوم كامل)`;
        if (approvedDuration > 0) {
          await supabase.from('leave_requests').update({
            time_duration_minutes: 0,
            leave_end_time: requestedMidShift.leave_start_time,
            reason: (requestedMidShift.reason || '') + ` [أُلغيت واستبدلت بإجازة اعتيادية إجبارية لعدم إثبات بصمة العودة]`
          }).eq('id', requestedMidShift.id);
          requestedMidShift.time_duration_minutes = 0;
        }
      }
    }

    let eveningPenalty: number | 'day' = 0;
    let eveningReason = '';
    let eveningStartStr = '14:30:00';
    let eveningEndStr = '15:00:00';
    let eveningEarlyMinutes = 0;

    // إذا كان الموظف لديه طلب shift_end معتمد وسجل time_leave_out بدلاً من check_out:
    if (!record.check_out && record.time_leave_out && requestedShiftEnd) {
      record.check_out = record.time_leave_out;
    }

    // --- حساب الانصراف المبكر والساعات الإضافية ---
    if (record.check_out && !record.check_out_is_virtual && !record.notes?.includes('خروج نهائي افتراضي')) {
      const checkOutDate = new Date(record.check_out);
      const bOut = getBaghdadDate(checkOutDate);
      const checkOutMinutes = bOut.getHours() * 60 + bOut.getMinutes();

      const formatHM = (mins: number) => {
        const h = Math.floor(mins / 60);
        const m = mins % 60;
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
      };
      const formatHMS = (mins: number) => `${formatHM(mins)}:00`;

      if (isRoster && daySchedule) {
        let expectedEndMins = 15 * 60;
        if (daySchedule.is_night) {
          expectedEndMins = 8 * 60;
        } else if (daySchedule.is_evening) {
          expectedEndMins = 20 * 60;
        }
        const diffEarly = (daySchedule.is_night && checkOutMinutes > 8 * 60)
          ? 0
          : (expectedEndMins - checkOutMinutes);
        if (diffEarly > 5) {
          eveningEarlyMinutes = diffEarly;
          eveningPenalty = diffEarly;
          eveningReason = `خروج مبكر لمناوب (${diffEarly} دقيقة)`;
          eveningStartStr = formatHMS(Math.max(0, expectedEndMins - diffEarly));
          eveningEndStr = formatHMS(expectedEndMins);
        }
      } else {
        // الدوام الصباحي الثابت (08:00 إلى 15:00)
        const officialShiftEndMins = 15 * 60; // 900 (15:00)
        const allowedDepartureStartMins = 14 * 60 + 30; // 870 (14:30)

        if (!requestedShiftEnd) {
          // الموظف بدون إجازة زمنية نهاية دوام
          if (checkOutMinutes >= allowedDepartureStartMins) {
            // انصراف نظامي (14:30 إلى 15:00 أو بعدها)
            eveningPenalty = 0;

            // فحص الساعات الإضافية (بعد 15:00):
            if (checkOutMinutes > officialShiftEndMins) {
              const overtimeMins = checkOutMinutes - officialShiftEndMins;
              const otHours = (overtimeMins / 60).toFixed(1).replace('.0', '');
              const otNote = `(هناك ساعات إضافية = ${otHours} ساعة)`;
              if (!record.notes?.includes('ساعات إضافية')) {
                const updatedNotes = record.notes ? `${record.notes} | ${otNote}` : otNote;
                await supabase.from('attendance_records').update({ notes: updatedNotes }).eq('id', record.id);
                record.notes = updatedNotes;

                // إشعار مسؤول البصمة
                const empName = profile?.full_name || 'موظف';
                const supMsg = `الموظف (${empName}) سجل بصمة انصراف بعد نهاية الدوام (${otNote}) لتاريخ ${dateStr}. البصمة باللون الأحمر بانتظار المراجعة والقرار.`;
                const targetGov = profile?.governorate || 'karbala';
                const { data: sups } = await supabase
                  .from('profiles')
                  .select('id')
                  .in('admin_role', ['biometric', 'attendance_supervisor', 'general'])
                  .eq('governorate', targetGov)
                  .neq('id', employeeId);
                if (sups && sups.length > 0) {
                  const rows = sups.map(s => ({
                    recipient_id: s.id,
                    type: 'biometric_alert',
                    title: '⏱️ تسجيل ساعات إضافية بعد نهاية الدوام',
                    content: supMsg,
                    is_read: false,
                    metadata: { type: 'overtime_alert', employee_id: employeeId, record_date: dateStr, overtime_minutes: overtimeMins }
                  }));
                  await supabase.from('system_notifications').insert(rows);
                }
              }
            }
          } else {
            // خروج مبكر قبل 14:30
            eveningEarlyMinutes = allowedDepartureStartMins - checkOutMinutes;

            if (checkOutMinutes >= allowedDepartureStartMins - 30) {
              // الشريحة الأولى (14:00 إلى 14:29): زمنية نصف ساعة (30 دقيقة)
              eveningPenalty = 30;
              eveningReason = `خروج مبكر (${formatHM(checkOutMinutes)}) - إجازة زمنية إجبارية (30 دقيقة)`;
              eveningStartStr = formatHMS(allowedDepartureStartMins - 30);
              eveningEndStr = formatHMS(allowedDepartureStartMins);
            } else if (checkOutMinutes >= allowedDepartureStartMins - 60) {
              // الشريحة الثانية (13:30 إلى 13:59): زمنية ساعة كاملة (60 دقيقة)
              eveningPenalty = 60;
              eveningReason = `خروج مبكر (${formatHM(checkOutMinutes)}) - إجازة زمنية إجبارية (ساعة كاملة)`;
              eveningStartStr = formatHMS(allowedDepartureStartMins - 60);
              eveningEndStr = formatHMS(allowedDepartureStartMins);
            } else if (checkOutMinutes >= allowedDepartureStartMins - 90) {
              // الشريحة الثالثة (13:00 إلى 13:29): زمنية ساعتان (120 دقيقة)
              eveningPenalty = 120;
              eveningReason = `خروج مبكر (${formatHM(checkOutMinutes)}) - إجازة زمنية إجبارية (ساعتان كاملتان)`;
              eveningStartStr = formatHMS(allowedDepartureStartMins - 120);
              eveningEndStr = formatHMS(allowedDepartureStartMins);
            } else {
              // الشريحة الرابعة (قبل 13:00 - أي 12:59 وما قبل): إجازة اعتيادية إجبارية يوم كامل
              eveningPenalty = 'day';
              eveningReason = `خروج مبكر (${formatHM(checkOutMinutes)} - قبل 13:00) - إجازة اعتيادية إجبارية (يوم كامل)`;
            }
          }
        } else {
          // الموظف لديه إجازة زمنية نهاية دوام معتمدة بطلب (نوع C)
          const approvedDuration = requestedShiftEnd.time_duration_minutes || 0;
          // موعد الخروج المصرح به يبدأ بالسالب من وقت بداية سماحية الانصراف (14:30 = 870 دقيقة)
          const approvedExitMins = allowedDepartureStartMins - approvedDuration;

          // الحالة 1: البقاء في الدوام حتى وقت الانصراف الطبيعي (14:30 فما بعد)
          if (checkOutMinutes >= allowedDepartureStartMins - 5) {
            if (approvedDuration > 0) {
              const note = ` [أُلغيت لعدم الاستخدام والبقاء في الدوام حتى وقت الانصراف الطبيعي ${formatHM(checkOutMinutes)}]`;
              await supabase.from('leave_requests').update({
                time_duration_minutes: 0,
                leave_start_time: '14:30:00',
                reason: (requestedShiftEnd.reason || '') + note
              }).eq('id', requestedShiftEnd.id);

              requestedShiftEnd.time_duration_minutes = 0;
              requestedShiftEnd.leave_start_time = '14:30:00';

              // إشعار الموظف بحفظ رصيده
              await supabase.from('system_notifications').insert({
                recipient_id: employeeId,
                sender_id: employeeId,
                type: 'system',
                title: 'إلغاء احتساب إجازة نهاية الدوام (دوام كامل)',
                content: `نظراً لاستمرارك في الدوام حتى وقت الانصراف الطبيعي (${formatHM(checkOutMinutes)})، تم إلغاء احتساب دقائق الإجازة الزمنية (${approvedDuration} دقيقة) حفاظاً على رصيدك.`,
                metadata: { request_id: requestedShiftEnd.id },
                created_at: getServerNow().toISOString()
              });
            }
            eveningPenalty = 0;
            eveningEarlyMinutes = 0;

            // فحص الساعات الإضافية إذا بقي بعد 15:00
            if (checkOutMinutes > officialShiftEndMins) {
              const overtimeMins = checkOutMinutes - officialShiftEndMins;
              const otHours = (overtimeMins / 60).toFixed(1).replace('.0', '');
              const otNote = `(هناك ساعات إضافية = ${otHours} ساعة)`;
              if (!record.notes?.includes('ساعات إضافية')) {
                const updatedNotes = record.notes ? `${record.notes} | ${otNote}` : otNote;
                await supabase.from('attendance_records').update({ notes: updatedNotes }).eq('id', record.id);
                record.notes = updatedNotes;
              }
            }
          }
          // الحالة 2: الخروج المتأخر عن بداية الإجازة (التقليص الذكي وحفظ الرصيد)
          // مثلاً: مصرح له 12:30 وخرج 13:45 (بقي يعمل بعد بداية إجازته بأكثر من 5 دقائق)
          else if (checkOutMinutes > approvedExitMins + 5) {
            const actualUsedMins = allowedDepartureStartMins - checkOutMinutes;
            if (actualUsedMins < approvedDuration) {
              const newStartStr = formatHMS(checkOutMinutes);
              const note = ` [تم تقليص المدة من ${approvedDuration} إلى ${actualUsedMins} دقيقة للاستمرار بالعمل حتى ${formatHM(checkOutMinutes)}]`;
              await supabase.from('leave_requests').update({
                time_duration_minutes: actualUsedMins,
                leave_start_time: newStartStr,
                reason: (requestedShiftEnd.reason || '') + note
              }).eq('id', requestedShiftEnd.id);

              requestedShiftEnd.time_duration_minutes = actualUsedMins;
              requestedShiftEnd.leave_start_time = newStartStr;

              await supabase.from('system_notifications').insert({
                recipient_id: employeeId,
                sender_id: employeeId,
                type: 'system',
                title: 'تقليص مدة إجازة نهاية الدوام',
                content: `تم تقليص مدة إجازتك الزمنية إلى (${actualUsedMins} دقيقة) بدلاً من (${approvedDuration} دقيقة) لاستمرارك بالعمل حتى الساعة (${formatHM(checkOutMinutes)}) وحفظاً لرصيدك.`,
                metadata: { request_id: requestedShiftEnd.id },
                created_at: getServerNow().toISOString()
              });
            }
            eveningPenalty = 0;
            eveningEarlyMinutes = 0;
          }
          // الحالة 3: الخروج في نافذة الموعد المصرح به بدقة (مع سماحية بصمة 5 دقائق قبل و 5 دقائق بعد)
          else if (checkOutMinutes >= approvedExitMins - 5) {
            eveningPenalty = 0;
            eveningEarlyMinutes = 0;
          }
          // الحالة 4: الخروج المبكر قبل موعد الإجازة المصرح بها (قبل approvedExitMins - 5)
          else {
            const totalEarlyFromAllowed = allowedDepartureStartMins - checkOutMinutes;
            const extraEarlyMins = approvedExitMins - checkOutMinutes;
            eveningEarlyMinutes = extraEarlyMins;

            // إذا تجاوز الغياب الكلي ساعتين عن وقت الانصراف 14:30 (أي خرج قبل 12:30)
            if (totalEarlyFromAllowed > 120 || checkOutMinutes < 12 * 60 + 30) {
              eveningPenalty = 'day';
              eveningReason = `خروج مبكر تجاوز الساعتين (${formatHM(checkOutMinutes)} - إجمالي غياب عن الانصراف ${totalEarlyFromAllowed} دقيقة) - إجازة اعتيادية إجبارية (يوم كامل)`;

              // تصفير الإجازة الزمنية فوراً منعاً للازدواجية
              if (approvedDuration > 0) {
                const note = ` [أُلغيت واستبدلت بإجازة اعتيادية إجبارية لتجاوز الساعتين وخروج ${formatHM(checkOutMinutes)}]`;
                await supabase.from('leave_requests').update({
                  time_duration_minutes: 0,
                  reason: (requestedShiftEnd.reason || '') + note
                }).eq('id', requestedShiftEnd.id);

                requestedShiftEnd.time_duration_minutes = 0;
              }
            } else {
              // الخروج المبكر الإضافي ضمن الساعتين
              const remainingCap = Math.max(0, 120 - approvedDuration);
              let penaltyVal = 30;
              if (extraEarlyMins > 30) {
                penaltyVal = Math.min(extraEarlyMins <= 60 ? 60 : 120, remainingCap);
              }
              eveningPenalty = penaltyVal;
              eveningReason = `خروج مبكر قبل موعد الإجازة الزمنية (${formatHM(checkOutMinutes)} بتبكير ${extraEarlyMins} دقيقة) - إجازة زمنية إجبارية (${penaltyVal} دقيقة)`;
              eveningStartStr = formatHMS(approvedExitMins - penaltyVal);
              eveningEndStr = formatHMS(approvedExitMins);
            }
          }
        }
      }
    }

    // --- دمج العقوبات وقاعدة المجموع التراكمي لليوم ---
    const isMorningLate = (typeof morningPenalty === 'number' && morningPenalty > 0) || morningPenalty === 'day' || morningPenalty === 'day_double';
    if (record.id) {
      if (isMorningLate && record.status !== 'late') {
        await supabase.from('attendance_records').update({ status: 'late' }).eq('id', record.id);
        record.status = 'late';
      } else if (!isMorningLate && record.status === 'late') {
        await supabase.from('attendance_records').update({ status: 'present' }).eq('id', record.id);
        record.status = 'present';
      }
    }

    const totalPenalties = (typeof morningPenalty === 'number' ? morningPenalty : 0) +
      (typeof eveningPenalty === 'number' ? eveningPenalty : 0) +
      (typeof midShiftPenalty === 'number' ? midShiftPenalty : 0);

    const isFullDay = (morningPenalty === 'day') || (morningPenalty === 'day_double') || (eveningPenalty === 'day') || (midShiftPenalty === 'day') || (totalPenalties > 120);

    if (isFullDay) {
      // تحويل اليوم بالكامل إلى إجازة اعتيادية إجبارية
      if (lateLeave && lateLeave.leave_type === 'time_off') {
        await supabase.from('leave_requests').delete().eq('id', lateLeave.id);
      }
      if (earlyLeave && earlyLeave.leave_type === 'time_off') {
        await supabase.from('leave_requests').delete().eq('id', earlyLeave.id);
      }
      if (midLeave && midLeave.leave_type === 'time_off') {
        await supabase.from('leave_requests').delete().eq('id', midLeave.id);
      }
      // حماية هندسية من الخصم المزدوج: تصفير وإلغاء أي إجازة زمنية مطلوبة لنفس اليوم لتحول اليوم إلى اعتيادية إجبارية
      if (requestedShiftStart && requestedShiftStart.id) {
        await supabase.from('leave_requests').update({
          status: 'canceled',
          time_duration_minutes: 0,
          leave_end_time: requestedShiftStart.leave_start_time || '08:00:00',
          reason: (requestedShiftStart.reason || '') + ' [أُلغيت واستبدلت بإجازة اعتيادية إجبارية منعاً للازدواجية في الخصم]'
        }).eq('id', requestedShiftStart.id);
        requestedShiftStart.time_duration_minutes = 0;
        (requestedShiftStart as any).status = 'canceled';
      }
      if (requestedMidShift && requestedMidShift.id) {
        await supabase.from('leave_requests').update({
          status: 'canceled',
          time_duration_minutes: 0,
          leave_end_time: requestedMidShift.leave_start_time,
          reason: (requestedMidShift.reason || '') + ' [أُلغيت واستبدلت بإجازة اعتيادية إجبارية منعاً للازدواجية في الخصم]'
        }).eq('id', requestedMidShift.id);
        requestedMidShift.time_duration_minutes = 0;
        (requestedMidShift as any).status = 'canceled';
      }
      if (requestedShiftEnd && requestedShiftEnd.id) {
        await supabase.from('leave_requests').update({
          status: 'canceled',
          time_duration_minutes: 0,
          reason: (requestedShiftEnd.reason || '') + ' [أُلغيت واستبدلت بإجازة اعتيادية إجبارية منعاً للازدواجية في الخصم]'
        }).eq('id', requestedShiftEnd.id);
        requestedShiftEnd.time_duration_minutes = 0;
        (requestedShiftEnd as any).status = 'canceled';
      }

      let fullDayReason = '';
      if (morningPenalty === 'day' || morningPenalty === 'day_double') fullDayReason = morningReason;
      else if (eveningPenalty === 'day') fullDayReason = eveningReason;
      else if (midShiftPenalty === 'day') fullDayReason = midShiftReason;
      else {
        fullDayReason = `تجاوز مجموع زمنيات اليوم ساعتين (${totalPenalties} دقيقة) - تحويل إلى إجازة اعتيادية إجبارية`;
      }

      const existingFullDay = fullDayPenalty || (lateLeave?.leave_type === 'regular' ? lateLeave : null) || (earlyLeave?.leave_type === 'regular' ? earlyLeave : null) || (midLeave?.leave_type === 'regular' ? midLeave : null);
      const penaltyDaysCount = (morningPenalty === 'day_double') ? 2 : 1;

      if (!existingFullDay) {
        await supabase.from('leave_requests').insert({
          user_id: employeeId,
          leave_type: 'regular',
          start_date: dateStr,
          end_date: dateStr,
          days_count: penaltyDaysCount,
          reason: fullDayReason,
          status: 'approved',
          leave_status: 'approved',
          is_mandatory: true,
          with_request: false
        });

        await sendPenaltyAlert(morningPenalty === 'day_double' ? 'day_double' : 'day', fullDayReason, morningPenalty === 'day' || morningPenalty === 'day_double' || midShiftPenalty === 'day', morningDelayMinutes || eveningEarlyMinutes || midShiftDelayMinutes);
      } else if (existingFullDay.reason !== fullDayReason || (existingFullDay as any).days_count !== penaltyDaysCount) {
        await supabase.from('leave_requests').update({ reason: fullDayReason, days_count: penaltyDaysCount }).eq('id', existingFullDay.id);
      }

      // تحديث سجل البصمة الفعلي ليظهر كإجازة إجبارية بدلاً من قيد الدوام / تأخير حضور
      if (record?.id) {
        await supabase.from('attendance_records').update({
          status: 'leave',
          notes: fullDayReason
        }).eq('id', record.id);
        (record as any).status = 'leave';
        record.notes = fullDayReason;
      }
    } else {
      // لم يتجاوز الساعتين: تطبيق الزمنيات الجزئية (صباحي / مسائي)
      if (fullDayPenalty) {
        await supabase.from('leave_requests').delete().eq('id', fullDayPenalty.id);
      }

      // 1. التعامل مع التأخير الصباحي (إذا وجد)
      if (typeof morningPenalty === 'number' && morningPenalty > 0) {
        if (!lateLeave) {
          await supabase.from('leave_requests').insert({
            user_id: employeeId,
            leave_type: 'time_off',
            start_date: dateStr,
            end_date: dateStr,
            leave_start_time: morningStartStr,
            leave_end_time: morningEndStr,
            time_duration_minutes: morningPenalty,
            reason: morningReason,
            status: 'approved',
            leave_status: 'approved',
            is_mandatory: true,
            time_off_subtype: 'shift_start',
            with_request: false
          });
          await sendPenaltyAlert(morningPenalty, morningReason, true, morningDelayMinutes);
        } else if (lateLeave.leave_type === 'time_off' && lateLeave.time_duration_minutes !== morningPenalty) {
          await supabase.from('leave_requests').update({
            time_duration_minutes: morningPenalty,
            leave_start_time: morningStartStr,
            leave_end_time: morningEndStr,
            reason: morningReason,
            time_off_subtype: 'shift_start',
            with_request: false
          }).eq('id', lateLeave.id);
          await sendPenaltyAlert(morningPenalty, morningReason, true, morningDelayMinutes);
        }
      } else {
        if (lateLeave && lateLeave.leave_type === 'time_off') {
          await supabase.from('leave_requests').delete().eq('id', lateLeave.id);
        }
      }

      // 2. التعامل مع الخروج المبكر (إذا وجد)
      if (typeof eveningPenalty === 'number' && eveningPenalty > 0) {
        if (!earlyLeave) {
          await supabase.from('leave_requests').insert({
            user_id: employeeId,
            leave_type: 'time_off',
            start_date: dateStr,
            end_date: dateStr,
            leave_start_time: eveningStartStr,
            leave_end_time: eveningEndStr,
            time_duration_minutes: eveningPenalty,
            reason: eveningReason,
            status: 'approved',
            leave_status: 'approved',
            is_mandatory: true,
            time_off_subtype: 'shift_end',
            with_request: false
          });
          await sendPenaltyAlert(eveningPenalty, eveningReason, false, eveningEarlyMinutes);
        } else if (earlyLeave.leave_type === 'time_off' && earlyLeave.time_duration_minutes !== eveningPenalty) {
          await supabase.from('leave_requests').update({
            time_duration_minutes: eveningPenalty,
            leave_start_time: eveningStartStr,
            leave_end_time: eveningEndStr,
            reason: eveningReason,
            time_off_subtype: 'shift_end',
            with_request: false
          }).eq('id', earlyLeave.id);
          await sendPenaltyAlert(eveningPenalty, eveningReason, false, eveningEarlyMinutes);
        }
      } else {
        if (earlyLeave && earlyLeave.leave_type === 'time_off') {
          await supabase.from('leave_requests').delete().eq('id', earlyLeave.id);
        }
      }

      // 3. التعامل مع إجازة وسط الدوام (إذا وجدت)
      if (typeof midShiftPenalty === 'number' && midShiftPenalty > 0) {
        if (!midLeave) {
          await supabase.from('leave_requests').insert({
            user_id: employeeId,
            leave_type: 'time_off',
            start_date: dateStr,
            end_date: dateStr,
            leave_start_time: midShiftStartStr,
            leave_end_time: midShiftEndStr,
            time_duration_minutes: midShiftPenalty,
            days_count: 1,
            reason: midShiftReason,
            status: 'approved',
            leave_status: 'approved',
            is_mandatory: true,
            time_off_subtype: 'mid_shift',
            with_request: false
          });
          await sendPenaltyAlert(midShiftPenalty, midShiftReason, true, midShiftDelayMinutes);
        } else if (midLeave.leave_type === 'time_off' && midLeave.time_duration_minutes !== midShiftPenalty) {
          await supabase.from('leave_requests').update({
            time_duration_minutes: midShiftPenalty,
            leave_start_time: midShiftStartStr,
            leave_end_time: midShiftEndStr,
            reason: midShiftReason,
            time_off_subtype: 'mid_shift',
            with_request: false
          }).eq('id', midLeave.id);
          await sendPenaltyAlert(midShiftPenalty, midShiftReason, true, midShiftDelayMinutes);
        }
      } else {
        if (midLeave && midLeave.leave_type === 'time_off') {
          await supabase.from('leave_requests').delete().eq('id', midLeave.id);
        }
      }
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
            if (currentMins > 480) initialStatus = 'late'; // المناوب بلا سماحية ولو كان شفته صباحياً
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


