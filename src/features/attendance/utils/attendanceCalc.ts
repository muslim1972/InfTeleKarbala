import { differenceInMinutes, parseISO, isValid, format } from 'date-fns';
import type { AttendanceRecord } from '../types';

export type LiveStatus = 'working' | 'on_break' | 'late' | 'checked_out' | 'absent' | 'not_checked_in';

export function computeWorkedMinutes(record: AttendanceRecord, toTime?: Date, expectedCheckout?: string): number {
  if (!record.check_in) return 0;
  
  const inTime = parseISO(record.check_in);
  let outTime = record.check_out ? parseISO(record.check_out) : (toTime || new Date());
  
  // Cap at expectedCheckout or 15:00 for past days without checkout
  if (!record.check_out) {
    const isToday = inTime.toDateString() === new Date().toDateString();
    if (!isToday) {
      const defaultOut = new Date(inTime);
      if (expectedCheckout) {
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

  if (record.time_leave_out && record.time_leave_return) {
    const leaveOut = parseISO(record.time_leave_out);
    const leaveReturn = parseISO(record.time_leave_return);
    if (isValid(leaveOut) && isValid(leaveReturn)) {
      const leaveMins = Math.max(0, differenceInMinutes(leaveReturn, leaveOut));
      totalMins = Math.max(0, totalMins - leaveMins);
    }
  } else if (record.time_leave_out && !record.time_leave_return && !record.check_out) {
    // Currently on break 1, subtract time from leaveOut to now
    const leaveOut = parseISO(record.time_leave_out);
    if (isValid(leaveOut)) {
      const leaveMins = Math.max(0, differenceInMinutes(toTime || new Date(), leaveOut));
      totalMins = Math.max(0, totalMins - leaveMins);
    }
  }

  if (record.time_leave_out_2 && record.time_leave_return_2) {
    const leaveOut2 = parseISO(record.time_leave_out_2);
    const leaveReturn2 = parseISO(record.time_leave_return_2);
    if (isValid(leaveOut2) && isValid(leaveReturn2)) {
      const leaveMins2 = Math.max(0, differenceInMinutes(leaveReturn2, leaveOut2));
      totalMins = Math.max(0, totalMins - leaveMins2);
    }
  } else if (record.time_leave_out_2 && !record.time_leave_return_2 && !record.check_out) {
    // Currently on break 2, subtract time from leaveOut2 to now
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

// Compute if late based on schedule (simple check for timesheets)
export function computeLateMinutes(checkIn: string | undefined, scheduleStart: string | undefined, gracePeriod: number = 0): number {
  if (!checkIn || !scheduleStart) return 0;
  
  const checkInDate = parseISO(checkIn);
  if (!isValid(checkInDate)) return 0;
  
  // Create a schedule start date on the same day as checkIn
  const expectedStartStr = `${format(checkInDate, 'yyyy-MM-dd')}T${scheduleStart}`;
  const expectedStartDate = parseISO(expectedStartStr);
  
  if (!isValid(expectedStartDate)) return 0;
  
  const diff = differenceInMinutes(checkInDate, expectedStartDate);
  if (diff > gracePeriod) {
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
      const lateMins = differenceInMinutes(checkInDate, expectedStartDate);
      if (lateMins > gracePeriod) deficit += lateMins;
    }
  }

  if (record.check_out) {
    const checkOutDate = parseISO(record.check_out);
    if (isValid(checkOutDate)) {
      const expectedEndStr = `${format(checkOutDate, 'yyyy-MM-dd')}T${scheduleEnd}`;
      const expectedEndDate = parseISO(expectedEndStr);
      if (isValid(expectedEndDate)) {
        const earlyMins = differenceInMinutes(expectedEndDate, checkOutDate);
        if (earlyMins > 0) deficit += earlyMins;
      }
    }
  }
  
  return deficit;
}

export function computeOvertimeMinutes(
  record: AttendanceRecord,
  scheduleStart: string | undefined,
  scheduleEnd: string | undefined
): number {
  if (record.overtime_minutes) return record.overtime_minutes; // Explicit admin override
  if (!scheduleStart || !scheduleEnd || !record.check_in) return 0;
  
  let overtime = 0;
  
  const checkInDate = parseISO(record.check_in);
  if (isValid(checkInDate)) {
    const expectedStartStr = `${format(checkInDate, 'yyyy-MM-dd')}T${scheduleStart}`;
    const expectedStartDate = parseISO(expectedStartStr);
    if (isValid(expectedStartDate)) {
      const earlyMins = differenceInMinutes(expectedStartDate, checkInDate);
      if (earlyMins > 0) overtime += earlyMins;
    }
  }

  if (record.check_out) {
    const checkOutDate = parseISO(record.check_out);
    if (isValid(checkOutDate)) {
      const expectedEndStr = `${format(checkOutDate, 'yyyy-MM-dd')}T${scheduleEnd}`;
      const expectedEndDate = parseISO(expectedEndStr);
      if (isValid(expectedEndDate)) {
        const lateMins = differenceInMinutes(checkOutDate, expectedEndDate);
        if (lateMins > 0) overtime += lateMins;
      }
    }
  }
  
  return overtime;
}
