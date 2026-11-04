import fs from 'fs';

let c = fs.readFileSync('src/components/features/AdministrativeTabContent.tsx', 'utf8');

const oldFields = `const basicInfoFields: BasicInfoField[] = [
    { key: 'permission_level', label: 'مستوى الصلاحية', superHighlight: true },
    { key: 'job_number', label: 'الرقم الوظيفي', isProfile: true, superHighlight: true },
    { key: 'full_name', label: 'الاسم الكامل', isProfile: true },
    { key: 'specialization', label: 'التخصص (PROF)', isProfile: true },
    { key: 'graduation_year', label: 'سنة التخرج', isProfile: true },
    { key: 'appointment_date', label: 'تاريخ التعيين', isProfile: true, isDate: true },
    { key: 'work_nature', label: 'طبيعة العمل', isProfile: true },
    { key: 'dept_text', label: 'القسم', isProfile: true },
    { key: 'section_text', label: 'الشعبة', isProfile: true },
    { key: 'unit_text', label: 'الوحدة', isProfile: true },
    { key: 'department_name', label: 'مكان العمل' },
    { key: 'direct_manager', label: 'المسؤول المباشر' },
    { key: 'job_title', label: 'العنوان الوظيفي' },
    { key: 'salary_grade', label: 'الدرجة في سلم الرواتب' },
    { key: 'salary_stage', label: 'المرحلة في الدرجة الوظيفية' },
    { key: 'certificate_text', label: 'الشهادة' },
];`;

const newFields = `const basicInfoFields: BasicInfoField[] = [
    { key: 'permission_level', label: 'مستوى الصلاحية', superHighlight: true },
    { key: 'job_number', label: 'الرقم الوظيفي', isProfile: true, superHighlight: true },
    { key: 'full_name', label: 'الاسم الكامل', isProfile: true },
    { key: 'mother_name', label: 'اسم الأم', isProfile: true },
    { key: 'gender_display', label: 'الجنس', isProfile: true },
    { key: 'birth_date', label: 'تاريخ الولادة', isProfile: true, isDate: true },
    { key: 'phone_number', label: 'رقم الهاتف', isProfile: true },
    { key: 'job_title', label: 'العنوان الوظيفي' },
    { key: 'position_title', label: 'المنصب الإداري', isProfile: true },
    { key: 'general_specialization', label: 'الاختصاص العام', isProfile: true },
    { key: 'specialization', label: 'التخصص (PROF)', isProfile: true },
    { key: 'certificate_text', label: 'الشهادة' },
    { key: 'graduation_year', label: 'سنة التخرج', isProfile: true },
    { key: 'appointment_date', label: 'تاريخ التعيين', isProfile: true, isDate: true },
    { key: 'work_nature', label: 'طبيعة العمل', isProfile: true },
    { key: 'salary_grade', label: 'الدرجة في سلم الرواتب' },
    { key: 'salary_stage', label: 'المرحلة في الدرجة الوظيفية' },
    { key: 'dept_text', label: 'القسم', isProfile: true },
    { key: 'section_text', label: 'الشعبة', isProfile: true },
    { key: 'unit_text', label: 'الوحدة', isProfile: true },
    { key: 'department_name', label: 'مكان العمل' },
    { key: 'direct_manager', label: 'المسؤول المباشر' },
    { key: 'leave_date', label: 'تاريخ الترك', isProfile: true },
    { key: 'reinstatement_date', label: 'تاريخ الإعادة', isProfile: true },
    { key: 'reinstatement_type', label: 'نوع الإعادة', isProfile: true },
];`;

const isCrlf = c.includes('\r\n');
const targetStr = isCrlf ? oldFields.replace(/\n/g, '\r\n').replace(/\r\r\n/g, '\r\n') : oldFields.replace(/\r\n/g, '\n');
const replStr = isCrlf ? newFields.replace(/\n/g, '\r\n').replace(/\r\r\n/g, '\r\n') : newFields.replace(/\r\n/g, '\n');

if (!c.includes(targetStr)) {
    console.error('targetStr not found');
    process.exit(1);
}
c = c.replace(targetStr, replStr);

const oldLoop = `                        {basicInfoFields.map((field) => {
                            let val;
                            if (field.key === 'department_name') {
                                val = departmentInfo.name;
                            } else if (field.key === 'direct_manager') {
                                val = departmentInfo.managerName;
                            } else if (field.key === 'permission_level') {
                                val = getRoleLabel(user);
                            } else if (field.key === 'job_number') {
                                val = user?.job_number || user?.username;
                            } else if (field.key === 'section_text') {
                                val = departmentInfo.sectionName || cleanText((user as any)?.section_text);
                            } else if (field.key === 'dept_text') {
                                val = departmentInfo.deptName || cleanText((user as any)?.dept_text);
                            } else {
                                val = field.isProfile ? (user as any)?.[field.key] : (field.isDate ? undefined : financialData?.[field.key]);
                                if (['unit_text'].includes(field.key)) {
                                    val = cleanText(val);
                                }
                            }

                            const displayVal = field.isMoney
                                ? Math.round(Number(val || 0)).toLocaleString()
                                : field.suffix ? \`\${val || 0}\${field.suffix}\` : (val || 'غير محدد');`;

const newLoop = `                        {basicInfoFields.map((field) => {
                            let val: any;
                            if (field.key === 'department_name') {
                                val = departmentInfo.name;
                            } else if (field.key === 'direct_manager') {
                                val = departmentInfo.managerName;
                            } else if (field.key === 'permission_level') {
                                val = getRoleLabel(user);
                            } else if (field.key === 'job_number') {
                                val = user?.job_number || user?.username;
                            } else if (field.key === 'gender_display') {
                                const g = (user as any)?.gender;
                                val = g === 'male' || g === 'ذكر' ? 'ذكر' : g === 'female' || g === 'أنثى' ? 'أنثى' : g;
                            } else if (field.key === 'birth_date') {
                                const bd = (user as any)?.birth_date;
                                val = bd ? String(bd).split('T')[0] : '';
                            } else if (field.key === 'section_text') {
                                val = departmentInfo.sectionName || cleanText((user as any)?.section_text);
                            } else if (field.key === 'dept_text') {
                                val = departmentInfo.deptName || cleanText((user as any)?.dept_text);
                            } else {
                                val = field.isProfile ? (user as any)?.[field.key] : financialData?.[field.key];
                                if (['unit_text'].includes(field.key)) {
                                    val = cleanText(val);
                                }
                            }

                            // فلترة ديناميكية: إخفاء الحقول غير الأساسية إذا كانت فارغة لمنع ازدحام الواجهة
                            const ESSENTIAL_KEYS = ['permission_level', 'job_number', 'full_name', 'dept_text', 'job_title', 'salary_grade', 'salary_stage', 'certificate_text'];
                            const hasValue = val !== null && val !== undefined && String(val).trim() !== '' && String(val).trim() !== '0';
                            if (!ESSENTIAL_KEYS.includes(field.key) && !hasValue) {
                                return null;
                            }

                            const displayVal = field.isMoney
                                ? Math.round(Number(val || 0)).toLocaleString()
                                : field.suffix ? \`\${val || 0}\${field.suffix}\` : (val || 'غير محدد');`;

const targetLoop = isCrlf ? oldLoop.replace(/\n/g, '\r\n').replace(/\r\r\n/g, '\r\n') : oldLoop.replace(/\r\n/g, '\n');
const replLoop = isCrlf ? newLoop.replace(/\n/g, '\r\n').replace(/\r\r\n/g, '\r\n') : newLoop.replace(/\r\n/g, '\n');

if (!c.includes(targetLoop)) {
    console.error('targetLoop not found');
    process.exit(1);
}
c = c.replace(targetLoop, replLoop);

fs.writeFileSync('src/components/features/AdministrativeTabContent.tsx', c, 'utf8');
console.log('AdministrativeTabContent.tsx updated successfully');
