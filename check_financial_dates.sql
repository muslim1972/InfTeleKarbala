-- استعلام للتحقق من تواريخ التحديث للبيانات المالية
-- هذا الاستعلام سيعرض آخر 20 موظف تم تحديث بياناتهم المالية مع تواريخ التحديث

SELECT 
    f.full_name AS "اسم الموظف",
    f.job_title AS "العنوان الوظيفي",
    f.updated_at AS "تاريخ الانشاء/التحديث التلقائي",
    f.last_modified_at AS "تاريخ آخر تعديل للبيانات",
    f.last_modified_by_name AS "تم التعديل بواسطة"
FROM 
    public.financial_records f
ORDER BY 
    f.last_modified_at DESC
LIMIT 20;
