/**
 * shiftScheduleUtils.ts
 * دوال نقية لحساب وتزحيف ساعات الدوام وأوقات البصمة بالكامل (صباحي / مسائي / خفر)
 * عند وجود أمر تعديل ساعات الدوام المؤقت الساري على تاريخ محدد.
 * النواة المعمارية: FE-ATT-01
 */

export interface EffectiveWorkHours {
  id?: string;
  governorate?: string;
  start_date: string;
  end_date: string;
  morning_start: string; // HH:mm or HH:mm:ss
  morning_end: string;
  evening_start: string;
  evening_end: string;
  night_start: string;
  night_end: string;
  book_number?: string;
  book_date?: string;
  issuing_entity?: string;
}

export interface ResolvedDutyWindows {
  isOverridden: boolean;
  morningStart: string;           // HH:mm (مثال: 08:00)
  morningEnd: string;             // HH:mm (مثال: 15:00)
  morningStartMinutes: number;    // دقائق بداية الصباحي
  morningOnTimeLimitMinutes: number; // البداية + 30د (حد التأخير الصباحي، مثال: 08:30)
  morningEarlyPunchMinMinutes: number; // أقل وقت مسموح لبصمة الصباحي (البداية - 120د، مثال: 06:00)
  morningCheckInWindowStartMinutes: number; // بداية استقبال الصباحي (البداية - 30د، مثال: 07:30)
  morningEarlyLeaveLimitMinutes: number; // النهاية - 30د للدوام الصباحي (حد الانصراف المبكر، مثال: 14:30)
  morningEndMinutes: number;      // نهاية الصباحي الكاملة (مثال: 15:00)
  morningCheckoutMaxMinutes: number; // نهاية نافذة قبول الانصراف (+15د، مثال: 15:15)
  morningBridgeStartMinutes: number; // بداية نافذة الجسر بين الصباحي والمسائي
  morningBridgeEndMinutes: number;   // نهاية نافذة الجسر بين الصباحي والمسائي
  eveningStart: string;           // HH:mm (مثال: 14:30)
  eveningEnd: string;             // HH:mm (مثال: 20:00)
  eveningStartMinutes: number;
  eveningEndMinutes: number;
  eveningCheckoutStartMinutes: number; // النهاية - 15د
  eveningCheckoutEndMinutes: number;   // النهاية + 90د
  nightStart: string;             // HH:mm (مثال: 20:00)
  nightEnd: string;               // HH:mm (مثال: 08:00 في اليوم التالي)
  nightStartMinutes: number;
  nightEndMinutes: number;
  nightHandoverStartMinutes: number;   // نهاية الخفر - 90د (مثال: 06:30)
  nightCheckoutStartMinutes: number;   // نهاية الخفر - 30د (مثال: 07:30)
  nightCheckoutEndMinutes: number;     // نهاية الخفر + 90د (مثال: 09:30)
}

export function parseTimeToMinutes(timeStr?: string | null, fallbackMinutes: number = 0): number {
  if (!timeStr) return fallbackMinutes;
  const parts = String(timeStr).trim().split(':');
  if (parts.length < 2) return fallbackMinutes;
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  if (isNaN(h) || isNaN(m)) return fallbackMinutes;
  return h * 60 + m;
}

export function normalizeHHMM(timeStr?: string | null, fallback: string = '08:00'): string {
  if (!timeStr) return fallback;
  const parts = String(timeStr).trim().split(':');
  if (parts.length < 2) return fallback;
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  if (isNaN(h) || isNaN(m)) return fallback;
  return `${String(Math.max(0, Math.min(23, h))).padStart(2, '0')}:${String(Math.max(0, Math.min(59, m))).padStart(2, '0')}`;
}

export function minutesToHHMM(totalMinutes: number): string {
  const norm = ((Math.round(totalMinutes) % 1440) + 1440) % 1440;
  const h = Math.floor(norm / 60);
  const m = norm % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function minutesToHHMMSS(totalMinutes: number): string {
  return `${minutesToHHMM(totalMinutes)}:00`;
}

/**
 * استخراج كافة نوافذ وحدود الدوام والبصمة المزحفة لليوم بناءً على الأمر المؤقت إن وجد،
 * أو القيم القياسية المعتمدة للنظام عند عدم وجود أمر.
 */
export function resolveEffectiveDutyWindows(override?: EffectiveWorkHours | null): ResolvedDutyWindows {
  const morningStart = normalizeHHMM(override?.morning_start, '08:00');
  const morningEnd = normalizeHHMM(override?.morning_end, '15:00');
  const eveningStart = normalizeHHMM(override?.evening_start, '14:30');
  const eveningEnd = normalizeHHMM(override?.evening_end, '20:00');
  const nightStart = normalizeHHMM(override?.night_start, '20:00');
  const nightEnd = normalizeHHMM(override?.night_end, '08:00');

  const morningStartMinutes = parseTimeToMinutes(morningStart, 8 * 60);
  const morningEndMinutes = parseTimeToMinutes(morningEnd, 15 * 60);
  const eveningStartMinutes = parseTimeToMinutes(eveningStart, 14 * 60 + 30);
  const eveningEndMinutes = parseTimeToMinutes(eveningEnd, 20 * 60);
  const nightStartMinutes = parseTimeToMinutes(nightStart, 20 * 60);
  const nightEndMinutes = parseTimeToMinutes(nightEnd, 8 * 60);

  // الصباحي يتزحف مع السماحية المعتمدة: (+30د بداية) و(-30د نهاية)
  const morningOnTimeLimitMinutes = morningStartMinutes + 30;
  const morningEarlyPunchMinMinutes = Math.max(0, morningStartMinutes - 120);
  const morningCheckInWindowStartMinutes = Math.max(0, morningStartMinutes - 30);
  const morningEarlyLeaveLimitMinutes = Math.max(morningStartMinutes, morningEndMinutes - 30);
  const morningCheckoutMaxMinutes = morningEndMinutes + 15;

  // نافذة الجسر بين الصباحي والمسائي تتبع نهاية الصباحي المزحفة (+15د عن النهاية، تبدأ من نهاية السماح)
  const morningBridgeStartMinutes = morningEarlyLeaveLimitMinutes;
  const morningBridgeEndMinutes = Math.max(morningEndMinutes + 30, eveningStartMinutes + 60);

  return {
    isOverridden: Boolean(override),
    morningStart,
    morningEnd,
    morningStartMinutes,
    morningOnTimeLimitMinutes,
    morningEarlyPunchMinMinutes,
    morningCheckInWindowStartMinutes,
    morningEarlyLeaveLimitMinutes,
    morningEndMinutes,
    morningCheckoutMaxMinutes,
    morningBridgeStartMinutes,
    morningBridgeEndMinutes,
    eveningStart,
    eveningEnd,
    eveningStartMinutes,
    eveningEndMinutes,
    eveningCheckoutStartMinutes: Math.max(0, eveningEndMinutes - 15),
    eveningCheckoutEndMinutes: eveningEndMinutes + 90,
    nightStart,
    nightEnd,
    nightStartMinutes,
    nightEndMinutes,
    nightHandoverStartMinutes: Math.max(0, nightEndMinutes - 90),
    nightCheckoutStartMinutes: Math.max(0, nightEndMinutes - 30),
    nightCheckoutEndMinutes: nightEndMinutes + 90,
  };
}
