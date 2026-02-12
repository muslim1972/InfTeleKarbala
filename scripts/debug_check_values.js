import { supabase } from './utils/db.js';

async function check() {
    // رائد هاشم
    const { data: r1 } = await supabase.from('profiles').select('id, full_name').ilike('full_name', '%رائد%هاشم%').single();
    if (r1) {
        const { data: f1 } = await supabase.from('financial_records').select('*').eq('user_id', r1.id).single();
        console.log('\n=== رائد هاشم ===');
        console.log('engineering_allowance:', f1?.engineering_allowance, '| type:', typeof f1?.engineering_allowance);
        console.log('tax_deduction_amount:', f1?.tax_deduction_amount, '| type:', typeof f1?.tax_deduction_amount);
        console.log('certificate_allowance:', f1?.certificate_allowance);
        console.log('legal_allowance:', f1?.legal_allowance);
        console.log('ALL keys:', Object.keys(f1 || {}).join(', '));
    }

    // مسلم عقيل
    const { data: r2 } = await supabase.from('profiles').select('id, full_name').ilike('full_name', '%مسلم%عقيل%').single();
    if (r2) {
        const { data: f2 } = await supabase.from('financial_records').select('*').eq('user_id', r2.id).single();
        console.log('\n=== مسلم عقيل ===');
        console.log('engineering_allowance:', f2?.engineering_allowance, '| type:', typeof f2?.engineering_allowance);
        console.log('tax_deduction_amount:', f2?.tax_deduction_amount, '| type:', typeof f2?.tax_deduction_amount);
        console.log('certificate_allowance:', f2?.certificate_allowance);
        console.log('legal_allowance:', f2?.legal_allowance);
    }

    // علي عباس (الذي يعمل صحيح)
    const { data: r3 } = await supabase.from('profiles').select('id, full_name').ilike('full_name', '%علي%عباس%صباغ%').single();
    if (r3) {
        const { data: f3 } = await supabase.from('financial_records').select('*').eq('user_id', r3.id).single();
        console.log('\n=== علي عباس الصباغ (يعمل صحيح) ===');
        console.log('engineering_allowance:', f3?.engineering_allowance, '| type:', typeof f3?.engineering_allowance);
        console.log('tax_deduction_amount:', f3?.tax_deduction_amount, '| type:', typeof f3?.tax_deduction_amount);
    }
}

check();
