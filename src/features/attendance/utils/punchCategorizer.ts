import type { AttendanceRecord } from '../types';

export interface RawPunch {
  time: string;
  location?: string;
  device_id?: string;
  snapshot_url?: string;
  notes?: string;
  verified_by_biometric?: boolean;
}

/**
 * Parses the raw punches, applies the 3-minute debounce, categorizes them up to 6 punches,
 * and handles the special night-shift logic.
 */
export function categorizePunches(
  rawPunches: RawPunch[],
  yesterdayRecord?: AttendanceRecord,
  todayDateStr?: string // YYYY-MM-DD
): Partial<AttendanceRecord> {
  if (!rawPunches || rawPunches.length === 0) return {};

  // 1. Sort punches by time
  const sortedPunches = [...rawPunches].sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

  // 2. Debounce (3 minutes)
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
    // A group of punches from i to j-1
    if (filteredPunches.length % 2 === 0) {
      // It's an IN punch -> take the earliest
      filteredPunches.push(sortedPunches[i]);
    } else {
      // It's an OUT punch -> take the latest
      filteredPunches.push(sortedPunches[j - 1]);
    }
    i = j;
  }

  let finalNotes = '';

  // 3. Handle excessive punches
  if (filteredPunches.length === 7) {
    filteredPunches.splice(5, 1); // delete the 6th
  } else if (filteredPunches.length >= 8) {
    // delete from the 6th up to the second to last
    filteredPunches.splice(5, filteredPunches.length - 6);
    finalNotes = 'يرجى المراجعة , كثير البصمات';
  }

  const updates: any = {
    check_in: null,
    time_leave_out: null,
    time_leave_return: null,
    time_leave_out_2: null,
    time_leave_return_2: null,
    check_out: null,
    check_out_location: null,
    check_out_device_id: null,
    check_out_snapshot_url: null,
    check_out_verified_by_biometric: null,
  };

  // 4. Special case: 1 punch + Night shift check
  if (filteredPunches.length === 1) {
    const punch = filteredPunches[0];
    const missedOutYesterday = yesterdayRecord?.check_in && !yesterdayRecord?.check_out;
    
    if (missedOutYesterday && todayDateStr) {
      updates.check_out = punch.time;
      updates.check_out_location = punch.location;
      updates.check_out_device_id = punch.device_id;
      updates.check_out_snapshot_url = punch.snapshot_url;
      updates.check_out_verified_by_biometric = punch.verified_by_biometric;
      
      updates.check_in = `${todayDateStr}T00:01:00.000Z`;
      const fakeInNote = 'دخول تلقائي (مكمل لخفر الأمس)';
      updates.notes = finalNotes ? `${finalNotes} | ${fakeInNote}` : fakeInNote;
      return updates;
    }
  }

  // 5. Normal Mapping for 1 to 6 punches
  if (filteredPunches.length > 0) {
    updates.check_in = filteredPunches[0].time;
    updates.check_in_location = filteredPunches[0].location;
    updates.check_in_device_id = filteredPunches[0].device_id;
    updates.check_in_snapshot_url = filteredPunches[0].snapshot_url;
    updates.check_in_verified_by_biometric = filteredPunches[0].verified_by_biometric;
  }

  if (filteredPunches.length > 1) {
    if (filteredPunches.length === 2) {
      // 2nd is OUT
      setOutData(updates, filteredPunches[1], 'check_out');
    } else {
      // 2nd is Break 1 OUT
      setOutData(updates, filteredPunches[1], 'time_leave_out');
    }
  }

  if (filteredPunches.length > 2) {
    // 3rd is Break 1 IN
    setOutData(updates, filteredPunches[2], 'time_leave_return');
  }

  if (filteredPunches.length > 3) {
    if (filteredPunches.length === 4) {
      // 4th is OUT
      setOutData(updates, filteredPunches[3], 'check_out');
    } else {
      // 4th is Break 2 OUT
      setOutData(updates, filteredPunches[3], 'time_leave_out_2');
    }
  }

  if (filteredPunches.length > 4) {
    // 5th is Break 2 IN
    setOutData(updates, filteredPunches[4], 'time_leave_return_2');
  }

  if (filteredPunches.length > 5) {
    // 6th is OUT
    setOutData(updates, filteredPunches[5], 'check_out');
  }

  if (finalNotes) {
    updates.notes = finalNotes;
  }

  return updates;
}

function setOutData(updates: any, punch: RawPunch, keyPrefix: string) {
  updates[keyPrefix] = punch.time;
  // If it's check_out, we also set the other fields
  if (keyPrefix === 'check_out') {
    updates.check_out_location = punch.location;
    updates.check_out_device_id = punch.device_id;
    updates.check_out_snapshot_url = punch.snapshot_url;
    updates.check_out_verified_by_biometric = punch.verified_by_biometric;
  }
}
