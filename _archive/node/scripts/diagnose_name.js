
import { supabase } from './utils/db.js';
import fs from 'fs';

const OUT_FILE = 'diagnosis_report.txt';

function toUnicode(str) {
    if (!str) return 'null';
    return str.split('').map(c => {
        const hex = c.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0');
        return `\\u${hex}('${c}')`;
    }).join(' ');
}

async function diagnose() {
    const logBuffer = [];
    const log = (msg) => {
        console.log(msg);
        logBuffer.push(msg);
    };

    log('🔍 Starting Unicode Diagnosis...');

    // Fetch first 50 profiles
    const { data: profiles, error } = await supabase
        .from('profiles')
        .select('id, full_name, job_number')
        .limit(50);

    if (error) {
        log(`❌ DB Error: ${error.message}`);
        fs.writeFileSync(OUT_FILE, logBuffer.join('\n'));
        return;
    }

    log(`✅ Loaded ${profiles.length} profiles.`);

    // Look for names containing "مسلم" visually
    // We will construct a regex that allows for optional accents/marks
    const looseRegex = /[\u0600-\u06FF]*[م][\u0600-\u06FF]*[س][\u0600-\u06FF]*[ل][\u0600-\u06FF]*[م][\u0600-\u06FF]*/;

    log('\n--- Checking for "Muslim" patterns ---');
    let found = false;

    for (const p of profiles) {
        if (!p.full_name) continue;

        // Check if it matches our loose regex or just contains the letters
        if (p.full_name.includes('مسلم') || looseRegex.test(p.full_name)) {
            found = true;
            log(`\n🆔 Found Match Candidate:`);
            log(`   Job Number: ${p.job_number}`);
            log(`   Visual Name: "${p.full_name}"`);
            log(`   Unicode Raw: ${toUnicode(p.full_name)}`);

            // Compare with standard Typed "مسلم"
            const standard = "مسلم";
            if (p.full_name.includes(standard)) {
                log(`   ✅ Contains standard "مسلم" (${toUnicode(standard)})`);
            } else {
                log(`   ❌ DOES NOT contain standard "مسلم" (${toUnicode(standard)})`);
                log(`   ⚠️ This confirms the mismatch! Using different characters.`);
            }
        }
    }

    if (!found) {
        log('\n⚠️ No visual matches for "مسلم" found in first 50 rows.');
        log('Dumping first 5 rows for general inspection:');
        profiles.slice(0, 5).forEach(p => {
            log(`\nName: "${p.full_name}"`);
            log(`Code: ${toUnicode(p.full_name)}`);
        });
    }

    fs.writeFileSync(OUT_FILE, logBuffer.join('\n'));
    log(`\n📄 Report saved to ${OUT_FILE}`);
}

diagnose();
