import re

with open('src/pages/Login.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

# 1. Update imports
text = text.replace(
    'import { governorateName } from "../constants/governorates";',
    'import { governorateName, DEFAULT_GOVERNORATE } from "../constants/governorates";'
)

# 2. Ensure currentGov defaults to DEFAULT_GOVERNORATE
text = text.replace(
    '  const currentGov = activeGovernorate;',
    '  const currentGov = activeGovernorate || DEFAULT_GOVERNORATE;'
)

# 3. Remove 'تغيير المحافظة' button
text = re.sub(
    r'\{/\* Back to Launcher Button \*/\}[\s\S]*?\{onBack && \([\s\S]*?<span>تغيير المحافظة</span>[\s\S]*?</button>\s*\)\}',
    '{/* تم حجب زر تغيير المحافظة لمرحلة Beta - يقتصر النظام على كربلاء المقدسة */}',
    text
)

with open('src/pages/Login.tsx', 'w', encoding='utf-8', newline='\n') as f:
    f.write(text)

print('SUCCESS: Updated Login.tsx')
