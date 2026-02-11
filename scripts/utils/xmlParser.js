
import fs from 'fs';
import iconv from 'iconv-lite';
import { parseString } from 'xml2js';

// دالة لقراءة ومعالجة ملف XML الخاص بيانات الموظفين
export async function parseEmployeeXML(filePath) {
    return new Promise((resolve, reject) => {
        if (!fs.existsSync(filePath)) {
            reject(new Error(`File not found: ${filePath}`));
            return;
        }

        const buffer = fs.readFileSync(filePath);
        // XML is encoded in Windows-1256 (Arabic)
        const decoded = iconv.decode(buffer, 'win1256');

        parseString(decoded, (err, result) => {
            if (err) {
                reject(err);
                return;
            }

            try {
                // Navigate XML structure to find the employees list
                // Based on previous inspection, structure is roughly:
                // Root -> List -> Item[]
                const rootKey = Object.keys(result)[0];
                const listKey = Object.keys(result[rootKey])[0];
                const rawItems = result[rootKey][listKey];

                if (!Array.isArray(rawItems)) {
                    resolve([]); // Empty or unexpected structure
                    return;
                }

                // Map raw items to cleaner objects
                const employees = rawItems.map(item => {
                    // Extract fields safely (they come as arrays from xml2js)
                    const getVal = (key) => item[key] ? item[key][0] : null;

                    return {
                        job_number: getVal('SAL_ID'), // Assuming this is the Job Number
                        full_name: getVal('SAL_NAME'),
                        card_number: getVal('CARD'),
                        // Add other fields if needed, e.g. department, title
                    };
                }).filter(emp => emp.job_number && emp.full_name); // Filter invalid entries

                resolve(employees);
            } catch (error) {
                reject(error);
            }
        });
    });
}
