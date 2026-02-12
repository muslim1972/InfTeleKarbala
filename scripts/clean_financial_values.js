/**
 * سكربت تنظيف بيانات الشهادة والعنوان الوظيفي
 * يقرأ كل القيم من financial_records، يطبّعها، ويحدّث DB
 */
import { supabase } from './utils/db.js';

// === قوائم الخيارات المعتمدة (نفس الموجودة في الفرونت) ===
const CERT_OPTIONS = ['دكتوراه', 'ماجستير', 'دبلوم عالي', 'بكلوريوس', 'بكالوريوس', 'دبلوم', 'الاعدادية', 'المتوسطة', 'الابتدائية', 'يقرأ ويكتب'];

const JOB_OPTIONS = [
    'ر. مهندسين اقدم اول', 'ر. مهندسين اقدم', 'ر. مهندسين', 'مهندس', 'م. مهندس',
    'ر. مبرمجين اقدم اول', 'ر. مبرمجين اقدم', 'ر. مبرمجين', 'مبرمج', 'م. مبرمج',
    'ر. مشغلين اقدم اول', 'ر. مشغلين اقدم', 'ر. مشغلين', 'مشغل حاسبة', 'م. مشغل حاسبة',
    'مدير فني اقدم', 'مدير فني', 'فني اقدم', 'فني', 'عامل خدمة'
];

// === دوال التطبيع ===
const stripAl = (t) => t.replace(/^ال/, '');
const normalizeChar = (t) => t.replace(/ى/g, 'ي').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه');

function normalizeCert(raw) {
    if (!raw) return { text: null, matched: false };
    let clean = raw.trim();
    // قص كل شيء بعد "بنسبة"
    if (clean.includes('بنسبة')) clean = clean.split('بنسبة')[0].trim();

    // البحث عن تطابق
    const match = CERT_OPTIONS.find(opt =>
        opt === clean ||
        stripAl(opt) === stripAl(clean) ||
        normalizeChar(stripAl(opt)) === normalizeChar(stripAl(clean))
    );

    return { text: match || clean, matched: !!match };
}

function normalizeJob(raw) {
    if (!raw) return { text: null, matched: false };
    let clean = raw.trim();

    // تطبيع: ى→ي
    const normalized = clean.replace(/ى/g, 'ي');

    const match = JOB_OPTIONS.find(opt =>
        opt === clean ||
        opt === normalized ||
        normalizeChar(opt) === normalizeChar(clean)
    );

    return { text: match || clean, matched: !!match };
}

// نسبة الشهادة بناءً على النص المطبّع
function getCertPerc(certText) {
    if (!certText) return 0;
    if (certText.includes('دكتوراه')) return 85;
    if (certText.includes('ماجستير')) return 75;
    if (certText.includes('دبلوم عالي')) return 55;
    if (certText.includes('بكلوريوس') || certText.includes('بكالوريوس')) return 45;
    if (certText.includes('دبلوم')) return 35;
    if (certText.includes('اعدادية') || certText.includes('الاعدادية')) return 25;
    if (certText.includes('متوسطة') || certText.includes('المتوسطة')) return 15;
    if (certText.includes('ابتدائية') || certText.includes('الابتدائية')) return 15;
    return 0;
}

async function cleanAll() {
    console.log('🔧 بدء تنظيف بيانات الشهادة والعنوان الوظيفي...\n');

    const { data: records, error } = await supabase
        .from('financial_records')
        .select('id, job_title, certificate_text, certificate_percentage');

    if (error) { console.error('❌ خطأ في جلب البيانات:', error.message); return; }
    console.log(`📊 عدد السجلات: ${records.length}\n`);

    // === المرحلة 1: التحليل ===
    const certStats = { matched: 0, cleaned: 0, empty: 0, newValues: new Set() };
    const jobStats = { matched: 0, cleaned: 0, empty: 0, newValues: new Set() };
    const updates = [];

    for (const rec of records) {
        const certResult = normalizeCert(rec.certificate_text);
        const jobResult = normalizeJob(rec.job_title);
        const updateData = {};
        let needsUpdate = false;

        // شهادة
        if (!rec.certificate_text) {
            certStats.empty++;
        } else if (certResult.text !== rec.certificate_text) {
            updateData.certificate_text = certResult.text;
            updateData.certificate_percentage = getCertPerc(certResult.text);
            needsUpdate = true;
            if (certResult.matched) certStats.matched++;
            else { certStats.cleaned++; certStats.newValues.add(certResult.text); }
        } else {
            certStats.matched++;
        }

        // عنوان وظيفي
        if (!rec.job_title) {
            jobStats.empty++;
        } else if (jobResult.text !== rec.job_title) {
            updateData.job_title = jobResult.text;
            needsUpdate = true;
            if (jobResult.matched) jobStats.matched++;
            else { jobStats.cleaned++; jobStats.newValues.add(jobResult.text); }
        } else {
            jobStats.matched++;
        }

        if (needsUpdate) {
            updates.push({ id: rec.id, ...updateData });
        }
    }

    // === التقرير ===
    console.log('📋 === تقرير الشهادات ===');
    console.log(`  ✅ مطابقة: ${certStats.matched}`);
    console.log(`  🔄 تحتاج تنظيف: ${updates.filter(u => u.certificate_text).length}`);
    console.log(`  ⚪ فارغة: ${certStats.empty}`);
    if (certStats.newValues.size > 0) {
        console.log(`  ⚠️ قيم جديدة (غير موجودة في القائمة):`);
        certStats.newValues.forEach(v => console.log(`     → "${v}"`));
    }

    console.log('\n📋 === تقرير العناوين الوظيفية ===');
    console.log(`  ✅ مطابقة: ${jobStats.matched}`);
    console.log(`  🔄 تحتاج تنظيف: ${updates.filter(u => u.job_title).length}`);
    console.log(`  ⚪ فارغة: ${jobStats.empty}`);
    if (jobStats.newValues.size > 0) {
        console.log(`  ⚠️ قيم جديدة (غير موجودة في القائمة):`);
        jobStats.newValues.forEach(v => console.log(`     → "${v}"`));
    }

    // === المرحلة 2: التحديث ===
    if (updates.length === 0) {
        console.log('\n✅ لا توجد سجلات تحتاج تحديث!');
        return;
    }

    console.log(`\n🔄 تحديث ${updates.length} سجل...`);
    let success = 0, failed = 0;

    for (const upd of updates) {
        const { id, ...data } = upd;
        const { error: updError } = await supabase
            .from('financial_records')
            .update(data)
            .eq('id', id);

        if (updError) {
            console.error(`  ❌ فشل ${id}: ${updError.message}`);
            failed++;
        } else {
            success++;
        }
    }

    console.log(`\n✅ نجح: ${success} | ❌ فشل: ${failed}`);

    // === المرحلة 3: القيم الجديدة للإضافة في القائمة ===
    const allNew = new Set([...certStats.newValues, ...jobStats.newValues]);
    if (allNew.size > 0) {
        console.log('\n⚠️ هذه القيم يجب إضافتها يدوياً لخيارات القائمة في AdminDashboard.tsx:');
        if (certStats.newValues.size > 0) {
            console.log('  شهادات:', [...certStats.newValues].join(', '));
        }
        if (jobStats.newValues.size > 0) {
            console.log('  عناوين:', [...jobStats.newValues].join(', '));
        }
    }
}

cleanAll().catch(e => console.error(e));
