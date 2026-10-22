import fs from 'fs';

const filePath = 'src/features/attendance/components/Timesheets.tsx';
let content = fs.readFileSync(filePath, 'utf8');

const isCrlf = content.includes('\r\n');
const lines = content.replace(/\r\n/g, '\n').split('\n');

// Lines 423 to 436 (index 422 to 435)
const startIndex = 422; // "                   const dateStrKey..."
const endIndex = 436; // "                   if (rec.status === 'late'..."

console.log('Replacing from line', startIndex + 1, ':', lines[startIndex]);
console.log('To line', endIndex + 1, ':', lines[endIndex]);

const newLines = [
  "                   const dateStrKey = format(currentDateObj, 'yyyy-MM-dd');",
  "                   const dayLeave = (dayLeavesByEmp[group.employee.id] || []).find(l => coversDate(l, dateStrKey));",
  "                   if (dayLeave) {",
  "                     rec.dayLeave = dayLeave;",
  "                     rec.leaveLabel = LEAVE_TYPE_LABELS[dayLeave.leave_type] || 'إجازة';",
  "                     if (dayLeave.is_mandatory || dayLeave.reason?.includes('إجازة اعتيادية إجبارية')) {",
  "                       rec.status = 'leave';",
  "                     }",
  "                     group.leaveCount++;",
  "                   }",
  "",
  "                   const timeLeaves = (timeLeavesByEmp[group.employee.id] || []).filter(l => coversDate(l, dateStrKey) && (l as any).status !== 'canceled' && (l.time_duration_minutes || 0) > 0);",
  "                   if (timeLeaves.length > 0) {",
  "                       const totalTimeOffMins = timeLeaves.reduce((sum, l) => sum + (l.time_duration_minutes || 0), 0);",
  "                       if (totalTimeOffMins > 0) {",
  "                         defMins = Math.max(0, defMins - totalTimeOffMins);",
  "                         const timeOffNote = `(إجازة زمنية: ${totalTimeOffMins} دقيقة)`;",
  "                         if (!rec.notes) rec.notes = timeOffNote;",
  "                         else if (!rec.notes.includes('إجازة زمنية')) rec.notes += ' | ' + timeOffNote;",
  "                       }",
  "                   }",
  "",
  "                   group.totalWorkMins += netMins;",
  "                   group.totalDeficit += defMins;",
  "                   group.totalOvertime += ovtMins;",
  "                   if (rec.status === 'late' && !isRestOrHoliday && !dayLeave?.is_mandatory) group.lateCount++;"
];

lines.splice(startIndex, endIndex - startIndex + 1, ...newLines);

let updated = lines.join('\n');
if (isCrlf) {
  updated = updated.replace(/\n/g, '\r\n');
}

fs.writeFileSync(filePath, updated, 'utf8');
console.log('SUCCESS: Timesheets.tsx successfully patched by line splice!');
