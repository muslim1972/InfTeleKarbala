// Test script for resolveDepartmentHierarchy
function normalizeArabicText(text) {
    if (!text) return '';
    return text
        .toString()
        .trim()
        .replace(/[\u064B-\u065F\u0670]/g, '') // remove tashkeel
        .replace(/[إأآا]/g, 'ا')
        .replace(/ى/g, 'ي')
        .replace(/ة/g, 'ه')
        .replace(/[\u0640]/g, '') // remove tatweel
        .replace(/\s+/g, ' ');
}

// Semantic alias dictionary
const SEMANTIC_ALIASES = [
    { canonical: 'مجمع اتصالات قضاء الهندية', aliases: ['مجمع اتصالات الهندية', 'مجمع اتصالات الهنديه', 'مجمع الهندية', 'الهندية', 'مجمع الهنديه'] },
    { canonical: 'مجمع اتصالات سيد الشهداء (ع)', aliases: ['مجمع اتصالات سيد الشهداء', 'مجمع سيد الشهداء', 'سيد الشهداء', 'سيد الشهداء (ع)'] },
    { canonical: 'مجمع اتصالات عين التمر', aliases: ['مجمع عين التمر', 'عين التمر', 'مجمع اتصالات عين التمر'] },
    { canonical: 'مجمع اتصالات الحر', aliases: ['مجمع اتصالات الحر (ع)', 'مجمع الحر', 'الحر', 'مجمع اتصالات الحر'] },
    { canonical: 'مجمع اتصالات الخيرات', aliases: ['مجمع الخيرات', 'الخيرات', 'مجمع اتصالات الخيرات'] },
    { canonical: 'مجمع اتصالات الجدول الغربي', aliases: ['مجمع الجدول الغربي', 'الجدول الغربي'] },
    { canonical: 'مجمع اتصالات قضاء الحسينية', aliases: ['مجمع الحسينية', 'الحسينية', 'قضاء الحسينية'] },
    { canonical: 'شعبة العلاقات والاعلام', aliases: ['شعبة الإعلام والعلاقات', 'شعبة الاعلام والعلاقات', 'الاعلام والعلاقات', 'العلاقات والاعلام', 'الاعلام', 'العلاقات'] },
    { canonical: 'شعبة التخطيط والمتابعة', aliases: ['شعبه التخطيط والمتابعه', 'شعبة التخطيط و المتابعة', 'التخطيط والمتابعة', 'التخطيط والمتابعه', 'التخطيط'] },
    { canonical: 'شعبة الخدمات الادارية والنقليات', aliases: ['شعبة الخدمات الإدارية', 'شعبة الخدمات الادارية', 'الخدمات الادارية', 'الخدمات الادارية والنقليات', 'النقليات'] },
    { canonical: 'شعبة الشؤون المالية', aliases: ['الشعبة المالية', 'شعبة المالية', 'المالية', 'الشؤون المالية'] },
    { canonical: 'شعبة التسويق والمتابعة', aliases: ['شعبة التسويق والمتابعه', 'التسويق والمتابعة', 'التسويق'] },
    { canonical: 'وحدة البيانات', aliases: ['وحدة البيانات', 'وحده البيانات', 'البيانات'] },
    { canonical: 'شعبة تناقل البيانات IP', aliases: ['تناقل البيانات', 'شعبة تناقل البيانات', 'تناقل البيانات IP', 'IP'] },
    { canonical: 'شعبة ادارة الموارد البشرية', aliases: ['شعبة الموارد البشرية', 'الموارد البشرية', 'شعبة الموارد', 'الموارد'] },
    { canonical: 'شعبة المخازن', aliases: ['شعبة المخازن', 'المخازن'] },
    { canonical: 'شعبة القدرة', aliases: ['شعبة القدرة', 'القدرة'] },
    { canonical: 'شعبة المباني', aliases: ['شعبة المباني', 'المباني'] },
    { canonical: 'الشعبة القانونية', aliases: ['شعبة القانونية', 'القانونية'] },
    { canonical: 'شعبة GIS', aliases: ['GIS', 'شعبة GIS', 'جي اي اس'] },
    { canonical: 'قسم المالي والاداري', aliases: ['القسم المالي والاداري', 'القسم المالي', 'القسم الاداري'] },
    { canonical: 'قسم التراسل', aliases: ['قسم التراسل', 'التراسل'] },
    { canonical: 'قسم الشبكات', aliases: ['قسم الشبكات', 'الشبكات'] },
    { canonical: 'قسم تجهيز خدمات المعلوماتية', aliases: ['المعلوماتية', 'تجهيز الخدمة', 'تجهيز خدمات المعلوماتية'] }
];

function cleanDepartmentStem(text) {
    return normalizeArabicText(text || '')
        .replace(/\([^)]*\)/g, '')
        .replace(/^(شعبة|شعبه|الشعبة|الشعبه|قسم|القسم|وحدة|وحده|الوحدة|الوحده|مجمع|المجمع|ادارة|إدارة)\s+/g, '')
        .replace(/^(اتصالات|شؤون|خدمات|قضاء)\s+/g, '')
        .replace(/\b(كربلاء|المقدسة|قضاء)\b/g, '')
        .trim();
}

function resolveHierarchy(input, departments) {
    const normInput = normalizeArabicText(input);
    const stemInput = cleanDepartmentStem(input);

    // 1. Direct Exact Match
    let found = departments.find(d => normalizeArabicText(d.name) === normInput);

    // 2. Semantic Aliases Match
    if (!found) {
        for (const sa of SEMANTIC_ALIASES) {
            const isMatch = sa.aliases.some(alias => {
                const normAlias = normalizeArabicText(alias);
                return normAlias === normInput || normAlias === stemInput;
            });
            if (isMatch) {
                const targetDept = departments.find(d => {
                    const normD = normalizeArabicText(d.name);
                    const normCan = normalizeArabicText(sa.canonical);
                    return normD === normCan || normD.includes(normCan) || normCan.includes(normD);
                });
                if (targetDept) {
                    found = targetDept;
                    break;
                }
            }
        }
    }

    // 3. Stem Matching
    if (!found && stemInput.length >= 3) {
        found = departments.find(d => {
            const stemD = cleanDepartmentStem(d.name);
            return stemD === stemInput || stemD.includes(stemInput) || stemInput.includes(stemD);
        });
    }

    if (!found) return null;

    // Build hierarchy
    const deptMap = new Map();
    departments.forEach(d => deptMap.set(d.id, d));

    const parentDept = found.parent_id ? deptMap.get(found.parent_id) : null;
    const grandParentDept = parentDept?.parent_id ? deptMap.get(parentDept.parent_id) : null;

    const level = found.level ?? (found.name.startsWith('وحدة') ? 5 : 4);

    if (level === 5) {
        return {
            department_id: found.id,
            dept_text: grandParentDept?.name || 'مديرية الاتصالات',
            section_text: parentDept?.name || found.name,
            unit_text: found.name,
            matchedName: found.name
        };
    } else if (level === 4) {
        return {
            department_id: found.id,
            dept_text: parentDept?.name || 'مديرية الاتصالات',
            section_text: found.name,
            unit_text: null,
            matchedName: found.name
        };
    } else if (level === 3) {
        const isSecOrComplex = found.name.startsWith('شعبة') || found.name.startsWith('شعبه') || found.name.startsWith('الشعبة') || found.name.startsWith('مجمع');
        if (isSecOrComplex) {
            return {
                department_id: found.id,
                dept_text: 'مديرية الاتصالات',
                section_text: found.name,
                unit_text: null,
                matchedName: found.name
            };
        } else {
            return {
                department_id: found.id,
                dept_text: found.name,
                section_text: '',
                unit_text: null,
                matchedName: found.name
            };
        }
    } else {
        return {
            department_id: found.id,
            dept_text: found.name,
            section_text: '',
            unit_text: null,
            matchedName: found.name
        };
    }
}

// Test with 20 distinct Excel values
const mockDepartments = [
    { id: '1', name: 'مدير المديرية', level: 1, parent_id: null },
    { id: '2', name: 'مكتب معاون مدير المديرية', level: 2, parent_id: '1' },
    { id: 'sec-power', name: 'شعبة القدرة', level: 3, parent_id: '2' },
    { id: 'sec-build', name: 'شعبة المباني', level: 3, parent_id: '2' },
    { id: 'sec-legal', name: 'الشعبة القانونية', level: 3, parent_id: '2' },
    { id: 'sec-plan', name: 'شعبة التخطيط والمتابعة', level: 3, parent_id: '2' },
    { id: 'sec-gis', name: 'شعبة GIS', level: 3, parent_id: '2' },
    { id: 'sec-media', name: 'شعبة العلاقات والاعلام', level: 3, parent_id: '2' },
    { id: 'cpx-hind', name: 'مجمع اتصالات قضاء الهندية', level: 3, parent_id: '2' },
    { id: 'cpx-ayn', name: 'مجمع اتصالات عين التمر', level: 3, parent_id: '2' },
    { id: 'cpx-hur', name: 'مجمع اتصالات الحر', level: 3, parent_id: '2' },
    { id: 'cpx-khayrat', name: 'مجمع اتصالات الخيرات', level: 3, parent_id: '2' },
    { id: 'cpx-shuhada', name: 'مجمع اتصالات سيد الشهداء (ع)', level: 3, parent_id: '2' },
    { id: 'dept-fin-admin', name: 'قسم المالي والاداري', level: 3, parent_id: '2' },
    { id: 'dept-trans', name: 'قسم التراسل', level: 3, parent_id: '2' },
    { id: 'dept-info', name: 'قسم تجهيز خدمات المعلوماتية', level: 3, parent_id: '2' },
    { id: 'sec-hr', name: 'شعبة ادارة الموارد البشرية', level: 4, parent_id: 'dept-fin-admin' },
    { id: 'sec-fin', name: 'شعبة الشؤون المالية', level: 4, parent_id: 'dept-fin-admin' },
    { id: 'sec-stores', name: 'شعبة المخازن', level: 4, parent_id: 'dept-fin-admin' },
    { id: 'sec-services', name: 'شعبة الخدمات الادارية والنقليات', level: 4, parent_id: 'dept-fin-admin' },
    { id: 'sec-market', name: 'شعبة التسويق والمتابعة', level: 4, parent_id: 'dept-info' },
    { id: 'sec-ip', name: 'شعبة تناقل البيانات IP', level: 4, parent_id: 'dept-trans' },
    { id: 'unit-data', name: 'وحدة البيانات', level: 5, parent_id: 'sec-ip' }
];

const testInputs = [
    'مجمع اتصالات الهندية',
    'شعبة القدرة',
    'شعبة الموارد البشرية',
    'مجمع عين التمر',
    'وحدة البيانات',
    'شعبة المباني',
    'شعبة القانونية',
    'الشعبة المالية',
    'مجمع اتصالات الحر (ع)',
    'شعبة المخازن',
    'شعبة الإعلام والعلاقات',
    'مجمع اتصالات الخيرات',
    'شعبة GIS',
    'شعبه التخطيط والمتابعه',
    'مجمع اتصالات الهنديه',
    'شعبة الخدمات الإدارية',
    'مجمع اتصالات عين التمر',
    'شعبة التسويق والمتابعه',
    'شعبة التخطيط و المتابعة',
    'مجمع اتصالات سيد الشهداء (ع)'
];

let allPassed = true;
testInputs.forEach((inp, idx) => {
    const res = resolveHierarchy(inp, mockDepartments);
    if (!res) {
        console.error(`FAIL [${idx+1}]: "${inp}" did not match any department!`);
        allPassed = false;
    } else {
        console.log(`PASS [${idx+1}]: "${inp}" => [${res.matchedName}] | Dept: "${res.dept_text}" | Sec: "${res.section_text}" | Unit: "${res.unit_text}"`);
    }
});

if (allPassed) {
    console.log('\n🏆 ALL 20/20 TEST CASES PASSED PERFECTLY!');
}
