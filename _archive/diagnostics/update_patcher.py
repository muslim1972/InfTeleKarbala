with open('src/utils/universalPatcherConfig.ts', 'r', encoding='utf-8') as f:
    lines = f.readlines()

new_lines = []
for i, l in enumerate(lines):
    new_lines.append(l)
    if i == 110: # line 111 in 1-based
        new_lines.append("            { value: 'engineering_percentage', label: 'نسبة الهندسية', type: 'numeric' },\n")
    elif i == 384: # line 385 in 1-based
        new_lines.append("    engineering_percentage: ['نسبة الهندسية', 'نسبة م.الهندسية', 'نسبة مخصصات هندسية', 'نسبة مخصصات الهندسية', 'نسبة الهندسة', 'نسبة م.الهندسة'],\n")
    elif i == 802: # right before line 804 "if (certText) {"
        eng_logic = """    // تدقيق نسبة الهندسية (المستويان الذكيان)
    let engPerc = Number(newValues.engineering_percentage || 0);
    if (engPerc > 0 && engPerc <= 1.5) {
        engPerc = Math.round(engPerc * 100);
        newValues.engineering_percentage = engPerc;
    }
    const engAllowance = Number(newValues.engineering_allowance || 0);
    const jobTitle = String(newValues.job_title || '').trim();
    const isEngTitle = /مهندس|هندس/i.test(jobTitle);
    if (!engPerc || engPerc === 0) {
        if (nom > 0 && engAllowance > 0 && Math.abs(engAllowance - (nom * 0.35)) < 10) {
            newValues.engineering_percentage = 35;
            warnings.push('استنتاج ذكي: تم تحديد نسبة الهندسية (35%) استناداً إلى مبلغ مخصصات الهندسة والراتب الاسمي.');
        } else if (isEngTitle && engAllowance > 0) {
            newValues.engineering_percentage = 35;
            warnings.push('استنتاج ذكي: تم تحديد نسبة الهندسية (35%) استناداً إلى العنوان الوظيفي ومخصصات الهندسة.');
        }
    }

"""
        new_lines.append(eng_logic)

with open('src/utils/universalPatcherConfig.ts', 'w', encoding='utf-8') as f:
    f.writelines(new_lines)

print("Updated universalPatcherConfig successfully!")
