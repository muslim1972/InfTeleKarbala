/**
 * ملف سلم الرواتب الموحد (الراتب الاسمي)
 * القيم مبنية على الجدول الرسمي العراقي (قانون رقم 22 لسنة 2008 المعدل): 
 * - الدرجة (1 إلى 10)
 * - المرحلة (1 إلى 11)
 * يتم تخزين القيم الأساسية (base) ومقدار الزيادة السنوية لكل مرحلة (step).
 * للعلاوات السنوية ما بعد المرحلة 11:
 * - الدرجة الأولى: تواصل زيادة 20,000 د.ع لكل علاوة.
 * - الدرجة الثانية: المرحلة 11 = 893,000، والمرحلة 12 تصل إلى 910,000 (+17,000)،
 *   وما فوق 910,000 تكتسب علاوة الدرجة الأولى (20,000 د.ع) لكل مرحلة إضافية.
 * - باقي الدرجات: تواصل زيادة العلاوة السنوية الثابتة لنفس الدرجة.
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
 * دالة لحساب الراتب الاسمي المستحق بناءً على الدرجة والمرحلة، مع تدقيق العلاوات الممتدة
 * @param grade الدرجة الوظيفية (1-10)
 * @param stage المرحلة (1-25 فما فوق)
 * @param currentNominal الراتب الاسمي الحالي المسجل للتحقق من العلاوات المستمرة لما بعد المرحلة 11
 * @returns الراتب الاسمي المتوقع، أو الراتب الحالي إن طابق علاوة قانونية ممتدة
 */
export function getExpectedNominalSalary(
    grade?: string | number | null, 
    stage?: string | number | null,
    currentNominal?: number | null
): number | null {
    if (!grade || !stage) return null;

    const g = Number(grade);
    const s = Number(stage);

    if (isNaN(g) || isNaN(s) || g < 1 || g > 10 || s < 1) {
        return null;
    }

    const scale = SALARY_SCALE[g as keyof typeof SALARY_SCALE];
    if (!scale) return null;

    // الحساب القياسي المباشر
    let expectedStandard = scale.base + ((s - 1) * scale.step);

    // إذا كانت الدرجة 2 والمرحلة المحددة صراحة أكبر من 11:
    if (g === 2 && s > 11) {
        if (s === 12) {
            expectedStandard = 910000;
        } else {
            expectedStandard = 910000 + ((s - 12) * 20000);
        }
    }

    // إذا لم يُمرر الراتب الاسمي الحالي، نرجع الحساب القياسي للمرحلة
    if (currentNominal === undefined || currentNominal === null || isNaN(currentNominal)) {
        return expectedStandard;
    }

    const nom = Number(currentNominal);
    if (nom === expectedStandard) return nom;

    // فحص حالات علاوات ما بعد المرحلة 11 في ملفات الإكسل (حيث يثبت العمود عند المرحلة 11 غالباً):
    // 1. الدرجة الثانية:
    if (g === 2 && nom >= 893000) {
        if (nom === 910000) return nom;
        if (nom > 910000 && (nom - 910000) % 20000 === 0) {
            return nom; // علاوة قانونية مطابقة
        }
    }

    // 2. الدرجة الأولى:
    if (g === 1 && nom >= 1110000) {
        if ((nom - 1110000) % 20000 === 0) {
            return nom;
        }
    }

    // 3. باقي الدرجات (امتداد العلاوة السنوية الثابتة):
    if (nom > expectedStandard && (nom - scale.base) % scale.step === 0) {
        return nom;
    }

    return expectedStandard;
}
