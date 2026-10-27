const { createClient } = require('@supabase/supabase-js');

// Read env or use local config
const supabaseUrl = 'http://10.56.3.3:8000'; // or from app config
console.log('Testing query via psql on VPS directly...');
