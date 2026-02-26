/**
 * ملف سلم الرواتب الموحد (الراتب الاسمي)
 * القيم مبنية على الجدول الرسمي: 
 * - الدرجة (1 إلى 10)
 * - المرحلة (1 إلى 11)
 * يتم تخزين القيم الأساسية (base) ومقدار الزيادة السنوية لكل مرحلة (step).
 */

export const SALARY_SCALE = {
    1: { base: 910000, step: 20000 },
    2: { base: 723000, step: 17000 },
    3: { base: 600000, step: 10000 },
    4: { base: 509000, step: 8000 },
    5: { base: 429000, step: 6000 },
    6: { base: 362000, step: 6000 },
    7: { base: 296000, step: 6000 },
    8: { base: 260000, step: 3000 },
    9: { base: 210000, step: 3000 },
    10: { base: 170000, step: 3000 }
};

/**
 * دالة لحساب الراتب الاسمي المستحق بناءً على الدرجة والمرحلة
 * @param grade الدرجة الوظيفية (1-10)
 * @param stage المرحلة (1-11)
 * @returns الراتب الاسمي المتوقع، أو null إذا كانت القيم غير صالحة
 */
export function getExpectedNominalSalary(grade?: string | number | null, stage?: string | number | null): number | null {
    if (!grade || !stage) return null;

    const g = Number(grade);
    const s = Number(stage);

    // التحقق من صحة الأرقام وحدودها
    if (isNaN(g) || isNaN(s) || g < 1 || g > 10 || s < 1 || s > 11) {
        return null;
    }

    const scale = SALARY_SCALE[g as keyof typeof SALARY_SCALE];
    if (!scale) return null;

    // المرحلة الأولى هي الأساس (base)، والمراحل التالية نضيف عليها الزيادة (step) * (المرحلة - 1)
    return scale.base + ((s - 1) * scale.step);
}
