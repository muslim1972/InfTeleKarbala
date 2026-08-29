import { differenceInMinutes, parseISO, isValid, format } from 'date-fns';
import type { AttendanceRecord } from '../types';
import type { ShiftType } from './shiftRules';

export type LiveStatus = 'working' | 'on_break' | 'late' | 'checked_out' | 'absent' | 'not_checked_in';

/**
 * حساب دقائق العمل الفعلية مع خصم الإجازات الزمنية
 */
export function computeWorkedMinutes(
  record: AttendanceRecord,
  toTime?: Date,
  expectedCheckout?: string,
  shiftType: ShiftType = 'morning'
): number {
  if (!record.check_in) return 0;
  
  const inTime = parseISO(record.check_in);
  let outTime = record.check_out ? parseISO(record.check_out) : (toTime || new Date());
  
  // في الأيام السابقة أو عند انتهاء اليوم بدون بصمة خروج
  if (!record.check_out) {
    const isToday = inTime.toDateString() === new Date().toDateString();
    if (!isToday) {
      const defaultOut = new Date(inTime);
      if (shiftType === 'shift') {
        defaultOut.setHours(23, 59, 0, 0);
      } else if (expectedCheckout) {
        const [hh, mm] = expectedCheckout.split(':').map(Number);
        defaultOut.setHours(hh, mm, 0, 0);
      } else {
        defaultOut.setHours(15, 0, 0, 0);
      }
      outTime = defaultOut;
    }
  }
  
  if (!isValid(inTime) || !isValid(outTime)) return 0;

  let totalMins = Math.max(0, differenceInMinutes(outTime, inTime));

  // خصم فترات الإجازة الزمنية الأولى
  if (record.time_leave_out && record.time_leave_return) {
    const leaveOut = parseISO(record.time_leave_out);
    const leaveReturn = parseISO(record.time_leave_return);
    if (isValid(leaveOut) && isValid(leaveReturn)) {
      const leaveMins = Math.max(0, differenceInMinutes(leaveReturn, leaveOut));
      totalMins = Math.max(0, totalMins - leaveMins);
    }
  } else if (record.time_leave_out && !record.time_leave_return && !record.check_out) {
    const leaveOut = parseISO(record.time_leave_out);
    if (isValid(leaveOut)) {
      const leaveMins = Math.max(0, differenceInMinutes(toTime || new Date(), leaveOut));
      totalMins = Math.max(0, totalMins - leaveMins);
    }
  }

  // خصم فترات الإجازة الزمنية الثانية
  if (record.time_leave_out_2 && record.time_leave_return_2) {
    const leaveOut2 = parseISO(record.time_leave_out_2);
    const leaveReturn2 = parseISO(record.time_leave_return_2);
    if (isValid(leaveOut2) && isValid(leaveReturn2)) {
      const leaveMins2 = Math.max(0, differenceInMinutes(leaveReturn2, leaveOut2));
      totalMins = Math.max(0, totalMins - leaveMins2);
    }
  } else if (record.time_leave_out_2 && !record.time_leave_return_2 && !record.check_out) {
    const leaveOut2 = parseISO(record.time_leave_out_2);
    if (isValid(leaveOut2)) {
      const leaveMins2 = Math.max(0, differenceInMinutes(toTime || new Date(), leaveOut2));
      totalMins = Math.max(0, totalMins - leaveMins2);
    }
  }

  return totalMins;
}

export function deriveLiveStatus(record: AttendanceRecord | null): LiveStatus {
  if (!record || !record.check_in) return 'not_checked_in';
  if (record.check_out) return 'checked_out';
  if (record.time_leave_out && !record.time_leave_return) return 'on_break';
  if (record.status === 'late') return 'late';
  return 'working';
}

export function formatDurationArabic(minutes: number): string {
  if (!minutes || minutes <= 0) return '0.00';
  const h = Math.floor(minutes / 60);
  const m = Math.floor(minutes % 60);
  return `${h}.${m.toString().padStart(2, '0')}`;
}

export function formatDurationDot(minutes: number): string {
  return formatDurationArabic(minutes);
}

// Compute if late based on schedule and shift type
export function computeLateMinutes(
  checkIn: string | undefined, 
  scheduleStart: string | undefined, 
  gracePeriod: number = 0
): number {
  if (!checkIn || !scheduleStart) return 0;
  
  const checkInDate = parseISO(checkIn);
  if (!isValid(checkInDate)) return 0;
  
  const expectedStartStr = `${format(checkInDate, 'yyyy-MM-dd')}T${scheduleStart}`;
  const expectedStartDate = parseISO(expectedStartStr);
  if (!isValid(expectedStartDate)) return 0;

  let effectiveGrace = gracePeriod;
  if (scheduleStart === '08:00') {
    effectiveGrace = Math.max(gracePeriod, 30);
  } else if (scheduleStart === '14:30' || scheduleStart === '20:00') {
    effectiveGrace = 0; // Strict handover time
  }

  const diff = differenceInMinutes(checkInDate, expectedStartDate);
  if (diff > effectiveGrace) {
    return diff;
  }
  return 0;
}

export function computeDeficitMinutes(
  record: AttendanceRecord,
  scheduleStart: string | undefined,
  scheduleEnd: string | undefined,
  gracePeriod: number = 0
): number {
  if (!scheduleStart || !scheduleEnd || !record.check_in) return 0;
  
  let deficit = 0;
  
  const checkInDate = parseISO(record.check_in);
  if (isValid(checkInDate)) {
    const expectedStartStr = `${format(checkInDate, 'yyyy-MM-dd')}T${scheduleStart}`;
    const expectedStartDate = parseISO(expectedStartStr);
    if (isValid(expectedStartDate)) {
      let effectiveGrace = gracePeriod;
      if (scheduleStart === '08:00') {
        effectiveGrace = Math.max(gracePeriod, 30);
      } else if (scheduleStart === '14:30' || scheduleStart === '20:00') {
        effectiveGrace = 0;
      }
      
      const lateMins = differenceInMinutes(checkInDate, expectedStartDate);
      if (lateMins > effectiveGrace) deficit += lateMins;
    }
  }

  if (record.check_out) {
    const checkOutDate = parseISO(record.check_out);
    if (isValid(checkOutDate)) {
      let effectiveEnd = scheduleEnd;
      if (scheduleEnd === '15:00' && scheduleStart === '08:00') {
        effectiveEnd = '14:30';
      }

      const expectedEndStr = `${format(checkOutDate, 'yyyy-MM-dd')}T${effectiveEnd}`;
      const expectedEndDate = parseISO(expectedEndStr);
      if (isValid(expectedEndDate)) {
        const earlyMins = differenceInMinutes(expectedEndDate, checkOutDate);
        if (earlyMins > 0) deficit += earlyMins;
      }
    }
  }
  
  return deficit;
}

/**
 * احتساب ساعات العمل الإضافية (Overtime)
 * للدوام الصباحي: الساعات بعد 15:00م تُحسب كساعات إضافية (ما لم تكن بصمة افتراضية)
 */
export function computeOvertimeMinutes(
  record: AttendanceRecord,
  scheduleStart: string | undefined,
  scheduleEnd: string | undefined,
  shiftType: ShiftType = 'morning'
): number {
  if (record.overtime_minutes) return record.overtime_minutes;
  if (!record.check_in || !record.check_out) return 0;
  
  // إذا كان الموظف مناوباً، ساعات العمل تسجل كساعات طبيعية
  if (shiftType === 'shift') {
    return 0;
  }

  // إذا كان خروج افتراضي مغلق عند 15:00، لا يوجد إضافي
  if (record.notes?.includes('خروج نهائي افتراضي')) {
    return 0;
  }

  const checkOutDate = parseISO(record.check_out);
  if (!isValid(checkOutDate)) return 0;

  const effectiveEnd = scheduleEnd || '15:00';
  const expectedEndStr = `${format(checkOutDate, 'yyyy-MM-dd')}T${effectiveEnd}`;
  const expectedEndDate = parseISO(expectedEndStr);
  
  if (isValid(expectedEndDate)) {
    const overtimeMins = differenceInMinutes(checkOutDate, expectedEndDate);
    if (overtimeMins > 0) return overtimeMins;
  }
  
  return 0;
}
