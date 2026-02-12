import { supabase } from './utils/db.js';

async function fixTwo() {
    // 1. "% ماجستير" → "ماجستير"
    const { data: d1, error: e1 } = await supabase
        .from('financial_records')
        .update({ certificate_text: 'ماجستير', certificate_percentage: 75 })
        .eq('certificate_text', '% ماجستير')
        .select('id');
    console.log('ماجستير:', d1?.length || 0, 'updated', e1?.message || '✅');

    // 2. "امي _" → "أمي"
    const { data: d2, error: e2 } = await supabase
        .from('financial_records')
        .update({ certificate_text: 'أمي', certificate_percentage: 0 })
        .eq('certificate_text', 'امي _')
        .select('id');
    console.log('أمي:', d2?.length || 0, 'updated', e2?.message || '✅');
}

fixTwo();
