-- فحص وتصحيح نسب الشهادة الناتجة عن إكسل (0.45 -> 45)
SELECT count(*) AS total_fractional_records
FROM financial_records
WHERE certificate_percentage > 0 AND certificate_percentage <= 1.5;

UPDATE financial_records
SET certificate_percentage = ROUND(certificate_percentage * 100)
WHERE certificate_percentage > 0 AND certificate_percentage <= 1.5;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'monthly_snapshot_financials') THEN
        UPDATE monthly_snapshot_financials
        SET certificate_percentage = ROUND(certificate_percentage * 100)
        WHERE certificate_percentage > 0 AND certificate_percentage <= 1.5;
    END IF;
END $$;

SELECT count(*) AS remaining_fractional
FROM financial_records
WHERE certificate_percentage > 0 AND certificate_percentage <= 1.5;

SELECT certificate_percentage, certificate_allowance, nominal_salary
FROM financial_records
WHERE nominal_salary = 910000
LIMIT 5;
