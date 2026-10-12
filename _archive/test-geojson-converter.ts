/**
 * سكربت اختبار سريع للتحقق من دعم المحوّل للأنواع الجديدة
 * MultiPolygon, MultiLineString, Point
 */
import { readFileSync } from 'fs';
import { geoJsonToSimMap, GisImportError } from '../src/features/fiber-simulator/gis/geojsonToSimMap';

const files = [
  'F:/صور للتجربة/نظام المديرية/نظام الادارة/خرائط geojson/karbala-neighborhood.geojson',
  'F:/صور للتجربة/نظام المديرية/نظام الادارة/خرائط geojson/test.geojson',
  'F:/صور للتجربة/نظام المديرية/نظام الادارة/خرائط geojson/test_line.geojson',
  'F:/صور للتجربة/نظام المديرية/نظام الادارة/خرائط geojson/test_point.geojson',
  'F:/صور للتجربة/نظام المديرية/نظام الادارة/خرائط geojson/test_point2 حي السلام.geojson',
];

console.log('=== اختبار محوّل GeoJSON ===\n');

for (const file of files) {
  const name = file.split('/').pop();
  try {
    const text = readFileSync(file, 'utf-8');
    const result = geoJsonToSimMap(text, { name });
    console.log(`✅ ${name}`);
    console.log(`   المباني: ${result.stats.buildings}, الطرق: ${result.stats.roads}, المتخطى: ${result.stats.skipped}`);
    console.log(`   الأبعاد: ${result.stats.bboxM.w}×${result.stats.bboxM.h}م`);
    if (result.warnings.length > 0) {
      console.log(`   تحذيرات: ${result.warnings.join(' | ')}`);
    }
  } catch (e) {
    if (e instanceof GisImportError) {
      console.log(`❌ ${name}: ${e.message}`);
    } else {
      console.log(`❌ ${name}: خطأ غير متوقع - ${e}`);
    }
  }
  console.log('');
}
