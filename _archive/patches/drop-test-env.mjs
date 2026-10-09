import fs from 'fs';
const rep = (s, a, b, all = false) => {
  if (!s.includes(a)) throw new Error('missing: ' + a.slice(0, 80));
  return all ? s.split(a).join(b) : s.replace(a, b);
};
// ---- AttendanceCheckInOut ----
let p = 'src/features/attendance/components/AttendanceCheckInOut.tsx';
let s = fs.readFileSync(p, 'utf8');
const NL = s.includes('\r\n') ? '\r\n' : '\n';
s = s.split('\r\n').join('\n');
s = rep(s, "import { useTestEnvironment } from '../utils/testEnvironment';\n", '');
s = rep(s, /\n[ \t]*const \{ isTest, canResetPunches, resetPunches \} = useTestEnvironment\(\);/.source ? s.match(/\n[ \t]*const \{ isTest, canResetPunches, resetPunches \} = useTestEnvironment\(\);/)[0] : '', '');
s = rep(s, s.match(/\n[ \t]*const \[cooldownBypassed, setCooldownBypassed\] = useState\(false\);/)[0], '');
s = rep(s, 'if (!lastPunchTime || cooldownBypassed) return 0;', 'if (!lastPunchTime) return 0;');
s = rep(s, '[lastPunchTime, nowTick, cooldownBypassed]', '[lastPunchTime, nowTick]');
s = s.replace(/\n[ \t]*setCooldownBypassed\(false\);/g, '');
s = rep(s, '!isTest && hasExistingPunches', 'hasExistingPunches');
s = rep(s, ' && !isTest', '', true);
s = rep(s, '}, [employeeId, isTest]);', '}, [employeeId]);');
// geofence bypass block
s = s.replace(/\n[ \t]*if \(isTest\) \{\n[ \t]*setIsAllowed\(true\);[\s\S]*?return true;\n[ \t]*\}\n/, '\n');
// test env controls JSX
s = s.replace(/[ \t]*\{\/\* =+ Test Environment Controls =+ \*\/\}\n[ \t]*\{isTest && \([\s\S]*?<\/motion\.div>\n[ \t]*\)\}\n\n/, '');
// cooldown bypass button
s = s.replace(/\n[ \t]*\{isTest && \(\n[ \t]*<button\n[ \t]*type="button"\n[ \t]*onClick=\{\(\) => setCooldownBypassed\(true\)\}[\s\S]*?<\/button>\n[ \t]*\)\}/, '');
if (!/<Eraser/.test(s)) s = rep(s, ' Eraser,', '');
fs.writeFileSync(p, s.split('\n').join(NL));
// ---- TimeOffRequestForm ----
p = 'src/features/requests/components/TimeOffRequestForm.tsx';
s = fs.readFileSync(p, 'utf8');
const NL2 = s.includes('\r\n') ? '\r\n' : '\n';
s = s.split('\r\n').join('\n');
s = rep(s, "import { useTestEnvironment } from '../../attendance/utils/testEnvironment';\n", '');
s = rep(s, s.match(/\n[ \t]*const \{ isTest \} = useTestEnvironment\(\);/)[0], '');
s = rep(s, ' && !isTest', '', true);
s = rep(s, 'todayStr, isTest, effectiveLeaveTime', 'todayStr, effectiveLeaveTime');
s = s.replace(/<div className=\{`p-3 rounded-xl border text-sm space-y-1\.5 \$\{\n[ \t]*isTest\n[ \t]*\? '[^']*'\n[ \t]*: '([^']*)'\n[ \t]*\}`\}>/, (m, c) => `<div className="p-3 rounded-xl border text-sm space-y-1.5 ${c}">`);
s = s.replace(/<p className=\{`font-bold mb-1 \$\{isTest \? '[^']*' : ''\}`\}>/, '<p className="font-bold mb-1">');
s = s.replace(/\{isTest \? '[^']*' : ('النظام يعترض على ما يلي:')\}/, '$1');
s = s.replace(/\n[ \t]*\{isTest && \(\n[ \t]*<p className="mt-1\.5[\s\S]*?<\/p>\n[ \t]*\)\}/, '');
fs.writeFileSync(p, s.split('\n').join(NL2));
console.log('ok');
