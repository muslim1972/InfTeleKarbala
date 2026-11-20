import fs from 'fs';

const filePath = 'src/features/attendance/utils/shiftRules.ts';
let content = fs.readFileSync(filePath, 'utf8');

const oldCode = `export function determineShiftType(
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
}`;

const newCode = `export function determineShiftType(
  profile?: { work_schedule_id?: string | null; work_schedule?: any; work_schedules?: any } | null,
  workSchedule?: { id?: string; name?: string; type?: string; is_default?: boolean } | null
): ShiftType {
  if (!profile?.work_schedule_id) {
    return 'morning';
  }

  const sched = workSchedule || (profile as any)?.work_schedule || (profile as any)?.work_schedules;
  if (sched) {
    if (sched.is_default) return 'morning';
    const name = (sched.name || '').toLowerCase();
    const type = (sched.type || '').toLowerCase();
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
    return 'morning';
  }

  // إذا كان للموظف work_schedule_id مخصص ولم يتوفر كائن الجدول بعد في الذاكرة،
  // نفترض احترازياً 'shift' لمنع الحظر التعسفي الصباحي (قبل 6:00 ص)
  return 'shift';
}`;

content = content.replace(oldCode.replace(/\r\n/g, '\n'), newCode);
content = content.replace(oldCode.replace(/\n/g, '\r\n'), newCode);

fs.writeFileSync(filePath, content, 'utf8');
console.log('shiftRules patched cleanly');
