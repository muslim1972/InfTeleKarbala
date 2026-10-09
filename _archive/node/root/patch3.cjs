const fs = require('fs');
let content = fs.readFileSync('src/features/attendance/components/AttendanceCheckInOut.tsx', 'utf-8');

const search = `      if (freshCtx.timeLeaves.length > 0 && !hasAcknowledgedTimeOffRef.current) {
        setPendingTimeOffWarning(true);
        return;
      }`;

const replace = `      if (freshCtx.timeLeaves.length > 0 && !hasAcknowledgedTimeOffRef.current) {
        const now = getServerNow();
        let bypassWarning = false;

        for (const l of freshCtx.timeLeaves) {
            const outMatch = l.reason?.match(/ساعة الخروج:\\s*(\\d{2}:\\d{2})/);
            const returnMatch = l.reason?.match(/ساعة العودة:\\s*(\\d{2}:\\d{2})/);
            
            if (outMatch) {
                const [h, m] = outMatch[1].split(':').map(Number);
                const outTime = new Date(now);
                outTime.setHours(h, m, 0, 0);
                if (Math.abs(now.getTime() - outTime.getTime()) <= 5 * 60000) {
                    bypassWarning = true;
                    break;
                }
            }
            if (returnMatch) {
                const [h, m] = returnMatch[1].split(':').map(Number);
                const retTime = new Date(now);
                retTime.setHours(h, m, 0, 0);
                if (Math.abs(now.getTime() - retTime.getTime()) <= 5 * 60000) {
                    bypassWarning = true;
                    break;
                }
            }
        }
        
        if (!bypassWarning) {
            setPendingTimeOffWarning(true);
            return;
        } else {
            hasAcknowledgedTimeOffRef.current = true;
        }
      }`;

content = content.replace(search, replace);
fs.writeFileSync('src/features/attendance/components/AttendanceCheckInOut.tsx', content, 'utf-8');
console.log("Patched AttendanceCheckInOut");
