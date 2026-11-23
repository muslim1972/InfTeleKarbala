with open('src/components/admin/CustomAudit.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

# 1. Fix imports
old_imp = """import {
    ALLOWANCE_FIELDS,
    DEDUCTION_FIELDS,
    SALARY_FIELDS,
    resolveApprovedPercentage
} from '../../utils/salaryRules';"""

# Check if old_imp is CRLF
old_imp_crlf = old_imp.replace('\n', '\r\n')
new_imp = """import {
    ALLOWANCE_FIELDS,
    DEDUCTION_FIELDS,
    SALARY_FIELDS,
    resolveApprovedPercentage,
    getLegalAllowancePercentage,
    getExpectedGrossSalary,
    getExpectedNetSalary
} from '../../utils/salaryRules';"""

if old_imp in text:
    text = text.replace(old_imp, new_imp)
elif old_imp_crlf in text:
    text = text.replace(old_imp_crlf, new_imp.replace('\n', '\r\n'))
else:
    # try regex
    import re
    text = re.sub(
        r"import\s*\{\s*ALLOWANCE_FIELDS[\s\S]*?\}\s*from\s*['\"]\.\./\.\./utils/salaryRules['\"];",
        new_imp,
        text
    )

# 2. Fix approvedCalc null check on gross_salary and net_salary
text = text.replace(
    "approvedCalc = getExpectedGrossSalary(fullRecord);\n                        if (Math.abs(approvedCalc - fieldCurrentValue) > 1) {",
    "approvedCalc = getExpectedGrossSalary(fullRecord);\n                        if (approvedCalc !== null && Math.abs(approvedCalc - fieldCurrentValue) > 1) {"
)
text = text.replace(
    "approvedCalc = getExpectedGrossSalary(fullRecord);\r\n                        if (Math.abs(approvedCalc - fieldCurrentValue) > 1) {",
    "approvedCalc = getExpectedGrossSalary(fullRecord);\r\n                        if (approvedCalc !== null && Math.abs(approvedCalc - fieldCurrentValue) > 1) {"
)

text = text.replace(
    "approvedCalc = getExpectedNetSalary(fullRecord);\n                        if (Math.abs(approvedCalc - fieldCurrentValue) > 1) {",
    "approvedCalc = getExpectedNetSalary(fullRecord);\n                        if (approvedCalc !== null && Math.abs(approvedCalc - fieldCurrentValue) > 1) {"
)
text = text.replace(
    "approvedCalc = getExpectedNetSalary(fullRecord);\r\n                        if (Math.abs(approvedCalc - fieldCurrentValue) > 1) {",
    "approvedCalc = getExpectedNetSalary(fullRecord);\r\n                        if (approvedCalc !== null && Math.abs(approvedCalc - fieldCurrentValue) > 1) {"
)

with open('src/components/admin/CustomAudit.tsx', 'w', encoding='utf-8') as f:
    f.write(text)

print("Imports and null checks updated in CustomAudit.tsx!")
