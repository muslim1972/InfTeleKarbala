import fs from 'fs';

const filePath = 'src/features/attendance/services/attendanceService.ts';
let content = fs.readFileSync(filePath, 'utf8');

const oldCode = `    if (isRestDay && shiftType === 'shift' && !record && !bypassLeaveWarning) {
      throw new LeaveDayPunchWarning({
        id: 'rest_day',
        leaveType: 'rest',
        label: 'استراحة',
        warningMessage: 'اليوم هو يوم استراحة في جدول مناوبتك المعتمد'
      });
    }`;

const newCode = `    const nowServer = getServerNow();
    const baghdadNow = getBaghdadDate(nowServer);
    const currentMinutes = baghdadNow.getHours() * 60 + baghdadNow.getMinutes();
    // استثناء ساعات الصباح حتى 09:30 ص إذا كان يوم أمس شفت خفر ليلي (امتداد دوام الأمس وليس استراحة)
    const isYesterdayNightFollowup = Boolean(prevScheduleDay?.is_night) && currentMinutes <= (9 * 60 + 30);

    if (isRestDay && shiftType === 'shift' && !isYesterdayNightFollowup && !record && !bypassLeaveWarning) {
      throw new LeaveDayPunchWarning({
        id: 'rest_day',
        leaveType: 'rest',
        label: 'استراحة',
        warningMessage: 'اليوم هو يوم استراحة في جدول مناوبتك المعتمد'
      });
    }`;

content = content.replace(oldCode.replace(/\r\n/g, '\n'), newCode);
content = content.replace(oldCode.replace(/\n/g, '\r\n'), newCode);

fs.writeFileSync(filePath, content, 'utf8');
console.log('attendanceService patched successfully');
