const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const vpsUrl = 'https://khr-itpc.egov.iq';
const vpsKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3ODQyNTM1MDEsImV4cCI6MjA5OTYxMzUwMX0.YbdF55DaUN5Uy_XO0WNeJzeKrqdTkjpCQF8aTeoWOqk';

const supabase = createClient(vpsUrl, vpsKey);

async function restore() {
    console.log('Deleting existing records...');
    await supabase.from('summer_training_results').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('summer_training_students').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    
    const data = JSON.parse(fs.readFileSync('C:/Users/SAM-Tech/.gemini/antigravity/brain/a2fc27cb-3f5a-439a-9855-2f1c460a0efa/scratch/cloud_dump.json', 'utf8'));
    const tables = ['summer_training_settings', 'summer_training_students', 'summer_training_results'];
    
    for (const t of tables) {
        if (!data[t] || data[t].length === 0) continue;
        console.log(`Restoring ${t} (${data[t].length} rows)...`);
        
        for (let i = 0; i < data[t].length; i += 100) {
            const batch = data[t].slice(i, i + 100);
            const { error } = await supabase.from(t).upsert(batch, { returning: 'minimal' });
            if (error) {
                console.error(`Error in ${t} batch ${i}:`, error);
            }
        }
        console.log(`Done restoring ${t}`);
    }
}
restore();
