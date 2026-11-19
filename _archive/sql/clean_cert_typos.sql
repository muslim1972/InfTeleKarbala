UPDATE financial_records SET certificate_text = 'دبلوم عالي' WHERE certificate_text = 'دبلو م عالي';
UPDATE financial_records SET certificate_text = 'بكلوريوس' WHERE certificate_text IN ('بكلويوس', 'بكاوريوس');
UPDATE financial_records SET certificate_text = 'الابتدائية' WHERE certificate_text = 'ابتدائيه';

-- Also check if any record has certificate_text = 'دبلوم عالي' with percentage = 35
SELECT count(*) FROM financial_records WHERE certificate_text = 'دبلوم عالي' AND certificate_percentage = 35;
