const fs = require('fs');
let content = fs.readFileSync('src/features/attendance/components/AttendanceCheckInOut.tsx', 'utf-8');

const searchCancel = `  const cancelPunchProcess = useCallback(() => {
    setProcessing(false);
    setCapturingAction(null);
    capturedRef.current = false;
    toast('تم إلغاء عملية تثبيت البصمة', { icon: '🛑' });
  }, []);`;

const replaceCancel = `  const abortPunchRef = useRef(false);
  const cancelPunchProcess = useCallback(() => {
    abortPunchRef.current = true;
    setProcessing(false);
    setCapturingAction(null);
    capturedRef.current = false;
    toast('تم إلغاء عملية تثبيت البصمة', { icon: '🛑' });
  }, []);`;

content = content.replace(searchCancel, replaceCancel);

const searchComplete = `  const completeAction = useCallback(async (currentAction: 'punch', snapshotResult: { url?: string; notes?: string }) => {
    setProcessing(true);
    try {`;

const replaceComplete = `  const completeAction = useCallback(async (currentAction: 'punch', snapshotResult: { url?: string; notes?: string }) => {
    if (abortPunchRef.current) {
        abortPunchRef.current = false;
        return;
    }
    setProcessing(true);
    try {`;

content = content.replace(searchComplete, replaceComplete);

fs.writeFileSync('src/features/attendance/components/AttendanceCheckInOut.tsx', content, 'utf-8');
console.log("Patched cancel button");
