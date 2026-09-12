const fs = require('fs');
const lines = fs.readFileSync('data2.txt', 'utf8').trim().split('\n');
const queries = [];
lines.forEach(line => {
  const parts = line.split('\t').map(p => p.trim());
  if (parts.length >= 3) {
    const name = parts[0].replace(/'/g, "''");
    const job = parts[2].replace(/'/g, "''");
    queries.push(`UPDATE profiles SET username = '${name}' WHERE job_number = '${job}' AND governorate = 'babil';`);
  }
});
fs.writeFileSync('update_usernames.sql', queries.join('\n'));
