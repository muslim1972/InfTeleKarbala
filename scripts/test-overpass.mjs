/**
 * اختبار الوصول إلى Overpass بأساليب متعددة (GET + User-Agent)
 */
const BBOX = { south: 32.6180, west: 44.0380, north: 32.6210, east: 44.0420 };
const query = `[out:json][timeout:90];(way["building"](${BBOX.south},${BBOX.west},${BBOX.north},${BBOX.east});way["highway"](${BBOX.south},${BBOX.west},${BBOX.north},${BBOX.east}););out geom;`;
const url = 'https://overpass-api.de/api/interpreter?data=' + encodeURIComponent(query);

try {
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      'User-Agent': 'InfTeleKarbala-FTTH-Simulator/1.0 (educational fiber network planner)',
      'Accept': 'application/json',
    },
  });
  console.log('status', res.status, res.headers.get('content-type'));
  if (res.ok) {
    const text = await res.text();
    console.log('bytes', text.length);
    console.log(text.slice(0, 300));
  } else {
    console.log(await res.text().catch(() => ''));
  }
} catch (e) {
  console.log('ERR', e.message);
}
