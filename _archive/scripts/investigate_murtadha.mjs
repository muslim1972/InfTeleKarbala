import { execFileSync } from 'node:child_process';
import path from 'node:path';

const putty = 'C:\\Program Files\\PuTTY';
const pw = execFileSync('powershell', ['-NoProfile', '-Command', "[Environment]::GetEnvironmentVariable('VPS_PW','User')"], { encoding: 'utf8' }).trim();
const host = 'muslim@10.56.3.3';

const sql = `
SELECT id, employee_id, check_in, check_out, status, notes, admin_notes, created_at 
FROM public.attendance_records 
WHERE employee_id = 'f695a1d7-6442-4901-8cc3-77700185d21b'
  AND check_in::date = '2026-10-21';
`;

const res = execFileSync(path.join(putty, 'plink.exe'), ['-batch', '-pw', pw, host, `docker exec -i supabase-db psql -U supabase_admin -d postgres`], { input: sql, encoding: 'utf8' });
console.log(res);
