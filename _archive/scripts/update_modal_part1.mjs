import fs from 'fs';

const modalPath = 'D:/InfTeleKarbala/src/features/hr/components/ServiceContinuityProcessModal.tsx';
let content = fs.readFileSync(modalPath, 'utf8');

// 1. Update ContinuityRequestItem to include gender
content = content.replace(
`        department?: string;
    } | null;`,
`        department?: string;
        gender?: number | string | null;
    } | null;`
);

// 2. Add getHonorific export
const honorificCode = `export const getHonorific = (gender: number | string | undefined | null, fullName: string = ''): string => {
    if (gender === 2 || gender === '2' || gender === 'أنثى') return 'السيدة';
    if (gender === 1 || gender === '1' || gender === 'ذكر') return 'السيد';
    const first = fullName.trim().split(/\\s+/)[0] || '';
    if (/(ة|اء|ى)$/.test(first) && !/^(حمزة|أسامة|قتيبة|طلحة|حذيفة|عروة|عمارة|عكرمة|علاء|بهاء|ضياء|صفاء|رجاء|موسى|يحيى|عيسى)/.test(first)) {
        return 'السيدة';
    }
    return 'السيد';
};

`;

if (!content.includes('export const getHonorific')) {
    content = content.replace('export const getCcActionPhrase', honorificCode + 'export const getCcActionPhrase');
}

// 3. Add employeeGender and honorific
content = content.replace(
`    const employeeName = request.employee?.full_name || 'الموظف';`,
`    const employeeName = request.employee?.full_name || 'الموظف';
    const employeeGender = request.employee?.gender;
    const honorific = getHonorific(employeeGender, employeeName);`
);

fs.writeFileSync(modalPath, content, 'utf8');
console.log('Part 1 completed: interface and honorifics added.');
