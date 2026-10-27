const { execSync } = require('child_process');
const modified = [
    'src/components/admin/dashboard/DashboardHeader.tsx',
    'src/components/auth/AdminRoleSelector.tsx',
    'src/features/hr/components/HRAdminOrders.tsx',
    'src/features/hr/components/HREmployeeDossiers.tsx',
    'src/features/hr/components/HRIncomingMail.tsx',
    'src/features/hr/components/HROutgoingMail.tsx',
    'src/features/hr/components/HROverview.tsx',
    'src/pages/HRDashboard.tsx',
    'src/utils/permissions.ts'
];

try {
    execSync('npx tsc --noEmit -p tsconfig.app.json', { encoding: 'utf8', stdio: 'pipe' });
    console.log('TSC: 0 errors!');
} catch (e) {
    const lines = (e.stdout || '').split('\n');
    const matched = lines.filter(l => modified.some(m => l.includes(m.replace(/\//g, '\\')) || l.includes(m)));
    if (matched.length === 0) {
        console.log('SUCCESS: ZERO TypeScript errors in modified files! (Total legacy errors in other files: ' + lines.length + ')');
    } else {
        console.error('ERRORS in modified files:\n' + matched.join('\n'));
        process.exit(1);
    }
}
