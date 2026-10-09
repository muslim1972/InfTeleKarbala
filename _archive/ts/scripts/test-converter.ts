/**
 * اختبار محوّل GeoJSON→SimMap على ملف كربلاء الحقيقي
 */
import { readFileSync } from 'node:fs';
import { geoJsonToSimMap } from '../src/features/fiber-simulator/gis/geojsonToSimMap';

const raw = readFileSync('gis-maps/najaf-old-city.geojson', 'utf8');
const res = geoJsonToSimMap(raw, { name: 'النجف — المدينة القديمة' });

const { map, stats, warnings } = res;
console.log('=== النتيجة ===');
console.log(`id: ${map.id}`);
console.log(`name: ${map.name}`);
console.log(`level: ${map.level}`);
console.log(`dims: ${map.widthM} × ${map.heightM} م`);
console.log(`exchange: (${map.exchange.point.x}, ${map.exchange.point.y})`);
console.log(`stats:`, stats);
console.log(`warnings:`, warnings);
console.log(`requirements:`, map.requirements);

console.log('\n=== مبانٍ (أول 8) ===');
for (const b of map.buildings.slice(0, 8)) {
  const area = Math.abs(
    b.polygon.reduce((s, p, i) => {
      const q = b.polygon[(i + 1) % b.polygon.length];
      return s + p.x * q.y - q.x * p.y;
    }, 0) / 2
  );
  console.log(
    `${b.label} · pts=${b.polygon.length} · area=${Math.round(area)}م² · conn=(${b.connectionPoint.x},${b.connectionPoint.y})${b.name ? ' · ' + b.name : ''}`
  );
}

console.log('\n=== طرق (أول 8) ===');
for (const r of map.roads.slice(0, 8)) {
  console.log(`${r.id} · ${r.name} · ${r.surface} · ${r.width}م · pts=${r.centerline.length}`);
}

/* فحوص السلامة */
console.log('\n=== فحوص السلامة ===');
const allFinite = [
  ...map.buildings.flatMap((b) => [b.connectionPoint, ...b.polygon]),
  ...map.roads.flatMap((r) => r.centerline),
  map.exchange.point,
].every((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
console.log('كل الإحداثيات منتهية:', allFinite);

const inBounds = [
  ...map.buildings.flatMap((b) => [b.connectionPoint, ...b.polygon]),
  ...map.roads.flatMap((r) => r.centerline),
  map.exchange.point,
].every((p) => p.x >= 0 && p.x <= map.widthM && p.y >= 0 && p.y <= map.heightM);
console.log('كل الإحداثيات ضمن الحدود:', inBounds);

const connOnRing = map.buildings.every((b) => {
  const tol = 0.3;
  return b.polygon.some((p) => Math.hypot(p.x - b.connectionPoint.x, p.y - b.connectionPoint.y) < tol)
    || b.polygon.some((_, i) => {
      const a = b.polygon[i];
      const c = b.polygon[(i + 1) % b.polygon.length];
      const dx = c.x - a.x, dy = c.y - a.y;
      const len2 = dx * dx + dy * dy;
      if (len2 === 0) return false;
      let t = ((b.connectionPoint.x - a.x) * dx + (b.connectionPoint.y - a.y) * dy) / len2;
      t = Math.max(0, Math.min(1, t));
      const px = a.x + t * dx, py = a.y + t * dy;
      return Math.hypot(px - b.connectionPoint.x, py - b.connectionPoint.y) < 0.26;
    });
});
console.log('نقاط الدخول على محيط المضلع:', connOnRing);
console.log('عدد التسميات يساوي العدد:', map.buildings.every((b, i) => b.label === `H${i + 1}`));
