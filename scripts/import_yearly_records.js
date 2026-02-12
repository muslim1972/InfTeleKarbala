
import { supabase } from './utils/db.js';
import XLSX from 'xlsx';
import path from 'path';
import fs from 'fs';

const FILE_NAME = 'تفاصيل الراتب شهر 1 - 2026.xlsx';
const YEAR = 2025; // السنة من عنوان الأعمدة في Excel

const parseNum = (val) => {
    if (val === undefined || val === null || val === '') return 0;
    if (typeof val === 'number') return val;
    const clean = String(val).replace(/[^\d.-]/g, '');
    const num = parseFloat(clean);
    return isNaN(num) ? 0 : num;
};

async function importYearly() {
    console.log(`🚀 استيراد السجلات السنوية (${YEAR})...`);

    const filePath = path.resolve(process.cwd(), FILE_NAME);
    if (!fs.existsSync(filePath)) {
        console.error(`❌ الملف غير موجود: ${filePath}`);
        process.exit(1);
    }

    const workbook = XLSX.readFile(filePath);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    // تحديد الأعمدة
    const headers = rows[0].map(h => String(h).trim());
    const getIdx = (keywords) => headers.findIndex(h => keywords.some(k => h.includes(k)));

    const cardCol = getIdx(['الرقم الوظيفي', 'الوظيفي']);
    const committeesCol = getIdx(['عدد اللجان']);
    const thanksCol = getIdx(['عدد كتب الشكر']);

    console.log(`📋 أعمدة: Card=${cardCol}, Committees=${committeesCol}, Thanks=${thanksCol}`);

    if (cardCol === -1 || committeesCol === -1 || thanksCol === -1) {
        console.error('❌ لم يتم العثور على جميع الأعمدة المطلوبة');
        process.exit(1);
    }

    // جلب الملفات الشخصية
    const { data: profiles, error } = await supabase.from('profiles').select('card_number, id');
    if (error) {
        console.error('❌ فشل جلب الملفات الشخصية:', error.message);
        process.exit(1);
    }

    const cardToId = new Map();
    profiles.forEach(p => {
        if (p.card_number) cardToId.set(String(p.card_number).trim(), p.id);
    });
    console.log(`📊 عدد الملفات الشخصية: ${cardToId.size}`);

    let inserted = 0, updated = 0, skipped = 0, notFound = 0;

    for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.length === 0) continue;

        const cardNumVal = row[cardCol];
        if (!cardNumVal) { skipped++; continue; }

        const cardNum = String(cardNumVal).trim();
        const userId = cardToId.get(cardNum);

        if (!userId) { notFound++; continue; }

        const committees = parseNum(row[committeesCol]);
        const thanks = parseNum(row[thanksCol]);

        // التحقق من وجود سجل سابق
        const { data: existing } = await supabase.from('yearly_records')
            .select('id').eq('user_id', userId).eq('year', YEAR).maybeSingle();

        const yearlyData = {
            user_id: userId,
            year: YEAR,
            committees_count: committees,
            thanks_books_count: thanks,
            updated_at: new Date()
        };

        if (existing) {
            await supabase.from('yearly_records').update(yearlyData).eq('id', existing.id);
            updated++;
        } else {
            const { error: insErr } = await supabase.from('yearly_records').insert(yearlyData);
            if (insErr) {
                console.error(`❌ إدراج فاشل (${cardNum}):`, insErr.message);
            } else {
                inserted++;
            }
        }

        if ((inserted + updated) % 10 === 0) process.stdout.write('.');
    }

    console.log(`\n\n✅ اكتمل الاستيراد!`);
    console.log(`📥 إدراج جديد: ${inserted}`);
    console.log(`🔄 تحديث: ${updated}`);
    console.log(`⏭️ تخطي (بدون رقم): ${skipped}`);
    console.log(`❌ غير موجود: ${notFound}`);
}

importYearly().catch(e => console.error(e));
