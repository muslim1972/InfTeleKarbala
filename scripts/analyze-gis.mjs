/**
 * تحليل بنية ملف GeoJSON النموذجي لتصميم محوّل GeoJSON→SimMap
 */
import { readFileSync } from 'node:fs';

const gj = JSON.parse(readFileSync('public/gis-samples/karbala-neighborhood.geojson', 'utf8'));

const fs = gj.features;
console.log('عدد العناصر:', fs.length);

let minLon = Infinity, maxLon = -Infinity, minLat = Infinity, maxLat = -Infinity;
const buildings = [];
const roads = [];

for (const f of fs) {
  if (f.geometry.type === 'Polygon') {
    const ring = f.geometry.coordinates[0];
    for (const [lon, lat] of ring) {
      minLon = Math.min(minLon, lon); maxLon = Math.max(maxLon, lon);
      minLat = Math.min(minLat, lat); maxLat = Math.max(maxLat, lat);
    }
    // مساحة تقريبية بالمتر (شبه مساحة shoelace بإحداثيات محلية بدائية)
    const refLat = (minLat + maxLat) / 2;
    const mPerDegLon = 111320 * Math.cos((refLat * Math.PI) / 180);
    const mPerDegLat = 110574;
    let area = 0;
    for (let i = 0; i < ring.length - 1; i++) {
      const [x1, y1] = [ring[i][0] * mPerDegLon, ring[i][1] * mPerDegLat];
      const [x2, y2] = [ring[i + 1][0] * mPerDegLon, ring[i + 1][1] * mPerDegLat];
      area += x1 * y2 - x2 * y1;
    }
    area = Math.abs(area) / 2;
    let w = Infinity, h = Infinity, wMax = -Infinity, hMax = -Infinity;
    for (const [lon, lat] of ring) {
      w = Math.min(w, lon); wMax = Math.max(wMax, lon);
      h = Math.min(h, lat); hMax = Math.max(hMax, lat);
    }
    buildings.push({
      name: f.properties.name,
      floors: f.properties.floors,
      pts: ring.length - 1,
      areaM2: Math.round(area),
      wM: Math.round((wMax - w) * mPerDegLon),
      hM: Math.round((hMax - h) * mPerDegLat),
    });
  } else if (f.geometry.type === 'LineString') {
    roads.push({
      name: f.properties.name,
      highway: f.properties.highway,
      surface: f.properties.surface,
      lanes: f.properties.lanes,
      pts: f.geometry.coordinates.length,
    });
  }
}

const refLat = (minLat + maxLat) / 2;
const mPerDegLon = 111320 * Math.cos((refLat * Math.PI) / 180);
const mPerDegLat = 110574;
console.log('\n--- الحدود ---');
console.log(`lon: ${minLon.toFixed(6)} → ${maxLon.toFixed(6)}  = ${((maxLon - minLon) * mPerDegLon).toFixed(1)} م`);
console.log(`lat: ${minLat.toFixed(6)} → ${maxLat.toFixed(6)}  = ${((maxLat - minLat) * mPerDegLat).toFixed(1)} م`);

console.log(`\n--- مبانٍ (${buildings.length}) ---`);
const areas = buildings.map((b) => b.areaM2).sort((a, b) => a - b);
console.log('المساحة: min', areas[0], 'median', areas[Math.floor(areas.length / 2)], 'max', areas[areas.length - 1]);
const named = buildings.filter((b) => b.name);
console.log('مبانٍ بأسماء:', named.length);
if (named.length) console.log(JSON.stringify(named.slice(0, 8).map((b) => b.name), null, 1));
const withFloors = buildings.filter((b) => b.floors);
console.log('مبانٍ بعدد طوابق:', withFloors.length, JSON.stringify(withFloors.slice(0, 5).map((b) => b.floors)));
console.log('عدد رؤوس المضلع:', JSON.stringify([...new Set(buildings.map((b) => b.pts))].sort((a, b) => a - b)));
console.log('أبعاد (عرض×ارتفاع):');
console.log(JSON.stringify(buildings.slice(0, 12).map((b) => `${b.wM}×${b.hM}`)));

console.log(`\n--- طرق (${roads.length}) ---`);
const types = {};
for (const r of roads) types[r.highway] = (types[r.highway] ?? 0) + 1;
console.log('الأنواع:', JSON.stringify(types));
const surfaces = {};
for (const r of roads) surfaces[r.surface || '(فارغ)'] = (surfaces[r.surface || '(فارغ)'] ?? 0) + 1;
console.log('الأسطح:', JSON.stringify(surfaces));
const namedR = roads.filter((r) => r.name);
console.log('طرق بأسماء:', namedR.length);
if (namedR.length) console.log(JSON.stringify(namedR.slice(0, 10).map((r) => `${r.name} [${r.highway}]`), null, 1));
console.log('عدد رؤوس الخطوط:', JSON.stringify([...new Set(roads.map((r) => r.pts))].sort((a, b) => a - b)));
