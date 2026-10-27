const fs = require('fs');
const path = require('path');

const ignoreDirs = new Set(['node_modules', '.git', 'dist', '.gemini', 'tmp']);
const results = [];

function searchDir(dir) {
    let entries;
    try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (e) {
        return;
    }
    for (const entry of entries) {
        if (entry.isDirectory()) {
            if (!ignoreDirs.has(entry.name)) {
                searchDir(path.join(dir, entry.name));
            }
        } else if (entry.isFile()) {
            if (entry.name.endsWith('.cjs')) continue; // Skip temporary scripts
            const fullPath = path.join(dir, entry.name);
            try {
                const content = fs.readFileSync(fullPath, 'utf8');
                if (content.includes('طابوق')) {
                    const lines = content.split('\n');
                    lines.forEach((line, idx) => {
                        if (line.includes('طابوق')) {
                            results.push({
                                file: path.relative(process.cwd(), fullPath),
                                line: idx + 1,
                                text: line.trim()
                            });
                        }
                    });
                }
            } catch (e) {}
        }
    }
}

searchDir(process.cwd());

if (results.length === 0) {
    console.log('CLEAN: ZERO occurrences of (طابوق) found in the entire project!');
} else {
    console.log(`Found ${results.length} remaining occurrences:`);
    results.forEach(r => console.log(`${r.file}:${r.line}: ${r.text}`));
}
