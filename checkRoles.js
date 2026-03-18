import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function checkRoles() {
    console.log('Checking roles...');
    const { data, error } = await supabase.from('profiles').select('id, full_name, admin_role').limit(10);
    if (error) {
        console.error('Error fetching profiles:', error);
    } else {
        console.log('Sample profiles:', data);
        
        const { data: allData } = await supabase.from('profiles').select('admin_role');
        const roles = allData.map(d => d.admin_role);
        const roleCounts = roles.reduce((acc, role) => {
            acc[role || 'null'] = (acc[role || 'null'] || 0) + 1;
            return acc;
        }, {});
        console.log('Role counts across all users:', roleCounts);
    }
}

checkRoles();
