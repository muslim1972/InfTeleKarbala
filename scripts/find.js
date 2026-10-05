import fs from 'fs';
const content = fs.readFileSync('D:/InfTeleKarbala/src/components/features/AppNotifications.tsx', 'utf8');
const lines = content.split('\n');
const idx = lines.findIndex(l => l.includes('fetchSystemNotifications = useCallback'));
if (idx !== -1) {
    console.log(lines.slice(Math.max(0, idx - 5), idx + 25).join('\n'));
} else {
    console.log('Not found');
}
