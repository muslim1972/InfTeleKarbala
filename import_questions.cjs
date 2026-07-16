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

const FILE_PATH = './اسئلة الكراس 2026.xlsx';

const levelMap = {
    'سهل': 'E',
    'متوسط': 'M',
    'صعب': 'A'
};

async function importQuestions() {
    if (!fs.existsSync(FILE_PATH)) {
        console.error(`File not found: ${FILE_PATH}`);
        process.exit(1);
    }

    console.log(`Reading Excel file: ${FILE_PATH}`);
    const workbook = xlsx.readFile(FILE_PATH);
    
    // مسح الأسئلة القديمة
    console.log("Deleting old questions...");
    const { error: deleteError } = await supabase
        .from('summer_training_questions')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

    if (deleteError) {
        console.error("Failed to delete old questions:", deleteError.message);
        process.exit(1);
    }
    console.log("Old questions deleted successfully.");

    let successCount = 0;
    let errorCount = 0;
    const questionsToInsert = [];

    for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        const data = xlsx.utils.sheet_to_json(sheet);
        console.log(`Found ${data.length} questions in sheet: ${sheetName}`);

        const level = levelMap[sheetName] || 'E'; // E كافتراضي

        for (let i = 0; i < data.length; i++) {
            const row = data[i];
            
            const questionText = row['السؤال'] || row['question_text'];
            const option1 = row['الإجابة الصحيحة (أ)'] || row['option_1'];
            const option2 = row['الإجابة الخاطئة (ب)'] || row['option_2'];
            const option3 = row['الإجابة الخاطئة (ج)'] || row['option_3'];
            const option4 = row['الإجابة الخاطئة (د)'] || row['option_4'];

            if (!questionText || !option1 || !option2) {
                console.warn(`تخطي صف بسبب نقص بيانات السؤال أو الخيارات بالصف ${i+2} في ورقة ${sheetName}`);
                errorCount++;
                continue;
            }

            questionsToInsert.push({
                question_text: String(questionText).trim(),
                option_1: String(option1).trim(),
                option_2: String(option2).trim(),
                option_3: option3 ? String(option3).trim() : 'لا يوجد',
                option_4: option4 ? String(option4).trim() : 'لا يوجد',
                level: level
            });
        }
    }

    console.log(`Starting bulk insert of ${questionsToInsert.length} total questions...`);
    
    // تقسيم الإدخال المجمع إلى أجزاء (Chunks) لتجنب التحميل الزائد
    const CHUNK_SIZE = 50;
    for (let i = 0; i < questionsToInsert.length; i += CHUNK_SIZE) {
        const chunk = questionsToInsert.slice(i, i + CHUNK_SIZE);
        const { error: insertError } = await supabase
            .from('summer_training_questions')
            .insert(chunk);

        if (insertError) {
            console.error(`خطأ في استيراد الدفعة ${i} إلى ${i + CHUNK_SIZE}:`, insertError.message);
            errorCount += chunk.length;
        } else {
            successCount += chunk.length;
            console.log(`تم استيراد ${successCount} سؤال...`);
        }
    }

    console.log(`\n--- انتهت عملية الاستيراد ---`);
    console.log(`الناجحين: ${successCount}`);
    console.log(`الفاشلين: ${errorCount}`);
}

importQuestions();
