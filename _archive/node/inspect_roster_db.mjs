import { spawnSync } from 'child_process';

const pw = process.env.VPS_PW || '';
if (!pw) {
  console.error('VPS_PW is empty!');
  process.exit(1);
}

const sql = `
SELECT proname 
FROM pg_proc 
WHERE proname LIKE '%roster%' 
   OR proname LIKE '%khafar%' 
   OR proname LIKE '%closeout%'
   OR proname LIKE '%evaluate%'
ORDER BY proname;

SELECT jobid, schedule, command, active FROM cron.job;

SELECT tgname, relname 
FROM pg_trigger t 
JOIN pg_class c ON t.tgrelid = c.oid 
WHERE relname IN ('attendance_records', 'leave_requests')
ORDER BY relname, tgname;
`;

const res = spawnSync(
  'C:\\Program Files\\PuTTY\\plink.exe',
  ['-batch', '-pw', pw, 'muslim@10.56.3.3', 'docker exec -i supabase-db psql -U postgres -d postgres'],
  { input: sql, encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 }
);

if (res.stdout) console.log(res.stdout);
if (res.stderr) console.error(res.stderr);
