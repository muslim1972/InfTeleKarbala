import { spawnSync } from 'child_process';

const pw = process.env.VPS_PW || '';
if (!pw) {
  console.error('VPS_PW is empty!');
  process.exit(1);
}

const sql = `
SELECT id, name, department_id, latitude, longitude, radius_meters, is_active 
FROM work_locations 
WHERE name LIKE '%مخازن%';

SELECT conname, confrelid::regclass, conrelid::regclass, pg_get_constraintdef(oid)
FROM pg_constraint 
WHERE conrelid IN ('work_locations'::regclass, 'work_location_audit_logs'::regclass)
   OR confrelid IN ('work_locations'::regclass, 'work_location_audit_logs'::regclass);

SELECT tgname, relname, proname, prosrc
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE relname IN ('work_locations', 'work_location_audit_logs');
`;

const res = spawnSync(
  'C:\\Program Files\\PuTTY\\plink.exe',
  ['-batch', '-pw', pw, 'muslim@10.56.3.3', 'docker exec -i supabase-db psql -U postgres -d postgres'],
  { input: sql, encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 }
);

if (res.stdout) console.log(res.stdout);
if (res.stderr) console.error(res.stderr);
