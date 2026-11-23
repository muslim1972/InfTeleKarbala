with open('src/hooks/useEmployeeManager.ts', 'r', encoding='utf-8') as f:
    text = f.read()

target = "'مدير فني اقدم', 'مدير فني', 'فني اقدم', 'فني', 'عامل خدمة'"
repl = "'مدير فني اقدم', 'مدير فني', 'فني اقدم', 'فني', 'عامل خدمة', 'عقد', 'أجير يومي'"

if target in text:
    text = text.replace(target, repl)
    with open('src/hooks/useEmployeeManager.ts', 'w', encoding='utf-8') as f:
        f.write(text)
    print("Updated useEmployeeManager.ts with contract and daily wage options successfully!")
else:
    print("Target not found in useEmployeeManager.ts")
