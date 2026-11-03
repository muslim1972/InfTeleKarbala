# Update TabManageEmployees.tsx
with open('src/components/admin/dashboard/TabManageEmployees.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

target = """                                        if (dept) {
                                            if (dept.level === 4) {
                                                updates.section_text = dept.name;
                                                if (parentDept) updates.dept_text = parentDept.name;
                                            } else if (dept.level === 3) {
                                                updates.dept_text = dept.name;
                                                updates.section_text = '';
                                            } else if (dept.level === 5) {
                                                updates.unit_text = dept.name;
                                                if (parentDept) updates.section_text = parentDept.name;
                                            }
                                        }"""

replacement = """                                        if (dept) {
                                            if (dept.level === 1 || dept.level === 2) {
                                                updates.dept_text = dept.name;
                                                updates.section_text = '';
                                                updates.unit_text = '';
                                            } else if (dept.level === 4) {
                                                updates.section_text = dept.name;
                                                if (parentDept) updates.dept_text = parentDept.name;
                                            } else if (dept.level === 3) {
                                                updates.dept_text = dept.name;
                                                updates.section_text = '';
                                            } else if (dept.level === 5) {
                                                updates.unit_text = dept.name;
                                                if (parentDept) updates.section_text = parentDept.name;
                                            }
                                        }"""

if target in text:
    text = text.replace(target, replacement)
    print("SUCCESS: Updated TabManageEmployees.tsx")
else:
    print("WARNING: target not found in TabManageEmployees.tsx")

with open('src/components/admin/dashboard/TabManageEmployees.tsx', 'w', encoding='utf-8', newline='\n') as f:
    f.write(text)

# Update TabAddEmployee.tsx
with open('src/components/admin/dashboard/TabAddEmployee.tsx', 'r', encoding='utf-8') as f:
    add_text = f.read()

target_add = """                            if (dept) {
                                if (dept.level === 4) {
                                    updates.section_text = dept.name;
                                    if (parentDept) updates.dept_text = parentDept.name;
                                } else if (dept.level === 3) {
                                    updates.dept_text = dept.name;
                                    updates.section_text = '';
                                } else if (dept.level === 5) {
                                    updates.unit_text = dept.name;
                                    if (parentDept) updates.section_text = parentDept.name;
                                }
                            }"""

replacement_add = """                            if (dept) {
                                if (dept.level === 1 || dept.level === 2) {
                                    updates.dept_text = dept.name;
                                    updates.section_text = '';
                                    updates.unit_text = '';
                                } else if (dept.level === 4) {
                                    updates.section_text = dept.name;
                                    if (parentDept) updates.dept_text = parentDept.name;
                                } else if (dept.level === 3) {
                                    updates.dept_text = dept.name;
                                    updates.section_text = '';
                                } else if (dept.level === 5) {
                                    updates.unit_text = dept.name;
                                    if (parentDept) updates.section_text = parentDept.name;
                                }
                            }"""

if target_add in add_text:
    add_text = add_text.replace(target_add, replacement_add)
    print("SUCCESS: Updated TabAddEmployee.tsx")
else:
    print("WARNING: target_add not found in TabAddEmployee.tsx")

with open('src/components/admin/dashboard/TabAddEmployee.tsx', 'w', encoding='utf-8', newline='\n') as f:
    f.write(add_text)
