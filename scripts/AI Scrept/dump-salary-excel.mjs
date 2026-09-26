// General Excel structure dumper (reusable for any monthly file)
// Usage: node scripts/dump-salary-excel.mjs "<src.xlsx>" "<outDir>"
// Outputs: structure.txt (readable overview) + full.json (raw grid)
import XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';

const SRC = process.argv[2];
const OUT = process.argv[3];
if (!SRC || !OUT) {
  console.error('usage: node scripts/dump-salary-excel.mjs "<src.xlsx>" "<outDir>"');
  process.exit(1);
}
fs.mkdirSync(OUT, { recursive: true });

const wb = XLSX.readFile(SRC, { cellDates: false });
const lines = [];
lines.push('FILE: ' + SRC);
lines.push('SHEETS: ' + JSON.stringify(wb.SheetNames));

const data = {};
for (const name of wb.SheetNames) {
  const ws = wb.Sheets[name];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null });
  data[name] = rows;
  lines.push('');
  lines.push('=== SHEET: ' + JSON.stringify(name) + ' RANGE: ' + ws['!ref'] + ' TOTAL_ROWS: ' + rows.length);
  lines.push('MERGES: ' + JSON.stringify(ws['!merges'] || []));
  const preview = Math.min(8, rows.length);
  for (let i = 0; i < preview; i++) {
    lines.push('R' + i + ' (cols=' + rows[i].length + '): ' + JSON.stringify(rows[i]));
  }
  if (rows.length > preview) {
    lines.push('... LAST ROW R' + (rows.length - 1) + ': ' + JSON.stringify(rows[rows.length - 1]));
  }
}

fs.writeFileSync(path.join(OUT, 'structure.txt'), lines.join('\n'), 'utf8');
fs.writeFileSync(path.join(OUT, 'full.json'), JSON.stringify(data), 'utf8');
console.log('OK ' + wb.SheetNames.length + ' sheets, rows: ' + Object.values(data).map(r => r.length).join(','));
