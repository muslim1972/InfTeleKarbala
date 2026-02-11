
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

    // Function to safely print structure without dumping huge data
    function printStructure(obj, depth = 0, maxDepth = 4) {
        const indent = '  '.repeat(depth);
        if (depth > maxDepth) return;

        if (Array.isArray(obj)) {
            console.log(`${indent}(Array length: ${obj.length})`);
            if (obj.length > 0) {
                console.log(`${indent}[0]:`);
                printStructure(obj[0], depth + 1, maxDepth);
            }
        } else if (typeof obj === 'object' && obj !== null) {
            Object.keys(obj).forEach(key => {
                console.log(`${indent}${key}:`);
                printStructure(obj[key], depth + 1, maxDepth);
            });
        } else {
            // Primitive value, print a snippet
            console.log(`${indent}"${String(obj).substring(0, 50)}..."`);
        }
    }

    console.log('--- XML Structure Dump ---');
    printStructure(result);
});
