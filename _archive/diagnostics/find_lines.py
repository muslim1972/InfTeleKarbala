with open('src/utils/universalPatcherConfig.ts', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i, l in enumerate(lines):
    if 'engineering_allowance' in l:
        print(f"Line {i+1}: {repr(l)}")
    if 'certText' in l:
        print(f"Line {i+1}: {repr(l)}")
