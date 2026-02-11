
import { supabase } from './utils/db.js';
import XLSX from 'xlsx';
import path from 'path';

const FILE_NAME = 'تفاصيل الراتب شهر 1 - 2026.xlsx';

const getCertPerc = (text) => {
    if (!text) return 0;
    const t = text.trim();
    if (t.includes('دكتوراه')) return 85;
    if (t.includes('ماجستير')) return 75;
    if (t.includes('دبلوم عالي')) return 55;
    if (t.includes('بكلوريوس') || t.includes('بكالوريوس')) return 45;
    if (t.includes('دبلوم')) return 35;
    if (t.includes('الاعدادية') || t.includes('اعدادية')) return 25;
    if (t.includes('المتوسطة') || t.includes('متوسطة')) return 15;
    return 0;
};

async function fixCertificates() {
    console.log('🔧 تحديث سريع: إضافة الشهادة والنسبة فقط...');

    const filePath = path.resolve(process.cwd(), FILE_NAME);
    const workbook = XLSX.readFile(filePath);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    // Index 2 = رقم البطاقة (الرقم الوظيفي), Index 5 = الشهادة
    const CARD_COL = 2;
    const CERT_COL = 5;

    // 1. جلب البروفايلات مع أرقام البطاقات
    const { data: profiles } = await supabase.from('profiles').select('id, card_number');
    const cardToId = new Map();
    profiles.forEach(p => {
        if (p.card_number) cardToId.set(String(p.card_number).trim(), p.id);
    });

    console.log(`📊 عدد البطاقات: ${cardToId.size}`);

    let updated = 0;
    let failed = 0;

    // 2. لكل سطر في Excel، حدّث فقط العمودين
    for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row) continue;

        const cardNum = row[CARD_COL] ? String(row[CARD_COL]).trim() : null;
        if (!cardNum) continue;

        const userId = cardToId.get(cardNum);
        if (!userId) continue;

        const certText = row[CERT_COL] ? String(row[CERT_COL]).trim() : null;
        const certPerc = getCertPerc(certText);

        // UPDATE فقط (بدون حذف أو إدراج)
        const { error } = await supabase
            .from('financial_records')
            .update({
                certificate_text: certText,
                certificate_percentage: certPerc
            })
            .eq('user_id', userId);

        if (error) {
            console.error(`❌ فشل تحديث ${cardNum}: ${error.message}`);
            failed++;
        } else {
            updated++;
        }
    }

    console.log(`\n✅ تم تحديث ${updated} سجل بنجاح.`);
    if (failed > 0) console.log(`❌ فشل: ${failed}`);

    // 3. تحقق سريع: عينة عشوائية
    const { data: sample } = await supabase
        .from('financial_records')
        .select('certificate_text, certificate_percentage')
        .not('certificate_text', 'is', null)
        .limit(3);

    console.log('\n🔍 عينة من البيانات المحدّثة:');
    sample?.forEach(s => console.log(`   الشهادة: "${s.certificate_text}" - النسبة: ${s.certificate_percentage}%`));
}

fixCertificates().catch(e => console.error(e));
