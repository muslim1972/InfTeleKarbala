with open('src/utils/universalPatcherConfig.ts', 'r', encoding='utf-8') as f:
    text = f.read()

target = "if (fieldValue === 'certificate_percentage') {"
repl = "if (fieldValue === 'certificate_percentage' || fieldValue === 'engineering_percentage') {"

text = text.replace(target, repl)

with open('src/utils/universalPatcherConfig.ts', 'w', encoding='utf-8') as f:
    f.write(text)
print("Updated cleanFieldValue for engineering_percentage successfully!")
