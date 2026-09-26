// Probe script: resolve open questions from findings.txt
// Usage: node scripts/probe-salary-excel.mjs "<src.xlsx>" "<outDir>"
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
const pctIn = s => { const m = txt(s).match(/(\d+(?:\.\d+)?)\s*%/); return m ? parseFloat(m[1]) : null; };

const C = {
  id: 'الرقم الوظيفي', name: 'اسم الموظف', title: 'العنوان الوظيفي', cert: 'الشهادة',
  grade: 'الدرجة', step: 'المرحلة', taxCat: 'حالة الموظف في الاستقطاع الضريبي',
  nominal: 'الراتب الاسمي', certA: 'مخصصات الشهادة', posA: 'مخصصات المنصب',
  engA: 'مخصصات هندسية', riskA: 'مخصصات الخطورة', lawA: 'مخصصات القانونية',
  extra50: 'المخصصات الاضافية 50%', trans: 'مخصصات النقل', spouse: 'مخصصات الزوجية',
  kids: 'مخصصات الاطفال', gross: 'الراتب الاجمالي', loan: 'استقطاع مبلغ القرض',
  tarkh: 'طرح مبلغ', exec: 'مبلغ التنفيذ', tax: 'الضريبة', pension: 'التقاعد',
  soc: 'الحماية الاجتماعية', stamp: 'طابع مدرسي', dedTotal: 'مجموع الاستقطاعات',
  net: 'الراتب الصافي', work: 'مكان العمل حسب تصنيف المالية', riskPct: 'نسبة الخطورة',
  marital: 'الحالة الزوجية', position: 'المنصب', engText: 'المخصصات الهندسية',
  date: 'تاريخ استحقاق الراتب الحالي2'
};
if (idx[norm(C.gross)] == null) C.gross = Object.keys(idx).find(k => k.includes('الراتب الاجمالي'));
if (idx[norm(C.tax)] == null) C.tax = Object.keys(idx).find(k => k.includes('الضريبة') || k.includes('الضريبه'));

const data = rows.slice(1);
const L = [];
const p = (...a) => L.push(a.join(' '));

// A) engineering allowance: implied base vs nominal
p('### A) ENG allowance: pct -> amount implied base');
const engRatio = {};
let engWithAmt = 0;
for (const r of data) {
  const pct = pctIn(get(r, C.engText));
  const amt = num(get(r, C.engA));
  const nom = num(get(r, C.nominal));
  if (pct != null && amt != null && amt > 0 && nom) {
    engWithAmt++;
    const base = amt / (pct / 100);
    const ratio = +(base / nom).toFixed(2);
    engRatio[`${pct}% -> base/nominal=${ratio}`] = (engRatio[`${pct}% -> base/nominal=${ratio}`] || 0) + 1;
  }
}
Object.entries(engRatio).sort((a, b) => b[1] - a[1]).slice(0, 30)
  .forEach(([k, c]) => p(`   ${c}x ${k}`));
p(`   rows with eng pct + amount: ${engWithAmt}`);
// sample rows
let shown = 0;
for (const r of data) {
  const pct = pctIn(get(r, C.engText));
  const amt = num(get(r, C.engA));
  const nom = num(get(r, C.nominal));
  if (pct != null && amt != null && amt > 0 && nom && shown < 6) {
    shown++;
    p(`   SAMPLE #${txt(get(r, C.id))} pct=${pct} amt=${amt} nom=${nom} base=${(amt / (pct / 100)).toFixed(0)} gross=${num(get(r, C.gross))}`);
  }
}

// B) gross mystery +87500: find source column
p('### B) GROSS > sum(earnings): diff histogram + source column');
const earningsCols = [C.nominal, C.certA, C.posA, C.engA, C.riskA, C.lawA, C.extra50, C.trans, C.spouse, C.kids];
const gBad = [];
for (const r of data) {
  const g = num(get(r, C.gross));
  const s = earningsCols.reduce((acc, c) => acc + (num(get(r, c)) || 0), 0);
  if (g != null && Math.abs(g - s) > 250) gBad.push({ r, diff: Math.round(g - s) });
}
const diffCount = {};
gBad.forEach(x => { diffCount[x.diff] = (diffCount[x.diff] || 0) + 1; });
Object.entries(diffCount).sort((a, b) => b[1] - a[1]).forEach(([k, c]) => p(`   diff=${k} x${c}`));
for (let i = 0; i < header.length; i++) {
  const h = norm(header[i]);
  if (!h) continue;
  let c = 0;
  for (const x of gBad) {
    const v = num(x.r[i]);
    if (v != null && Math.abs(v - x.diff) <= 1) c++;
  }
  if (c > 0) p(`   SOURCE? col "${h}" equals diff in ${c}/${gBad.length} rows`);
}
// are those rows special in title/workplace?
const gBadTitle = {};
gBad.forEach(x => { const t = txt(get(x.r, C.title)); gBadTitle[t] = (gBadTitle[t] || 0) + 1; });
p(`   titles of mismatch rows: ${JSON.stringify(Object.entries(gBadTitle).sort((a, b) => b[1] - a[1]).slice(0, 8))}`);

// C) pension != 10% rows: full identity
p('### C) PENSION mismatch rows identity');
for (const r of data) {
  const nom = num(get(r, C.nominal)); const pen = num(get(r, C.pension));
  if (nom && pen != null && Math.abs(pen - nom * 0.10) > 250) {
    p(`   #${txt(get(r, C.id))} ${txt(get(r, C.name))} | title=${txt(get(r, C.title))} | cert="${txt(get(r, C.cert))}" | nom=${nom} pen=${pen} (${(pen / nom * 100).toFixed(1)}%) | certA=${num(get(r, C.certA))} riskA=${num(get(r, C.riskA))} engA=${num(get(r, C.engA))} riskPct="${txt(get(r, C.riskPct))}" | grade=${txt(get(r, C.grade))}/${txt(get(r, C.step))}`);
  }
}
// risk mismatch rows identity
p('### C2) RISK allowance mismatch rows identity');
for (const r of data) {
  const pct = pctIn(get(r, C.riskPct));
  const amt = num(get(r, C.riskA));
  const nom = num(get(r, C.nominal));
  if (pct != null && amt != null && nom && Math.abs(amt - nom * pct / 100) > 250) {
    p(`   #${txt(get(r, C.id))} ${txt(get(r, C.name))} | title=${txt(get(r, C.title))} | nom=${nom} riskPct=${pct} amt=${amt} | engA=${num(get(r, C.engA))} | work="${txt(get(r, C.work))}"`);
  }
}
// cert mismatch rows identity
p('### C3) CERT allowance mismatch rows identity');
for (const r of data) {
  const pct = pctIn(get(r, C.cert));
  const amt = num(get(r, C.certA));
  const nom = num(get(r, C.nominal));
  if (pct != null && amt != null && nom && Math.abs(amt - nom * pct / 100) > 250) {
    p(`   #${txt(get(r, C.id))} ${txt(get(r, C.name))} | title=${txt(get(r, C.title))} | cert="${txt(get(r, C.cert))}" pct=${pct} nom=${nom} amt=${amt} | pension=${num(get(r, C.pension))}`);
  }
}

// D) law allowance: who gets what
p('### D) LAW allowance values (nonzero)');
const lawCount = {};
for (const r of data) {
  const v = num(get(r, C.lawA));
  if (v != null && v > 0) {
    const k = `${v}`;
    lawCount[k] = (lawCount[k] || 0) + 1;
  }
}
Object.entries(lawCount).sort((a, b) => b[1] - a[1]).slice(0, 12).forEach(([k, c]) => p(`   ${k} x${c}`));

// E) grade/step conflicts detail
p('### E) grade/step conflict rows (1/11 and 2/11)');
for (const r of data) {
  const g = txt(get(r, C.grade)); const s = txt(get(r, C.step));
  if ((g === '1' || g === '2') && s === '11') {
    p(`   G${g}/S${s} nom=${num(get(r, C.nominal))} | ${txt(get(r, C.title))} | ${txt(get(r, C.name))} | cert="${txt(get(r, C.cert))}"`);
  }
}

// F) deductions: total vs 7 items diff histogram
p('### F) DEDUCTIONS total vs items: diff histogram');
const dedCols = [C.loan, C.tarkh, C.exec, C.tax, C.pension, C.soc, C.stamp];
const dCount = {};
for (const r of data) {
  const t = num(get(r, C.dedTotal));
  const s = dedCols.reduce((a, c) => a + (num(get(r, c)) || 0), 0);
  if (t != null) { const d = Math.round(t - s); dCount[d] = (dCount[d] || 0) + 1; }
}
Object.entries(dCount).sort((a, b) => b[1] - a[1]).slice(0, 18).forEach(([k, c]) => p(`   diff=${k} x${c}`));
// 3 samples with big diff
let shownF = 0;
for (const r of data) {
  const t = num(get(r, C.dedTotal));
  const s = dedCols.reduce((a, c) => a + (num(get(r, c)) || 0), 0);
  if (t != null && Math.abs(t - s) > 250 && shownF < 4) {
    shownF++;
    p(`   SAMPLE #${txt(get(r, C.id))} total=${t} items=${Math.round(s)} diff=${Math.round(t - s)} | tax=${num(get(r, C.tax))} pension=${num(get(r, C.pension))} exec=${num(get(r, C.exec))} tarkh=${num(get(r, C.tarkh))} stamp=${num(get(r, C.stamp))}`);
  }
}

// G) tax category vs tax/gross
p('### G) TAX category distribution + tax/gross%');
const catCount = {};
for (const r of data) {
  const cat = txt(get(r, C.taxCat)) || '(empty)';
  const t = num(get(r, C.tax)); const g = num(get(r, C.gross));
  catCount[cat] = catCount[cat] || { n: 0, ratios: new Set() };
  catCount[cat].n++;
  if (t != null && g) catCount[cat].ratios.add(+(t / g * 100).toFixed(1));
}
Object.entries(catCount).forEach(([k, v]) => {
  const u = [...v.ratios].sort((a, b) => a - b);
  p(`   ${k}: n=${v.n} ratios%=[${u.slice(0, 10).join(',')}${u.length > 10 ? '...' : ''}]`);
});

// H) extra50 + transport distributions
p('### H) extra50 + transport + position allowance quick dist');
const e50 = {};
for (const r of data) { const v = num(get(r, C.extra50)) || 0; e50[v] = (e50[v] || 0) + 1; }
Object.entries(e50).sort((a, b) => b[1] - a[1]).slice(0, 8).forEach(([k, c]) => p(`   extra50=${k} x${c}`));
const tr = {};
for (const r of data) { const v = num(get(r, C.trans)); if (v != null) tr[v] = (tr[v] || 0) + 1; }
Object.entries(tr).sort((a, b) => b[1] - a[1]).slice(0, 8).forEach(([k, c]) => p(`   transport=${k} x${c}`));

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'probe.txt'), L.join('\n'), 'utf8');
console.log(`OK probe written: ${L.length} lines`);
