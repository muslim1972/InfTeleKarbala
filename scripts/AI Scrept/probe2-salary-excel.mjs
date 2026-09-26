// Probe 2: decode eng allowance base, marital x tax-category crosstab
// Usage: node scripts/probe2-salary-excel.mjs "<src.xlsx>" "<outDir>"
import XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';

const SRC = process.argv[2];
const OUT = process.argv[3];
const wb = XLSX.readFile(SRC, { cellDates: false });
const ws = wb.Sheets[wb.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null });
const header = rows[0].map(h => String(h == null ? '' : h));
const norm = s => String(s).replace(/\s+/g, ' ').trim();
const idx = {};
header.forEach((h, i) => { const k = norm(h); if (!(k in idx)) idx[k] = i; });
const get = (r, name) => { const i = idx[norm(name)]; return i == null ? null : r[i]; };
const num = v => {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return v;
  const s = String(v).replace(/[, ]/g, '');
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
};
const txt = v => (v == null ? '' : String(v).trim());
// pct: digits before OR after %
const pctIn = s => {
  const t = txt(s);
  let m = t.match(/(\d+(?:\.\d+)?)\s*%/);
  if (m) return parseFloat(m[1]);
  m = t.match(/%\s*(\d+(?:\.\d+)?)/);
  return m ? parseFloat(m[1]) : null;
};

const data = rows.slice(1);
const L = [];
const p = (...a) => L.push(a.join(' '));

const C = {
  id: 'الرقم الوظيفي', name: 'اسم الموظف', title: 'العنوان الوظيفي',
  nominal: 'الراتب الاسمي', engA: 'مخصصات هندسية', engText: 'المخصصات الهندسية',
  riskA: 'مخصصات الخطورة', extra50: 'المخصصات الاضافية 50%', lawA: 'مخصصات القانونية',
  marital: 'الحالة الزوجية', taxCat: 'حالة الموظف في الاستقطاع الضريبي',
  gross: 'الراتب الاجمالي'
};
if (idx[norm(C.gross)] == null) C.gross = Object.keys(idx).find(k => k.includes('الراتب الاجمالي'));

// A) ENG: distinct engText with amounts
p('### A) ENG text patterns (engA>0):');
const engPat = {};
for (const r of data) {
  const amt = num(get(r, C.engA));
  const t = txt(get(r, C.engText));
  const nom = num(get(r, C.nominal));
  if (amt != null && amt > 0) {
    const pct = pctIn(t);
    const key = `"${t}" | amt=${amt} | nom=${nom} | pct=${pct} | amt/nom=${nom ? (amt / nom * 100).toFixed(1) + '%' : '?'}`;
    engPat[key] = (engPat[key] || 0) + 1;
  }
}
Object.entries(engPat).sort((a, b) => b[1] - a[1]).slice(0, 20).forEach(([k, c]) => p(`   ${c}x ${k}`));
p(`   total rows engA>0: ${Object.values(engPat).reduce((a, b) => a + b, 0)}`);
p('   ENG text="غير مشمول" rows with engA>0:');
let g0 = 0;
for (const r of data) {
  const amt = num(get(r, C.engA));
  const t = txt(get(r, C.engText));
  if (amt != null && amt > 0 && t.includes('غير مشمول')) g0++;
}
p(`   count: ${g0}`);

// A2) with corrected pct extraction, retry nominal*pct match
p('### A2) ENG match retry (pct before % too):');
let m2 = 0, mis2 = 0;
for (const r of data) {
  const pct = pctIn(get(r, C.engText));
  const amt = num(get(r, C.engA));
  const nom = num(get(r, C.nominal));
  if (pct != null && amt != null && amt > 0 && nom) {
    if (Math.abs(amt - nom * pct / 100) <= 250) m2++; else mis2++;
  }
}
p(`   match=${m2} mismatch=${mis2}`);

// B) marital x taxCat category crosstab
p('### B) marital x tax-category crosstab:');
const cross = {};
for (const r of data) {
  const m = txt(get(r, C.marital)) || '(فارغ)';
  const tc = txt(get(r, C.taxCat));
  const cat = tc.match(/ج(\d)/) ? `ج${tc.match(/ج(\d)/)[1]}` : (tc ? 'بلا فئة' : '(فارغ)');
  const k = `${m} -> ${cat}`;
  cross[k] = (cross[k] || 0) + 1;
}
Object.entries(cross).sort((a, b) => b[1] - a[1]).forEach(([k, c]) => p(`   ${k}: ${c}`));

// C) extra50 == nom*50% hypothesis (risk values parked in wrong column)
p('### C) extra50 == nominal*50% rows:');
for (const r of data) {
  const e = num(get(r, C.extra50));
  const nom = num(get(r, C.nominal));
  const risk = num(get(r, C.riskA));
  if (e != null && e > 0 && nom) {
    p(`   #${txt(get(r, C.id))} ${txt(get(r, C.name))} | extra50=${e} nom*50%=${nom * 0.5} riskA=${risk} | riskText="${txt(get(r, 'نسبة الخطورة'))}"`);
  }
}

// D) law allowance recipients
p('### D) LAW allowance recipients:');
for (const r of data) {
  const v = num(get(r, C.lawA));
  if (v != null && v > 0) {
    const nom = num(get(r, C.nominal));
    p(`   #${txt(get(r, C.id))} ${txt(get(r, C.name))} | title="${txt(get(r, C.title))}" | law=${v} nom=${nom} law/nom=${nom ? (v / nom * 100).toFixed(1) + '%' : '?'}`);
  }
}

// E) drivers +87500: verify all 21
p('### E) gross-mystery rows titles count:');
const tCount = {};
for (const r of data) {
  const g = num(get(r, C.gross));
  const earnings = ['الراتب الاسمي', 'مخصصات الشهادة', 'مخصصات المنصب', 'مخصصات هندسية', 'مخصصات الخطورة', 'مخصصات القانونية', 'المخصصات الاضافية 50%', 'مخصصات النقل', 'مخصصات الزوجية', 'مخصصات الاطفال']
    .reduce((a, c) => a + (num(get(r, c)) || 0), 0);
  if (g != null && Math.abs(g - earnings) > 250) {
    const t = txt(get(r, C.title));
    tCount[t] = (tCount[t] || 0) + 1;
  }
}
Object.entries(tCount).forEach(([k, c]) => p(`   "${k}" x${c}`));

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'probe2.txt'), L.join('\n'), 'utf8');
console.log(`OK probe2 written: ${L.length} lines`);
