const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

const updates = [
    { name: 'ابراهيم عبد الامير عراك حسين المنصور', new_job_number: '143264419' },
    { name: 'احمد حسين جواد جعفر الموسوي', new_job_number: '143264352' },
    { name: 'امير علاوي نعمة حسين الفتلة', new_job_number: '143264323' },
    { name: 'حسن عبد علي سالم عذاب الحريشاوي', new_job_number: '143264464' },
    { name: 'حسين عباس مجهول منديل الفتلاوي', new_job_number: '143264451' },
    { name: 'حسين علي سعيد عبد المشاعلة', new_job_number: '143264310' },
    { name: 'حيدر حميد حسين زيارة الكنعان', new_job_number: '143264381' },
    { name: 'رضوان محمد حسين عبود الجبوري', new_job_number: '143264224' },
    { name: 'سجاد عبد اليمة فليح حسن زيادي', new_job_number: '143264253' },
    { name: 'علي حسين عبد عون حسن ابو عربي', new_job_number: '143264282' },
    { name: 'علي محمد عبد الرضا عباس المنصوري', new_job_number: '143264448' },
    { name: 'كرار حيدر عبد الامام سلمان الحميد', new_job_number: '143264435' },
    { name: 'محمد احمد عبد الحسين عبد علي البدري', new_job_number: '143264422' },
    { name: 'محمد صادق جواد عبد الزهرة النصراوي', new_job_number: '143264505' },
    { name: 'محمد عباس محسن مكطاف الفتلاوي', new_job_number: '143264295' },
    { name: 'محمود نعمة شنين عباس ال سماعيل', new_job_number: '143264349' },
    { name: 'مصطفى حيدر ياسين خنجر الفتلاوي', new_job_number: '143264240' },
    { name: 'مصطفى طالب ابراهيم علي السعدي', new_job_number: '143264378' },
    { name: 'نهضة عبد الله كاظم الخزعلي', new_job_number: '143264365' },
    { name: 'وحيد فاهم وحيد فرحان الليثي', new_job_number: '143264394' },
    { name: 'وسيم عباس صبري عبيد الدعوم', new_job_number: '143264406' }
];

async function run() {
    let successCount = 0;
    for (const record of updates) {
        // Find user by name
        const { data: users, error: findError } = await supabase
            .from('profiles')
            .select('id, full_name, job_number')
            .eq('full_name', record.name)
            .eq('governorate', 'كربلاء المقدسة');
            
        if (findError) {
            console.error('Error finding user:', record.name, findError);
            continue;
        }
        
        if (users && users.length > 0) {
            const user = users[0];
            console.log("Updating " + user.full_name + " from " + user.job_number + " to " + record.new_job_number);
            
            const { error: updateError } = await supabase
                .from('profiles')
                .update({ job_number: record.new_job_number })
                .eq('id', user.id);
                
            if (updateError) {
                console.error('Failed to update:', record.name, updateError);
            } else {
                successCount++;
            }
        } else {
            console.log("User not found in DB: " + record.name);
        }
    }
    console.log("Done! Updated " + successCount + " out of " + updates.length);
}

run();
