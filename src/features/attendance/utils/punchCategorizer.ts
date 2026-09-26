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
  target_slot?: 'check_in' | 'time_leave_out' | 'time_leave_return' | 'time_leave_out_2' | 'time_leave_return_2' | 'check_out' | 'update_check_out';
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

  // 2. تطبيق مهلة الأمان (3 دقائق بين البصمات المتتالية للحركة نفسها) لمنع التكرار العرضي
  // مع الحفاظ على كل بصمة جديدة بعد انقضاء المهلة
  const filteredPunches: RawPunch[] = [];
  let i = 0;
  while (i < sortedPunches.length) {
    let j = i + 1;
    while (
      j < sortedPunches.length &&
      new Date(sortedPunches[j].time).getTime() - new Date(sortedPunches[j - 1].time).getTime() <= 3 * 60 * 1000
    ) {
      // إذا كانت الخانة محددة صراحة وتختلف عن السابقة، لا ندمجها حتى لو كانت متقاربة
      if (
        sortedPunches[j].target_slot &&
        sortedPunches[j - 1].target_slot &&
        sortedPunches[j].target_slot !== sortedPunches[j - 1].target_slot
      ) {
        break;
      }
      j++;
    }
    // في مهلة الدخول نعتمد أول بصمة، وفي مهلة الخروج/الانصراف نعتمد آخر بصمة
    if (filteredPunches.length % 2 === 0) {
      filteredPunches.push(sortedPunches[i]);
    } else {
      filteredPunches.push(sortedPunches[j - 1]);
    }
    i = j;
  }

  let finalNotes = '';

  const updates: any = {
    raw_punches: filteredPunches,
    check_in: null,
    check_in_location: null,
    check_in_device_id: null,
    check_in_snapshot_url: null,
    check_in_verified_by_biometric: false,
    
    check_out: null,
    check_out_location: null,
    check_out_device_id: null,
    check_out_snapshot_url: null,
    check_out_verified_by_biometric: false,
    
    time_leave_out: null,
    time_leave_return: null,
    time_leave_out_2: null,
    time_leave_return_2: null,
  };

  // 3. فحص حالة دوام المناوب الممتد عبر منتصف الليل (Overnight Follow-up Check)
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

  // 4. التوزيع القياسي للبصمات من 1 إلى 6
  if (filteredPunches.length > 0) {
    updates.check_in = filteredPunches[0].time;
    updates.check_in_location = filteredPunches[0].location;
    updates.check_in_device_id = filteredPunches[0].device_id;
    updates.check_in_snapshot_url = filteredPunches[0].snapshot_url;
    updates.check_in_verified_by_biometric = filteredPunches[0].verified_by_biometric;
  }

  if (filteredPunches.length === 2) {
    const p2Date = new Date(filteredPunches[1].time);
    const p2BaghdadHour = (p2Date.getUTCHours() + 3) % 24;
    // إذا كانت البصمة الثانية في نهاية الدوام (>= 14:00 في الصباحي) نعتبرها انصرافاً، وإلا فاستراحة
    if (shiftType === 'morning' ? p2BaghdadHour >= 14 : p2BaghdadHour >= 18) {
      setOutData(updates, filteredPunches[1], 'check_out');
    } else {
      setOutData(updates, filteredPunches[1], 'time_leave_out');
    }
  } else if (filteredPunches.length > 2) {
    // البصمة الأخيرة انصراف نهائي
    const lastPunch = filteredPunches[filteredPunches.length - 1];
    setOutData(updates, lastPunch, 'check_out');

    // البصمات الوسطى تُوزع استراحات
    const middlePunches = filteredPunches.slice(1, -1);
    if (middlePunches.length > 0) setOutData(updates, middlePunches[0], 'time_leave_out');
    if (middlePunches.length > 1) setOutData(updates, middlePunches[1], 'time_leave_return');
    if (middlePunches.length > 2) setOutData(updates, middlePunches[2], 'time_leave_out_2');
    if (middlePunches.length > 3) setOutData(updates, middlePunches[3], 'time_leave_return_2');
    if (middlePunches.length > 4) {
      finalNotes = 'يرجى المراجعة , كثير البصمات';
    }
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
