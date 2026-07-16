const { createClient } = require('@supabase/supabase-js');
const xlsx = require('xlsx');
const dotenv = require('dotenv');
const fs = require('fs');

dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error("Missing Supabase credentials in .env");
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const FILE_PATH = './طلبة التدريب الصيفي 2026.xlsx';

async function importData() {
    if (!fs.existsSync(FILE_PATH)) {
        console.error(`File not found: ${FILE_PATH}`);
        console.error(`يرجى التأكد من وجود الملف في نفس مسار المشروع`);
        process.exit(1);
    }

    console.log(`Reading Excel file: ${FILE_PATH}`);
    const workbook = xlsx.readFile(FILE_PATH);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    
    // تحويل الشيت إلى مصفوفة JSON مع أخذ أول صف كعناوين للأعمدة
    const data = xlsx.utils.sheet_to_json(sheet);
    console.log(`Found ${data.length} rows.`);

    let successCount = 0;
    let errorCount = 0;

    for (const row of data) {
        // قراءة الأعمدة بناءً على العناوين في ملف الإكسل
        const fullName = row['الاسم الثلاثي'] || row['الاسم'];
        const password = row['الرمز'] ? String(row['الرمز']) : '';
        const institutionName = row['الجامعة او المعهد او الإعدادية'];
        const trainingLocation = row['موقع التدريب'];
        const trainerName = row['اسم المدرب'];

        if (!fullName || !password) {
            console.warn(`تخطي صف بسبب نقص الاسم أو الرمز:`, row);
            errorCount++;
            continue;
        }

        console.log(`جاري استيراد: ${fullName}...`);
        
        // استدعاء دالة إضافة الطالب لمعالجة وتشفير كلمة المرور بشكل صحيح
        const { error } = await supabase.rpc('create_training_student', {
            p_full_name: fullName.trim(),
            p_username: fullName.trim(),
            p_password: password.trim(),
            p_institution_name: institutionName ? String(institutionName).trim() : '',
            p_training_location: trainingLocation ? String(trainingLocation).trim() : '',
            p_trainer_name: trainerName ? String(trainerName).trim() : '',
            p_supervisor_id: null
        });

        if (error) {
            console.error(`خطأ في استيراد ${fullName}:`, error.message);
            errorCount++;
        } else {
            successCount++;
        }
    }

    console.log(`\n--- انتهت عملية الاستيراد ---`);
    console.log(`الناجحين: ${successCount}`);
    console.log(`الفاشلين: ${errorCount}`);
}

importData();
