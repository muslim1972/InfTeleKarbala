
import { supabase } from './utils/db.js';

function toUnicode(str) {
    return str.split('').map(c => {
        return '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0');
    }).join('');
}

async function inspectUnicode() {
    console.log('🔍 Inspecting Unicode Normalization...');

    // 1. Search for any profile containing 'مسلم' using a very loose search or just list some
    // Since strict filter failed, let's try to fetch by something else or just list all
    const { data: profiles, error } = await supabase
        .from('profiles')
        .select('full_name, job_number')
        .limit(50);

    if (error) { console.error(error); return; }

    // Find the user "مسلم" manually in JS
    const targetName = "مسلم";
    console.log(`Target Literal "${targetName}": ${toUnicode(targetName)}`);

    const match = profiles.find(p => p.full_name && p.full_name.includes(targetName));

    if (match) {
        console.log(`\n✅ Found in JS Filter!`);
        console.log(`DB Name: "${match.full_name}"`);
        console.log(`DB Unicode: ${toUnicode(match.full_name)}`);

        // Detailed Comparison
        const idx = match.full_name.indexOf(targetName);
        const extracted = match.full_name.substr(idx, targetName.length);
        console.log(`Extracted substring: "${extracted}" -> ${toUnicode(extracted)}`);

        if (extracted !== targetName) {
            console.log('⚠️ MISMATCH DETECTED!');
        } else {
            console.log('✅ Exact match in unicode. Mystery why DB filter failed.');
        }
    } else {
        console.log('\n❌ Manual JS search also failed to find "مسلم" in first 50 rows.');
        console.log('Printing first 5 names to check format:');
        profiles.slice(0, 5).forEach(p => {
            console.log(`- ${p.full_name} : ${toUnicode(p.full_name)}`);
        });
    }
}

inspectUnicode();
