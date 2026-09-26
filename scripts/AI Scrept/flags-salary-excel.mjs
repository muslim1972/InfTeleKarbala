// Flagged records inventory: every non-matching / notable row with its Excel row number
// Usage: node "scripts/AI Scrept/flags-salary-excel.mjs" "<src.xlsx>" "<outDir>"
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
// pct: "45%" | "%35" | "بنسبة 125"
const pctIn = s => {
  const t = txt(s);
  let m = t.match(/(\d+(?:\.\d+)?)\s*%/);
  if (m) return parseFloat(m[1]);
  m = t.match(/%\s*(\d+(?:\.\d+)?)/);
  if (m) return parseFloat(m[1]);
  m = t.match(/بنسبة\s*(\d+(?:\.\d+)?)/);
  return m ? parseFloat(m[1]) : null;
};

const data = rows.slice(1);
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
  marital: 'الحالة الزوجية', position: 'المنصب', engText: 'المخصصات الهندسية'
};
if (idx[norm(C.gross)] == null) C.gross = Object.keys(idx).find(k => k.includes('الراتب الاجمالي'));
if (idx[norm(C.tax)] == null) C.tax = Object.keys(idx).find(k => k.includes('الضريبة') || k.includes('الضريبه'));

const earningsCols = [C.nominal, C.certA, C.posA, C.engA, C.riskA, C.lawA, C.extra50, C.trans, C.spouse, C.kids];
const dedCols = [C.loan, C.tarkh, C.exec, C.tax, C.pension, C.soc, C.stamp];
const TAX_OK = { 'متزوج': ['ج1', 'ج3', 'ج4'], 'اعزب': ['ج1'], 'مطلق': ['ج2', 'ج3'], 'ارمل': ['ج2', 'ج3'] };

const L = [];
const fmt = (rowNo, r, note) =>
  `صف=${rowNo} | ${txt(get(r, C.id))} | ${txt(get(r, C.name))} | ${txt(get(r, C.title))} | ${note}`;
const pass = (name, test) => {
  const lines = [];
  data.forEach((r, i) => {
    const s = test(r);
    if (s) lines.push(fmt(i + 2, r, s)); // Excel row: header is row 1
  });
  L.push('', `===== ${name} ===== (${lines.length})`, ...lines);
  return lines.length;
};

const total = {};
total['شهادة'] = pass('1) مخصصات الشهادة لا يطابق النسبة', r => {
  const pct = pctIn(get(r, C.cert)); const amt = num(get(r, C.certA)); const nom = num(get(r, C.nominal));
  if (pct == null || !nom || amt == null || Math.abs(amt - nom * pct / 100) <= 250) return null;
  return `شهادة="${txt(get(r, C.cert))}" نسبة=${pct}% متوقع=${Math.round(nom * pct / 100)} موجود=${amt}`;
});

total['خطورة'] = pass('2) مخصصات الخطورة لا يطابق النسبة', r => {
  const pct = pctIn(get(r, C.riskPct)); const amt = num(get(r, C.riskA)); const nom = num(get(r, C.nominal));
  if (pct == null || !nom || amt == null || Math.abs(amt - nom * pct / 100) <= 250) return null;
  const e50 = num(get(r, C.extra50));
  const parked = e50 != null && Math.abs(e50 - nom * pct / 100) <= 250
    ? ` — المبلغ منقول في عمود الإضافية 50% (${e50}) = خطورة إضافية`
    : ` — متوقع=${Math.round(nom * pct / 100)} موجود=${amt}`;
  return `نسبة الخطورة="${txt(get(r, C.riskPct))}"${parked}`;
});

total['تقاعد'] = pass('3) التقاعد غير معياري (ليس 10% من الاسمي)', r => {
  const nom = num(get(r, C.nominal)); const pen = num(get(r, C.pension));
  if (!nom || pen == null || Math.abs(pen - nom * 0.10) <= 250) return null;
  return `الاسمي=${nom} تقاعد=${pen} (${(pen / nom * 100).toFixed(1)}%)`;
});

total['إجمالي'] = pass('4) الإجمالي أكبر من مجموع بنود الإيراد (علاوة غير مفصّلة)', r => {
  const g = num(get(r, C.gross));
  const s = earningsCols.reduce((a, c) => a + (num(get(r, c)) || 0), 0);
  if (g == null || Math.abs(g - s) <= 250) return null;
  const isDriver = txt(get(r, C.title)).includes('سواق');
  return `فرق=${Math.round(g - s)}${isDriver ? ' — علاوة سواق 87500' : ' — مصدر غير معروف'}`;
});

total['استقطاعات'] = pass('5) مجموع الاستقطاعات أكبر من بنوده الظاهرة (استقطاع غير مفصّل)', r => {
  const t = num(get(r, C.dedTotal));
  const s = dedCols.reduce((a, c) => a + (num(get(r, c)) || 0), 0);
  if (t == null || Math.abs(t - s) <= 250) return null;
  return `المجموع=${t} البنود=${Math.round(s)} فرق=${Math.round(t - s)}`;
});

total['فئة ضريبية'] = pass('6) فئة الضريبة لا تنسجم مع الحالة الاجتماعية', r => {
  const mar = txt(get(r, C.marital)); const tc = txt(get(r, C.taxCat));
  const m = tc.match(/ج(\d)/); const cat = m ? `ج${m[1]}` : null;
  if (!mar || !TAX_OK[mar] || !cat || TAX_OK[mar].includes(cat)) return null;
  return `حالة="${mar}" فئة=${cat}`;
});

total['سجل ناقص'] = pass('7) سجل ناقص الإدخال (بلا درجة/مرحلة)', r => {
  if (txt(get(r, C.grade)) && txt(get(r, C.step))) return null;
  return `درجة="${txt(get(r, C.grade))}" مرحلة="${txt(get(r, C.step))}" منصب="${txt(get(r, C.position))}" حالة="${txt(get(r, C.marital))}"`;
});

total['نقل'] = pass('8) علاوة نقل بقيمة غير معيارية (ليست 0/20000/30000/40000)', r => {
  const tr = num(get(r, C.trans));
  if (tr == null || [0, 20000, 30000, 40000].includes(tr)) return null;
  return `نقل=${tr}`;
});

total['شاذ 1/11'] = pass('9) المفتاح 1/11 — قيمة فوق نمط المراحل (للتثبت فقط — يفسرها نمط فوق المرحلة)', r => {
  if (txt(get(r, C.grade)) !== '1' || txt(get(r, C.step)) !== '11') return null;
  return `الاسمي=${num(get(r, C.nominal))}`;
});

L.push('', '===== الملخص =====');
Object.entries(total).forEach(([k, v]) => L.push(`${k}: ${v}`));

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'flags.txt'), L.join('\n'), 'utf8');
console.log(`OK flags written: ${L.length} lines`);
