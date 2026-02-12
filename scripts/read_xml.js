const fs = require('fs');
const buf = fs.readFileSync('D:/InfTeleKarbala/rwservlet.xml');
// Try UTF-8 first, then raw
const text = buf.toString('utf8');
fs.writeFileSync('D:/InfTeleKarbala/rwservlet_output.txt', text, 'utf8');
console.log('File size:', buf.length, 'bytes');
console.log('First 3000 chars:');
console.log(text.substring(0, 3000));
