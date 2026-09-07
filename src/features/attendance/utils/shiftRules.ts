/**
 * shiftRules.ts
 * قواعد وضوابط أنواع الدوام (صباحي / مناوب)، والتحقق من التوقيتات وفق توقيت بغداد (UTC+3)
 */

export type ShiftType = 'morning' | 'shift';

/**
 * إرجاع كائن الوقت الحالي بتوقيت بغداد (Asia/Baghdad / UTC+3)
 */
export function getBaghdadDate(d: Date = new Date()): Date {
  // Use Intl or timezone offset to get Baghdad time
  const baghdadStr = d.toLocaleString('en-US', { timeZone: 'Asia/Baghdad' });
  return new Date(baghdadStr);
}

/**
 * إرجاع تاريخ اليوم بصيغة YYYY-MM-DD بتوقيت بغداد
 */
export function getBaghdadDateStr(d: Date = new Date()): string {
  const bDate = getBaghdadDate(d);
  const y = bDate.getFullYear();
  const m = String(bDate.getMonth() + 1).padStart(2, '0');
  const day = String(bDate.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * إرجاع الوقت الحالي بالساعات والدقائق بتوقيت بغداد
 */
export function getBaghdadTimeMinutes(d: Date = new Date()): { hours: number; minutes: number; totalMinutes: number } {
  const bDate = getBaghdadDate(d);
  const hours = bDate.getHours();
  const minutes = bDate.getMinutes();
  return {
    hours,
    minutes,
    totalMinutes: hours * 60 + minutes
  };
}

/**
 * تحديد نوع دوام الموظف (صباحي vs مناوب)
 * الدوام الافتراضي هو صباحي (08:00 - 15:00) ما لم يُحدد جدول خاص بالمناوبة/الخفر/المسائي
 */
export function determineShiftType(
  profile?: { work_schedule_id?: string | null } | null,
  workSchedule?: { id?: string; name?: string; type?: string; is_default?: boolean } | null
): ShiftType {
  if (!profile?.work_schedule_id) {
    return 'morning';
  }

  if (workSchedule) {
    if (workSchedule.is_default) return 'morning';
    const name = (workSchedule.name || '').toLowerCase();
    const type = (workSchedule.type || '').toLowerCase();
    if (
      name.includes('خفر') ||
      name.includes('مناوب') ||
      name.includes('مسائي') ||
      name.includes('شفت') ||
      name.includes('roster') ||
      name.includes('shift') ||
      type === 'roster' ||
      type === 'flexible'
    ) {
      return 'shift';
    }
  }

  return 'morning';
}

/**
 * فحص منع البصمة المبكرة قبل الساعة 6:30 ص
 * (تم تعطيل الشرط مؤقتاً لتسهيل الفحص التجريبي والتطوير بناءً على توجيه الإدارة)
 */
export function validateEarlyCheckIn(
  shiftType: ShiftType,
  d: Date = new Date(),
  isFollowUpOvernight: boolean = false
): { allowed: boolean; message?: string } {
  // تم إزالة القيد مؤقتاً لتسهيل الفحص والتطوير في أي وقت
  return { allowed: true };
}

/**
 * استخراج مصفوفة البصمات الحقيقية (استبعاد البصمات الافتراضية المحقونة تلقائياً)
 */
export function countRealPunches(rawPunches: any[] = []): number {
  if (!Array.isArray(rawPunches)) return 0;
  return rawPunches.filter(p => !p.is_virtual && !p.notes?.includes('افتراضي')).length;
}
