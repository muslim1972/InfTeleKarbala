/**
 * جلب بيانات GIS حقيقية لكربلاء من OpenStreetMap (Overpass API)
 * وتحويلها إلى GeoJSON قياسي (مبانٍ + طرق) للاستيراد في محاكي FTTH.
 * يعمل مرة واحدة لإنتاج النموذج — لا يدخل في حزمة التطبيق.
 */
import { writeFileSync, mkdirSync } from 'node:fs';

const OUT = 'public/gis-samples';
mkdirSync(OUT, { recursive: true });

/* مربع صغير شرق حرم الإمام الحسين (ع) — حي سكني منتظم نسبياً
   الأبعاد ≈ 340م × 340م — مناسب كحقل تدريب على شبكة FTTH */
const BBOX = { south: 32.6180, west: 44.0380, north: 32.6210, east: 44.0420 };

/* [bbox:] العام يقص هندسات الطرق عند حدود الصندوق حتى لا
   تمتد طرق رئيسية (مثل شارع باب بغداد) خارج منطقة التدريب */
const query = `[out:json][timeout:90][bbox:${BBOX.south},${BBOX.west},${BBOX.north},${BBOX.east}];
(
  way["building"](${BBOX.south},${BBOX.west},${BBOX.north},${BBOX.east});
  way["highway"](${BBOX.south},${BBOX.west},${BBOX.north},${BBOX.east});
);
out geom;`;

const UA = 'InfTeleKarbala-FTTH-Simulator/1.0 (educational fiber network planner)';
const endpoints = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.openstreetmap.ru/api/interpreter',
];

let data = null;
let used = null;
for (const url of endpoints) {
  for (const attempt of [1, 2]) {
    try {
      console.log(`محاولة: ${url} (ال try ${attempt})`);
      const res = await fetch(url + '?data=' + encodeURIComponent(query), {
        method: 'GET',
        headers: { 'User-Agent': UA, 'Accept': 'application/json' },
      });
      if (res.status === 429) { console.log('  HTTP 429 — انتظار 12 ثانية'); await new Promise((r) => setTimeout(r, 12000)); continue; }
      if (!res.ok) { console.log(`  HTTP ${res.status}`); break; }
      data = await res.json();
      used = url;
      break;
    } catch (e) {
      console.log(`  فشل: ${e.message}`);
    }
  }
  if (data) break;
}
if (!data) { console.error('تعذر جلب البيانات من كل الخوادم'); process.exit(1); }
console.log(`نجح: ${used}`);

/* تحويل عناصر Overpass إلى GeoJSON */
const features = [];
let buildings = 0, roads = 0;

for (const el of data.elements ?? []) {
  if (el.type !== 'way' || !Array.isArray(el.geometry) || el.geometry.length < 2) continue;
  const coords = el.geometry.map((g) => [g.lon, g.lat]);
  const isBuilding = Object.hasOwn(el.tags ?? {}, 'building');
  const closed = coords.length > 3 &&
    coords[0][0] === coords[coords.length - 1][0] &&
    coords[0][1] === coords[coords.length - 1][1];

  if (isBuilding && closed) {
    buildings++;
    features.push({
      type: 'Feature',
      properties: {
        kind: 'building',
        name: el.tags?.['name'] ?? el.tags?.['addr:housename'] ?? '',
        building: el.tags?.building ?? 'yes',
        floors: el.tags?.['building:levels'] ?? '',
        source: 'OpenStreetMap',
      },
      geometry: { type: 'Polygon', coordinates: [coords] },
    });
  } else if (!isBuilding) {
    roads++;
    features.push({
      type: 'Feature',
      properties: {
        kind: 'highway',
        name: el.tags?.name ?? '',
        highway: el.tags?.highway ?? 'road',
        lanes: el.tags?.lanes ?? '',
        surface: el.tags?.surface ?? '',
        source: 'OpenStreetMap',
      },
      geometry: { type: 'LineString', coordinates: coords },
    });
  }
}

const geojson = {
  type: 'FeatureCollection',
  name: 'كربلاء — حي شرق الحرم',
  crs: { type: 'name', properties: { name: 'urn:ogc:def:crs:EPSG::4326' } },
  features,
};

const fname = `${OUT}/karbala-neighborhood.geojson`;
writeFileSync(fname, JSON.stringify(geojson, null, 1), 'utf8');
console.log(`مبانٍ: ${buildings} · طرق: ${roads}`);
console.log(`حُفظ: ${fname}`);
