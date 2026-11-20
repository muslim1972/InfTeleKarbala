import fs from 'fs';

const filePath = 'src/features/attendance/services/attendanceService.ts';
let content = fs.readFileSync(filePath, 'utf8');

content = content.replace(
  'const nowServer = getServerNow();\n    const baghdadNow = getBaghdadDate(nowServer);',
  'const nowServerCurrent = getServerNow();\n    const baghdadNow = getBaghdadDate(nowServerCurrent);'
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Fixed variable shadowing in attendanceService');
