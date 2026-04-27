import { supabase } from './utils/db.js';
import ExcelJS from 'exceljs';
import path from 'path';
import fs from 'fs';

const FILE_NAME = 'تفاصيل الراتب شهر 1 - 2026.xlsx';

const parseNum = (val) => {
    if (val === undefined || val === null || val === '') return 0;
    if (typeof val === 'number') return val;
    const clean = String(val).replace(/[^\d.-]/g, '');
    const num = parseFloat(clean);
    return isNaN(num) ? 0 : num;
};

const parseStr = (val) => (val ? String(val).trim() : null);

// Helper to calculate percentage based on text
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
    return 0; // Primary or Read/Write or null
};

async function importPhase2() {
    console.log('🚀 Phase 2: Importing Salaries (Linking via Card Number)...');

    const filePath = path.resolve(process.cwd(), FILE_NAME);
    if (!fs.existsSync(filePath)) {
        console.error(`❌ File not found: ${filePath}`);
        process.exit(1);
    }

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);
    const sheet = workbook.worksheets[0];

    // Get headers from first row
    const headerRow = sheet.getRow(1);
    const headers = [];
    headerRow.eachCell((cell) => {
        headers.push(String(cell.value).trim());
    });

    const getIdx = (keywords) => headers.findIndex(h => keywords.some(k => h.includes(k)));

    const colMap = {
        excel_card_col: getIdx(['الرقم الوظيفي', 'الوظيفي']), // Start with 11...

        job_title: getIdx(['العنوان الوظيفي']),
        cert_text: getIdx(['الشهادة']), // Correct Index
        grade: getIdx(['الدرجة']),
        stage: getIdx(['المرحلة']),
        tax_status: getIdx(['حالة الموظف']),
        nominal: getIdx(['الراتب الاسمي']),
        cert_allow: getIdx(['مخصصات الشهادة']),
        pos_allow: getIdx(['مخصصات المنصب']),
        eng_allow: getIdx(['مخصصات هندسية']),
        risk_allow: getIdx(['مخصصات الخطورة']),
        legal_allow: getIdx(['مخصصات القانونية']),
        add_allow: getIdx(['المخصصات الاضافية', '50%']),
        trans_allow: getIdx(['مخصصات النقل']),
        mar_allow: getIdx(['مخصصات الزوجية']),
        child_allow: getIdx(['مخصصات الاطفال']),
        loan_ded: getIdx(['استقطاع مبلغ القرض']),
        exec_ded: getIdx(['مبلغ التنفيذ']),
        tax_ded: getIdx(['الضريبة']),
        retire_ded: getIdx(['التقاعد']),
        social_ded: getIdx(['الحماية الاجتماعية']),
        stamp_ded: getIdx(['طابع مدرسي']),
        total_ded: getIdx(['مجموع الاستقطاعات']),
        net_sal: getIdx(['الراتب الصافي']),
        iban: getIdx(['IBAN', 'الايبان']),
        committees: getIdx(['عدد اللجان']),
        thanks: getIdx(['عدد كتب الشكر'])
    };

    console.log('📋 Column Mapping (Card Number is key)...');

    // Fetch Profiles
    console.log('🔄 Fetching profiles and mapping by Card Number...');
    const { data: profiles, error } = await supabase.from('profiles').select('card_number, id, job_number');

    if (error) {
        console.error('❌ Failed to fetch profiles:', error.message);
        process.exit(1);
    }

    const cardToId = new Map();
    let cardsFound = 0;
    profiles.forEach(p => {
        if (p.card_number) {
            cardToId.set(String(p.card_number).trim(), p.id);
            cardsFound++;
        }
    });

    console.log(`📊 DB Profiles with Card Numbers: ${cardsFound} / ${profiles.length}`);

    if (cardsFound === 0) {
        console.error('❌ No card numbers found in DB. Please populate card_number first.');
        process.exit(1);
    }

    let updated = 0;
    let skipped = 0;
    let notFound = 0;

    // Process data rows (starting from row 2)
    sheet.eachRow(async (row, rowNumber) => {
        if (rowNumber === 1) return; // Skip header row
        
        const rowValues = [];
        row.eachCell((cell) => {
            rowValues.push(cell.value);
        });

        if (!rowValues || rowValues.length === 0) return;

        const cardNumVal = rowValues[colMap.excel_card_col];
        if (!cardNumVal) { skipped++; return; }

        const cardNum = String(cardNumVal).trim();
        const userId = cardToId.get(cardNum);

        if (!userId) {
            // console.warn(`⚠️ User not found for Card: ${cardNum}`);
            notFound++;
            return;
        }

        const certTextValue = parseStr(rowValues[colMap.cert_text]);
        const certPercValue = getCertPerc(certTextValue);

        // Prepare Financial Record
        const financialData = {
            user_id: userId,
            job_title: parseStr(rowValues[colMap.job_title]),

            certificate_text: certTextValue,
            certificate_percentage: certPercValue,

            salary_grade: parseStr(rowValues[colMap.grade]),
            salary_stage: parseStr(rowValues[colMap.stage]),
            tax_deduction_status: parseStr(rowValues[colMap.tax_status]),
            nominal_salary: parseNum(rowValues[colMap.nominal]),
            certificate_allowance: parseNum(rowValues[colMap.cert_allow]),
            position_allowance: parseNum(rowValues[colMap.pos_allow]),
            engineering_allowance: parseNum(rowValues[colMap.eng_allow]),
            risk_allowance: parseNum(rowValues[colMap.risk_allow]),
            legal_allowance: parseNum(rowValues[colMap.legal_allow]),
            additional_50_percent_allowance: parseNum(rowValues[colMap.add_allow]),
            transport_allowance: parseNum(rowValues[colMap.trans_allow]),
            marital_allowance: parseNum(rowValues[colMap.mar_allow]),
            children_allowance: parseNum(rowValues[colMap.child_allow]),
            loan_deduction: parseNum(rowValues[colMap.loan_ded]),
            execution_deduction: parseNum(rowValues[colMap.exec_ded]),
            tax_deduction_amount: parseNum(rowValues[colMap.tax_ded]),
            retirement_deduction: parseNum(rowValues[colMap.retire_ded]),
            social_security_deduction: parseNum(rowValues[colMap.social_ded]),
            school_stamp_deduction: parseNum(rowValues[colMap.stamp_ded]),
            total_deductions: parseNum(rowValues[colMap.total_ded]),
            net_salary: parseNum(rowValues[colMap.net_sal]),
            iban: parseStr(rowValues[colMap.iban]),
            updated_at: new Date()
        };

        const yearlyData = {
            user_id: userId,
            year: 2025,
            committees_count: parseNum(rowValues[colMap.committees]),
            thanks_books_count: parseNum(rowValues[colMap.thanks]),
            updated_at: new Date()
        };

        // Execute Upserts
        const { error: delErr } = await supabase.from('financial_records').delete().eq('user_id', userId);
        if (delErr) console.error(`❌ Delete failed for ${userId}:`, delErr.message);

        const { error: insErr } = await supabase.from('financial_records').insert(financialData);
        if (insErr) {
            console.error(`❌ Insert failed for ${userId}:`, insErr.message);
        }

        const { data: existingYearly } = await supabase.from('yearly_records')
            .select('id').eq('user_id', userId).eq('year', 2025).maybeSingle();
        if (existingYearly) {
            await supabase.from('yearly_records').update(yearlyData).eq('id', existingYearly.id);
        } else {
            await supabase.from('yearly_records').insert(yearlyData);
        }

        updated++;
        if (updated % 10 === 0) process.stdout.write('.');
    });

    // Wait for all operations to complete
    await new Promise(resolve => setTimeout(resolve, 2000));

    console.log(`\n\n✅ Finished Phase 2 (via Card ID).`);
    console.log(`Updated: ${updated}`);
    console.log(`Not Found: ${notFound}`);
}

importPhase2().catch(e => console.error(e));