const https = require('https');
const fs = require('fs');
const path = require('path');

const fileUrl = 'https://github.com/google/fonts/raw/main/ofl/cairo/Cairo-Regular.ttf';
const destFolder = path.join(__dirname, 'public', 'fonts');
const dest = path.join(destFolder, 'Cairo-Regular.ttf');

if (!fs.existsSync(destFolder)) {
    fs.mkdirSync(destFolder, { recursive: true });
}

const file = fs.createWriteStream(dest);

https.get(fileUrl, function (response) {
    if (response.statusCode === 301 || response.statusCode === 302) {
        https.get(response.headers.location, function (res) {
            res.pipe(file);
            file.on('finish', function () {
                file.close();
                console.log('Download completed.');
            });
        }).on('error', function (err) {
            fs.unlink(dest, () => { });
            console.error('Error:', err.message);
        });
    } else {
        response.pipe(file);
        file.on('finish', function () {
            file.close();
            console.log('Download completed.');
        });
    }
}).on('error', function (err) {
    fs.unlink(dest, () => { });
    console.error('Error:', err.message);
});
