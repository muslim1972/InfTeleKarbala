const fs = require('fs');
const path = 'D:/noortech/src/app/dashboard/page.tsx';
let content = fs.readFileSync(path, 'utf8');

// Fix the botched import lines - they have extra quotes
content = content.replace(
  '"import ParticipantSearchModal from',
  'import ParticipantSearchModal from'
);
content = content.replace(
  "NotificationsBell';\"",
  "NotificationsBell';"
);

fs.writeFileSync(path, content);
console.log('Done fixing page.tsx');