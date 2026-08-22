/**
 * ============================================================
 * الخريطة الأولى: زقاق الحي (16 منزلاً) — مستوى مبتدئ
 * ============================================================
 * مخطط بسيط وواقعي: شارع رئيسي أسفلتي (يمتد فيه الكابل الرئيسي
 * من المقسم) + زقاق ترابي تصطف على جانبيه 16 داراً.
 * جميع الأبعاد بالمتر الحقيقي.
 */

import type { MapBuilding, SimMap, Vec2 } from '../../types';

const COLUMN_XS = [45, 60, 75, 90, 105, 120, 135, 150];

/** مستطيل مبانٍ 10×10م حول مركز أفقي وأعلى رأسي */
const rect = (cx: number, top: number, w = 10, h = 10): Vec2[] => [
  { x: cx - w / 2, y: top },
  { x: cx + w / 2, y: top },
  { x: cx + w / 2, y: top + h },
  { x: cx - w / 2, y: top + h },
];

/* الصف الشمالي: قاعدة الدار y=60 ونقطة الدخول تواجه الزقاق (y=62) */
const northBuildings: MapBuilding[] = COLUMN_XS.map((cx, i) => ({
  id: `h${i + 1}`,
  label: `H${i + 1}`,
  polygon: rect(cx, 50),
  connectionPoint: { x: cx, y: 62 },
}));

/* الصف الجنوبي: قمة الدار y=84 ونقطة الدخول تواجه الزقاق (y=81) */
const southBuildings: MapBuilding[] = COLUMN_XS.map((cx, i) => ({
  id: `h${i + 9}`,
  label: `H${i + 9}`,
  polygon: rect(cx, 84),
  connectionPoint: { x: cx, y: 81 },
}));

export const ALLEY_16: SimMap = {
  id: 'alley-16',
  name: 'زقاق الحي — 16 داراً',
  level: 'beginner',
  widthM: 200,
  heightM: 110,

  buildings: [...northBuildings, ...southBuildings],

  roads: [
    {
      id: 'road-main',
      name: 'شارع الجمهورية',
      centerline: [
        { x: 10, y: 20 },
        { x: 190, y: 20 },
      ],
      width: 8,
      surface: 'asphalt',
    },
    {
      id: 'road-alley',
      name: 'زقاق الحي',
      centerline: [
        { x: 32, y: 75 },
        { x: 168, y: 75 },
      ],
      width: 6,
      surface: 'soil',
    },
  ],

  exchange: { point: { x: 14, y: 26 }, label: 'المقسم الرئيسي (OLT)' },

  requirements: {
    homes: 16,
    minRxDbm: -24,
    maxDropMeters: 60,
    budgetPerHomeUSD: 175,
    notes:
      'امدد الكابل الرئيسي من المقسم على شارع الجمهورية (أسفلت) ثم ادخل الزقاق الترابي وغطِّ الدور الـ16 جميعها بإشارة لا تقل عن -24 dBm.',
  },
};
