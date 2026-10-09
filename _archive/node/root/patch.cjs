const fs = require('fs');
let content = fs.readFileSync('src/features/attendance/components/Timesheets.tsx', 'utf-8');

const search1 = /const dayLeavesByEmp: Record<string, LeaveRequestLite\[\]> = \{\};\s*monthLeaves\.forEach\(l => \{\s*if \(!DAY_LEAVE_TYPES\.includes\(l\.leave_type\)\) return;\s*if \(!dayLeavesByEmp\[l\.user_id\]\) dayLeavesByEmp\[l\.user_id\] = \[\];\s*dayLeavesByEmp\[l\.user_id\]\.push\(l\);\s*\}\);/;

const replace1 = `const dayLeavesByEmp: Record<string, LeaveRequestLite[]> = {};
    const timeLeavesByEmp: Record<string, LeaveRequestLite[]> = {};
    monthLeaves.forEach(l => {
      if (DAY_LEAVE_TYPES.includes(l.leave_type)) {
        if (!dayLeavesByEmp[l.user_id]) dayLeavesByEmp[l.user_id] = [];
        dayLeavesByEmp[l.user_id].push(l);
      } else if (l.leave_type === 'time_off') {
        if (!timeLeavesByEmp[l.user_id]) timeLeavesByEmp[l.user_id] = [];
        timeLeavesByEmp[l.user_id].push(l);
      }
    });`;

content = content.replace(search1, replace1);

const search2 = /const defMins = computeDeficitMinutes\(rec, shiftInfo\.expectedIn, shiftInfo\.expectedOut\);\s*const ovtMins = computeOvertimeMinutes\(rec, shiftInfo\.expectedIn, shiftInfo\.expectedOut\);\s*group\.totalWorkMins \+= netMins;\s*group\.totalDeficit \+= defMins;\s*group\.totalOvertime \+= ovtMins;/;

const replace2 = `let defMins = computeDeficitMinutes(rec, shiftInfo.expectedIn, shiftInfo.expectedOut);
                    const ovtMins = computeOvertimeMinutes(rec, shiftInfo.expectedIn, shiftInfo.expectedOut);

                    const dateStrKey = format(currentDateObj, 'yyyy-MM-dd');
                    const timeLeaves = (timeLeavesByEmp[group.employee.id] || []).filter(l => coversDate(l, dateStrKey));
                    if (timeLeaves.length > 0) {
                        const totalTimeOffMins = timeLeaves.reduce((sum, l) => sum + (l.time_duration_minutes || 0), 0);
                        defMins = Math.max(0, defMins - totalTimeOffMins);
                        const timeOffNote = \`(إجازة زمنية: \${totalTimeOffMins} دقيقة)\`;
                        if (!rec.notes) rec.notes = timeOffNote;
                        else if (!rec.notes.includes('إجازة زمنية')) rec.notes += ' | ' + timeOffNote;
                    }

                    group.totalWorkMins += netMins;
                    group.totalDeficit += defMins;
                    group.totalOvertime += ovtMins;`;

content = content.replace(search2, replace2);

fs.writeFileSync('src/features/attendance/components/Timesheets.tsx', content, 'utf-8');
console.log("Replaced");
