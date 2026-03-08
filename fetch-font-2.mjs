import fs from 'fs';
import path from 'path';

async function downloadFont() {
    const url = 'https://raw.githubusercontent.com/googlefonts/cairo/master/fonts/ttf/Cairo-Regular.ttf';
    try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        const buffer = await res.arrayBuffer();
        const dest = path.join(process.cwd(), 'public', 'fonts', 'Cairo-Regular.ttf');
        fs.writeFileSync(dest, Buffer.from(buffer));
        console.log('Font downloaded successfully via fetch API:', dest);
    } catch (e) {
        console.error('Failed to download font:', e);
    }
}
downloadFont();
