-- فحص سجلات العقود في profiles و financial_records
SELECT p.id, p.job_number, p.full_name, p.username, p.governorate,
       fr.id as financial_record_id, fr.gross_salary, fr.job_title, fr.certificate_text
FROM profiles p
LEFT JOIN financial_records fr ON fr.user_id = p.id
WHERE p.job_number LIKE '9999%' OR p.username IN (
  'اروى هاشم علي', 'اكرم محمد ضاحي', 'انوار محمد حسين', 'جاسم عدنان جاسم', 'جلنار زهير سالم'
)
ORDER BY p.job_number;
