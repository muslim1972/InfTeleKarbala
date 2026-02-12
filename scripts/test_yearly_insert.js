import { supabase } from './utils/db.js';

async function test() {
    // Find a known good user
    const { data: testUser } = await supabase.from('profiles')
        .select('id, full_name')
        .ilike('full_name', '%مسلم%عقيل%')
        .single();

    if (!testUser) {
        console.log('❌ لم يتم العثور على مستخدم');
        return;
    }

    console.log(`🧪 اختبار إدراج لـ: ${testUser.full_name} (${testUser.id})`);

    // Try insert
    const { data, error } = await supabase.from('yearly_records').insert({
        user_id: testUser.id,
        year: 2025,
        committees_count: 5,
        thanks_books_count: 3,
    }).select();

    if (error) {
        console.log('❌ خطأ:', error.message);
        console.log('   details:', error.details);
        console.log('   hint:', error.hint);
        console.log('   code:', error.code);
    } else {
        console.log('✅ نجح:', JSON.stringify(data));
    }

    // Check count
    const { count } = await supabase.from('yearly_records').select('*', { count: 'exact', head: true });
    console.log(`📊 عدد السجلات: ${count}`);
}

test();
