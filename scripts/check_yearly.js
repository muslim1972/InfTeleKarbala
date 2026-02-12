import { supabase } from './utils/db.js';

async function check() {
    const { count } = await supabase.from('yearly_records').select('*', { count: 'exact', head: true });
    console.log(`عدد السجلات في yearly_records: ${count}`);

    // عينة
    const { data } = await supabase.from('yearly_records').select('*, profiles(full_name)').limit(5);
    data?.forEach(r => {
        console.log(`${r.profiles?.full_name}: شكر=${r.thanks_books_count}, لجان=${r.committees_count}, سنة=${r.year}`);
    });
}

check();
