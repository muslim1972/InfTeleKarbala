const fs = require('fs');
const sql = `
SELECT 
    p.id, p.full_name, p.job_number, p.username, p.governorate,
    p.position_title, p.is_retired,
    f.salary_grade, f.salary_stage, f.job_title, f.certificate_text,
    f.nominal_salary, f.gross_salary, f.net_salary, f.total_deductions,
    f.certificate_percentage, f.certificate_allowance,
    f.engineering_percentage, f.engineering_allowance,
    f.legal_allowance, f.position_allowance, f.risk_allowance,
    f.additional_50_percent_allowance, f.transport_allowance,
    f.marital_allowance, f.children_allowance,
    f.retirement_deduction, f.social_security_deduction, f.tax_deduction_amount,
    f.loan_deduction, f.execution_deduction, f.school_stamp_deduction, f.other_deductions,
    f.is_five_year_leave
FROM financial_records f
JOIN profiles p ON p.id = f.user_id
WHERE f.governorate = 'karbala'
ORDER BY p.full_name
`;
fs.writeFileSync('D:/InfTeleKarbala/_archive/diagnostics/get_records.sql', `COPY (${sql}) TO STDOUT WITH CSV HEADER;`);
console.log("SQL fixed with karbala.");
