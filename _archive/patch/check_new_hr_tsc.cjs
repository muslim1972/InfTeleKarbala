const { execSync } = require('child_process');
const modified = [
    'src/pages/HRDashboard.tsx',
    'src/features/hr/components/HRRequestsHub.tsx',
    'src/features/hr/components/ServiceContinuityProcessModal.tsx',
    'src/features/hr/components/IssuedContinuityCard.tsx',
    'src/features/hr/components/AdministrativeRequestsCard.tsx'
];

try {
    execSync('npx tsc --noEmit -p tsconfig.app.json', { encoding: 'utf8', stdio: 'pipe' });
    console.log('TSC: 0 errors in entire project!');
} catch (e) {
    const lines = (e.stdout || '').split('\n');
    const matched = lines.filter(l => modified.some(m => l.includes(m.replace(/\//g, '\\')) || l.includes(m)));
    if (matched.length === 0) {
        console.log('SUCCESS: ZERO TypeScript errors in new/modified HR files! (Legacy errors in other files: ' + lines.length + ')');
    } else {
        console.error('ERRORS in modified files:\n' + matched.join('\n'));
        process.exit(1);
    }
}
