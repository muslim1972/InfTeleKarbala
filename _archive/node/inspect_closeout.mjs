import { spawnSync } from 'child_process';

const pw = process.env.VPS_PW || '';
const sql = `
SELECT prosrc FROM pg_proc WHERE proname = 'closeout_prev_day_attendance';
`;

const res = spawnSync(
  'C:\\Program Files\\PuTTY\\plink.exe',
  ['-batch', '-pw', pw, 'muslim@10.56.3.3', 'docker exec -i supabase-db psql -U postgres -d postgres'],
  { input: sql, encoding: 'utf-8' }
);

console.log(res.stdout);
