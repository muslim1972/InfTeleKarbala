with open('src/utils/salaryRules.ts', 'r', encoding='utf-8') as f:
    text = f.read()

# Replace risk_allowance, position_allowance, and additional_50_percent_allowance
target_block = """    // --- 4. مخصصات الخطورة ---
    if (fieldKey === 'risk_allowance') {
        const legalPct = getLegalAllowancePercentage(finData);
        if (legalPct === 30) return 0; // إذا كان مستحقاً للقانونية، تحجب الخطورة
        return 30; // غير القانوني يستحق 30% خطورة
    }

    // --- 5. مخصصات المنصب (النسب الوزارية المعتمدة الرسمية) ---
    if (fieldKey === 'position_allowance') {
        const pos = String(finData.administrative_position || finData.position || '').trim();
        const fullText = `${pos} ${title}`.trim();

        if (/مدير\s*المديرية|مدير\s*مديرية/i.test(fullText) && !/معاون/i.test(fullText) && !/مكتب/i.test(fullText)) {
            return 25; // مدير المديرية 25%
        }
        if (/معاون\s*مدير/i.test(fullText)) {
            return 20; // معاون مدير المديرية 20%
        }
        if (/مدير\s*قسم|مسؤول\s*قسم|مسئول\s*قسم|مدير\s*القسم|مسؤول\s*القسم/i.test(fullText)) {
            return 20; // مدير قسم أو مسؤول قسم 20%
        }
        if (/مسؤول\s*شعبة|مسئول\s*شعبة|مسؤول\s*الشعبة|مسؤول\s*مجمع|مسؤول\s*المجمع/i.test(fullText)) {
            return 15; // مسؤول شعبة أو مجمع 15%
        }
        if (/مسؤول\s*وحدة|مسئول\s*وحدة|مسؤول\s*الوحدة/i.test(fullText)) {
            return 0; // مسؤول وحدة لا شيء
        }

        // التحقق الذكي من النسبة المدفوعة فعلياً إن طابقت أحد النسب المعتمدة (25, 20, 15)
        const val = parseFloat(finData.position_allowance) || 0;
        if (val > 0 && nom > 0) {
            const pct = Math.round((val / nom) * 100);
            if ([25, 20, 15].includes(pct)) return pct;
        }
        return 0;
    }

    // --- 6. المخصصات الإضافية 50% ---
    if (fieldKey === 'additional_50_percent_allowance') {
        const val = parseFloat(finData.additional_50_percent_allowance) || 0;
        return val > 0 ? 50 : 0;
    }"""

repl_block = """    // --- 4. مخصصات الخطورة ---
    if (fieldKey === 'risk_allowance') {
        const legalPct = getLegalAllowancePercentage(finData);
        if (legalPct === 30) return 0; // إذا كان مستحقاً للقانونية، تحجب الخطورة
        const grade = Number(finData.salary_grade);
        if ([8, 9, 10].includes(grade)) return 0; // الدرجات 8 و 9 و 10 خطورتهم صفر ويستحقون مخصصات إضافية 50%
        return 30; // غير القانوني ومن الدرجات 1 إلى 7 يستحق 30% خطورة
    }

    // --- 5. مخصصات المنصب (النسب الوزارية المعتمدة الرسمية) ---
    if (fieldKey === 'position_allowance') {
        // فحص المنصب الإداري حصراً (عدم الخلط مع العناوين الوظيفية مثل معاون مدير أو مدير أقدم)
        const pos = String(finData.administrative_position || finData.position || finData.position_title || '').trim();
        if (!pos) {
            const val = parseFloat(finData.position_allowance) || 0;
            if (val > 0 && nom > 0) {
                const pct = Math.round((val / nom) * 100);
                if ([25, 20, 15].includes(pct)) return pct;
            }
            return 0;
        }

        // فصل الأدوار إن كان الموظف يجمع بين منصب أصيل ومنصب بديل (مثل: مسؤول شعبة / بديل مدير قسم)
        const roles = pos.split(/[/,]/).map(s => s.trim());
        let bestPct = 0;
        for (const role of roles) {
            if (/بديل/i.test(role)) continue; // أي تكليف بصفة بديل لا تترتب عليه مخصصات منصب
            if (/مدير\s*المديرية/i.test(role) && !/معاون/i.test(role) && !/مكتب/i.test(role)) {
                bestPct = Math.max(bestPct, 25);
            } else if (/معاون\s*مدير/i.test(role)) {
                bestPct = Math.max(bestPct, 20);
            } else if (/مدير\s*قسم|مسؤول\s*قسم|مدير\s*القسم|مسؤول\s*القسم/i.test(role)) {
                bestPct = Math.max(bestPct, 20);
            } else if (/مسؤول\s*شعبة|مسؤول\s*الشعبة|مسؤول\s*مجمع|مسؤول\s*المجمع/i.test(role)) {
                bestPct = Math.max(bestPct, 15);
            }
        }
        return bestPct;
    }

    // --- 6. المخصصات الإضافية 50% ---
    if (fieldKey === 'additional_50_percent_allowance') {
        const grade = Number(finData.salary_grade);
        if ([8, 9, 10].includes(grade)) return 50; // الدرجات 8 و 9 و 10 تستحق 50% إضافية
        return 0;
    }"""

if target_block in text:
    text = text.replace(target_block, repl_block)
    with open('src/utils/salaryRules.ts', 'w', encoding='utf-8') as f:
        f.write(text)
    print("Updated salaryRules.ts successfully!")
else:
    print("target_block not found in salaryRules.ts")
