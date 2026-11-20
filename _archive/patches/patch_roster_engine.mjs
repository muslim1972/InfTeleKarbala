import fs from 'fs';

const filePath = 'src/features/attendance/engines/rosterAttendanceEngine.ts';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Update resolveRosterShiftType to handle connected_night_morning
const oldResolve = `export function resolveRosterShiftType(
  schedule: RosterDaySchedule,
  _prevDaySchedule?: { is_night: boolean }
): RosterShiftType {
  if (schedule.is_rest_day || (!schedule.is_morning && !schedule.is_evening && !schedule.is_night)) {
    return 'rest';
  }`;

const newResolve = `export function resolveRosterShiftType(
  schedule: RosterDaySchedule,
  prevDaySchedule?: { is_night: boolean },
  hasPunches: boolean = false
): RosterShiftType {
  if (schedule.is_rest_day || (!schedule.is_morning && !schedule.is_evening && !schedule.is_night)) {
    if (prevDaySchedule?.is_night && hasPunches) {
      return 'connected_night_morning';
    }
    return 'rest';
  }`;

content = content.replace(oldResolve.replace(/\r\n/g, '\n'), newResolve);
content = content.replace(oldResolve.replace(/\n/g, '\r\n'), newResolve);

// 2. In evaluateRosterAttendance call resolveRosterShiftType with hasPunches
const oldCall = `  const shiftType = resolveRosterShiftType(schedule, prevDaySchedule);`;
const newCall = `  const hasAnyRealPunches = (rawPunchesInput || []).some(p => !p.is_virtual && !p.notes?.includes('افتراضي'));
  const shiftType = resolveRosterShiftType(schedule, prevDaySchedule, hasAnyRealPunches);`;

content = content.replace(oldCall.replace(/\r\n/g, '\n'), newCall);
content = content.replace(oldCall.replace(/\n/g, '\r\n'), newCall);

// 3. In checkOutWindow
const oldWindow = `    case 'connected_evening_night':
      // نهاية النوبة الممتدة صباح اليوم التالي (07:30 - 09:30)
      checkOutWindowStartMins = 7 * 60 + 30;
      checkOutWindowEndMins = 9 * 60 + 30;
      break;`;

const newWindow = `    case 'connected_evening_night':
    case 'connected_night_morning':
      // نهاية النوبة الممتدة صباح اليوم التالي (07:30 - 09:30)
      checkOutWindowStartMins = 7 * 60 + 30;
      checkOutWindowEndMins = 9 * 60 + 30;
      break;`;

content = content.replace(oldWindow.replace(/\r\n/g, '\n'), newWindow);
content = content.replace(oldWindow.replace(/\n/g, '\r\n'), newWindow);

// 4. In slot assignment
const oldSlots = `  if (filteredPunches.length > 0) {
    // الخانة 1: الدخول الرئيسي (أول بصمة مقبولة)
    const firstPunch = filteredPunches[0];
    slots.check_in = firstPunch.time;`;

const newSlots = `  if (filteredPunches.length > 0) {
    if (shiftType === 'connected_night_morning') {
      // في يوم استكمال الخفارة الممتدة صباحاً: البصمة الصباحية هي بصمة انصراف نهاية الخفارة
      const lastPunch = filteredPunches[filteredPunches.length - 1];
      slots.check_out = lastPunch.time;
      slots.check_out_location = lastPunch.location;
      slots.check_out_device_id = lastPunch.device_id;
      slots.check_out_snapshot_url = lastPunch.snapshot_url;
      slots.check_out_verified_by_biometric = lastPunch.verified_by_biometric;
      if (filteredPunches.length > 1) {
        slots.time_leave_out = filteredPunches[0].time;
      }
    } else {
    // الخانة 1: الدخول الرئيسي (أول بصمة مقبولة)
    const firstPunch = filteredPunches[0];
    slots.check_in = firstPunch.time;`;

content = content.replace(oldSlots.replace(/\r\n/g, '\n'), newSlots);
content = content.replace(oldSlots.replace(/\n/g, '\r\n'), newSlots);

// Close the else block
const oldLoop = `        // نبضة تواجد بينية (Presence Heartbeat)
        heartbeats.push(punch);
      }
    }
  }`;

const newLoop = `        // نبضة تواجد بينية (Presence Heartbeat)
        heartbeats.push(punch);
      }
    }
    }
  }`;

content = content.replace(oldLoop.replace(/\r\n/g, '\n'), newLoop);
content = content.replace(oldLoop.replace(/\n/g, '\r\n'), newLoop);

// 5. In status and notes
const oldStatus = `  if (!slots.check_in) {
    status = 'absent';
    notes = 'غياب — لم تُسجل بصمة حضور للشفت';
  } else {`;

const newStatus = `  if (shiftType === 'connected_night_morning') {
    status = 'present';
    notes = 'انصراف خفارة ممتدة (امتداد شفت ليلة الأمس)';
  } else if (!slots.check_in) {
    status = 'absent';
    notes = 'غياب — لم تُسجل بصمة حضور للشفت';
  } else {`;

content = content.replace(oldStatus.replace(/\r\n/g, '\n'), newStatus);
content = content.replace(oldStatus.replace(/\n/g, '\r\n'), newStatus);

fs.writeFileSync(filePath, content, 'utf8');
console.log('rosterAttendanceEngine patched successfully');
