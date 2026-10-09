
import { supabase } from './utils/db.js';

const JOB_NUMBER = '266772'; // Ali Abbas

async function checkFinancial() {
    console.log(`🔍 Checking Financial Records for Job: ${JOB_NUMBER}`);

    // 1. Get User ID
    const { data: user } = await supabase.from('profiles').select('id, full_name').eq('job_number', JOB_NUMBER).single();

    if (!user) {
        console.error('❌ User not found');
        return;
    }
    console.log(`👤 User: ${user.full_name}`);

    // 2. Get Financial Record
    const { data: fin } = await supabase.from('financial_records').select('*').eq('user_id', user.id).single();

    if (!fin) {
        console.error('❌ No financial record found!');
    } else {
        console.log('💰 Financial Record:');
        console.log(`   - certificate_text: "${fin.certificate_text}"`);
        console.log(`   - certificate_percentage: ${fin.certificate_percentage}`);
        console.log(`   - nominal_salary: ${fin.nominal_salary}`);
    }
}

checkFinancial();
