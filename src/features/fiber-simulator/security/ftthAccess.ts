/**
 * ============================================================
 * منطق الوصول إلى محاكي FTTH عبر صلاحيات الحقول
 * ============================================================
 * كانت الميزة حصرية لحساب المطور؛ أصبحت الآن قابلة للمنح من نافذة
 * «صلاحيات الحقول» عبر السجل ftth_simulator في جدول field_permissions:
 *   1 = مالية | 2 = موارد بشرية | 3 = إعلام | 4 = عام
 *
 * قواعد التقييم (بترتيب الحسم):
 *   1) حساب المطور مسموح دائماً (تجاوز كامل).
 *   2) الزائر أو حساب بلا مستوى محدد → مرفوض.
 *   3) غياب سجل الصلاحية من قاعدة البيانات → مرفوض (fail-closed).
 *   4) غير ذلك: يُسمح فقط إذا احتوى permission_levels مستوى المستخدم.
 *
 * دوال نقية قابلة للاختبار — بلا أي اعتماد على React أو الشبكة.
 */

import type { AppUser } from '../../../context/AuthContext';
import { isDeveloperAccount } from './feature-gate';

/** مفتاح سجل هذه الميزة في جدول field_permissions */
export const FTTH_SIMULATOR_FIELD_KEY = 'ftth_simulator';

/** مستويات الصلاحية المعتمدة في النظام (نفس تسميات نافذة صلاحيات الحقول) */
export type PermissionLevel = 1 | 2 | 3 | 4;

/** صف صلاحية الحقل كما يعود من Supabase (مع دعم الصيغة العددية القديمة) */
export interface FtthPermissionRow {
  permission_levels?: number[] | null;
  permission_level?: number | null;
}

/**
 * مستوى المستخدم الحالي وفق تعيين الأدوار المعتمد في النظام
 * (مطابق لتعيين isFieldReadOnly في useEmployeeManager):
 * finance=1، hr=2، media=3، وغير المعرَّف (موظف عادي)=4.
 * الزائر بلا مستوى → null.
 */
export function permissionLevelForUser(
  u: AppUser | null | undefined
): PermissionLevel | null {
  if (!u) return null;
  if (u.role === 'visitor') return null;
  switch (u.admin_role) {
    case 'finance':
      return 1;
    case 'hr':
      return 2;
    case 'media':
      return 3;
    default:
      return 4;
  }
}

/** تقييم الوصول إلى محاكي FTTH — دالة نقية واحدة مصدر الحقيقة */
export function evaluateFtthAccess(
  user: AppUser | null | undefined,
  row: FtthPermissionRow | null | undefined
): boolean {
  /* 1) المطور يتجاوز كل القيود */
  if (isDeveloperAccount(user)) return true;

  /* 2) لا مستوى → لا وصول (الزائر وحسابات النظام الخاصة) */
  const level = permissionLevelForUser(user);
  if (level === null) return false;

  /* 3) غياب السجل → الإخفاء (fail-closed) */
  if (!row) return false;

  /* 4) المنح فقط عبر المستويات المصرّح بها */
  if (Array.isArray(row.permission_levels)) {
    return row.permission_levels.includes(level);
  }
  /* توافق رجعي مع الصيغة العددية القديمة permission_level */
  if (typeof row.permission_level === 'number') {
    return row.permission_level === level;
  }
  return false;
}
