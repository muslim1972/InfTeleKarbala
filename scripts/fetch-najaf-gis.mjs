// ============================================================
// جلب خريطة حقيقية ثانية من OpenStreetMap إلى القرص (خارج public/)
// ============================================================
// نستخدمها كملف GeoJSON يدخل المستخدم يدوياً إلى المحاكي عبر
// واجهة الاستيراد، ليجرّب سير العمل كاملاً: استيراد → عمل → حفظ
// المشروع (فتُخزَّن الخريطة في DB لا في ملفات التطبيق).
//
// ملاحظة: GET + User-Agent صريح — Overpass يرفض POST و UA المتصفح.

import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const UA = 'InfTeleKarbala-FTTH-Simulator/1.0 (educational fiber network planner)';
const ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

/* النجف — المدينة القديمة قرب الإمام علي (ع): نسيج عمراني كثيف
   يختلف عن كربلاء (شرق الحرم) ليختبر المحوّل على تضاريس جديدة */
const BBOX = { south: 32.0005, west: 44.3325, north: 32.0035, east: 44.3355 };
const NAME = 'النجف — المدينة القديمة';
const OUT = join(__dirname, '..', 'gis-maps', 'najaf-old-city.geojson');

const query = `[out:json][timeout:60];
(
  way["building"](${BBOX.south},${BBOX.west},${BBOX.north},${BBOX.east});
  way["highway"](${BBOX.south},${BBOX.west},${BBOX.north},${BBOX.east});
);
out geom;`;

let lastErr = '';
for (const endpoint of ENDPOINTS) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      console.log(`→ ${endpoint} (محاولة ${attempt})`);
      const url = `${endpoint}?data=${encodeURIComponent(query)}`;
      const res = await fetch(url, { method: 'GET', headers: { 'User-Agent': UA } });
      if (res.status === 429) {
        console.log('  429 — ازدحام، انتظار 12 ثانية…');
        lastErr = 'HTTP 429';
        await new Promise((r) => setTimeout(r, 12000));
        continue;
      }
      if (!res.ok) { lastErr = `HTTP ${res.status}`; break; }
      const data = await res.json();

      // تحويل عناصر Overpass إلى GeoJSON قياسي
      const features = [];
      let buildings = 0, roads = 0;
      for (const el of data.elements ?? []) {
        if (el.type !== 'way' || !Array.isArray(el.geometry) || el.geometry.length < 2) continue;
        const coords = el.geometry.map((g) => [g.lon, g.lat]);
        const isBuilding = Object.hasOwn(el.tags ?? {}, 'building');
        const closed =
          coords.length > 3 &&
          coords[0][0] === coords[coords.length - 1][0] &&
          coords[0][1] === coords[coords.length - 1][1];
        if (isBuilding && closed) {
          buildings++;
          features.push({
            type: 'Feature',
            properties: { kind: 'building', name: el.tags?.name ?? '', building: el.tags?.building ?? 'yes', source: 'OpenStreetMap' },
            geometry: { type: 'Polygon', coordinates: [coords] },
          });
        } else if (!isBuilding) {
          roads++;
          features.push({
            type: 'Feature',
            properties: { kind: 'highway', name: el.tags?.name ?? '', highway: el.tags?.highway ?? 'road', source: 'OpenStreetMap' },
            geometry: { type: 'LineString', coordinates: coords },
          });
        }
      }
      const geojson = {
        type: 'FeatureCollection',
        name: NAME,
        crs: { type: 'name', properties: { name: 'urn:ogc:def:crs:EPSG::4326' } },
        features,
      };
      mkdirSync(dirname(OUT), { recursive: true });
      writeFileSync(OUT, JSON.stringify(geojson, null, 2), 'utf8');
      const sizeKb = Math.round(Buffer.byteLength(JSON.stringify(geojson)) / 1024);
      console.log(`\n✓ ${NAME}: ${features.length} عنصر (${buildings} مبنى، ${roads} طريق) — ${sizeKb}KB`);
      console.log(`  حُفظ: ${OUT}`);
      process.exit(0);
    } catch (e) {
      lastErr = e?.message ?? 'fetch failed';
      console.log(`  فشل: ${lastErr}`);
    }
  }
}
console.error(`\n✗ تعذّر الجلب من كل الخوادم: ${lastErr}`);
process.exit(1);
