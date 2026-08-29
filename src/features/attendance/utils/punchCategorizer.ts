import type { AttendanceRecord } from '../types';
import type { ShiftType } from './shiftRules';
import { countRealPunches } from './shiftRules';

export interface RawPunch {
  time: string;
  location?: string;
  device_id?: string;
  snapshot_url?: string;
  notes?: string;
  verified_by_biometric?: boolean;
  is_virtual?: boolean; // البصمات الافتراضية المحقونة تلقائياً بواسطة النظام
}

/**
 * تحويل وقت بالساعات والدقائق بتوقيت بغداد إلى ISO UTC string دقيق
 */
function toBaghdadIsoString(dateStr: string, hour: number, minute: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const utcMillis = Date.UTC(y, m - 1, d, hour, minute, 0, 0) - (3 * 3600 * 1000);
  return new Date(utcMillis).toISOString();
}

/**
 * خوارزمية تصنيف وفرز البصمات ومعالجة حالات الورديات وانتقال منتصف الليل
 */
export function categorizePunches(
  rawPunches: RawPunch[],
  yesterdayRecord?: AttendanceRecord | null,
  todayDateStr?: string, // YYYY-MM-DD
  shiftType: ShiftType = 'morning',
  isEndOfDayEvaluation: boolean = false
): Partial<AttendanceRecord> {
  if (!rawPunches || rawPunches.length === 0) return {};

  // 1. Sort punches by time
  const sortedPunches = [...rawPunches].sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

  // 2. Debounce (3 minutes between adjacent taps)
  const filteredPunches: RawPunch[] = [];
  let i = 0;
  while (i < sortedPunches.length) {
    let j = i + 1;
    while (
      j < sortedPunches.length &&
      new Date(sortedPunches[j].time).getTime() - new Date(sortedPunches[j - 1].time).getTime() <= 3 * 60 * 1000
    ) {
      j++;
    }
    if (filteredPunches.length % 2 === 0) {
      filteredPunches.push(sortedPunches[i]); // Earliest for IN
    } else {
      filteredPunches.push(sortedPunches[j - 1]); // Latest for OUT
    }
    i = j;
  }

  let finalNotes = '';

  // 3. Handle excessive punches
  if (filteredPunches.length === 7) {
    filteredPunches.splice(5, 1);
  } else if (filteredPunches.length >= 8) {
    filteredPunches.splice(5, filteredPunches.length - 6);
    finalNotes = 'يرجى المراجعة , كثير البصمات';
  }

  const updates: any = {
    check_in: null,
    check_in_location: null,
    check_in_device_id: null,
    check_in_snapshot_url: null,
    check_in_verified_by_biometric: null,
    time_leave_out: null,
    time_leave_return: null,
    time_leave_out_2: null,
    time_leave_return_2: null,
    check_out: null,
    check_out_location: null,
    check_out_device_id: null,
    check_out_snapshot_url: null,
    check_out_verified_by_biometric: null,
    raw_punches: filteredPunches
  };

  // 4. فحص حالة دوام المناوب الممتد عبر منتصف الليل (Overnight Follow-up Check)
  // إذا كان الموظف مناوباً + له بصمة صباحية واحدة فقط اليوم (عدد فردي) + بصمات الأمس الحقيقية كانت فردية (1 أو 3 أو 5)
  const yesterdayRealCount = yesterdayRecord ? countRealPunches(yesterdayRecord.raw_punches) : 0;
  const yesterdayWasOdd = yesterdayRealCount % 2 === 1 || (yesterdayRecord?.check_in && !yesterdayRecord?.check_out);

  if (shiftType === 'shift' && filteredPunches.length === 1 && yesterdayWasOdd && todayDateStr) {
    const firstPunch = filteredPunches[0];
    const punchDate = new Date(firstPunch.time);
    // 12:00 PM Baghdad is 09:00 UTC
    const baghdadHour = (punchDate.getUTCHours() + 3) % 24;

    // إذا كانت البصمة في الفترة الصباحية حتى 12:00 ظهراً وتكمل خفر الأمس
    if (baghdadHour <= 12) {
      const virtualInTime = toBaghdadIsoString(todayDateStr, 0, 1); // 00:01 AM Baghdad
      
      updates.check_in = virtualInTime;
      updates.check_in_location = firstPunch.location;
      updates.check_in_device_id = firstPunch.device_id;
      
      updates.check_out = firstPunch.time;
      updates.check_out_location = firstPunch.location;
      updates.check_out_device_id = firstPunch.device_id;
      updates.check_out_snapshot_url = firstPunch.snapshot_url;
      updates.check_out_verified_by_biometric = firstPunch.verified_by_biometric;

      const virtualInNote = '(دخول اولي افتراضي)';
      updates.notes = finalNotes ? `${finalNotes} | ${virtualInNote}` : virtualInNote;
      return updates;
    }
  }

  // 5. التوزيع القياسي للبصمات من 1 إلى 6
  if (filteredPunches.length > 0) {
    updates.check_in = filteredPunches[0].time;
    updates.check_in_location = filteredPunches[0].location;
    updates.check_in_device_id = filteredPunches[0].device_id;
    updates.check_in_snapshot_url = filteredPunches[0].snapshot_url;
    updates.check_in_verified_by_biometric = filteredPunches[0].verified_by_biometric;
  }

  if (filteredPunches.length > 1) {
    if (filteredPunches.length === 2) {
      setOutData(updates, filteredPunches[1], 'check_out');
    } else {
      setOutData(updates, filteredPunches[1], 'time_leave_out');
    }
  }

  if (filteredPunches.length > 2) {
    setOutData(updates, filteredPunches[2], 'time_leave_return');
  }

  if (filteredPunches.length > 3) {
    if (filteredPunches.length === 4) {
      setOutData(updates, filteredPunches[3], 'check_out');
    } else {
      setOutData(updates, filteredPunches[3], 'time_leave_out_2');
    }
  }

  if (filteredPunches.length > 4) {
    setOutData(updates, filteredPunches[4], 'time_leave_return_2');
  }

  if (filteredPunches.length > 5) {
    setOutData(updates, filteredPunches[5], 'check_out');
  }

  // 6. فحص وإدراج الخروج الافتراضي الإجباري عند نهاية اليوم إذا كانت البصمات فردية
  if (isEndOfDayEvaluation && filteredPunches.length % 2 === 1 && todayDateStr) {
    const virtualOutTime = shiftType === 'morning' 
      ? toBaghdadIsoString(todayDateStr, 15, 0)  // 15:00 Baghdad
      : toBaghdadIsoString(todayDateStr, 23, 59); // 23:59 Baghdad

    updates.check_out = virtualOutTime;
    const virtualOutNote = '(خروج نهائي افتراضي)';
    finalNotes = finalNotes ? `${finalNotes} | ${virtualOutNote}` : virtualOutNote;
  }

  if (finalNotes) {
    updates.notes = finalNotes;
  }

  return updates;
}

function setOutData(updates: any, punch: RawPunch, keyPrefix: string) {
  updates[keyPrefix] = punch.time;
  if (keyPrefix === 'check_out') {
    updates.check_out_location = punch.location;
    updates.check_out_device_id = punch.device_id;
    updates.check_out_snapshot_url = punch.snapshot_url;
    updates.check_out_verified_by_biometric = punch.verified_by_biometric;
  }
}
