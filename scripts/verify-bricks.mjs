#!/usr/bin/env node
// OPS-03 — حارس الطابوق. بلا اعتماديات خارجية.
// الاستخدام:
//   node scripts/verify-bricks.mjs              فحص (يفشل بكود 1 عند خطأ)
//   node scripts/verify-bricks.mjs --snapshot   تسجيل بصمات الملفات الحالية كمرجع (bricks/fingerprints.json)
// الأخطاء (تُفشل الفحص): ملف مملوك مفقود، ملكية مزدوجة، عقد مُعلن مفقود، ملف كان في البصمات واختفى.
// التحذيرات: ملفات src غير منسوبة لطابوقة، قواعد R# بلا اختبار T# يذكرها، ملفات تغيّرت عن البصمة.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const REG = path.join(ROOT, 'bricks', 'registry.json');
const FP = path.join(ROOT, 'bricks', 'fingerprints.json');
const SCAN_DIRS = ['src'];
const rel = (p) => path.relative(ROOT, p).split(path.sep).join('/');

const walk = (dir) => {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p)); else out.push(p);
  }
  return out;
};
const sha = (p) => crypto.createHash('sha1').update(fs.readFileSync(p)).digest('hex').slice(0, 12);

const reg = JSON.parse(fs.readFileSync(REG, 'utf8').replace(/^\uFEFF/, '')); // تحمّل BOM من PowerShell 5.1
const errors = [], warns = [];
const owner = new Map(); // file -> brick id

for (const b of reg.bricks) {
  for (const o of b.owns || []) {
    const abs = path.join(ROOT, o);
    if (!fs.existsSync(abs)) { errors.push(`[${b.id}] ملف/مجلد مملوك مفقود: ${o}`); continue; }
    const files = fs.statSync(abs).isDirectory() ? walk(abs) : [abs];
    for (const f of files) {
      const r = rel(f);
      if (owner.has(r) && owner.get(r) !== b.id) errors.push(`ملكية مزدوجة: ${r} ← ${owner.get(r)} و ${b.id}`);
      else owner.set(r, b.id);
    }
  }
  if (b.contract) {
    const c = path.join(ROOT, b.contract);
    if (!fs.existsSync(c)) { errors.push(`[${b.id}] العقد مفقود: ${b.contract}`); continue; }
    const txt = fs.readFileSync(c, 'utf8');
    const rules = [...new Set([...txt.matchAll(/\*\*(R\d+)\*\*/g)].map((m) => m[1]))];
    const testRows = txt.split('\n').filter((l) => /^\|\s*T\d+\s*\|/.test(l)).join('\n');
    const untested = rules.filter((r) => !new RegExp(`\\b${r}\\b`).test(testRows));
    if (untested.length) warns.push(`[${b.id}] قواعد بلا اختبار يذكرها (${untested.length}/${rules.length}): ${untested.join(', ')}`);
  }
}

// تغطية: كل ملف في src يجب أن يُنسب لطابوقة
const all = SCAN_DIRS.flatMap((d) => walk(path.join(ROOT, d))).map(rel);
const orphans = all.filter((f) => !owner.has(f));
const coverage = all.length ? Math.round(((all.length - orphans.length) / all.length) * 100) : 100;
orphans.forEach((f) => warns.push(`غير منسوب لطابوقة: ${f}`));

// البصمات
if (process.argv.includes('--snapshot')) {
  const snap = {};
  for (const [f, id] of [...owner.entries()].sort()) snap[f] = { brick: id, sha: sha(path.join(ROOT, f)) };
  fs.writeFileSync(FP, JSON.stringify({ created: new Date().toISOString(), files: snap }, null, 1));
  console.log(`✓ سُجّلت بصمات ${Object.keys(snap).length} ملفاً في bricks/fingerprints.json`);
} else if (fs.existsSync(FP)) {
  const snap = JSON.parse(fs.readFileSync(FP, 'utf8')).files;
  let changed = 0;
  for (const [f, { brick, sha: h }] of Object.entries(snap)) {
    const abs = path.join(ROOT, f);
    if (!fs.existsSync(abs)) errors.push(`[${brick}] فُقد ملف كان مسجلاً: ${f}  ← استرجاع: git checkout <tag> -- "${f}"`);
    else if (sha(abs) !== h) changed++;
  }
  if (changed) warns.push(`ملفات تغيّرت عن آخر بصمة: ${changed} (طبيعي أثناء التطوير؛ حدّث بـ --snapshot بعد الاعتماد)`);
}

// قاعدة البيانات (--db): مقارنة المسجّل مع الخادم الفعلي
const dbObjs = { F: 'db', T: 'tables', B: 'buckets' };
const dbStats = {};
if (process.argv.includes('--db')) {
  const { execFileSync } = await import('node:child_process');
  const putty = 'C:\\Program Files\\PuTTY';
  let pw = process.env.VPS_PW;
  if (!pw) { const m = fs.readFileSync(path.join(ROOT, 'AGENTS.md'), 'utf8').match(/-pw '([^']+)'/); pw = m && m[1]; }
  const host = 'muslim@10.56.3.3';
  try {
    for (const f of ['runsql.sh', 'db-inventory.sql'])
      execFileSync(path.join(putty, 'pscp.exe'), ['-batch', '-pw', pw, path.join(ROOT, 'scripts', 'ops', f), `${host}:/tmp/bricks-${f}`], { stdio: 'pipe' });
    const out = execFileSync(path.join(putty, 'plink.exe'), ['-batch', '-pw', pw, host, `VPS_PW='${pw}' bash /tmp/bricks-runsql.sh /tmp/bricks-db-inventory.sql`], { encoding: 'utf8' });
    const live = { F: new Set(), T: new Set(), B: new Set() };
    out.split(/\r?\n/).forEach((l) => { const m = l.match(/^([FTB])\|(.+)$/); if (m) live[m[1]].add(m[2].trim()); });
    for (const [k, field] of Object.entries(dbObjs)) {
      const declared = new Map();
      reg.bricks.forEach((b) => (b[field] || []).forEach((n) => {
        if (declared.has(n)) errors.push(`ملكية مزدوجة (${field}): ${n} ← ${declared.get(n)} و ${b.id}`);
        declared.set(n, b.id);
      }));
      for (const [n, id] of declared) if (!live[k].has(n)) errors.push(`[${id}] مفقود على الخادم (${field}): ${n}`);
      const unowned = [...live[k]].filter((n) => !declared.has(n));
      unowned.forEach((n) => warns.push(`غير منسوب لطابوقة (${field}): ${n}`));
      dbStats[field] = `${live[k].size - unowned.length}/${live[k].size}`;
    }
  } catch (e) { errors.push(`تعذّر فحص قاعدة البيانات: ${e.message.split('\n')[0]}`); }
}

// التقرير
const byStatus = reg.bricks.reduce((a, b) => ((a[b.status] = (a[b.status] || 0) + 1), a), {});
console.log(`\n=== حارس الطابوق OPS-03 ===`);
console.log(`الطابوق: ${reg.bricks.length}  ${Object.entries(byStatus).map(([k, v]) => `${k}=${v}`).join('  ')}`);
console.log(`تغطية src: ${coverage}% (${all.length - orphans.length}/${all.length})`);
if (Object.keys(dbStats).length) console.log(`تغطية DB: ${Object.entries(dbStats).map(([k, v]) => `${k}=${v}`).join('  ')}`);
if (warns.length) { console.log(`\nتحذيرات (${warns.length}):`); warns.slice(0, 40).forEach((w) => console.log('  ⚠ ' + w)); if (warns.length > 40) console.log(`  … و${warns.length - 40} أخرى`); }
if (errors.length) { console.log(`\nأخطاء (${errors.length}):`); errors.forEach((e) => console.log('  ✗ ' + e)); console.log('\n✗ الفحص فشل'); process.exit(1); }
console.log('\n✓ الفحص ناجح');
