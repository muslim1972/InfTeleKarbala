import { createClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env vars from .env file
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase credentials in .env");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const normalizeText = (text) => {
    if (!text) return '';
    return String(text)
        .replace(/[\u200B-\u200D\uFEFF]/g, '')
        .trim()
        .toLowerCase()
        .replace(/[أإآ]/g, 'ا')
        .replace(/ة/g, 'ه')
        .replace(/ى/g, 'ي')
        .replace(/عبد\s+ال/g, 'عبدال')
        .replace(/عبدال/g, 'عبد ال')
        .replace(/\s+/g, ' ');
};

async function processExcelFile(filePath) {
    console.log(`\nProcessing file: ${path.basename(filePath)}`);
    const buf = fs.readFileSync(filePath);
    const wb = XLSX.read(buf, { type: 'buffer' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(ws, { header: 1 });

    if (data.length < 2) {
        console.warn(`File ${path.basename(filePath)} is empty or invalid.`);
        return;
    }

    // Row 1 is the department name
    const rawDeptName = data[0][0];
    if (!rawDeptName) {
        console.warn(`Could not find department name in row 1 of ${path.basename(filePath)}`);
        return;
    }

    // Clean up the department name (remove phrases like "اسماء موظفين")
    let targetDeptName = rawDeptName.replace(/اسماء\s+موظفين\s+/g, '').replace(/اسماء\s+كادر\s+/g, '').trim();
    console.log(`Target Department: "${targetDeptName}"`);

    // Explicit manual mappings for known edge cases based on user's db
    const explicitMappings = {
        "شعبة نظام المعلومات": "شعبة الـ (GIS)",
        "الشعبة القانوية": "الشعبة القانونية",
        "شعبة القدرة والتكيف": "شعبة القدرة",
        "ادارة تجهيز الخدمة": "شعبة ادارة تجهيز الخدمة",
        "تقييم ادارة تجهيز الخدمة": "شعبة ادارة تجهيز الخدمة", // assuming it maps here based on name
        "مجمع الجدول الغربي": "مجمع اتصالات الجدول الغربي",
        "مجمع الحر": "مجمع اتصالات الحر (ع)",
        "مجمع الحسينية": "مجمع اتصالات الحسينية",
        "مجمع الخيرات": "مجمع اتصالات الخيرات",
        "مجمع الغدير": "مجمع اتصالات الغدير",
        "مجمع سيد الشهداء": "مجمع اتصالات سيد الشهداء (ع)",
        "مجمع عين التمر": "مجمع اتصالات عين التمر",
        "مجمع الهندية": "مجمع اتصالات الهندية"
    };

    // Pre-check explicit mapping
    if (explicitMappings[targetDeptName]) {
        targetDeptName = explicitMappings[targetDeptName];
        console.log(`  -> 💡 Using explicit mapping: "${targetDeptName}"`);
    }

    const { data: departments, error: deptError } = await supabase.from('departments').select('id, name');
    if (deptError) {
        console.error("Error fetching departments:", deptError);
        return;
    }

    const deptNorm = (text) => normalizeText(text).replace(/شعبة\s+/g, '').replace(/قسم\s+/g, '').replace(/مجمع\s+/g, '').replace(/ادارة\s+/g, '').replace(/وحدة\s+/g, '').replace(/\(ع\)/g, '').replace(/اتصالات\s+/g, '').trim();

    const targetDeptNorm = deptNorm(targetDeptName);

    const deptMap = new Map(departments.map(d => [deptNorm(d.name), d.id]));
    let targetDeptId = deptMap.get(targetDeptNorm);

    // Also check exact name in db to bypass normalization issues
    if (!targetDeptId) {
        const exactMatch = departments.find(d => d.name === targetDeptName);
        if (exactMatch) targetDeptId = exactMatch.id;
    }

    if (!targetDeptId) {
        // Try fuzzy matching (substring)
        const fuzzyMatch = departments.find(d =>
            deptNorm(d.name).includes(targetDeptNorm) ||
            targetDeptNorm.includes(deptNorm(d.name))
        );

        if (fuzzyMatch) {
            console.log(`  -> 🔄 Fuzzy matched "${targetDeptName}" to Database name: "${fuzzyMatch.name}"`);
            targetDeptId = fuzzyMatch.id;
        } else {
            console.warn(`\n⚠️ Warning: Could not find a department matching "${targetDeptName}" in the database.`);
            console.warn(`Available DB Departments:`, departments.map(d => d.name).join(' | '));
            return;
        }
    }

    console.log(`✅ Found Department ID: ${targetDeptId}`);

    // Fetch all users to match names
    const { data: users, error: userError } = await supabase.from('profiles').select('id, full_name');
    if (userError) {
        console.error("Error fetching profiles:", userError);
        return;
    }
    const userMap = new Map();
    users.forEach(u => {
        if (u.full_name) {
            userMap.set(normalizeText(u.full_name), u.id);
        }
    });

    const allUsers = users.map(u => ({
        id: u.id,
        normName: normalizeText(u.full_name),
        solidName: normalizeText(u.full_name).replace(/\s+/g, '')
    })).filter(u => u.normName);

    let successCount = 0;
    let missingCount = 0;

    // Row 2+ are employee names
    for (let i = 1; i < data.length; i++) {
        const empNameRaw = data[i][0];
        if (!empNameRaw) continue;

        const normEmpName = normalizeText(empNameRaw);
        const solidEmpName = normEmpName.replace(/\s+/g, '');

        let userId = userMap.get(normEmpName);

        if (!userId) {
            // Advanced Fuzzy Match
            const fuzzyUser = allUsers.find(u => {
                const isSubstring = u.solidName.includes(solidEmpName) || solidEmpName.includes(u.solidName);
                if (isSubstring) return true;

                // Match first 10 characters ignoring spaces (e.g. "باقراسماعيل" matches "باقر اسماعيل")
                if (solidEmpName.length >= 8 && u.solidName.length >= 8) {
                    if (u.solidName.startsWith(solidEmpName.substring(0, 8))) return true;
                    if (solidEmpName.startsWith(u.solidName.substring(0, 8))) return true;
                }
                return false;
            });

            if (fuzzyUser) {
                console.log(`  -> 💡 Fuzzy Matched: "${empNameRaw}" => "${fuzzyUser.normName}"`);
                userId = fuzzyUser.id;
            }
        }

        if (userId) {
            const { error: updateError } = await supabase
                .from('profiles')
                .update({ department_id: targetDeptId, updated_at: new Date().toISOString() })
                .eq('id', userId);

            if (updateError) {
                console.error(`Error updating user ${empNameRaw}:`, updateError);
            } else {
                console.log(`  🔗 Updated: ${empNameRaw}`);
                successCount++;
            }
        } else {
            console.log(`  ❌ Not Found: ${empNameRaw}`);
            missingCount++;
        }
    }

    console.log(`File Summary: ${successCount} updated, ${missingCount} missing.`);
}


async function main() {
    const dirList = fs.readdirSync('D:/InfTeleKarbala/employees');
    const files = dirList.filter(f => f.endsWith('.xlsx') || f.endsWith('.xls'));

    console.log(`Found ${files.length} excel files.`);
    for (const file of files) {
        await processExcelFile(path.join('D:/InfTeleKarbala/employees', file));
    }
}

main().catch(console.error);
