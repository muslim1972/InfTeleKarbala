import fs from 'fs';

const filePath = 'src/context/AuthContext.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add work_schedule_id to AppUser interface
content = content.replace(
  /retirement_note\?: string;\s*\}/,
  'retirement_note?: string;\n  work_schedule_id?: string | null;\n}'
);

// 2. Add work_schedule_id in session restore
content = content.replace(
  /retirement_note: profile\.retirement_note\s*\};/,
  'retirement_note: profile.retirement_note,\n              work_schedule_id: profile.work_schedule_id\n            };'
);

// 3. Add work_schedule_id in login
content = content.replace(
  /retirement_note: fullProfile\.retirement_note\s*\};/,
  'retirement_note: fullProfile.retirement_note,\n        work_schedule_id: fullProfile.work_schedule_id\n      };'
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('AuthContext patched successfully');
