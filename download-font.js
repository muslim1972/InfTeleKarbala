const https = require('https');
const fs = require('fs');

const file = fs.createWriteStream("public/fonts/Amiri-Regular.ttf");
https.get("https://raw.githubusercontent.com/google/fonts/main/ofl/amiri/Amiri-Regular.ttf", function (response) {
    if (response.statusCode === 200) {
        response.pipe(file);
        file.on('finish', () => {
            file.close();
            console.log("Download completed.");
        });
    } else if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        // Handle redirect
        https.get(response.headers.location, function (res) {
            res.pipe(file);
            file.on('finish', () => {
                file.close();
                console.log("Download completed after redirect.");
            });
        });
    } else {
        console.log("Failed with status:", response.statusCode);
    }
}).on('error', function (err) {
    fs.unlink("public/fonts/Amiri-Regular.ttf", () => { }); // Delete the file async
    console.error("Error downloading font:", err.message);
});
