import fs from 'fs';

const filePath = 'src/features/attendance/components/Timesheets.tsx';
let content = fs.readFileSync(filePath, 'utf8');

const isCrlf = content.includes('\r\n');
let lines = content.replace(/\r\n/g, '\n').split('\n');

// Insert "} else {" before line 449 (index 448)
lines.splice(448, 0, "               } else {");

let updated = lines.join('\n');
if (isCrlf) updated = updated.replace(/\n/g, '\r\n');

fs.writeFileSync(filePath, updated, 'utf8');
console.log('Fixed: inserted } else { at index 448');
