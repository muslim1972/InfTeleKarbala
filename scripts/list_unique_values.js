import { supabase } from './utils/db.js';

async function listUniqueValues() {
    const { data, error } = await supabase
        .from('financial_records')
        .select('job_title, certificate_text');

    if (error) { console.error(error); return; }

    const titles = new Set();
    const certs = new Set();
    data.forEach(r => {
        if (r.job_title) titles.add(r.job_title);
        if (r.certificate_text) certs.add(r.certificate_text);
    });

    console.log('=== العناوين الوظيفية الفريدة في DB ===');
    [...titles].sort().forEach(t => console.log(`  "${t}"`));
    console.log(`\n=== الشهادات الفريدة في DB ===`);
    [...certs].sort().forEach(c => console.log(`  "${c}"`));
}

listUniqueValues();
