const fs = require('fs');
const b64 = fs.readFileSync('public/logo-new.png').toString('base64');
let html = fs.readFileSync('splash_itpc.html','utf8');
html = html.replace('src="public/logo-new.png"','src="data:image/png;base64,'+b64+'"');
fs.writeFileSync('splash_final.html',html,'utf8');
console.log('OK size='+(fs.statSync('splash_final.html').size/1024).toFixed(0)+'KB');