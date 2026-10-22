import { execFileSync } from 'node:child_process';
import path from 'node:path';

const putty = 'C:\\Program Files\\PuTTY';
const pw = execFileSync('powershell', ['-NoProfile', '-Command', "[Environment]::GetEnvironmentVariable('VPS_PW','User')"], { encoding: 'utf8' }).trim();
const host = 'muslim@10.56.3.3';

const sql = `
UPDATE system_notifications 
SET type = 'service_continuity_request' 
WHERE title LIKE '%استمرارية%';
`;

const res = execFileSync(path.join(putty, 'plink.exe'), ['-batch', '-pw', pw, host, `docker exec -i supabase-db psql -U supabase_admin -d postgres`], { input: sql, encoding: 'utf8' });
console.log(res);
