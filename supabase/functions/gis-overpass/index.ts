// @ts-nocheck — ملف Deno Edge Function (لا يُفحص بمكتبة TypeScript الخاصة بالويب)
// ============================================================
// gis-overpass — وسيط آمن لجلب بيانات GIS حقيقية من OpenStreetMap
// ============================================================
// الغرض: تمكين محاكي FTTH من استيراد خريطة حقيقية "في الوقت الفعلي
// حسب طلب المستخدم" دون حفظ أي ملفات داخل حزمة التطبيق (public/).
//
// لماذا وسيط وليس fetch مباشر من المتصفح؟
//  - Overpass يرفض User-Agent الخاص بالمتصفحات (HTTP 406) بينما
//    يقبل UA التطبيقي الصريح — وهذا لا يمكن ضبطه من المتصفح.
//  - عزل المفتاح/السلوك عن العميل + تحقق صارم من المدخلات.
//
// الأمان:
//  1) يجب أن يكون المستخدم مصادقاً عليه (JWT يُفحص ضد خادم Auth).
//  2) صندوق الإحداثيات يُتحقق منه صارماً (نطاقات + سقف أبعاد).
//  3) طلب للقراءة فقط من Overpass — لا كتابة في قاعدة البيانات
//     ولا تسرَّ أي بيانات مستخدم (نرسل إحداثيات فقط).
//  4) كبح بسيط لكل مستخدم (in-memory) لمنع إغراق الخدمة.
//  5) إعادة البيانات إلى GeoJSON قياسي بحجم محدود.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
}

/* ===== حدود الأمان ===== */
/** أقصى طول لكل ضلع من صندوق الإحداثيات (درجة) ≈ 880م — يكفي لح سكني */
const MAX_BBOX_SIDE_DEG = 0.008
/** أقل طول ضلع (درجة) ≈ 55م — نمنع الصناديق الفارغة */
const MIN_BBOX_SIDE_DEG = 0.0005
/** سقف عدد العناصر المُعادة (حماية المتصفح من الإغراق) */
const MAX_FEATURES = 600
/** فترة الكبح لكل مستخدم (مللي ثانية) */
const THROTTLE_MS = 4000

const UA = 'InfTeleKarbala-FTTH-Simulator/1.0 (educational fiber network planner)'
/* mail.ru أولاً: أثبتت أنها أسرع وأكثر استقراراً من شبكتنا، وتقبل UA التطبيقي */
const ENDPOINTS = [
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
  'https://overpass-api.de/api/interpreter',
]
/** مهلة كل محاولة — مجموع المحاولات يجب أن يبقى دون مهلة مشرف edge-runtime
 *  الذي يُلغي الطلبات الطويلة ("cancelled by supervisor") */
const ATTEMPT_TIMEOUT_MS = 25_000

/* كبح بسيط لكل مستخدم — كل عزل (isolate) حالة مستقلة، كافٍ للحد العام */
const lastCall = new Map<string, number>()

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const URL = Deno.env.get('SUPABASE_URL') ?? ''
  const ANON = Deno.env.get('SUPABASE_ANON_KEY') ?? ''

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: corsHeaders })

  try {
    /* 1) التحقق من هوية المستخدم — لا وصول مجهول أبداً */
    const userToken = (req.headers.get('Authorization') || '').replace('Bearer ', '')
    if (!userToken) return json({ error: 'Unauthorized: missing token' }, 401)
    const meRes = await fetch(`${URL}/auth/v1/user`, {
      headers: { apikey: ANON, Authorization: `Bearer ${userToken}` },
    })
    if (!meRes.ok) return json({ error: 'Unauthorized: invalid token' }, 401)
    const me = await meRes.json()
    const uid: string | undefined = me?.id
    if (!uid) return json({ error: 'Unauthorized: no user' }, 401)

    /* 2) الكبح — منع الاستدعاءات المتتالية السريعة */
    const now = Date.now()
    const prev = lastCall.get(uid) ?? 0
    if (now - prev < THROTTLE_MS) {
      return json({ error: `يرجى الانتظار ${Math.ceil((THROTTLE_MS - (now - prev)) / 1000)} ثانية قبل طلب خريطة أخرى` }, 429)
    }
    lastCall.set(uid, now)

    /* 3) التحقق من صندوق الإحداثيات */
    const { bbox, name } = await req.json()
    if (
      !bbox ||
      typeof bbox.south !== 'number' ||
      typeof bbox.west !== 'number' ||
      typeof bbox.north !== 'number' ||
      typeof bbox.east !== 'number'
    ) {
      return json({ error: 'صندوق الإحداثيات مفقود أو غير صالح' }, 400)
    }
    const { south, west, north, east } = bbox
    if (
      !Number.isFinite(south) || !Number.isFinite(west) ||
      !Number.isFinite(north) || !Number.isFinite(east)
    ) return json({ error: 'إحداثيات غير رقمية' }, 400)
    if (south < -90 || north > 90 || south >= north) return json({ error: 'خط العرض غير صالح' }, 400)
    if (west < -180 || east > 180 || west >= east) return json({ error: 'خط الطول غير صالح' }, 400)
    const dLat = north - south
    const dLon = east - west
    if (dLat < MIN_BBOX_SIDE_DEG || dLon < MIN_BBOX_SIDE_DEG)
      return json({ error: 'المنطقة صغيرة جداً (أقل من 55×55م)' }, 400)
    if (dLat > MAX_BBOX_SIDE_DEG || dLon > MAX_BBOX_SIDE_DEG)
      return json({ error: `المنطقة كبيرة جداً — الحد الأقصى ${Math.round(MAX_BBOX_SIDE_DEG * 111000)}م لكل ضلع` }, 400)

    /* 4) استعلام Overpass — فلترة العناصر بالصندوق دون قص الهندسة
          (نطلب الهندسة كاملةً ليرى المستخدم الأطراف ويصغّر/يكبّر بنفسه) */
    const query = `[out:json][timeout:20];
(
  way["building"](${south},${west},${north},${east});
  way["highway"](${south},${west},${north},${east});
);
out geom;`

    let data: any = null
    let usedEndpoint: string | null = null
    const failures: string[] = []
    /* محاولة واحدة لكل مرآة بمهلة صارمة — لا انتظار طويل يُلغيه المشرف */
    for (const endpoint of ENDPOINTS) {
      const abort = new AbortController()
      const timer = setTimeout(() => abort.abort(), ATTEMPT_TIMEOUT_MS)
      try {
        const res = await fetch(`${endpoint}?data=${encodeURIComponent(query)}`, {
          method: 'GET',
          headers: { 'User-Agent': UA, Accept: 'application/json' },
          signal: abort.signal,
        })
        if (!res.ok) {
          failures.push(`${new URL(endpoint).host}: HTTP ${res.status}`)
          continue
        }
        data = await res.json()
        usedEndpoint = endpoint
        break
      } catch (e) {
        const aborted = e?.name === 'AbortError'
        failures.push(`${new URL(endpoint).host}: ${aborted ? 'تجاوز المهلة' : 'تعذر الوصول'}`)
      } finally {
        clearTimeout(timer)
      }
    }
    if (!data) return json({ error: `تعذر جلب البيانات من OpenStreetMap (${failures.join(' · ')})` }, 502)

    /* 5) تحويل عناصر Overpass → GeoJSON قياسي (EPSG:4326) */
    const features: any[] = []
    let buildings = 0
    let roads = 0
    let truncated = false

    for (const el of data.elements ?? []) {
      if (el.type !== 'way' || !Array.isArray(el.geometry) || el.geometry.length < 2) continue
      if (features.length >= MAX_FEATURES) { truncated = true; break }
      const coords = el.geometry.map((g: any) => [g.lon, g.lat])
      const isBuilding = Object.hasOwn(el.tags ?? {}, 'building')
      const closed =
        coords.length > 3 &&
        coords[0][0] === coords[coords.length - 1][0] &&
        coords[0][1] === coords[coords.length - 1][1]

      if (isBuilding && closed) {
        buildings++
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
        })
      } else if (!isBuilding) {
        roads++
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
        })
      }
    }

    const geojson = {
      type: 'FeatureCollection',
      name: typeof name === 'string' && name.trim() ? name.trim() : 'خريطة جُلبت حيّاً',
      crs: { type: 'name', properties: { name: 'urn:ogc:def:crs:EPSG::4326' } },
      features,
    }

    return json({
      geojson,
      meta: {
        buildings,
        roads,
        truncated,
        endpoint: usedEndpoint,
        bboxM: {
          w: Math.round(dLon * 111320 * Math.cos(((south + north) / 2) * Math.PI / 180)),
          h: Math.round(dLat * 110574),
        },
      },
    })
  } catch (err: any) {
    console.error(`gis-overpass error: ${err?.message}`)
    return json({ error: 'خطأ داخلي في خادم الجلب' }, 500)
  }
})
