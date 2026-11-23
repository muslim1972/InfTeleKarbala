with open('src/components/admin/FullAudit.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

new_lines = []
for i, l in enumerate(lines):
    if "const isContract = jn.startsWith('143264')" in l:
        new_lines.append("                    const jt = String(rec.job_title || '').trim();\n")
        new_lines.append("                    const isContractOrDaily = jn.startsWith('143264') || /عقد|اجير|أجير/.test(jt);\n")
        new_lines.append("                    if (isContractOrDaily) {\n")
        new_lines.append("                        continue;\n")
        new_lines.append("                    }\n")
    elif "if (isContract) {" in l or (i > 0 and "if (isContract) {" in lines[i-1] and "continue;" in l) or (i > 1 and "if (isContract) {" in lines[i-2] and "}" in l):
        # skip old block
        continue
    else:
        new_lines.append(l)

with open('src/components/admin/FullAudit.tsx', 'w', encoding='utf-8') as f:
    f.writelines(new_lines)

print("Updated FullAudit successfully!")
