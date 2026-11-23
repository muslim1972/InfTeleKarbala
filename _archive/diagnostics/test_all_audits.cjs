const fs = require('fs');

function parseCSV(content) {
    const lines = content.split('\n');
    if (lines.length < 2) return [];
    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const values = [];
        let cur = '';
        let inQuotes = false;
        for (let j = 0; j < line.length; j++) {
            const ch = line[j];
            if (ch === '"') {
                inQuotes = !inQuotes;
            } else if (ch === ',' && !inQuotes) {
                values.push(cur.replace(/^"|"$/g, ''));
                cur = '';
            } else {
                cur += ch;
            }
        }
        values.push(cur.replace(/^"|"$/g, ''));
        const obj = {};
        headers.forEach((h, idx) => {
            obj[h] = values[idx] || '';
        });
        rows.push(obj);
    }
    return rows;
}

const csv = fs.readFileSync('D:/InfTeleKarbala/_archive/diagnostics/records.csv', 'utf8');
const records = parseCSV(csv);
console.log(`Loaded ${records.length} records.`);

// 1. Position Allowance
function resolvePositionPct(finData) {
    const pos = String(finData.position_title || '').trim();
    if (!pos || pos === 'بدون منصب' || pos === 'متقاعد') return 0;

    const parts = pos.split('/').map(p => p.trim());
    let maxPct = 0;

    for (const part of parts) {
        if (/بديل/.test(part)) continue;
        if (/مدير\s*المديرية/.test(part) && !/معاون/.test(part)) {
            maxPct = Math.max(maxPct, 25);
        } else if (/معاون\s*مدير\s*المديرية|مدير\s*قسم|مسؤول\s*قسم/.test(part)) {
            maxPct = Math.max(maxPct, 20);
        } else if (/مسؤول\s*شعبة|مسؤول\s*الشعبة|مسؤول\s*مجمع|مسؤول\s*المجمع/.test(part)) {
            maxPct = Math.max(maxPct, 15);
        }
    }
    return maxPct;
}

// 2. Legal Allowance
function getLegalPct(finData) {
    const title = String(finData.job_title || '').trim();
    const cert = String(finData.certificate_text || '').replace(/[0-9%.\s\-()]/g, '');
    const isLegal = /قانوني|مشاور|مستشار/.test(title);
    const isBach = cert.includes('بكلوريوس') || cert.includes('بكالوريوس');
    return (isLegal && isBach) ? 30 : 0;
}

// 3. Risk Allowance
function resolveRiskPct(finData) {
    const grade = parseInt(finData.salary_grade, 10);
    if ([8, 9, 10].includes(grade)) return 0; // Grades 8, 9, 10 get 50% additional allowance instead of risk
    const legal = getLegalPct(finData);
    if (legal === 30) return 0;
    return 30;
}

// 4. Additional 50% Allowance
function resolveAdditional50Pct(finData) {
    const grade = parseInt(finData.salary_grade, 10);
    return [8, 9, 10].includes(grade) ? 50 : 0;
}

// 5. Certificate Allowance
function resolveCertPct(finData) {
    const stored = parseFloat(finData.certificate_percentage);
    if (!isNaN(stored) && stored > 0) return (stored <= 1.5 ? Math.round(stored * 100) : stored);

    const cert = String(finData.certificate_text || '').replace(/[0-9%.\s\-()]/g, '');
    if (cert.includes('دكتوراه')) return 150;
    if (cert.includes('ماجستير')) return 125;
    if (cert.includes('دبلومعالي')) return 55;
    if (cert.includes('بكلوريوس') || cert.includes('بكالوريوس')) return 45;
    if (cert.includes('دبلوم') || cert.includes('معهد')) return 35;
    if (cert.includes('اعدادية') || cert.includes('إعدادية')) return 25;
    if (cert.includes('توسطة')) return 15;
    if (cert.includes('بتدائية') || cert.includes('إبتدائية') || cert.includes('دونالابتدائية')) return 15;
    if (cert.includes('يقرأ') || cert.includes('أمي')) return 15;
    return 0;
}

// Let's run all tests!
let r_pos = 0, r_risk = 0, r_cert = 0, r_legal = 0, r_add50 = 0, r_mar = 0;

for (const r of records) {
    if (r.is_retired === 't' || r.is_retired === 'true') continue;
    const jn = String(r.job_number || '').trim();
    const jt = String(r.job_title || '').trim();
    const isContract = jn.startsWith('143264') || /عقد|اجير|أجير/.test(jt);
    const nom = parseFloat(r.nominal_salary) || 0;
    const gross = parseFloat(r.gross_salary) || 0;
    const certAll = parseFloat(r.certificate_allowance) || 0;
    const riskAll = parseFloat(r.risk_allowance) || 0;
    const isFiveYear = (r.is_five_year_leave === 't' || r.is_five_year_leave === 'true' || (gross > 0 && Math.abs(gross - nom) < 10 && certAll === 0 && riskAll === 0));

    if (nom <= 0) continue;

    // Test Position
    if (!isContract && !isFiveYear) {
        const act = parseFloat(r.position_allowance) || 0;
        const exp = Math.round((nom * resolvePositionPct(r)) / 100);
        if (Math.abs(exp - act) > 10) {
            r_pos++;
        }
    }

    // Test Risk
    if (!isContract && !isFiveYear) {
        const act = parseFloat(r.risk_allowance) || 0;
        const exp = Math.round((nom * resolveRiskPct(r)) / 100);
        if (Math.abs(exp - act) > 10) {
            r_risk++;
            console.log(`Risk mismatch: ${r.full_name} | Grade: ${r.salary_grade} | Title: ${jt} | Act: ${act} | Exp: ${exp}`);
        }
    }

    // Test Legal
    if (!isContract && !isFiveYear) {
        const act = parseFloat(r.legal_allowance) || 0;
        const exp = Math.round((nom * getLegalPct(r)) / 100);
        if (Math.abs(exp - act) > 10) {
            r_legal++;
            console.log(`Legal mismatch: ${r.full_name} | Act: ${act} | Exp: ${exp}`);
        }
    }

    // Test Additional 50%
    if (!isContract && !isFiveYear) {
        const act = parseFloat(r.additional_50_percent_allowance) || 0;
        const exp = Math.round((nom * resolveAdditional50Pct(r)) / 100);
        if (Math.abs(exp - act) > 10) {
            r_add50++;
            console.log(`Add50 mismatch: ${r.full_name} | Grade: ${r.salary_grade} | Act: ${act} | Exp: ${exp}`);
        }
    }

    // Test Certificate
    if (!isContract && !isFiveYear) {
        const act = parseFloat(r.certificate_allowance) || 0;
        const exp = Math.round((nom * resolveCertPct(r)) / 100);
        if (Math.abs(exp - act) > 10) {
            r_cert++;
            console.log(`Cert mismatch: ${r.full_name} | Cert: "${r.certificate_text}" | Nom: ${nom} | Act: ${act} | Exp: ${exp}`);
        }
    }

    // Test Marital (Flat 50,000 for married, 0 for unmarried)
    if (!isContract && !isFiveYear) {
        const act = parseFloat(r.marital_allowance) || 0;
        // Marital allowance in Iraq is either 50000 or 0
        if (act > 0 && Math.abs(act - 50000) > 10) {
            r_mar++;
            console.log(`Marital mismatch: ${r.full_name} | Act: ${act}`);
        }
    }
}

console.log("\n================ RESULTS ================");
console.log(`Position mismatches: ${r_pos}`);
console.log(`Risk mismatches: ${r_risk}`);
console.log(`Legal mismatches: ${r_legal}`);
console.log(`Additional 50% mismatches: ${r_add50}`);
console.log(`Certificate mismatches: ${r_cert}`);
console.log(`Marital mismatches (non-50k): ${r_mar}`);
