
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
        // Path based on debug output: REP210 -> LIST_G_SAL_ID[0] -> G_SAL_ID
        const root = result.REP210;
        if (!root) throw new Error('Root REP210 not found');

        const listWrapper = root.LIST_G_SAL_ID ? root.LIST_G_SAL_ID[0] : null;
        if (!listWrapper) throw new Error('LIST_G_SAL_ID not found');

        const items = listWrapper.G_SAL_ID;
        if (!items || !Array.isArray(items)) throw new Error('G_SAL_ID array not found');

        console.log(`✅ Found ${items.length} employee records.`);

        // Analyze fields of the first few items
        const fieldStats = {};

        items.forEach(item => {
            Object.keys(item).forEach(key => {
                if (!fieldStats[key]) {
                    fieldStats[key] = { count: 0, examples: new Set() };
                }
                fieldStats[key].count++;

                const val = item[key][0];
                if (val && typeof val === 'string' && val.trim() !== '') {
                    if (fieldStats[key].examples.size < 3) {
                        fieldStats[key].examples.add(val.trim());
                    }
                }
            });
        });

        console.log('\n🔍 XML Fields found in records:');
        console.log('---------------------------------------------------------');
        Object.keys(fieldStats).forEach(key => {
            const examples = Array.from(fieldStats[key].examples).join(', ');
            console.log(`${key.padEnd(35)} | ${String(fieldStats[key].count).padEnd(5)} | ${examples}`);
        });

    } catch (e) {
        console.error('Structure Error:', e.message);
        // Fallback dump if path is slightly off
        // console.log(JSON.stringify(result, null, 2).substring(0, 1000));
    }
});
