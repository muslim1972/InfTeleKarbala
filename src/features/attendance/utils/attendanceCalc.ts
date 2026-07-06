import { differenceInMinutes, parseISO, isValid, format } from 'date-fns';
import type { AttendanceRecord } from '../types';

export type LiveStatus = 'working' | 'on_break' | 'late' | 'checked_out' | 'absent' | 'not_checked_in';

export function computeWorkedMinutes(record: AttendanceRecord, toTime?: Date): number {
  if (!record.check_in) return 0;
  
  const inTime = parseISO(record.check_in);
  const outTime = record.check_out ? parseISO(record.check_out) : (toTime || new Date());
  
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
    // Currently on break, subtract time from leaveOut to now
    const leaveOut = parseISO(record.time_leave_out);
    if (isValid(leaveOut)) {
      const leaveMins = Math.max(0, differenceInMinutes(toTime || new Date(), leaveOut));
      totalMins = Math.max(0, totalMins - leaveMins);
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
  if (!minutes || minutes <= 0) return '0 دقيقة';
  const h = Math.floor(minutes / 60);
  const m = Math.floor(minutes % 60);
  
  const parts = [];
  if (h > 0) parts.push(`${h}س`);
  if (m > 0) parts.push(`${m}د`);
  
  return parts.join(' و ') || '0 دقيقة';
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
