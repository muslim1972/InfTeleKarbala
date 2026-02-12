const fs = require('fs');
const buf = fs.readFileSync('D:/InfTeleKarbala/rwservlet.xml');
const text = buf.toString('utf8');

// Extract percentage fields from XML tags content (the description tags contain percentages)
const descFields = text.match(/<GET_DESC_COD_[^>]+>[^<]*%[^<]*<\/GET_DESC_COD_[^>]+>/g) || [];
console.log('=== FIELDS WITH PERCENTAGES ===');
const uniqueDescs = new Set();
descFields.forEach(f => {
    uniqueDescs.add(f);
});
[...uniqueDescs].slice(0, 30).forEach(d => console.log(d));

// Analyze salary calculations for first 5 records
console.log('\n\n=== SALARY CALCULATION ANALYSIS ===');
const records = text.split('<G_SAL_ID>').slice(1, 6);

records.forEach((rec, i) => {
    const getVal = (tag) => {
        const m = rec.match(new RegExp(`<${tag}>([^<]*)</${tag}>`));
        return m ? m[1] : '';
    };
    const getNum = (tag) => parseInt(getVal(tag)) || 0;

    const salary = getNum('SAL_NEW_SAL');       // الراتب الاسمي
    const espCert = getNum('SAL_ESP_CERT');      // مخصصات الشهادة
    const espJob = getNum('SAL_ESP_JOB1');       // مخصصات المنصب
    const geometEsp = getNum('GEOMET_ESP');       // مخصصات هندسية
    const danger = getNum('SAL_DANGER');          // مخصصات الخطورة
    const espAdd = getNum('SAL_ESP_ADD');         // مخصصات اضافية
    const espHous = getNum('SAL_ESP_HOUS');       // مخصصات السكن
    const espMari = getNum('SAL_ESP_MARI');       // مخصصات الزوجية
    const espCh = getNum('SAL_ESP_CH');           // مخصصات الاطفال
    const grossPay = getNum('SAL_GRESS_PAY');     // اجمالي الراتب
    const tax = getNum('SAL_TAX');                // الضريبة
    const deduction = getNum('SAL_DEDUCTION');    // التقاعد
    const totalDebt = getNum('SAL_TOTAL_DEBAT');  // اجمالي الاستقطاعات
    const netPay = getNum('SAL_NET_PAY');         // صافي الراتب
    const secC = getNum('SAL_SEC_C');             // التأمين
    const schol = getNum('SAL_SCHOL');            // التعليم
    const children = getNum('SAL_NO_CHILD');      // عدد الاطفال
    const deg = getVal('SAL_DEG_C');              // الدرجة
    const step = getVal('SAL_STEP');              // المرحلة

    // Descriptions
    const certDesc = getVal('GET_DESC_COD_5_SAL_CERT_C_');
    const unitDesc = getVal('GET_DESC_COD_22_SAL_UNIT_C_');
    const dangerDesc = getVal('GET_DESC_COD_19_SAL_ESP_DEG_FL');
    const taxDesc = getVal('GET_DESC_COD_7_SAL_TAX_C_');

    console.log(`\n--- Record ${i + 1} (Deg: ${deg}, Step: ${step}) ---`);
    console.log(`Cert Desc: ${certDesc}`);
    console.log(`Unit Desc: ${unitDesc}`);
    console.log(`Danger Desc: ${dangerDesc}`);
    console.log(`Tax Desc: ${taxDesc}`);
    console.log(`Salary (SAL_NEW_SAL): ${salary}`);
    console.log(`ESP_CERT: ${espCert} (${salary > 0 ? ((espCert / salary) * 100).toFixed(1) : 0}%)`);
    console.log(`ESP_JOB1: ${espJob}`);
    console.log(`GEOMET_ESP: ${geometEsp} (${salary > 0 ? ((geometEsp / salary) * 100).toFixed(1) : 0}%)`);
    console.log(`DANGER: ${danger} (${salary > 0 ? ((danger / salary) * 100).toFixed(1) : 0}%)`);
    console.log(`ESP_ADD: ${espAdd} (${salary > 0 ? ((espAdd / salary) * 100).toFixed(1) : 0}%)`);
    console.log(`ESP_HOUS: ${espHous}`);
    console.log(`ESP_MARI: ${espMari}`);
    console.log(`ESP_CH: ${espCh} (children: ${children})`);
    console.log(`GROSS: ${grossPay}`);
    console.log(`DEDUCTION (Retirement): ${deduction} (${salary > 0 ? ((deduction / salary) * 100).toFixed(1) : 0}%)`);
    console.log(`TAX: ${tax}`);
    console.log(`SEC_C: ${secC}`);
    console.log(`SCHOL: ${schol}`);
    console.log(`TOTAL_DEBAT: ${totalDebt}`);
    console.log(`NET_PAY: ${netPay}`);
    console.log(`Verify GROSS = salary + all esp: ${salary + espCert + espJob + geometEsp + danger + espAdd + espHous + espMari + espCh}`);
});
