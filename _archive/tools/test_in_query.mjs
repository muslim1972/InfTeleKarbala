import { createClient } from '@supabase/supabase-js';

const url = 'https://khr-itpc.egov.iq';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzg0MjUzNTAxLCJleHAiOjIwOTk2MTM1MDF9.J6epEjJZoyDL5GM_PNLoh3P2j18CCP4WeLrfAejCaew';

async function testInQuery() {
    const supabase = createClient(url, key);
    const { data: profs, error: pErr } = await supabase.from('profiles').select('id').eq('governorate', 'karbala');
    console.log('Karbala profiles count:', profs?.length, 'error:', pErr?.message);
    if (!profs) return;
    const ids = profs.map(p => p.id);
    console.log('Testing query with', ids.length, 'IDs...');
    const { data: fin, error: fErr } = await supabase.from('financial_records').select('id, user_id').in('user_id', ids);
    console.log('financial_records result count:', fin?.length, 'error:', fErr);
}
testInQuery().catch(console.error);
