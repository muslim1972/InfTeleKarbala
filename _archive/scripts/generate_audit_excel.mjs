import fs from 'fs';
import path from 'path';
import ExcelJS from 'exceljs';

// 1. قراءة البيانات المستخرجة من VPS
const rawJsonPath = 'D:/InfTeleKarbala/_archive/data/audit_raw.json';
const rawText = fs.readFileSync(rawJsonPath, 'utf8').replace(/^\uFEFF/, '');
const data = JSON.parse(rawText);

const departments = data.departments || [];
const profiles = data.profiles || [];
const locations = data.locations || [];

console.log(`قراءة البيانات: ${profiles.length} موظف، ${departments.length} تشكيل إداري، ${locations.length} ارتباط موقع بصمة.`);

// خريطة مواقع البصمة
const locMap = new Map();
for (const l of locations) {
    if (l.employee_id) {
        locMap.set(l.employee_id, l.location_names || '');
    }
}

// خريطة التشكيلات الإدارية بالمعرف
const deptById = new Map();
for (const d of departments) {
    deptById.set(d.id, d);
}

// خريطة مسؤولي التشكيلات (manager_id -> department)
const managedDeptsByManager = new Map();
for (const d of departments) {
    if (d.manager_id) {
        if (!managedDeptsByManager.has(d.manager_id)) {
            managedDeptsByManager.set(d.manager_id, []);
        }
        managedDeptsByManager.get(d.manager_id).push(d);
    }
}

// قراءة كلمات المرور الصريحة للعقود الـ 28 من ملف إكسل العقود إن وُجد
const contractPasswords = new Map();
const contractExcelPath = 'F:/صور للتجربة/نظام المديرية/excel/الرمز السري للعقود.xlsx';
if (fs.existsSync(contractExcelPath)) {
    try {
        const wbContracts = new ExcelJS.Workbook();
        await wbContracts.xlsx.readFile(contractExcelPath);
        const ws = wbContracts.worksheets[0];
        ws.eachRow((row, rowIdx) => {
            if (rowIdx === 1) return; // header
            // الأعمدة: 1 username, 2 full_name, 3 password, 4 job_number
            const username = String(row.getCell(1).value || '').trim();
            const fullName = String(row.getCell(2).value || '').trim();
            const password = String(row.getCell(3).value || '').trim();
            const jobNumber = String(row.getCell(4).value || '').trim();
            if (jobNumber && password) contractPasswords.set(jobNumber, password);
            if (username && password) contractPasswords.set(username, password);
            if (fullName && password) contractPasswords.set(fullName, password);
        });
        console.log(`تم تحميل ${contractPasswords.size} كلمة مرور للعقود من ملف العقود.`);
    } catch (e) {
        console.warn('تعذر قراءة ملف العقود لكلمات المرور:', e.message);
    }
}

// دالة المقارنة وتوحيد النصوص العربية (مطابقة تماماً لـ profileUtils.ts)
function normalizeForComparison(text) {
    if (!text || typeof text !== 'string') return '';
    const normalized = text
        .trim()
        .replace(/\s+/g, ' ')
        .replace(/[إأآ]/g, 'ا')
        .replace(/ة/g, 'ه')
        .replace(/ى/g, 'ي')
        .replace(/[\u064B-\u065F\u0670]/g, '')
        .toLowerCase();
    return normalized.split(' ').sort().join(' ');
}

// معالجة كل موظف وحساب الأعمدة والتدقيق
const rowsData = [];

for (const p of profiles) {
    const jobNumber = String(p.job_number || '').trim();
    const fullName = String(p.full_name || '').trim();
    const username = String(p.username || '').trim();

    // 1. كلمة المرور
    let passwordDisplay = '';
    if (p.password && String(p.password).trim() !== '') {
        passwordDisplay = String(p.password).trim();
    } else if (contractPasswords.has(jobNumber)) {
        passwordDisplay = contractPasswords.get(jobNumber);
    } else if (contractPasswords.has(username)) {
        passwordDisplay = contractPasswords.get(username);
    } else if (contractPasswords.has(fullName)) {
        passwordDisplay = contractPasswords.get(fullName);
    } else {
        passwordDisplay = 'مشفرة في خادم الهوية (Auth)';
    }

    // 2. المرجع / التشكيل الإداري (الصورة الأولى)
    let adminFormation = 'غير محدد';
    let adminFormationLevel = null;
    let explicitDept = null;
    if (p.department_id && deptById.has(p.department_id)) {
        explicitDept = deptById.get(p.department_id);
        adminFormation = `${explicitDept.name} (مستوى ${explicitDept.level})`;
        adminFormationLevel = explicitDept.level;
    }

    // 3. القسم (الصورة الثانية)
    const deptText = p.dept_text ? String(p.dept_text).trim() : '';

    // 4. الشعبة (الصورة الثانية)
    const sectionText = p.section_text ? String(p.section_text).trim() : '';

    // 5. الوحدة (الصورة الثانية)
    const unitText = p.unit_text ? String(p.unit_text).trim() : '';

    // 6. جهة الارتباط في الهيكلية الإدارية (الصورة الثالثة)
    // كما في DepartmentsManager.tsx:
    // أولاً: فحص هل هو مسؤول تشكيل؟
    let hierarchyLink = '';
    const managedList = managedDeptsByManager.get(p.id) || [];
    if (managedList.length > 0) {
        hierarchyLink = managedList.map(d => `مسؤول ${d.name} (مستوى ${d.level})`).join(' | ');
    } else {
        // ثانياً: ربط بالـ department_id الصريح إن وجد
        let assignedDeptId = p.department_id || null;

        // ثالثاً: فحص النصوص (الوحدة -> الشعبة -> القسم)
        const normUnit = normalizeForComparison(unitText);
        const normSection = normalizeForComparison(sectionText);
        const normDept = normalizeForComparison(deptText);

        if (!assignedDeptId && normUnit) {
            const m = departments.find(d => normalizeForComparison(d.name) === normUnit);
            if (m) assignedDeptId = m.id;
        }
        if (!assignedDeptId && normSection) {
            const m = departments.find(d => normalizeForComparison(d.name) === normSection);
            if (m) assignedDeptId = m.id;
        }
        if (!assignedDeptId && normDept) {
            const m = departments.find(d => normalizeForComparison(d.name) === normDept);
            if (m) assignedDeptId = m.id;
        }

        if (assignedDeptId && deptById.has(assignedDeptId)) {
            const ad = deptById.get(assignedDeptId);
            const isTextMatched = !p.department_id && assignedDeptId;
            hierarchyLink = `${ad.name} (مستوى ${ad.level})${isTextMatched ? ' [ربط تلقائي بالاسم]' : ''}`;
        } else {
            hierarchyLink = 'غير مرتبط في الهيكلية';
        }
    }

    // 7. موقع العمل المرتبط بالبصمة (الصورة الرابعة)
    const biometricLocation = locMap.get(p.id) || 'غير مرتبط بموقع بصمة';

    // 8. التحليل التدقيقي والتعارضات (Audit Engine)
    const issues = [];

    const hasAdminFormation = adminFormation !== 'غير محدد';
    const hasBiometric = biometricLocation !== 'غير مرتبط بموقع بصمة';
    const hasHierarchy = hierarchyLink !== 'غير مرتبط في الهيكلية';
    const hasSectionOrDept = sectionText !== '' || deptText !== '';

    if (!hasAdminFormation) {
        issues.push('المرجع/التشكيل الإداري غير محدد');
    }
    if (!hasHierarchy) {
        issues.push('غير مسجل في شجرة الهيكلية الإدارية');
    }
    if (!hasBiometric) {
        issues.push('غير مرتبط بموقع بصمة');
    }

    // فحص التوافق بين الشعبة النصية والمرجع الإداري
    if (explicitDept && sectionText) {
        const normDeptName = normalizeForComparison(explicitDept.name);
        const normSec = normalizeForComparison(sectionText);
        // هل أحدهما يحتوي الآخر أو يتطابقان؟
        const wordsDept = normDeptName.split(' ');
        const wordsSec = normSec.split(' ');
        const overlap = wordsDept.filter(w => wordsSec.includes(w) && w.length > 2);
        if (overlap.length === 0 && !normDeptName.includes(normSec) && !normSec.includes(normDeptName)) {
            issues.push(`اختلاف: المرجع الإداري (${explicitDept.name}) ≠ الشعبة (${sectionText})`);
        }
    }

    // فحص التوافق بين موقع البصمة والشعبة/المرجع
    if (hasBiometric) {
        const targetRefName = explicitDept ? explicitDept.name : (sectionText || deptText);
        if (targetRefName) {
            const normBio = normalizeForComparison(biometricLocation);
            const normRef = normalizeForComparison(targetRefName);
            const wordsBio = normBio.split(' ');
            const wordsRef = normRef.split(' ');
            const overlap = wordsBio.filter(w => wordsRef.includes(w) && w.length > 2);
            if (overlap.length === 0 && !normBio.includes(normRef) && !normRef.includes(normBio)) {
                // استثناء المقرات العامة أو المجمعات إذا كانت تابعة لنفس الدائرة
                issues.push(`انتباه: موقع البصمة (${biometricLocation}) يختلف عن التشكيل (${targetRefName})`);
            }
        }
    }

    let auditStatus = '✅ متطابق ومتكامل';
    let auditSeverity = 'ok'; // ok, warning, error

    if (issues.length > 0) {
        if (!hasAdminFormation || !hasBiometric || !hasHierarchy) {
            auditStatus = `⚠️ نواقص (${issues.length})`;
            auditSeverity = 'warning';
        } else {
            auditStatus = `⚠️ تعارض (${issues.length})`;
            auditSeverity = 'discrepancy';
        }
    }

    rowsData.push({
        fullName,
        username,
        jobNumber,
        passwordDisplay,
        adminFormation,
        deptText: deptText || 'غير محدد',
        sectionText: sectionText || 'غير محدد',
        unitText: unitText || 'غير محدد',
        hierarchyLink,
        biometricLocation,
        auditStatus,
        auditSeverity,
        issuesText: issues.length > 0 ? issues.join(' | ') : 'مطابق ومتسق في كامل المنظومة'
    });
}

// ترتيب الصفوف: من لديه ملاحظات أولاً ثم المتطابقون، لسهولة المتابعة
rowsData.sort((a, b) => {
    if (a.auditSeverity !== 'ok' && b.auditSeverity === 'ok') return -1;
    if (a.auditSeverity === 'ok' && b.auditSeverity !== 'ok') return 1;
    return a.fullName.localeCompare(b.fullName, 'ar');
});

// 2. بناء ملف Excel الاحترافي
const wb = new ExcelJS.Workbook();
wb.creator = 'نظام إدارة اتصالات ومعلوماتية كربلاء';
wb.created = new Date();

// ─── ورقة 1: سجل التدقيق الشامل ───
const wsAll = wb.addWorksheet('سجل التدقيق الشامل (378 موظف)', {
    views: [{ rtl: true, showGridLines: true }]
});

const columnsDef = [
    { header: 'ت', key: 'seq', width: 6 },
    { header: 'اسم الموظف', key: 'fullName', width: 32 },
    { header: 'اسم المستخدم', key: 'username', width: 24 },
    { header: 'الرقم الوظيفي', key: 'jobNumber', width: 16 },
    { header: 'كلمة المرور', key: 'passwordDisplay', width: 28 },
    { header: 'المرجع / التشكيل الإداري (الصورة 1)', key: 'adminFormation', width: 36 },
    { header: 'القسم (الصورة 2)', key: 'deptText', width: 32 },
    { header: 'الشعبة (الصورة 2)', key: 'sectionText', width: 32 },
    { header: 'الوحدة (الصورة 2)', key: 'unitText', width: 22 },
    { header: 'جهة الارتباط في الهيكلية الإدارية (الصورة 3)', key: 'hierarchyLink', width: 38 },
    { header: 'موقع العمل المرتبط بالبصمة (الصورة 4)', key: 'biometricLocation', width: 38 },
    { header: 'حالة المطابقة', key: 'auditStatus', width: 20 },
    { header: 'الملاحظات والتعارضات التدقيقية', key: 'issuesText', width: 50 },
];

wsAll.columns = columnsDef;

// تنسيق صف العناوين
const headerRow = wsAll.getRow(1);
headerRow.height = 34;
headerRow.eachCell((cell) => {
    cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1E3A8A' } // Navy blue
    };
    cell.font = {
        name: 'Segoe UI',
        size: 11,
        bold: true,
        color: { argb: 'FFFFFFFF' }
    };
    cell.alignment = {
        vertical: 'middle',
        horizontal: 'center',
        wrapText: true
    };
    cell.border = {
        top: { style: 'medium', color: { argb: 'FF0F2356' } },
        bottom: { style: 'medium', color: { argb: 'FF0F2356' } },
        left: { style: 'thin', color: { argb: 'FF3B82F6' } },
        right: { style: 'thin', color: { argb: 'FF3B82F6' } }
    };
});

// تعبئة البيانات في ورقة 1
rowsData.forEach((item, idx) => {
    const row = wsAll.addRow({
        seq: idx + 1,
        fullName: item.fullName,
        username: item.username,
        jobNumber: item.jobNumber,
        passwordDisplay: item.passwordDisplay,
        adminFormation: item.adminFormation,
        deptText: item.deptText,
        sectionText: item.sectionText,
        unitText: item.unitText,
        hierarchyLink: item.hierarchyLink,
        biometricLocation: item.biometricLocation,
        auditStatus: item.auditStatus,
        issuesText: item.issuesText
    });
    row.height = 24;

    // تلوين الصفوف حسب الحالة
    let bgColor = (idx % 2 === 0) ? 'FFFFFFFF' : 'FFF8FAFC'; // أبيض رمادي ناعم
    if (item.auditSeverity === 'warning') {
        bgColor = (idx % 2 === 0) ? 'FFFFFBEB' : 'FFFEF3C7'; // أصفر تحذيري ناعم
    } else if (item.auditSeverity === 'discrepancy') {
        bgColor = (idx % 2 === 0) ? 'FFFFF1F2' : 'FFFFE4E6'; // أحمر فاتح جداً للتعارض
    }

    row.eachCell((cell, colNumber) => {
        cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: bgColor }
        };
        cell.font = {
            name: 'Segoe UI',
            size: 10,
            bold: colNumber === 2 || colNumber === 4 || colNumber === 12
        };
        cell.alignment = {
            vertical: 'middle',
            horizontal: colNumber === 1 || colNumber === 4 || colNumber === 12 ? 'center' : 'right'
        };
        cell.border = {
            top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
        };

        if (colNumber === 12) {
            if (item.auditSeverity === 'ok') {
                cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF15803D' } }; // أخضر
            } else if (item.auditSeverity === 'warning') {
                cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFB45309' } }; // برتقالي
            } else {
                cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFB91C1C' } }; // أحمر
            }
        }
    });
});

wsAll.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: rowsData.length + 1, column: columnsDef.length }
};

// ─── ورقة 2: قائمة التعارضات والنواقص فقط ───
const wsDiscrepancies = wb.addWorksheet('قائمة التعارضات والنواقص', {
    views: [{ rtl: true, showGridLines: true }]
});
wsDiscrepancies.columns = columnsDef;

const headerRow2 = wsDiscrepancies.getRow(1);
headerRow2.height = 34;
headerRow2.eachCell((cell) => {
    cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFB91C1C' } // Crimson Red
    };
    cell.font = {
        name: 'Segoe UI',
        size: 11,
        bold: true,
        color: { argb: 'FFFFFFFF' }
    };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = {
        top: { style: 'medium', color: { argb: 'FF7F1D1D' } },
        bottom: { style: 'medium', color: { argb: 'FF7F1D1D' } }
    };
});

const problematicRows = rowsData.filter(r => r.auditSeverity !== 'ok');
problematicRows.forEach((item, idx) => {
    const row = wsDiscrepancies.addRow({
        seq: idx + 1,
        fullName: item.fullName,
        username: item.username,
        jobNumber: item.jobNumber,
        passwordDisplay: item.passwordDisplay,
        adminFormation: item.adminFormation,
        deptText: item.deptText,
        sectionText: item.sectionText,
        unitText: item.unitText,
        hierarchyLink: item.hierarchyLink,
        biometricLocation: item.biometricLocation,
        auditStatus: item.auditStatus,
        issuesText: item.issuesText
    });
    row.height = 24;

    const bgColor = item.auditSeverity === 'warning'
        ? ((idx % 2 === 0) ? 'FFFFFBEB' : 'FFFEF3C7')
        : ((idx % 2 === 0) ? 'FFFFF1F2' : 'FFFFE4E6');

    row.eachCell((cell, colNumber) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
        cell.font = { name: 'Segoe UI', size: 10, bold: colNumber === 2 || colNumber === 4 || colNumber === 12 };
        cell.alignment = {
            vertical: 'middle',
            horizontal: colNumber === 1 || colNumber === 4 || colNumber === 12 ? 'center' : 'right'
        };
        cell.border = {
            top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
        };
    });
});

wsDiscrepancies.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: problematicRows.length + 1, column: columnsDef.length }
};

// ─── ورقة 3: لوحة الإحصائيات والملخص ───
const wsStats = wb.addWorksheet('إحصائيات التدقيق', {
    views: [{ rtl: true, showGridLines: true }]
});

wsStats.columns = [
    { header: 'المؤشر التدقيقي', key: 'metric', width: 38 },
    { header: 'العدد', key: 'count', width: 14 },
    { header: 'النسبة المئوية', key: 'percentage', width: 18 },
    { header: 'التوصية والإجراء المطلوب', key: 'recommendation', width: 50 },
];

const totalEmps = rowsData.length;
const okCount = rowsData.filter(r => r.auditSeverity === 'ok').length;
const missingFormationCount = rowsData.filter(r => r.adminFormation === 'غير محدد').length;
const missingHierarchyCount = rowsData.filter(r => r.hierarchyLink === 'غير مرتبط في الهيكلية').length;
const missingBiometricCount = rowsData.filter(r => r.biometricLocation === 'غير مرتبط بموقع بصمة').length;
const discrepancyCount = rowsData.filter(r => r.auditSeverity === 'discrepancy').length;

const statsRows = [
    {
        metric: 'إجمالي الموظفين المسجلين في كربلاء',
        count: totalEmps,
        percentage: '100%',
        recommendation: 'يشمل الملاك الدائم وموظفي العقود الـ 28 الجدد'
    },
    {
        metric: 'موظفون متطابقون ومتوافقون بالكامل',
        count: okCount,
        percentage: `${((okCount / totalEmps) * 100).toFixed(1)}%`,
        recommendation: 'بياناتهم منسجمة تماماً بين التشكيل والشعبة وموقع البصمة'
    },
    {
        metric: 'موظفون بحاجة لتحديد المرجع/التشكيل الإداري',
        count: missingFormationCount,
        percentage: `${((missingFormationCount / totalEmps) * 100).toFixed(1)}%`,
        recommendation: 'يُنصح باختيار التشكيل الإداري لهم من تبويبة «معلومات أساسية»'
    },
    {
        metric: 'موظفون غير مرتبطين في شجرة الهيكلية الإدارية',
        count: missingHierarchyCount,
        percentage: `${((missingHierarchyCount / totalEmps) * 100).toFixed(1)}%`,
        recommendation: 'يُنصح بإدراجهم ضمن أقسام وشعب الهيكلية في تبويبة «الهيكلية الإدارية»'
    },
    {
        metric: 'موظفون غير مرتبطين بموقع بصمة حضور',
        count: missingBiometricCount,
        percentage: `${((missingBiometricCount / totalEmps) * 100).toFixed(1)}%`,
        recommendation: 'يُنصح بربطهم بمواقعهم الجغرافية في تبويبة «إدارة البصمة -> ربط الموظفين»'
    },
    {
        metric: 'موظفون لديهم اختلاف بين موقع البصمة والشعبة/المرجع',
        count: discrepancyCount,
        percentage: `${((discrepancyCount / totalEmps) * 100).toFixed(1)}%`,
        recommendation: 'تدقيق مكان الدوام الفعلي ونقل الموقع أو تحديث الشعبة'
    }
];

const headerRow3 = wsStats.getRow(1);
headerRow3.height = 34;
headerRow3.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F766E' } }; // Teal
    cell.font = { name: 'Segoe UI', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
});

statsRows.forEach((item) => {
    const row = wsStats.addRow(item);
    row.height = 26;
    row.eachCell((cell, colNumber) => {
        cell.font = { name: 'Segoe UI', size: 10, bold: colNumber === 1 || colNumber === 2 };
        cell.alignment = {
            vertical: 'middle',
            horizontal: colNumber === 2 || colNumber === 3 ? 'center' : 'right'
        };
        cell.border = {
            top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
        };
    });
});

// حفظ الملف النهائي
const outputPath = 'D:/InfTeleKarbala/تدقيق_هيكلية_ومواقع_موظفي_كربلاء_2026.xlsx';
await wb.xlsx.writeFile(outputPath);
console.log(`✓ تم إنشاء ملف Excel بنجاح في: ${outputPath}`);

// نسخ الملف أيضاً إلى مجلد إكسل الخاص بالمستخدم إن كان متاحاً
const userFolder = 'F:/صور للتجربة/نظام المديرية/excel';
if (fs.existsSync(userFolder)) {
    const copyPath = path.join(userFolder, 'تدقيق_هيكلية_ومواقع_موظفي_كربلاء_2026.xlsx');
    try {
        fs.copyFileSync(outputPath, copyPath);
        console.log(`✓ تم نسخ نسخة إلى: ${copyPath}`);
    } catch (err) {
        console.warn('تعذر النسخ إلى القرص F:', err.message);
    }
}
