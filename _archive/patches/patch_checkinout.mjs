import fs from 'fs';

const filePath = 'src/features/attendance/components/AttendanceCheckInOut.tsx';
let content = fs.readFileSync(filePath, 'utf8');

const oldCode = `    const shiftType = determineShiftType(user as any, null);
    if (!hasExistingPunch) {
      if (shiftType === 'morning') {
        const nowServer = getServerNow();
        const bDate = getBaghdadDate(nowServer);
        if (bDate.getHours() < 6) {
          toast.error('الدوام الصباحي يبدأ على أقل تقدير عند الساعة 6:00 صباحاً');
          return;
        }
      } else {
        const earlyCheck = validateEarlyCheckIn(shiftType, getServerNow());
        if (!earlyCheck.allowed) {
          toast.error(earlyCheck.message || 'لا يسمح بتثبيت الحضور قبل 6:30ص');
          return;
        }
      }
    }`;

const newCode = `    // تحديد نوع الدوام بدقة استناداً إلى سياق الدوام المحمل (Roster/Shifts vs Morning)
    const effectiveWorkScheduleId = (user as any)?.work_schedule_id;
    const shiftType = dutyCtx?.shiftType || determineShiftType(
      { work_schedule_id: effectiveWorkScheduleId, work_schedule: (user as any)?.work_schedule },
      null
    );

    if (!hasExistingPunch) {
      if (shiftType === 'morning') {
        const nowServer = getServerNow();
        const bDate = getBaghdadDate(nowServer);
        if (bDate.getHours() < 6) {
          toast.error('الدوام الصباحي يبدأ على أقل تقدير عند الساعة 6:00 صباحاً');
          return;
        }
      } else {
        const earlyCheck = validateEarlyCheckIn(shiftType, getServerNow());
        if (!earlyCheck.allowed) {
          toast.error(earlyCheck.message || 'لا يسمح بتثبيت الحضور قبل 6:30ص');
          return;
        }
      }
    }`;

content = content.replace(oldCode.replace(/\r\n/g, '\n'), newCode);
content = content.replace(oldCode.replace(/\n/g, '\r\n'), newCode);

fs.writeFileSync(filePath, content, 'utf8');
console.log('AttendanceCheckInOut patched cleanly');
