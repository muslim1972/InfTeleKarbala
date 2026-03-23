import { formatCurrency } from './formatters';

export const printMismatchReportHTML = (
    fieldLabel: string, 
    auditType: 'allowances' | 'deductions' | 'salary_values' | null, 
    mismatchRows: any[]
) => {
    return `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
    <meta charset="UTF-8">
    <title>تقرير القيود غير المطابقة</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700&display=swap');
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Tajawal', sans-serif; padding: 30px; color: #1a1a1a; background: white; font-size: 12px; }
        .header { border-bottom: 3px solid #000; padding-bottom: 15px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: flex-start; }
        .header h1 { font-size: 18px; }
        .summary { display: flex; gap: 15px; margin-bottom: 15px; }
        .summary-item { background: #f5f5f5; border: 1px solid #e0e0e0; border-radius: 6px; padding: 8px 12px; }
        .summary-item .label { font-size: 10px; color: #888; }
        .summary-item .value { font-size: 14px; font-weight: 700; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        th { background: #1a1a1a; color: white; padding: 8px 6px; font-size: 11px; text-align: center; }
        td { border: 1px solid #ddd; padding: 6px; text-align: center; font-size: 12px; }
        tr:nth-child(even) { background: #fafafa; }
        .mismatch { color: #dc2626; font-weight: 700; }
        .footer { margin-top: 25px; padding-top: 10px; border-top: 1px solid #ccc; text-align: center; color: #999; font-size: 10px; }
    </style>
</head>
<body>
    <div class="header">
        <div><h1>تقرير القيود غير المطابقة</h1><p style="color:#666">دائرة المعلوماتية وتكنولوجيا الاتصالات</p></div>
        <div style="text-align:left"><p>نوع: ${auditType === 'allowances' ? 'مخصصات' : auditType === 'deductions' ? 'استقطاعات' : 'قيم الراتب'} — ${fieldLabel}</p></div>
    </div>
    <div class="summary">
        <div class="summary-item"><div class="label">غير المطابق</div><div class="value mismatch">${mismatchRows.length}</div></div>
    </div>
    <table>
        <thead>
            <tr><th>#</th><th>الاسم</th><th>الراتب الاسمي</th><th>الاستحقاق حسب النسبة</th><th>الرقم حسب المالية</th><th>الملاحظات</th></tr>
        </thead>
        <tbody>
            ${mismatchRows.map((r, i) => `
            <tr>
                <td>${i + 1}</td>
                <td style="text-align:right">${r.name}<br/><small>${r.jobNumber}</small></td>
                <td>${formatCurrency(r.nominalSalary)}</td>
                <td>
                    ${formatCurrency(r.approvedCalc)}
                    ${r.isFiveYearLeave ? '<br/><small style="color:red; font-size:9px">(إجازة 5 سنوات)</small>' : ''}
                </td>
                <td class="mismatch">${formatCurrency(r.currentValue)}</td>
                <td style="font-size:11px; color:#dc2626">${r.notes}</td>
            </tr>`).join('')}
        </tbody>
    </table>
    <div class="footer"><p>تقرير تدقيقي لأغراض المراجعة</p></div>
</body>
</html>`;
};

export const buildSingleAuditHTML = (
    fieldLabel: string, 
    selectedEmployee: any,
    financialData: any,
    approvedPercentage: number | null,
    auditResult: number | null,
    currentValue: number | null,
    validationState: 'idle' | 'match' | 'mismatch'
) => {
    return `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
    <meta charset="UTF-8">
    <title>تقرير تدقيق مخصص</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700&display=swap');
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Tajawal', sans-serif; padding: 40px; color: #1a1a1a; background: white; }
        .header { border-bottom: 3px solid #000; padding-bottom: 20px; margin-bottom: 30px; display: flex; justify-content: space-between; }
        .header h1 { font-size: 22px; font-weight: 700; }
        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 25px; }
        .info-item { background: #f8f8f8; border: 1px solid #e5e5e5; border-radius: 8px; padding: 12px; }
        .info-item .label { font-size: 11px; color: #888; margin-bottom: 4px; }
        .info-item .value { font-size: 16px; font-weight: 700; }
        .result-section { border: 2px solid #e5e5e5; border-radius: 12px; padding: 20px; margin-top: 20px; }
        .result-row { display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px dashed #ddd; }
        .result-row:last-child { border: none; }
        .result-row .label { color: #555; font-size: 13px; }
        .result-row .value { font-weight: 700; font-size: 16px; direction: ltr; }
        .match { color: #16a34a; }
        .mismatch { color: #dc2626; }
        .footer { margin-top: 40px; padding-top: 15px; border-top: 1px solid #ccc; text-align: center; color: #999; font-size: 11px; }
    </style>
</head>
<body>
    <div class="header">
        <div><h1>تقرير تدقيق محدد</h1><p style="color:#666">دائرة المعلوماتية وتكنولوجيا الاتصالات</p></div>
        <div style="text-align:left"><p>${fieldLabel}</p></div>
    </div>
    <div class="info-grid">
        <div class="info-item"><div class="label">اسم الموظف</div><div class="value">${selectedEmployee?.full_name || '—'}</div></div>
        <div class="info-item"><div class="label">الراتب الاسمي</div><div class="value">${formatCurrency(financialData?.nominal_salary)} د.ع</div></div>
    </div>
    <div class="result-section">
        <div class="result-row"><span class="label">النسبة المعتمدة</span><span class="value">${approvedPercentage !== null ? approvedPercentage + '%' : 'غير محدد'}</span></div>
        <div class="result-row">
            <div style="display:flex; flex-direction:column">
                <span class="label">الاستحقاق (المحسوب)</span>
                ${financialData?.is_five_year_leave ? '<span style="font-size:10px; color:#dc2626; margin-top:2px">(كونه يتمتع بإجازة 5 سنوات)</span>' : ''}
            </div>
            <span class="value">${formatCurrency(auditResult ?? 0)} د.ع</span>
        </div>
        <div class="result-row"><span class="label">القيمة الحالية</span><span class="value">${formatCurrency(currentValue)} د.ع</span></div>
        <div class="result-row"><span class="label">الحالة</span><span class="value ${validationState === 'match' ? 'match' : 'mismatch'}">${validationState === 'match' ? '✓ مطابق' : '✗ غير مطابق'}</span></div>
    </div>
    <div class="footer"><p>تقرير تدقيقي لأغراض المراجعة</p></div>
</body>
</html>`;
};
