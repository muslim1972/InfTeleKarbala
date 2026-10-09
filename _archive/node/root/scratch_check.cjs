const fs = require('fs');
const c = fs.readFileSync('D:/Int-Karbala/dist/assets/index-DtE0VnCl.js', 'utf8');

// Search for schema: itpc
let idx = c.indexOf('schema');
let count = 0;
while (idx !== -1 && count < 10) {
  console.log('--- schema at', idx, '---');
  console.log(c.substring(Math.max(0, idx - 100), idx + 100));
  idx = c.indexOf('schema', idx + 10);
  count++;
}

// Search for "users"
console.log('\n\n=== Searching for "users" ===');
idx = c.indexOf('"users"');
count = 0;
while (idx !== -1 && count < 5) {
  console.log('--- "users" at', idx, '---');
  console.log(c.substring(Math.max(0, idx - 100), idx + 100));
  idx = c.indexOf('"users"', idx + 10);
  count++;
}

// Search for 'itpc'
console.log('\n\n=== Searching for itpc ===');
idx = c.indexOf('itpc');
count = 0;
while (idx !== -1 && count < 5) {
  console.log('--- itpc at', idx, '---');
  console.log(c.substring(Math.max(0, idx - 100), idx + 100));
  idx = c.indexOf('itpc', idx + 10);
  count++;
}
