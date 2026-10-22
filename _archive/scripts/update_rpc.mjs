import { execFileSync } from 'node:child_process';
import path from 'node:path';

const putty = 'C:\\Program Files\\PuTTY';
const pw = execFileSync('powershell', ['-NoProfile', '-Command', "[Environment]::GetEnvironmentVariable('VPS_PW','User')"], { encoding: 'utf8' }).trim();
const host = 'muslim@10.56.3.3';

console.log('1. Uploading updated migration file...');
execFileSync(path.join(putty, 'pscp.exe'), ['-batch', '-pw', pw, path.resolve('supabase/migrations/20261021000000_hr01_service_continuity_requests.sql'), `${host}:/home/muslim/migration_continuity.sql`]);

console.log('2. Applying updated migration under supabase_admin...');
const out1 = execFileSync(path.join(putty, 'plink.exe'), ['-batch', '-pw', pw, host, `cat /home/muslim/migration_continuity.sql | docker exec -i supabase-db psql -U supabase_admin -d postgres`], { encoding: 'utf8' });
console.log('Result:\n' + out1);

console.log('3. Deleting misdirected HR notifications from non-HR accounts...');
const cleanupSql = `
DELETE FROM public.system_notifications 
WHERE title = 'طلب تأييد استمرارية جاهز للإصدار'
  AND recipient_id IN (
    SELECT id FROM public.profiles 
    WHERE admin_role NOT IN ('hr', 'hr_supervisor') OR admin_role IS NULL
  );
`;
const out2 = execFileSync(path.join(putty, 'plink.exe'), ['-batch', '-pw', pw, host, `docker exec -i supabase-db psql -U supabase_admin -d postgres`], { input: cleanupSql, encoding: 'utf8' });
console.log('Cleanup Result:\n' + out2);

console.log('Done!');
