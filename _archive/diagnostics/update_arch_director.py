with open('.agents/skills/inftele-architecture/SKILL.md', 'r', encoding='utf-8') as f:
    text = f.read()

entry = '| 2026-11-03 | حوكمة ارتباط مدير المديرية: تصحيح تبعية مكتب المدير، واستحداث موقع بصمة مدير المديرية/كربلاء وربطه بالمدير، والربط الثلاثي لمستوى 1 و2 | FE-HR-01 / FE-ATT-01 / BE | ربط شعبة مكتب المدير بمدير المديرية كمرجع أعلى، إنشاء موقع بصمة مدير المديرية/كربلاء وإدراج د. علي عباس جاسم فيه منفرداً، وملء dept_text بمدير المديرية، وتطوير التزامن التلقائي عند اختيار مستوى 1 و2 في شاشات إدارة الموظفين والهيكلية. النشر SAME=366 |\n'

marker = '| 2026-11-03 | إطلاق Beta: قصر التطبيق على كربلاء المقدسة'
idx = text.find(marker)
if idx != -1:
    end_line = text.find('\n', idx)
    text = text[:end_line+1] + entry + text[end_line+1:]
else:
    text += entry

with open('.agents/skills/inftele-architecture/SKILL.md', 'w', encoding='utf-8', newline='\n') as f:
    f.write(text)

print('SUCCESS: Updated inftele-architecture skill.')
