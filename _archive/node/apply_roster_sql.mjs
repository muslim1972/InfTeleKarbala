import { spawnSync } from 'child_process';
import fs from 'fs';

const pw = process.env.VPS_PW || '';
if (!pw) {
  console.error('VPS_PW is empty!');
  process.exit(1);
}

const sql = fs.readFileSync('scripts/sql/roster_engine.sql', 'utf-8');

// Also update cron.job #1 to run at 09:15 AM Baghdad (06:15 UTC) instead of every minute
const cronSql = `
SELECT cron.unschedule(1);
SELECT cron.schedule('roster_daily_eval', '15 6 * * *', 'SELECT public.roster_evaluate_all();');
`;

const fullSql = sql + '\n' + cronSql;

const res = spawnSync(
  'C:\\Program Files\\PuTTY\\plink.exe',
  ['-batch', '-pw', pw, 'muslim@10.56.3.3', 'docker exec -i supabase-db psql -U postgres -d postgres'],
  { input: fullSql, encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 }
);

if (res.stdout) console.log('stdout:', res.stdout);
if (res.stderr) console.error('stderr:', res.stderr);
