
import { supabase } from './utils/db.js';

const JOB_NUMBER = '266772'; // Ali Abbas

async function showLink() {
    console.log(`🔍 Investigating link for Job Number: ${JOB_NUMBER}`);

    // 1. Get Profile
    const { data: profile, error: pError } = await supabase
        .from('profiles')
        .select('id, full_name, job_number')
        .eq('job_number', JOB_NUMBER)
        .single();

    if (pError || !profile) {
        console.error('❌ Profile not found!', pError);
        return;
    }

    console.log('--------------------------------------------------');
    console.log(`👤 Profile Found:`);
    console.log(`   Name: ${profile.full_name}`);
    console.log(`   ID (PK): ${profile.id}  <-- This is the KEY`);
    console.log('--------------------------------------------------');

    // 2. Get Financial Record using the ID
    const { data: fin, error: fError } = await supabase
        .from('financial_records')
        .select('user_id, nominal_salary, certificate_text, certificate_percentage')
        .eq('user_id', profile.id) // <--- THE LINK
        .single();

    if (fError || !fin) {
        console.error('❌ No Financial Record found for this ID!');
        console.log(`   Expected user_id in financial_records: ${profile.id}`);
    } else {
        console.log(`💰 Financial Record Found:`);
        console.log(`   user_id (FK): ${fin.user_id} <-- Matches Profile ID`);
        console.log(`   Certificate: "${fin.certificate_text}"`);
        console.log(`   Percentage: ${fin.certificate_percentage}`);
    }
    console.log('--------------------------------------------------');
}

showLink();
