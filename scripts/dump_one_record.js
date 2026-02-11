
import fs from 'fs';
import iconv from 'iconv-lite';
import { parseString } from 'xml2js';

const XML_FILE = 'rwservlet.xml';

if (!fs.existsSync(XML_FILE)) {
    console.error(`File not found: ${XML_FILE}`);
    process.exit(1);
}

const buffer = fs.readFileSync(XML_FILE);
const decoded = iconv.decode(buffer, 'win1256');

parseString(decoded, (err, result) => {
    if (err) {
        console.error('XML Parse Error:', err);
        return;
    }

    try {
        const root = result.REP210;
        const listWrapper = root.LIST_G_SAL_ID[0];
        const items = listWrapper.G_SAL_ID;

        console.log(`✅ Found ${items.length} records.`);
        console.log('--- DUMP OF FIRST RECORD ---');

        const firstItem = items[0];
        // Normalize for display
        const cleanItem = {};
        Object.keys(firstItem).forEach(key => {
            cleanItem[key] = firstItem[key][0];
        });

        console.log(JSON.stringify(cleanItem, null, 2));

        console.log('--- END DUMP ---');

    } catch (e) {
        console.error('Structure Error:', e);
    }
});
