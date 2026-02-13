
export interface CertificateDef {
    label: string;
    percentage: number;
    aliases?: string[]; // للتعامل مع الأسماء القديمة أو المرادفات
}

export const CERTIFICATES: CertificateDef[] = [
    { label: 'دكتوراه', percentage: 150 }, // 100% + 50%
    { label: 'ماجستير', percentage: 125 }, // 75% + 50%
    { label: 'دبلوم عالي', percentage: 55 },
    { label: 'بكلوريوس', percentage: 45 }, // لاحظ: بكلوريوس بدون ألف أحياناً
    { label: 'دبلوم', percentage: 35 },
    { label: 'الاعدادية', percentage: 25 },
    { label: 'المتوسطة', percentage: 15 },
    { label: 'الابتدائية', percentage: 15 },
    { label: 'دون الابتدائية', percentage: 15, aliases: ['يقرأ ويكتب'] }, // 15% أيضاً
    { label: 'أمي', percentage: 15 },
];
