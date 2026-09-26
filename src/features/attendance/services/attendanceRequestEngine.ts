/**
 * attendanceRequestEngine.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * المحرك الذكي الذي يوحّد حالة الموظف من تبويبة الطلبات مع تدفق الحضور
 * والانصراف، ويطبّق مصفوفة القرارات المعتمدة:
 *
 *  1. إجازة يوم معتمدة (اعتيادية/مرضية/طويلة) → تحذير + تأكيد «تثبيت رغم ذلك»
 *     ثم بصمة حمراء إدارياً + إشعار مشرف بزر «موافق» (ساعات غير محتسبة).
 *  2. إجازة رسمية (واجب/إيفاد) → توجيه مباشر دون عوائق + إشعار علمي للمشرف.
 *  3. طلب معلّق يغطي اليوم → بصمة عادية + إشعار مشرف بزر «مراجعة الطلب».
 *  4. طلب مرفوض يبدأ اليوم → بصمة عادية + إشعار علمي للمشرف.
 *  5. إجازة زمنية معتمدة → توجيه بصمات الخروج/العودة (البانرات + فحص الانصراف).
 *
 * هذا الملف هو المصدر الوحيد لقرارات الربط (attendace ↔ requests) حتى تبقى
 * القواعد قابلة للتوسّع من مكان واحد دون تشتيت في مكوّنات الواجهة.
 */

import { supabase } from '../../../lib/supabase';
import { sendPushNotification } from '../../../services/notifications';
import {
  getLeaveContext,
  coversDate,
  isRequestedLeave,
  mergeNote,
  type DayLeaveInfo,
  type TimeLeaveInfo,
  type LeaveRequestLite
} from './leaveIntegrationService';
import { LEAVE_CONFLICT_NOTE_TAG, hasLeaveConflictNote } from '../utils/attendanceCalc';

/** أنواع الإجازات الرسمية التي يكون فيها أداء الدوام هو الغاية أصلاً */
export const OFFICIAL_DUTY_TYPES = ['duty', 'dispatch'];

/** السياق الكامل لحالة الموظف في يوم محدد (طلبات + إجازات) */
export interface PunchRequestContext {
  dayLeave: DayLeaveInfo | null;
  /** هل إجازة اليوم صارمة (اعتيادية/مرضية/طويلة) تستوجب تأكيد «تثبيت رغم ذلك»؟ */
  strictDayLeave: boolean;
  timeLeaves: TimeLeaveInfo[];
  /** طلبات معلّقة تغطي اليوم (يوم كامل أو زمنية) */
  pendingRequests: LeaveRequestLite[];
  /** طلبات يوم كامل مرفوضة يبدأ تاريخها اليوم */
  rejectedToday: LeaveRequestLite[];
}

/**
 * نقطة الدخول الموحّدة: تُجمع إجازات اليوم المعتمدة + الطلبات المعلقة والمرفوضة
 * التي تغطي اليوم في سياق واحد يستهلكه تدفق البصمة وبانرات الواجهة.
 */
export async function resolvePunchRequestContext(
  employeeId: string,
  dateStr: string
): Promise<PunchRequestContext> {
  const leaveCtx = await getLeaveContext(employeeId, dateStr);

  let pendingRequests: LeaveRequestLite[] = [];
  let rejectedToday: LeaveRequestLite[] = [];
  try {
    const { data, error } = await supabase
      .from('leave_requests')
      .select(
        'id, user_id, leave_type, start_date, end_date, time_duration_minutes, time_off_subtype, with_request, is_mandatory, status, reason'
      )
      .eq('user_id', employeeId)
      .in('status', ['pending', 'rejected'])
      .lte('start_date', dateStr)
      .or(`end_date.gte.${dateStr},end_date.is.null`);

    if (error) throw error;

    const all = (data || []) as LeaveRequestLite[];
    pendingRequests = all.filter(
      r => r.status === 'pending' && isRequestedLeave(r) && coversDate(r, dateStr)
    );
    // المرفوض: يهم فقط إذا كان يبدأ اليوم (بصمة بعد رفض الطلب تستحق إشعاراً)
    rejectedToday = all.filter(
      r => r.status === 'rejected' && isRequestedLeave(r) && r.start_date === dateStr
    );
  } catch (err) {
    console.error('[SmartEngine] فشل جلب الطلبات المعلقة/المرفوضة:', err);
  }

  return {
    ...leaveCtx,
    strictDayLeave: !!leaveCtx.dayLeave && !OFFICIAL_DUTY_TYPES.includes(leaveCtx.dayLeave.leaveType),
    pendingRequests,
    rejectedToday
  };
}

// ─── إجراءات المشرف (تُستدعى من أزرار الإشعارات) ────────────────────────────

export interface SupervisorActionResult {
  success: boolean;
  message: string;
}

/** حدود اليوم المحلي (بغداد UTC+3) محوّلة إلى UTC ISO — بنفس منطق attendanceService */
function localDayRangeUTC(dateStr: string): { start: string; end: string } {
  const [y, m, d] = dateStr.split('-').map(Number);
  const start = new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0) - 3 * 3600 * 1000);
  const end = new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999) - 3 * 3600 * 1000);
  return { start: start.toISOString(), end: end.toISOString() };
}

/**
 * قرار المشرف «موافق» على بصمة متعارضة مع طلب إجازة:
 *  1. وسم سجل البصمة بـ«بصمة متعارضة مع طلب» → ساعات اليوم (الصافي/العجز/الإضافي)
 *     تُعرض غير محتسبة (0.00) تلقائياً في السجلات والتقارير.
 *  2. إشعار الموظف (قاعدة البيانات + Push): يجب مراجعة الإدارة لحل الأشكال
 *     واحتساب البصمة اصولياً.
 */
export async function approveLeaveConflict(
  employeeId: string,
  recordDate: string
): Promise<SupervisorActionResult> {
  try {
    const range = localDayRangeUTC(recordDate);
    const { data: recs, error: fetchErr } = await supabase
      .from('attendance_records')
      .select('id, notes')
      .eq('employee_id', employeeId)
      .gte('created_at', range.start)
      .lte('created_at', range.end)
      .order('created_at', { ascending: false })
      .limit(1);

    if (fetchErr) throw fetchErr;
    const rec = recs?.[0];
    if (!rec) {
      return { success: false, message: 'لم يُعثر على سجل بصمة للموظف في هذا اليوم' };
    }

    if (!hasLeaveConflictNote(rec.notes)) {
      const { error: updErr } = await supabase
        .from('attendance_records')
        .update({ notes: mergeNote(rec.notes, LEAVE_CONFLICT_NOTE_TAG) })
        .eq('id', rec.id);
      if (updErr) throw updErr;
    }

    const title = '⚠️ قرار إداري على بصمة يوم إجازتك';
    const content =
      'اعتمد المشرف بصمتك المسجلة في يوم إجازة معتمدة لديك، واعتُبرت ساعات هذا اليوم غير محتسبة ضمن ساعات العمل. يجب مراجعة الإدارة لحل الاشكال واحتساب البصمة اصولياً.';

    const { error: notifErr } = await supabase.from('system_notifications').insert({
      recipient_id: employeeId,
      type: 'system',
      title,
      content,
      is_read: false,
      metadata: { type: 'conflict_approved_notice', employee_id: employeeId, record_date: recordDate }
    });
    if (notifErr) throw notifErr;

    sendPushNotification(employeeId, content, { title }).catch(console.warn);

    return {
      success: true,
      message: 'تم الاعتماد: ساعات المخالفة غير محتسبة، وأُبلغ الموظف بضرورة مراجعة الإدارة'
    };
  } catch (err: any) {
    console.error('[SmartEngine] فشل اعتماد تعارض البصمة:', err);
    return { success: false, message: `فشل تنفيذ الاعتماد: ${err?.message || err}` };
  }
}
