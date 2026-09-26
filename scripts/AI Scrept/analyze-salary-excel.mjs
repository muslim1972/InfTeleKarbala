// Salary Excel relationship analyzer (reusable)
// Usage: node scripts/analyze-salary-excel.mjs "<src.xlsx>" "<outDir>"
// Verifies arithmetic/functional relationships across ALL rows and dumps findings.
import XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';

const SRC = process.argv[2];
const OUT = process.argv[3];
if (!SRC || !OUT) { console.error('usage: node scripts/analyze-salary-excel.mjs "<src>" "<outDir>"'); process.exit(1); }
fs.mkdirSync(OUT, { recursive: true });

const wb = XLSX.readFile(SRC, { cellDates: false });
const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: true, defval: null });
const H = rows[0].map(h => (h == null ? '' : String(h).trim()));
const idx = Object.fromEntries(H.map((h, i) => [h, i]));
const D = rows.slice(1).filter(r => r[idx['اسم الموظف']] != null);

const num = v => {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return v;
  const s = String(v).replace(/[,\s]/g, '');
  return /^-?\d+(\.\d+)?$/.test(s) ? parseFloat(s) : null;
};
const txt = v => (v == null ? '' : String(v).trim());
const pctIn = s => { const m = txt(s).match(/(\d+(?:\.\d+)?)\s*%/); return m ? parseFloat(m[1]) : null; };
const close = (a, b) => a != null && b != null && Math.abs(a - b) <= 250; // rounding tolerance

const L = [];
const say = s => L.push(s);
const stat = (label, ok, bad, total, badSamples) => {
  say(`${label}: match ${ok}/${total}` + (bad ? `  MISMATCH ${bad}` : ''));
  (badSamples || []).slice(0, 6).forEach(x => say('   BAD: ' + x));
};

// ---- basic integrity
say('### ROWS: ' + D.length);
const idDup = {}, nameDup = {};
D.forEach(r => {
  const id = String(r[idx['الرقم الوظيفي']]); const nm = txt(r[idx['اسم الموظف']]);
  (idDup[id] = idDup[id] || []).push(nm); (nameDup[nm] = nameDup[nm] || []).push(id);
});
say('DUP_JOB_IDS: ' + Object.entries(idDup).filter(([, v]) => v.length > 1).length);
Object.entries(idDup).filter(([, v]) => v.length > 1).slice(0, 8).forEach(([k, v]) => say('   ' + k + ' => ' + JSON.stringify(v)));
say('DUP_NAMES: ' + Object.entries(nameDup).filter(([, v]) => v.length > 1).length);
Object.entries(nameDup).filter(([, v]) => v.length > 1).slice(0, 8).forEach(([k, v]) => say('   ' + k + ' => ' + JSON.stringify(v)));

const ibanRe = /^IQ\d{2}[A-Z]{4}[A-Z0-9]{15}$/;
const badIban = D.filter(r => !ibanRe.test(txt(r[idx['IBAN']])));
say('IBAN_INVALID: ' + badIban.length);
badIban.slice(0, 6).forEach(r => say('   ' + r[idx['الرقم الوظيفي']] + ' ' + txt(r[idx['IBAN']])));
const ibanBanks = {};
D.forEach(r => { const m = txt(r[idx['IBAN']]).match(/^IQ\d{2}([A-Z]{4})/); if (m) ibanBanks[m[1]] = (ibanBanks[m[1]] || 0) + 1; });
say('IBAN_BANKS: ' + JSON.stringify(ibanBanks));

// ---- grade/step -> nominal salary mapping
const gsMap = new Map();
D.forEach(r => {
  const g = num(r[idx['الدرجة']]), s = num(r[idx['المرحلة']]), n = num(r[idx['الراتب الاسمي']]);
  if (g == null || s == null) return;
  const k = g + '/' + s;
  if (!gsMap.has(k)) gsMap.set(k, new Map());
  const m = gsMap.get(k); const key = String(n);
  m.set(key, (m.get(key) || 0) + 1);
});
say('### GRADE/STEP -> NOMINAL (conflicts only):');
let gsConf = 0;
[...gsMap.entries()].sort((a, b) => parseFloat(a[0].split('/')[0]) - parseFloat(b[0].split('/')[0]) || parseFloat(a[0].split('/')[1]) - parseFloat(b[0].split('/')[1])).forEach(([k, m]) => {
  if (m.size > 1) { gsConf++; say('   G/S ' + k + ' has ' + JSON.stringify([...m.entries()])); }
});
say('GRADE_STEP_KEYS: ' + gsMap.size + '  CONFLICTS: ' + gsConf);
const gOnly = new Map();
D.forEach(r => {
  const g = num(r[idx['الدرجة']]), s = num(r[idx['المرحلة']]), n = num(r[idx['الراتب الاسمي']]);
  if (g != null && s == null) { const m = gOnly.get(g) || new Map(); m.set(String(n), (m.get(String(n)) || 0) + 1); gOnly.set(g, m); }
});
say('GRADE_ONLY_KEYS: ' + [...gOnly.entries()].map(([g, m]) => g + ':' + JSON.stringify([...m.entries()])).join(' | '));
const noGrade = D.filter(r => num(r[idx['الدرجة']]) == null).length;
const withStepNoGrade = D.filter(r => num(r[idx['الدرجة']]) == null && num(r[idx['المرحلة']]) != null).length;
say('NO_GRADE_ROWS: ' + noGrade + '  STEP_WITHOUT_GRADE: ' + withStepNoGrade);

// ---- certificate allowance = nominal * cert%
let cOk = 0, cBad = 0, cSkip = 0; const cSamples = []; const certMap = new Map();
D.forEach(r => {
  const n = num(r[idx['الراتب الاسمي']]); const cert = txt(r[idx['الشهادة']]);
  const a = num(r[idx['مخصصات الشهادة']]); const p = pctIn(cert);
  if (!certMap.has(cert)) certMap.set(cert, new Set());
  certMap.get(cert).add(p == null ? 'NOPCT' : String(p));
  if (p == null || n == null || a == null) { cSkip++; return; }
  if (close(n * p / 100, a)) cOk++; else { cBad++; if (cSamples.length < 8) cSamples.push(`#${r[idx['الرقم الوظيفي']]} cert%=${p} nominal=${n} exp=${Math.round(n * p / 100)} got=${a}`); }
});
stat('CERT_ALLOWANCE(nominal*pct)', cOk, cBad, cOk + cBad, cSamples);
say('CERT_SKIP(no pct/nums): ' + cSkip);
certMap.forEach((v, k) => say('   CERT: ' + k + '  => pct set: ' + JSON.stringify([...v])));

// ---- risk allowance = nominal * risk%  (column نسبة الخطورة)
let rOk = 0, rBad = 0; const rSamples = [];
D.forEach(r => {
  const n = num(r[idx['الراتب الاسمي']]); const a = num(r[idx['مخصصات الخطورة']]); const p = pctIn(r[idx['نسبة الخطورة']]);
  if (n == null || a == null || p == null) return;
  if (close(n * p / 100, a)) rOk++; else { rBad++; if (rSamples.length < 8) rSamples.push(`#${r[idx['الرقم الوظيفي']]} risk%=${p} nominal=${n} exp=${Math.round(n * p / 100)} got=${a}`); }
});
stat('RISK_ALLOWANCE(nominal*pct)', rOk, rBad, rOk + rBad, rSamples);

// ---- engineering allowance = nominal * eng%
let eOk = 0, eBad = 0, eZero = 0, eOther = 0; const eSamples = [];
D.forEach(r => {
  const n = num(r[idx['الراتب الاسمي']]); const a = num(r[idx['مخصصات هندسية']]); const d = txt(r[idx['المخصصات الهندسية']]);
  const p = pctIn(d);
  if (/غير مشمول/.test(d)) { if (a === 0 || a == null) eZero++; else eOther++; return; }
  if (p == null) { eOther++; return; }
  if (close(n * p / 100, a)) eOk++; else { eBad++; if (eSamples.length < 8) eSamples.push(`#${r[idx['الرقم الوظيفي']]} eng%=${p} nominal=${n} exp=${Math.round(n * p / 100)} got=${a}`); }
});
say(`ENG_ALLOWANCE: pctMatch ${eOk}  MISMATCH ${eBad}  notIncludedOk ${eZero}  other ${eOther}`);
eSamples.forEach(x => say('   BAD: ' + x));

// ---- position allowance vs المنصب
const posMap = new Map();
D.forEach(r => {
  const p = txt(r[idx['المنصب ']] || r[H.indexOf('المنصب')]);
  const a = num(r[idx['مخصصات المنصب']]);
  if (!posMap.has(p)) posMap.set(p, new Map());
  const m = posMap.get(p); const k = a == null ? 'NULL' : String(Math.round(a));
  m.set(k, (m.get(k) || 0) + 1);
});
say('### POSITION -> ALLOWANCE values:');
posMap.forEach((m, p) => say('   "' + p + '" => ' + JSON.stringify([...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8))));

// ---- marital / transfer / children
const marMap = new Map();
D.forEach(r => {
  const m = txt(r[idx['الحالة الزوجية']]);
  const z = num(r[idx['مخصصات الزوجية']]); const ch = num(r[idx['مخصصات الاطفال']]); const tr = num(r[idx['مخصصات النقل']]);
  if (!marMap.has(m)) marMap.set(m, new Map());
  const mm = marMap.get(m); const k = `z=${z} ch=${ch} tr=${tr}`;
  mm.set(k, (mm.get(k) || 0) + 1);
});
say('### MARITAL -> (زوجية, اطفال, نقل):');
marMap.forEach((m, k) => say('   "' + k + '" => ' + JSON.stringify([...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6))));

// ---- pension & social protection = % of nominal
let pOk = 0, pBad = 0; const pSamples = [];
let sOk = 0, sBad = 0; const sSamples = [];
D.forEach(r => {
  const n = num(r[idx['الراتب الاسمي']]);
  const p = num(r[idx['التقاعد']]); const sp = num(r[idx['الحماية الاجتماعية']]);
  if (n != null && p != null) { if (close(n * 0.10, p)) pOk++; else { pBad++; if (pSamples.length < 6) pSamples.push(`#${r[idx['الرقم الوظيفي']]} nominal=${n} exp=${n * 0.10} got=${p}`); } }
  if (n != null && sp != null) { if (close(n * 0.0025, sp)) sOk++; else { sBad++; if (sSamples.length < 6) sSamples.push(`#${r[idx['الرقم الوظيفي']]} nominal=${n} exp=${n * 0.0025} got=${sp}`); } }
});
stat('PENSION(=10% nominal)', pOk, pBad, pOk + pBad, pSamples);
stat('SOCIAL_PROT(=0.25% nominal)', sOk, sBad, sOk + sBad, sSamples);

// ---- gross = sum of earnings
let gOk = 0, gBad = 0; const gSamples = [];
D.forEach(r => {
  const parts = ['الراتب الاسمي','مخصصات الشهادة','مخصصات المنصب','مخصصات هندسية','مخصصات الخطورة','مخصصات القانونية','المخصصات الاضافية 50%','مخصصات النقل','مخصصات الزوجية','مخصصات الاطفال'].map(k => num(r[idx[k]]));
  const sum = parts.reduce((x, v) => x + (v || 0), 0);
  const g = num(r[idx['الراتب الاجمالي ( اليرادات)']]) ?? num(r[idx['الراتب الاجمالي ( الايرادات)']]);
  if (g == null) return;
  if (close(sum, g)) gOk++; else { gBad++; if (gSamples.length < 8) gSamples.push(`#${r[idx['الرقم الوظيفي']]} sum=${Math.round(sum)} got=${g}`); }
});
stat('GROSS(=sum earnings)', gOk, gBad, gOk + gBad, gSamples);

// ---- deductions total = sum of deduction cols
const dCols = [' استقطاع مبلغ القرض','طرح مبلغ','مبلغ التنفيذ',' الضريبة','التقاعد','الحماية الاجتماعية','طابع مدرسي'];
const dIdx = dCols.map(c => H.findIndex(h => h === c.trim()) === -1 ? H.findIndex(h => h.trim() === c.trim()) : H.indexOf(c));
let dOk = 0, dBad = 0; const dSamples = [];
D.forEach(r => {
  const sum = dIdx.map(i => num(r[i])).reduce((x, v) => x + (v || 0), 0);
  const t = num(r[idx['مجموع الاستقطاعات']]);
  if (t == null) return;
  if (close(sum, t)) dOk++; else { dBad++; if (dSamples.length < 8) dSamples.push(`#${r[idx['الرقم الوظيفي']]} sum=${Math.round(sum)} got=${t}`); }
});
stat('DEDUCTIONS_TOTAL', dOk, dBad, dOk + dBad, dSamples);

// ---- net = gross - deductions
let nOk = 0, nBad = 0; const nSamples = [];
D.forEach(r => {
  const g = num(r[idx['الراتب الاجمالي ( الايرادات)']]); const t = num(r[idx['مجموع الاستقطاعات']]); const nn = num(r[idx['الراتب الصافي']]);
  if (g == null || t == null || nn == null) return;
  if (close(g - t, nn)) nOk++; else { nBad++; if (nSamples.length < 8) nSamples.push(`#${r[idx['الرقم الوظيفي']]} gross-tot=${g - t} got=${nn}`); }
});
stat('NET(=gross-deductions)', nOk, nBad, nOk + nBad, nSamples);

// ---- tax per family category: distribution of tax/gross
const taxByCat = new Map();
D.forEach(r => {
  const cat = (txt(r[idx['حالة الموظف في الاستقطاع الضريبي']]).match(/ج\d/) || ['?'])[0];
  const g = num(r[idx['الراتب الاجمالي ( الايرادات)']]); const t = num(r[idx[' الضريبة']]);
  if (g == null || t == null) return;
  if (!taxByCat.has(cat)) taxByCat.set(cat, []);
  taxByCat.get(cat).push(t / g);
});
say('### TAX/GROSS ratio per family category:');
taxByCat.forEach((arr, cat) => {
  const sorted = [...arr].sort((a, b) => a - b);
  const q = p => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))].toFixed(4);
  say(`   ${cat}: n=${sorted.length} min=${q(0)} q25=${q(0.25)} med=${q(0.5)} q75=${q(0.75)} max=${q(1)}`);
});

// ---- workplace (finance) distinct values
const wl = new Map();
D.forEach(r => { const w = txt(r[idx['مكان العمل حسب تصنيف المالية']]); wl.set(w, (wl.get(w) || 0) + 1); });
say('### FINANCE_WORKPLACE distinct (' + wl.size + '):');
[...wl.entries()].sort((a, b) => b[1] - a[1]).forEach(([k, v]) => say(`   ${v}x "${k}"`));

// ---- job titles
const jt = new Map();
D.forEach(r => { const t = txt(r[idx['العنوان الوظيفي']]); jt.set(t, (jt.get(t) || 0) + 1); });
say('### JOB_TITLES distinct (' + jt.size + '):');
[...jt.entries()].sort((a, b) => b[1] - a[1]).slice(0, 60).forEach(([k, v]) => say(`   ${v}x "${k}"`));

// ---- last column dates
const dt = new Map();
D.forEach(r => { const d = txt(r[idx['تاريخ استحقاق الراتب الحالي2']]); dt.set(d, (dt.get(d) || 0) + 1); });
say('### DATE_COL distinct (' + dt.size + '):');
[...dt.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20).forEach(([k, v]) => say(`   ${v}x "${k}"`));

// ---- loan deductions
const loans = D.filter(r => num(r[idx[' استقطاع مبلغ القرض']]) > 0);
say('### LOAN_ROWS: ' + loans.length + '  other-deduction cols nonzero: ' +
  D.filter(r => num(r[idx['طرح مبلغ']]) > 0 || num(r[idx['مبلغ التنفيذ']]) > 0).length);

fs.writeFileSync(path.join(OUT, 'findings.txt'), L.join('\n'), 'utf8');
console.log('OK findings written: ' + L.length + ' lines');
