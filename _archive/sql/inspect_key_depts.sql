SELECT d.id, d.name, d.parent_id, d.manager_id, pm.full_name as manager_name, d.deputy_manager_id, pd.full_name as deputy_name
FROM departments d
LEFT JOIN profiles pm ON d.manager_id = pm.id
LEFT JOIN profiles pd ON d.deputy_manager_id = pd.id
WHERE d.name LIKE '%الحسينية%' OR d.name LIKE '%الحر%' OR d.name LIKE '%مكتب%' OR d.name LIKE '%مدير المديرية%';
