with open('src/components/admin/DepartmentsManager.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

target = """            // NEW: Automatically link the manager to THIS department (not the parent)
            if (newManagerId) {
                const { error: profileError } = await supabase
                    .from('profiles')
                    .update({ department_id: deptId }) // <-- FIX: Assign to the department they manage
                    .eq('id', newManagerId);"""

replacement = """            // NEW: Automatically link the manager to THIS department (not the parent)
            if (newManagerId) {
                const deptObj = departments.find(d => d.id === deptId);
                const updates: any = { department_id: deptId };
                if (deptObj && (deptObj.level === 1 || deptObj.level === 2)) {
                    updates.dept_text = deptObj.name;
                    updates.section_text = null;
                    updates.unit_text = null;
                }
                const { error: profileError } = await supabase
                    .from('profiles')
                    .update(updates) // <-- FIX: Assign to the department they manage with proper dept_text
                    .eq('id', newManagerId);"""

if target in text:
    text = text.replace(target, replacement)
    print("SUCCESS: Updated DepartmentsManager.tsx")
else:
    print("WARNING: target not found in DepartmentsManager.tsx")

with open('src/components/admin/DepartmentsManager.tsx', 'w', encoding='utf-8', newline='\n') as f:
    f.write(text)
