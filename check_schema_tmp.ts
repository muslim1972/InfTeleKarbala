
import { supabase } from './src/lib/supabase';

async function checkSchema() {
  const { data, error } = await supabase.from('financial_records').select('*').limit(1);
  if (error) {
    console.error('Error fetching financial_records:', error);
  } else {
    console.log('financial_records columns:', Object.keys(data[0] || {}));
  }

  const { data: profileData, error: profileErr } = await supabase.from('profiles').select('*').limit(1);
  if (profileErr) {
    console.error('Error fetching profiles:', profileErr);
  } else {
    console.log('profiles columns:', Object.keys(profileData[0] || {}));
  }
  
  const { data: deptData, error: deptErr } = await supabase.from('departments').select('*').limit(1);
  if (deptErr) {
      console.error('Error fetching departments:', deptErr);
  } else {
      console.log('departments columns:', Object.keys(deptData[0] || {}));
  }
}

checkSchema();
