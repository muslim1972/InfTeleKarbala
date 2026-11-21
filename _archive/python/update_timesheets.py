with open(r'd:\InfTeleKarbala\src\features\attendance\components\Timesheets.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

target = """                     if (dayLeave.is_mandatory || dayLeave.reason?.includes('إجازة اعتيادية إجبارية')) {
                       rec.status = 'leave';
                     }"""

replacement = """                     if (!rec.check_in && (dayLeave.is_mandatory || dayLeave.reason?.includes('إجازة اعتيادية إجبارية'))) {
                       rec.status = 'leave';
                     }"""

if target in content:
    content = content.replace(target, replacement, 1)
    with open(r'd:\InfTeleKarbala\src\features\attendance\components\Timesheets.tsx', 'w', encoding='utf-8') as f:
        f.write(content)
    print('Updated Timesheets.tsx successfully.')
else:
    print('Target not found in Timesheets.tsx')
