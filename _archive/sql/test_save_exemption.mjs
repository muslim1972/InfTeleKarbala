import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envFile = fs.readFileSync('D:/InfTeleKarbala/.env.production', 'utf8');
let url = '', key = '';
envFile.split('\n').forEach(line => {
  if (line.startsWith('VITE_SUPABASE_URL=')) url = line.split('=')[1].trim().replace(/['"]/g, '');
  if (line.startsWith('VITE_SUPABASE_ANON_KEY=')) key = line.split('=')[1].trim().replace(/['"]/g, '');
});

const supabase = createClient(url, key);

async function test() {
  console.log('Testing save_employee_weekly_exemption with anon (should fail with not logged in)...');
  const res = await supabase.rpc('save_employee_weekly_exemption', {
    p_employee_id: 'd2c4eef8-72cc-4dd1-a734-00d5ebe94f6d',
    p_governorate: 'karbala',
    p_days: [2],
    p_order_number: '1000',
    p_order_date: '2026-05-18',
    p_valid_until: '2027-06-17',
    p_notes: 'فحص تجريبي'
  });

  console.log('RPC result:', res.error ? res.error.message : res.data);
}
test();
