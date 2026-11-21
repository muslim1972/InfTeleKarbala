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

/**
 * إشعار المشرفين للتدقيق عبر كاميرات المراقبة عند فقدان بصمة منتصف الليل لموظف الخفر
 */
async function notifySupervisorsOfMidnightAudit(
  employeeId: string,
  employeeName: string,
  recordDate: string,
  alertMessage: string
) {
  try {
    const supervisorIds = await collectSupervisorIds(employeeId);
    if (supervisorIds.length === 0) return;

    const title = '⚠️ تدقيق حضور منتصف الليل (شفت خفر)';
    const content = `${alertMessage} — الموظف: (${employeeName}) بتاريخ ${recordDate}.`;
    const notifRows = supervisorIds.map(supId => ({
      recipient_id: supId,
      type: 'system',
      title,
      content,
      is_read: false,
      metadata: {
        type: 'midnight_audit_alert',
        employee_id: employeeId,
        employee_name: employeeName,
        record_date: recordDate
      }
    }));

    const { error: notifErr } = await supabase.from('system_notifications').insert(notifRows);
    if (notifErr) console.warn('notifySupervisorsOfMidnightAudit DB error:', notifErr);

    const pushPromises = supervisorIds.map(supId =>
      sendPushNotification(supId, content, { title })
    );
    await Promise.allSettled(pushPromises);
  } catch (err) {
    console.error('Error in notifySupervisorsOfMidnightAudit:', err);
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
      }
    } catch (dcrErr) {
      console.warn('[DeviceMismatch] submit_device_change_request threw:', dcrErr);
    }

    // 2. Insert system notifications via dedicated RPC (SECURITY DEFINER, bypasses RLS)
    const { data: _notifyResult, error: notifyError } = await supabase.rpc('notify_device_mismatch', {
      p_employee_id: employeeId
    });

    if (notifyError) {
      console.error('[DeviceMismatch] ❌ notify_device_mismatch RPC FAILED:', notifyError);
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
      .select('department_id, primary_device_id, work_schedule_id, full_name, is_retired, retirement_date')
      .eq('id', employeeId)
      .single();

    if (profile?.is_retired && (!profile.retirement_date || today >= profile.retirement_date)) {
      throw new Error(`الموظف محال للتقاعد ومعفى من نظام البصمة ${profile.retirement_date ? `اعتباراً من ${profile.retirement_date}` : ''}`);
    }

    let workSchedule = null;
    let isRestDay = false;
    let currentScheduleDay: any = null;
    let prevScheduleDay: any = null;

    if (profile?.work_schedule_id) {
      const { data: ws } = await supabase
        .from('work_schedules')
        .select('*')
        .eq('id', profile.work_schedule_id)
        .single();
      workSchedule = ws;

      const dateObj = new Date(`${today}T00:00:00`);
      const dayOfWeek = dateObj.getDay();
      const prevDayOfWeek = (dayOfWeek + 6) % 7;

      const { data: sd } = await supabase
        .from('work_schedule_days')
        .select('is_rest_day, is_morning, is_evening, is_night')
        .eq('schedule_id', profile.work_schedule_id)
        .eq('day_of_week', dayOfWeek)
        .maybeSingle();
      currentScheduleDay = sd;

      const { data: psd } = await supabase
        .from('work_schedule_days')
        .select('is_rest_day, is_morning, is_evening, is_night')
        .eq('schedule_id', profile.work_schedule_id)
        .eq('day_of_week', prevDayOfWeek)
        .maybeSingle();
      prevScheduleDay = psd;
        
      if (sd && sd.is_rest_day) {
        isRestDay = true;
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

    const nowServerCurrent = getServerNow();
    const baghdadNow = getBaghdadDate(nowServerCurrent);
    const currentMinutes = baghdadNow.getHours() * 60 + baghdadNow.getMinutes();
    // استثناء ساعات الصباح حتى 09:30 ص إذا كان يوم أمس شفت خفر ليلي (امتداد دوام الأمس وليس استراحة)
    const isYesterdayNightFollowup = Boolean(prevScheduleDay?.is_night) && currentMinutes <= (9 * 60 + 30);

    if (isRestDay && shiftType === 'shift' && !isYesterdayNightFollowup && !record && !bypassLeaveWarning) {
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

    // فحص توقيت بغداد الحالي بالساعات والدقائق
    const baghdadDateNow = getBaghdadDate(getServerNow());
    const baghdadHourNow = baghdadDateNow.getHours();
    const baghdadMinsNow = baghdadDateNow.getMinutes();
    const totalBaghdadMinutes = baghdadHourNow * 60 + baghdadMinsNow;

    // هل الموظف في شفت ليلي/خفر مستمر بدأ بالأمس؟
    const isYesterdayNightShift = Boolean(prevScheduleDay?.is_night);
    const hasUnclosedYesterdayNight = isYesterdayNightShift && yesterdayRecord && !yesterdayRecord.check_out;

    // ─── أ) بصمة منتصف الليل لشفت الخفر (قبل الساعة 6:30 صباحاً = 390 دقيقة) ───
    // الموظف يبصم ليلاً ليثبت وجوده في موقع العمل أثناء الخفارة المستمرة:
    // تُسجل البصمة كنبضة تفقد (Heartbeat) وتُضم إلى سجل الأمس، ولا يُغلق الشفت، ولا يُفتح سجل جديد لليوم التقويمي!
    if (hasUnclosedYesterdayNight && totalBaghdadMinutes < 390) {
      const isAuthorized = options?.skipDeviceCheck
        ? true
        : await verifyAndAuthorizeDevice(employeeId, deviceId, profile);
      if (!isAuthorized && yesterdayRecord.raw_punches && yesterdayRecord.raw_punches.length > 0) {
        throw new Error('لا يمكن تسجيل بصمة إضافية من جهاز غير معتمد أثناء شفت الخفر.');
      }

      // فحص مهلة الأمان (3 دقائق / 180 ثانية)
      const yPunches = Array.isArray(yesterdayRecord.raw_punches) ? yesterdayRecord.raw_punches : [];
      const realYPunches = yPunches.filter((p: any) => !p.is_virtual && !p.notes?.includes('افتراضي'));
      if (realYPunches.length > 0 && !notes?.includes('تجاوز المهلة')) {
        const lastPunchTime = new Date(realYPunches[realYPunches.length - 1].time).getTime();
        const elapsedSec = Math.floor((getServerNow().getTime() - lastPunchTime) / 1000);
        if (elapsedSec >= 0 && elapsedSec < 180 && !bypassLeaveWarning) {
          throw new Error(`يرجى الانتظار ${180 - elapsedSec} ثانية قبل تسجيل بصمة جديدة (مهلة الأمان بين البصمات)`);
        }
      }

      const midnightPunch = {
        time: getServerNow().toISOString(),
        location,
        device_id: deviceId,
        snapshot_url: snapshotUrl,
        notes: notes || 'إثبات حضور ليلي (شفت الخفر)',
        verified_by_biometric: verifiedByBiometric,
        target_slot: 'midnight_presence'
      };

      const cleanedPunches = yPunches.filter((p: any) => !p.is_virtual && !p.notes?.includes('افتراضي'));
      cleanedPunches.push(midnightPunch);

      let cleanedNotes = yesterdayRecord.notes || '';
      cleanedNotes = cleanedNotes
        .replace(/\|?\s*\(?بصمة منتصف ليل افتراضية[^\)]*\)?/g, '')
        .replace(/\|?\s*\(?لم يثبت حضور منتصف الليل[^\)]*\)?/g, '')
        .trim();
      if (cleanedNotes.startsWith('|')) cleanedNotes = cleanedNotes.substring(1).trim();
      if (cleanedNotes.endsWith('|')) cleanedNotes = cleanedNotes.substring(0, cleanedNotes.length - 1).trim();

      const savedYesterday = await this.saveSecure(employeeId, yesterdayRecord.id, {
        raw_punches: cleanedPunches,
        notes: cleanedNotes || undefined
      });

      return savedYesterday;
    }

    // ─── ب) بصمة تسليم وانصراف شفت الخفر صباحاً (بين 06:30 و 10:00 صباحاً) ───
    if (hasUnclosedYesterdayNight && totalBaghdadMinutes >= 390 && totalBaghdadMinutes <= 600 && (!record || !record.raw_punches || record.raw_punches.length === 0)) {
      const isAuthorized = options?.skipDeviceCheck
        ? true
        : await verifyAndAuthorizeDevice(employeeId, deviceId, profile);
      if (!isAuthorized && yesterdayRecord.raw_punches && yesterdayRecord.raw_punches.length > 0) {
        throw new Error('لا يمكن تسجيل بصمة انصراف من جهاز غير معتمد.');
      }

      const yPunches = Array.isArray(yesterdayRecord.raw_punches) ? yesterdayRecord.raw_punches : [];
      const realYPunches = yPunches.filter((p: any) => !p.is_virtual && !p.notes?.includes('افتراضي'));
      if (realYPunches.length > 0 && !notes?.includes('تجاوز المهلة')) {
        const lastPunchTime = new Date(realYPunches[realYPunches.length - 1].time).getTime();
        const elapsedSec = Math.floor((getServerNow().getTime() - lastPunchTime) / 1000);
        if (elapsedSec >= 0 && elapsedSec < 180 && !bypassLeaveWarning) {
          throw new Error(`يرجى الانتظار ${180 - elapsedSec} ثانية قبل تسجيل بصمة جديدة`);
        }
      }

      const outPunch = {
        time: getServerNow().toISOString(),
        location,
        device_id: deviceId,
        snapshot_url: snapshotUrl,
        notes: notes || 'انصراف خفارة الأمس (تسليم الشفت)',
        verified_by_biometric: verifiedByBiometric,
        target_slot: 'check_out'
      };

      const cleanedPunches = yPunches.filter((p: any) => !p.is_virtual && !p.notes?.includes('افتراضي'));
      cleanedPunches.push(outPunch);

      const { evaluateRosterAttendance } = await import('../engines/rosterAttendanceEngine');
      const rosterSchedule = {
        is_morning: Boolean(prevScheduleDay?.is_morning),
        is_evening: Boolean(prevScheduleDay?.is_evening),
        is_night: Boolean(prevScheduleDay?.is_night),
        is_rest_day: Boolean(prevScheduleDay?.is_rest_day)
      };

      const rosterResult = evaluateRosterAttendance(
        cleanedPunches,
        yesterdayDateStr,
        rosterSchedule,
        { is_night: false },
        [],
        [],
        false
      );

      const savedYesterday = await this.saveSecure(employeeId, yesterdayRecord.id, {
        raw_punches: rosterResult.rawPunches,
        ...(rosterResult.slots as any),
        check_out: getServerNow().toISOString(),
        check_out_location: location,
        check_out_device_id: deviceId,
        check_out_verified_by_biometric: verifiedByBiometric,
        check_out_snapshot_url: snapshotUrl,
        status: rosterResult.status,
        notes: rosterResult.notes || yesterdayRecord.notes || undefined
      });

      return savedYesterday;
    }

    // فحص ما إذا كانت البصمة الحالية هي استكمال لخفر/مناوبة الأمس
    const isFollowUpOvernight = shiftType === 'shift' && Boolean(yesterdayWasOdd) && (!record || !record.raw_punches || record.raw_punches.length === 0);

    // 4. قيد الحضور المبكر (قبل 6:30 ص) استناداً لوقت السيرفر (للشفت الصباحي فقط)
    const earlyCheck = validateEarlyCheckIn(shiftType, getServerNow(), isFollowUpOvernight);
    if (!earlyCheck.allowed && !record) {
      throw new Error(earlyCheck.message || 'لا يسمح بتثبيت الحضور قبل 6:30ص');
    }

    // 5. إغلاق سجل الأمس المفتوح بعد انتهاء الشفت (تشخيصي آمن دون فرض إجازات)
    if (yesterdayRecord && !yesterdayRecord.check_out && (yesterdayRealCount > 0 || yesterdayRecord.check_in)) {
      const isKhafarFollowup = isFollowUpOvernight && baghdadHourNow >= 6 && baghdadHourNow <= 12;
      try {
        await supabase.rpc('closeout_prev_day_attendance', {
          p_employee_id: employeeId,
          p_followup: isKhafarFollowup
        });
      } catch (e) {
        console.warn('closeout_prev_day_attendance failed:', e);
      }
    }

    const nowServer = getServerNow();
    const nowIso = nowServer.toISOString();

    // فحص مهلة الأمان (180 ثانية / 3 دقائق صارمة لجميع الموظفين) بين البصمات لمنع التكرار العرضي
    if (record && Array.isArray(record.raw_punches) && record.raw_punches.length > 0 && !notes?.includes('تجاوز المهلة')) {
      const realPastPunches = record.raw_punches.filter((p: any) => {
        if (p.is_virtual || p.notes?.includes('افتراضي')) return false;
        const punchMs = new Date(p.time).getTime();
        return !isNaN(punchMs) && punchMs <= nowServer.getTime();
      });
      if (realPastPunches.length > 0) {
        const lastPunchTime = new Date(realPastPunches[realPastPunches.length - 1].time).getTime();
        const elapsedSeconds = Math.floor((nowServer.getTime() - lastPunchTime) / 1000);
        const cooldownSeconds = 180; // 3 دقائق صارمة لجميع الحالات
        if (elapsedSeconds >= 0 && elapsedSeconds < cooldownSeconds && !bypassLeaveWarning) {
          const remaining = cooldownSeconds - elapsedSeconds;
          throw new Error(`يرجى الانتظار ${remaining} ثانية قبل تسجيل بصمة جديدة (مهلة الأمان بين البصمات لمنع التكرار العرضي)`);
        }
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

    // فحص حظر الحضور الصباحي قبل 6:00 ص لموظفي الصباحي
    if (shiftType === 'morning' && !record) {
      const { checkMorningEarlyPunchAllowed } = await import('../engines/morningAttendanceEngine');
      const earlyCheck = checkMorningEarlyPunchAllowed(nowIso);
      if (!earlyCheck.allowed) {
        throw new Error(earlyCheck.message || 'الدوام الصباحي يبدأ على أقل تقدير عند الساعة 6:00 صباحاً');
      }
    }

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
    let updates: Partial<AttendanceRecord>;
    if (shiftType === 'morning') {
      const { evaluateMorningAttendance } = await import('../engines/morningAttendanceEngine');
      const { data: approvedLeavesData } = await supabase
        .from('leave_requests')
        .select('id, leave_type, start_date, end_date, leave_start_time, leave_end_time, time_duration_minutes, status, reason')
        .eq('user_id', employeeId)
        .eq('status', 'approved')
        .lte('start_date', today)
        .or(`end_date.gte.${today},end_date.is.null`);

      const morningResult = evaluateMorningAttendance(
        rawPunches,
        today,
        (approvedLeavesData || []) as any,
        { isRestDay, isOfficialHoliday: false, isCompensatory: false },
        false
      );

      updates = {
        raw_punches: morningResult.rawPunches,
        ...(morningResult.slots as any),
        status: morningResult.status,
        notes: morningResult.notes || undefined
      };
      if (morningResult.pdfNote) {
        (updates as any).admin_notes = morningResult.pdfNote;
      }
    } else {
      // ── محرك المناوبين المستقل (Roster Engine) ──
      const { evaluateRosterAttendance } = await import('../engines/rosterAttendanceEngine');
      const { data: approvedLeavesData } = await supabase
        .from('leave_requests')
        .select('id, leave_type, start_date, end_date, leave_start_time, leave_end_time, time_duration_minutes, time_off_subtype, status, reason')
        .eq('user_id', employeeId)
        .eq('status', 'approved')
        .lte('start_date', today)
        .or(`end_date.gte.${today},end_date.is.null`);

      const rosterSchedule = {
        is_morning: Boolean(currentScheduleDay?.is_morning),
        is_evening: Boolean(currentScheduleDay?.is_evening),
        is_night: Boolean(currentScheduleDay?.is_night),
        is_rest_day: Boolean(isRestDay)
      };
      const prevRosterSchedule = {
        is_night: Boolean(prevScheduleDay?.is_night)
      };
      const approvedLeavesList = (approvedLeavesData || []).filter((l: any) => l.leave_type !== 'time_off');
      const approvedTimeOffsList = (approvedLeavesData || []).filter((l: any) => l.leave_type === 'time_off');

      const rosterResult = evaluateRosterAttendance(
        rawPunches,
        today,
        rosterSchedule,
        prevRosterSchedule,
        approvedLeavesList as any,
        approvedTimeOffsList as any,
        false
      );

      updates = {
        raw_punches: rosterResult.rawPunches,
        ...(rosterResult.slots as any),
        status: rosterResult.status,
        notes: rosterResult.notes || undefined
      };
      if (rosterResult.pdfNote) {
        (updates as any).admin_notes = rosterResult.pdfNote;
      }
      if (rosterResult.supervisorAlert) {
        notifySupervisorsOfMidnightAudit(
          employeeId,
          profile?.full_name || 'موظف مناوب',
          today,
          rosterResult.supervisorAlert
        ).catch(console.warn);
      }
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

  async enforceMandatoryPenalties(_employeeId: string, _dateStr: string, _record: AttendanceRecord): Promise<void> {
    // ملغاة نهائياً: تطبيق البصمة استشاري تنبيهي فقط للمشرف ولا يفرض إجازات أو عقوبات تلقائية
    return;
  },

  async checkIn(employeeId: string, location?: string, deviceId?: string, verifiedByBiometric: boolean = false, snapshotUrl?: string, notes?: string) {
    await syncServerTime();
    const now = getServerNow().toISOString();
    
    // Get department, device info, and work schedule from employee profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('department_id, primary_device_id, work_schedule_id, full_name, is_retired, retirement_date')
      .eq('id', employeeId)
      .single();

    const todayStr = getServerLocalDateStr();
    if (profile?.is_retired && (!profile.retirement_date || todayStr >= profile.retirement_date)) {
      throw new Error(`الموظف محال للتقاعد ومعفى من نظام البصمة ${profile.retirement_date ? `اعتباراً من ${profile.retirement_date}` : ''}`);
    }

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


