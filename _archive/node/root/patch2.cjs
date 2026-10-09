const fs = require('fs');
let content = fs.readFileSync('src/features/attendance/services/leaveIntegrationService.ts', 'utf-8');

const search = `export interface TimeLeaveInfo {
  id: string;
  leaveType: 'time_off';
  /** mid_shift | shift_start | shift_end | null */
  subtype: string | null;
  minutes: number;
}`;

const replace = `export interface TimeLeaveInfo {
  id: string;
  leaveType: 'time_off';
  /** mid_shift | shift_start | shift_end | null */
  subtype: string | null;
  minutes: number;
  reason?: string | null;
}`;

content = content.replace(search, replace);

fs.writeFileSync('src/features/attendance/services/leaveIntegrationService.ts', content, 'utf-8');
console.log("Patched TimeLeaveInfo type");
