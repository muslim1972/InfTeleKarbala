import { createClient } from '@supabase/supabase-js';

const url = 'https://khr-itpc.egov.iq';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3ODQyNTM1MDEsImV4cCI6MjA5OTYxMzUwMX0.YbdF55DaUN5Uy_XO0WNeJzeKrqdTkjpCQF8aTeoWOqk';

const supabase = createClient(url, serviceKey);

async function main() {
  const recId = '08a48505-c1ef-4d9c-9472-10a4b27b477c';

  // 1. Fetch current record
  const { data: rec, error: fetchErr } = await supabase
    .from('attendance_records')
    .select('*')
    .eq('id', recId)
    .single();

  if (fetchErr || !rec) {
    console.error('Fetch error:', fetchErr);
    return;
  }

  console.log('Before cleanup:', {
    check_in: rec.check_in,
    check_out: rec.check_out,
    raw_punches: rec.raw_punches
  });

  // 2. Filter out virtual punches
  const cleanRaw = (rec.raw_punches || []).filter(
    (p) => !p.is_virtual && !p.notes?.includes('افتراضي')
  );

  // 3. Update record
  const { data: updated, error: updateErr } = await supabase
    .from('attendance_records')
    .update({
      check_out: null,
      raw_punches: cleanRaw,
      notes: 'حضور مثبت للشفت'
    })
    .eq('id', recId)
    .select()
    .single();

  if (updateErr) {
    console.error('Update error:', updateErr);
    return;
  }

  console.log('After cleanup:', {
    check_in: updated.check_in,
    check_out: updated.check_out,
    raw_punches: updated.raw_punches
  });
}

main();
