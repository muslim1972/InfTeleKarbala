import fs from 'fs';

const filePath = 'src/utils/universalPatcherConfig.ts';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Update SEMANTIC_DEPARTMENT_ALIASES
const newAliasesCode = `/** قاموس المرادفات والمطابقات الدلالية المسبقة للأقسام والشعب والمجمعات الإدارية */
const SEMANTIC_DEPARTMENT_ALIASES: Array<{ canonical: string; aliases: string[] }> = [
    { canonical: 'مجمع اتصالات قضاء الهندية', aliases: ['مجمع اتصالات الهندية', 'مجمع اتصالات الهنديه', 'مجمع الهندية', 'الهندية', 'مجمع الهنديه'] },
    { canonical: 'مجمع اتصالات سيد الشهداء (ع)', aliases: ['مجمع اتصالات سيد الشهداء', 'مجمع سيد الشهداء', 'سيد الشهداء', 'سيد الشهداء (ع)'] },
    { canonical: 'مجمع اتصالات عين التمر', aliases: ['مجمع اتصلات عين التمر', 'عين التمر', 'مجمع عين التمر', 'مجمع اتصالات عين التمر'] },
    { canonical: 'مجمع اتصالات الحر (ع)', aliases: ['مجمع اتصالات الحر', 'مجمع الحر', 'الحر', 'مجمع اتصالات الحر (ع)'] },
    { canonical: 'مجمع اتصالات الخيرات', aliases: ['مجمع الخيرات', 'الخيرات', 'مجمع اتصالات الخيرات'] },
    { canonical: 'مجمع اتصالات الجدول الغربي', aliases: ['مجمع الجدول الغربي', 'الجدول الغربي'] },
    { canonical: 'مجمع اتصالات قضاء الحسينية', aliases: ['مجمع اتصالات الحسينية', 'مجمع الحسينية', 'الحسينية', 'قضاء الحسينية'] },
    { canonical: 'شعبة العلاقات والاعلام', aliases: ['شعبة العلاقات العامة والاعلام', 'شعبة العلاقات العامة والإعلام', 'شعبة الإعلام والعلاقات', 'شعبة الاعلام والعلاقات', 'الاعلام والعلاقات', 'العلاقات والاعلام', 'الاعلام', 'العلاقات'] },
    { canonical: 'شعبة التخطيط والمتابعة', aliases: ['شعبه التخطيط والمتابعه', 'شعبة التخطيط و المتابعة', 'التخطيط والمتابعة', 'التخطيط والمتابعه', 'التخطيط'] },
    { canonical: 'شعبة الخدمات الادارية والنقليات', aliases: ['شعبة الخدمات الإدارية', 'شعبة الخدمات الادارية', 'الخدمات الادارية', 'الخدمات الادارية والنقليات', 'النقليات'] },
    { canonical: 'شعبة الشؤون المالية', aliases: ['الشعبة المالية', 'شعبة المالية', 'المالية', 'الشؤون المالية'] },
    { canonical: 'شعبة التسويق والمتابعة', aliases: ['شعبة التسويق والمتابعه', 'التسويق والمتابعة', 'التسويق'] },
    { canonical: 'وحدة البيانات', aliases: ['وحدة البيانات', 'وحده البيانات', 'البيانات'] },
    { canonical: 'وحده تصفية الديون السابقه', aliases: ['وحدة تصفية الديون السابقة', 'وحده تصفية الديون السابقة', 'وحدة تصفية الديون السابقه', 'وحده تصفية الديون', 'تصفية الديون السابقة', 'تصفية الديون', 'الديون'] },
    { canonical: 'شعبة ادارة مكتب المدير', aliases: ['شعبة إدارة مكتب المدير', 'ادارة مكتب المدير', 'إدارة مكتب المدير', 'مكتب المدير', 'شعبة مكتب المدير'] },
    { canonical: 'شعبة التدقيق والرقابة الداخلية', aliases: ['شعبة التدقيق والرقابه الداخليه', 'التدقيق والرقابة الداخلية', 'شعبة التدقيق', 'التدقيق'] },
    { canonical: 'شعبة تناقل البيانات IP', aliases: ['تناقل البيانات', 'شعبة تناقل البيانات', 'تناقل البيانات IP', 'IP'] },
    { canonical: 'شعبة ادارة الموارد البشرية', aliases: ['شعبة الموارد البشرية', 'الموارد البشرية', 'شعبة الموارد', 'الموارد'] },
    { canonical: 'شعبة ادارة تجهيز الخدمة', aliases: ['شعبة إدارة تجهيز الخدمة', 'ادارة تجهيز الخدمة', 'إدارة تجهيز الخدمة', 'تجهيز الخدمة'] },
    { canonical: 'شعبة الاتصالات السلكية الضوئية', aliases: ['الاتصالات السلكية الضوئية', 'السلكية الضوئية', 'السلكية', 'الاتصالات السلكية'] },
    { canonical: 'شعبة الاتصالات اللاسلكية', aliases: ['الاتصالات اللاسلكية', 'اللاسلكية'] },
    { canonical: 'شعبة المخازن', aliases: ['شعبة المخازن', 'المخازن'] },
    { canonical: 'شعبة القدرة', aliases: ['شعبة القدرة والتكييف', 'القدرة والتكييف', 'القدرة'] },
    { canonical: 'شعبة المباني', aliases: ['شعبة المباني', 'المباني'] },
    { canonical: 'الشعبة القانونية', aliases: ['شعبة القانونية', 'القانونية'] },
    { canonical: 'شعبة GIS', aliases: ['GIS', 'شعبة GIS', 'جي اي اس'] },
    { canonical: 'شعبة الدفاع المدني', aliases: ['شعبة الدفاع المدني', 'الدفاع المدني'] },
    { canonical: 'شعبة التصاميم', aliases: ['شعبة التصاميم', 'التصاميم'] },
    { canonical: 'شعبة البدالات والشبكة النحاسية', aliases: ['شعبة البدالات', 'البدالات والشبكة النحاسية', 'البدالات'] },
    { canonical: 'شعبة FTTX', aliases: ['شعبة FTTX', 'FTTX', 'اف تي تي اكس'] },
    { canonical: 'قسم المالي والاداري', aliases: ['القسم المالي والاداري', 'القسم المالي', 'القسم الاداري'] },
    { canonical: 'قسم التراسل', aliases: ['قسم التراسل', 'التراسل'] },
    { canonical: 'قسم الشبكات', aliases: ['قسم الشبكات', 'الشبكات'] },
    { canonical: 'قسم تجهيز خدمات المعلوماتية', aliases: ['المعلوماتية', 'تجهيز الخدمة', 'تجهيز خدمات المعلوماتية'] }
];`;

// Replace from '/** قاموس المرادفات والمطابقات الدلالية المسبقة للأقسام والشعب والمجمعات الإدارية */'
// up to end of file with updated aliases, new resolveDepartmentHierarchy, and resolvePositionAssignments.

const marker = '/** قاموس المرادفات والمطابقات الدلالية المسبقة للأقسام والشعب والمجمعات الإدارية */';
const markerIdx = content.indexOf(marker);
if (markerIdx === -1) {
    console.error('Marker not found!');
    process.exit(1);
}

const newRest = `${newAliasesCode}

/** استخراج الكلمات المفتاحية وجذر اسم التشكيل الإداري */
function cleanDepartmentStem(text: string): string {
    return normalizeArabicText(text || '')
        .replace(/\\([^)]*\\)/g, '')
        .replace(/^(شعبة|شعبه|الشعبة|الشعبه|قسم|القسم|وحدة|وحده|الوحدة|الوحده|مجمع|المجمع|ادارة|إدارة)\\s+/g, '')
        .replace(/^(اتصالات|شؤون|خدمات|قضاء)\\s+/g, '')
        .replace(/\\b(كربلاء|المقدسة|قضاء)\\b/g, '')
        .trim();
}

/** مطابقة اسم تشكيل إداري من قاعدة البيانات */
function matchDepartmentNode(
    candText: string,
    departments: Array<{ id: string; name: string; parent_id: string | null; level?: number }>
): typeof departments[0] | null {
    if (!candText) return null;
    const normCand = normalizeArabicText(candText);
    const stemCand = cleanDepartmentStem(candText);

    // 1. مطابقة مباشرة تامة (Exact Match)
    const exact = departments.find(d => normalizeArabicText(d.name) === normCand);
    if (exact) return exact;

    // 2. مطابقة بالقاموس الدلالي الذكي (Semantic Alias Match)
    for (const sa of SEMANTIC_DEPARTMENT_ALIASES) {
        const isMatch = sa.aliases.some(alias => {
            const normAlias = normalizeArabicText(alias);
            return normAlias === normCand || normAlias === stemCand;
        });
        if (isMatch) {
            const targetDept = departments.find(d => {
                const normD = normalizeArabicText(d.name);
                const normCan = normalizeArabicText(sa.canonical);
                return normD === normCan || normD.includes(normCan) || normCan.includes(normD);
            });
            if (targetDept) return targetDept;
        }
    }

    // 3. مطابقة الجذور المشتركة (Stem Match)
    if (stemCand.length >= 3) {
        const fuzzy = departments.find(d => {
            const stemDept = cleanDepartmentStem(d.name);
            return stemDept === stemCand || (stemDept.length >= 4 && (stemDept.includes(stemCand) || stemCand.includes(stemDept)));
        });
        if (fuzzy) return fuzzy;
    }

    return null;
}

/**
 * دالة ذكية لمطابقة واستنتاج شجرة التشكيل الإداري بطريقة تصاعدية حتمية:
 * 1. الأولوية للوحدة: إن وُجدت، يُلغى الشعبة والقسم من الإكسل وتُستنتج من الشجرة.
 * 2. إن كانت الوحدة فارغة، تُؤخذ الشعبة/المجمع: ويُلغى القسم من الإكسل ويُستنتج من الشجرة.
 * 3. إن كانت الوحدة والشعبة فارغتين، يُؤخذ القسم: ولا يُحذف تشكيل الموظف السابق.
 */
export function resolveDepartmentHierarchy(
    rawUnit: string | undefined | null,
    rawSection: string | undefined | null,
    rawDept: string | undefined | null,
    departments: Array<{ id: string; name: string; parent_id: string | null; level?: number }>
): { department_id: string; dept_text: string; section_text: string; unit_text: string | null } | null {
    if (!rawUnit && !rawSection && !rawDept) return null;

    const deptMap = new Map<string, typeof departments[0]>();
    departments.forEach(d => deptMap.set(d.id, d));

    // ─── المرحلة 1: فحص عمود [الوحدة] أولاً بتصاعدي ───
    const cleanUnit = (rawUnit || '').trim();
    if (cleanUnit) {
        const foundUnit = matchDepartmentNode(cleanUnit, departments);
        if (foundUnit) {
            const parentDept = foundUnit.parent_id ? deptMap.get(foundUnit.parent_id) : null;
            const grandParentDept = parentDept?.parent_id ? deptMap.get(parentDept.parent_id) : null;

            // إذا كان الأب شعبة والجد قسم
            if (parentDept && parentDept.level === 4 && grandParentDept && grandParentDept.level === 3) {
                return {
                    department_id: foundUnit.id,
                    dept_text: grandParentDept.name,
                    section_text: parentDept.name,
                    unit_text: foundUnit.name,
                };
            }

            // إذا كانت الوحدة مرتبطة بالقسم مباشرة بدون شعبة (مثل وحدة تصفية الديون التابعة للقسم المالي)
            if (parentDept && parentDept.level === 3) {
                return {
                    department_id: foundUnit.id,
                    dept_text: parentDept.name,
                    section_text: '',
                    unit_text: foundUnit.name,
                };
            }

            // إذا كانت الوحدة تابعة للإدارة العليا
            return {
                department_id: foundUnit.id,
                dept_text: grandParentDept?.name || 'كربلاء',
                section_text: parentDept?.name || '',
                unit_text: foundUnit.name,
            };
        }
    }

    // ─── المرحلة 2: إن كانت الوحدة فارغة، فحص عمود [الشعبة / المجمع] ───
    const cleanSection = (rawSection || '').trim();
    if (cleanSection) {
        const foundSec = matchDepartmentNode(cleanSection, departments);
        if (foundSec) {
            const parentDept = foundSec.parent_id ? deptMap.get(foundSec.parent_id) : null;

            // الحالة 2.1: شعبة تابعة لقسم رئيسي (المستوى 4)
            if (foundSec.level === 4) {
                return {
                    department_id: foundSec.id,
                    dept_text: parentDept ? parentDept.name : 'كربلاء',
                    section_text: foundSec.name,
                    unit_text: null,
                };
            }

            // الحالة 2.2: شعب مستقلة ومجمعات وأقسام (المستوى 3)
            if (foundSec.level === 3) {
                const isSecOrComplex = foundSec.name.startsWith('شعبة') ||
                    foundSec.name.startsWith('شعبه') ||
                    foundSec.name.startsWith('الشعبة') ||
                    foundSec.name.startsWith('مجمع');

                if (isSecOrComplex) {
                    return {
                        department_id: foundSec.id,
                        dept_text: 'كربلاء',
                        section_text: foundSec.name,
                        unit_text: null,
                    };
                } else {
                    return {
                        department_id: foundSec.id,
                        dept_text: foundSec.name,
                        section_text: '',
                        unit_text: null,
                    };
                }
            }

            // الإدارة العليا
            return {
                department_id: foundSec.id,
                dept_text: 'كربلاء',
                section_text: foundSec.name,
                unit_text: null,
            };
        }
    }

    // ─── المرحلة 3: إن كانت الوحدة والشعبة فارغتين، فحص عمود [القسم] ───
    const cleanDept = (rawDept || '').trim();
    if (cleanDept) {
        const foundDept = matchDepartmentNode(cleanDept, departments);
        if (foundDept) {
            return {
                department_id: foundDept.id,
                dept_text: foundDept.name,
                section_text: '',
                unit_text: null,
            };
        }
    }

    return null;
}

/** واجهة تعيين المناصب الإدارية التلقائية المستنتجة */
export interface PositionAssignment {
    managerDeptId?: string;
    managerDeptName?: string;
    deputyDeptId?: string;
    deputyDeptName?: string;
    positionTitle: string;
    isAmbiguous?: boolean;
    ambiguityReason?: string;
}

/**
 * تحليل ذكي لعمود [المنصب الإداري] وتعيين manager_id و deputy_manager_id في جدول departments
 */
export function resolvePositionAssignments(
    rawPosition: string | undefined | null,
    resolvedDept: { department_id: string; dept_text: string; section_text: string; unit_text: string | null } | null,
    departments: Array<{ id: string; name: string; parent_id: string | null; level?: number }>
): PositionAssignment {
    if (!rawPosition) return { positionTitle: '' };

    const posTrim = String(rawPosition).trim();
    const posNorm = normalizeArabicText(posTrim);

    // 1. تجاوز الأخطاء الصريحة المعروفة (مس)
    if (posNorm === 'مس') {
        return { positionTitle: '' };
    }

    const deptMap = new Map<string, typeof departments[0]>();
    departments.forEach(d => deptMap.set(d.id, d));

    const result: PositionAssignment = {
        positionTitle: posTrim
    };

    const parts = posTrim.split('/').map(p => p.trim()).filter(Boolean);

    const empDept = resolvedDept?.department_id ? deptMap.get(resolvedDept.department_id) : null;
    const parentDept = empDept?.parent_id ? deptMap.get(empDept.parent_id) : null;

    let mainDept: typeof departments[0] | null = null;
    if (empDept?.level === 3 && empDept.name.startsWith('قسم')) mainDept = empDept;
    else if (parentDept?.level === 3 && parentDept.name.startsWith('قسم')) mainDept = parentDept;

    for (const part of parts) {
        const normPart = normalizeArabicText(part);

        // ─── مسار المدير / المسؤول (Manager) ───
        if (normPart.includes('مدير المديرية')) {
            const dirDept = departments.find(d => normalizeArabicText(d.name).includes('مدير المديرية') && d.level === 1);
            if (dirDept) {
                result.managerDeptId = dirDept.id;
                result.managerDeptName = dirDept.name;
            }
        } else if (normPart.includes('معاون مدير المديرية')) {
            const asstDept = departments.find(d => normalizeArabicText(d.name).includes('معاون') && d.level === 2);
            if (asstDept) {
                result.managerDeptId = asstDept.id;
                result.managerDeptName = asstDept.name;
            }
            const dirDept = departments.find(d => normalizeArabicText(d.name).includes('مدير المديرية') && d.level === 1);
            if (dirDept) {
                result.deputyDeptId = dirDept.id;
                result.deputyDeptName = dirDept.name;
            }
        } else if (normPart.includes('مدير قسم') || normPart.includes('مسؤول قسم')) {
            if (mainDept) {
                result.managerDeptId = mainDept.id;
                result.managerDeptName = mainDept.name;
            } else {
                result.isAmbiguous = true;
                result.ambiguityReason = 'صفة مدير قسم ولكن لم يتم العثور على قسم رئيسي للموظف';
            }
        } else if (normPart.includes('مسؤول شعبة') || normPart.includes('مسؤول الشعبة') || normPart.includes('مسؤول مجمع')) {
            if (empDept && (empDept.level === 4 || (empDept.level === 3 && (empDept.name.startsWith('شعبة') || empDept.name.startsWith('مجمع'))))) {
                result.managerDeptId = empDept.id;
                result.managerDeptName = empDept.name;
            } else {
                result.isAmbiguous = true;
                result.ambiguityReason = 'صفة مسؤول شعبة/مجمع ولكن الموظف غير مسجل ضمن شعبة أو مجمع محدد';
            }
        } else if (normPart.includes('مسؤول وحدة') || normPart.includes('مسؤول الوحدة')) {
            if (empDept && (empDept.level === 5 || empDept.name.includes('وحد'))) {
                result.managerDeptId = empDept.id;
                result.managerDeptName = empDept.name;
            } else {
                result.isAmbiguous = true;
                result.ambiguityReason = 'صفة مسؤول وحدة ولكن الموظف غير مرتبط بوحدة محددة';
            }
        }

        // ─── مسار البديل (Deputy) ───
        if (normPart.includes('بديل')) {
            if (normPart.includes('بديل مدير قسم') || normPart.includes('بديل مسؤول قسم')) {
                if (mainDept) {
                    result.deputyDeptId = mainDept.id;
                    result.deputyDeptName = mainDept.name;
                } else {
                    result.isAmbiguous = true;
                    result.ambiguityReason = 'صفة بديل مدير قسم ولكن لم يُستنتج القسم الرئيسي';
                }
            } else if (normPart.includes('بديل مسؤول شعبة') || normPart.includes('بديل مسؤول الشعبة') || normPart.includes('بديل مسؤول مجمع') || normPart.includes('بديل مدير شعبة')) {
                // البحث عما إذا ذُكر اسم شعبة محددة في الشطر (مثل: بديل مسؤول شعبة التسويق)
                const targetSec = departments.find(d => {
                    if (d.level !== 4 && d.level !== 3) return false;
                    const stemD = cleanDepartmentStem(d.name);
                    return stemD.length >= 3 && normPart.includes(stemD);
                });

                if (targetSec && targetSec.id !== empDept?.id) {
                    result.deputyDeptId = targetSec.id;
                    result.deputyDeptName = targetSec.name;
                } else if (result.managerDeptId && result.managerDeptId === empDept?.id && mainDept) {
                    // الموظف مسؤول لشعبته الحالية وله منصب بديل مسؤول شعبة (حالة زينب صباح):
                    // البحث عن الشعبة الشقيقة تحت نفس القسم
                    const siblingSec = departments.find(d => d.parent_id === mainDept.id && d.id !== empDept.id && d.level === 4);
                    if (siblingSec) {
                        result.deputyDeptId = siblingSec.id;
                        result.deputyDeptName = siblingSec.name;
                    } else {
                        result.isAmbiguous = true;
                        result.ambiguityReason = 'مسؤول شعبة وبديل لشعبة شقيقة ولكن لم يُعثر على شعبة شقيقة في نفس القسم';
                    }
                } else if (empDept) {
                    result.deputyDeptId = empDept.id;
                    result.deputyDeptName = empDept.name;
                } else {
                    result.isAmbiguous = true;
                    result.ambiguityReason = 'صفة بديل مسؤول ولكن الموظف غير مسجل ضمن تشكيل محدد';
                }
            } else if (normPart.includes('بديل مسؤول وحدة') || normPart.includes('بديل مسؤول الوحدة')) {
                if (empDept && (empDept.level === 5 || empDept.name.includes('وحد'))) {
                    result.deputyDeptId = empDept.id;
                    result.deputyDeptName = empDept.name;
                }
            }
        }
    }

    return result;
}
`;

const updatedContent = content.slice(0, markerIdx) + newRest;
fs.writeFileSync(filePath, updatedContent, 'utf8');
console.log('Successfully updated src/utils/universalPatcherConfig.ts');
