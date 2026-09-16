const { createClient } = require('@supabase/supabase-js');
const vpsUrl = 'https://khr-itpc.egov.iq';
const vpsKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3ODQyNTM1MDEsImV4cCI6MjA5OTYxMzUwMX0.YbdF55DaUN5Uy_XO0WNeJzeKrqdTkjpCQF8aTeoWOqk';
const supabase = createClient(vpsUrl, vpsKey);

async function check() {
    const { data: students, error: err1 } = await supabase.from('summer_training_students').select('full_name, batch_name, username');
    console.log('Students in VPS:', students?.length);
    if (students?.length > 0) {
        console.log('Sample:', students.slice(0, 3));
    }
}
check();

