"const fs = require('fs');
const path = 'D:/noortech/src/app/dashboard/page.tsx';
let content = fs.readFileSync(path, 'utf8');

// Fix the botched import lines
content = content.replace(
  '\"import ParticipantSearchModal from',
  'import ParticipantSearchModal from'
).replace(
  'NotificationsBell';\\\"',
  'NotificationsBell';'
);

console.log('Fixed content check:', content.substring(0, 500));
fs.writeFileSync(path, content);
console.log('Done fixing page.tsx');
"