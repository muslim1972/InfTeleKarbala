/**
 * ============================================================
 * كتالوج المواد والأسعار — محاكي FTTH
 * ============================================================
 * أسعار استرشادية بالدولار الأمريكي، مسترجعة من مصادر إنترنت موثوقة
 * بتاريخ 2026-08-22، ومعدّلة بمعامل "التكلفة الموقعية للعراق"
 * (شحن + جمارك + هامش موزع) فوق أسعار التسليم FOB.
 *
 * المصادر الرئيسية:
 * - أسعار الكابلات FOB الصين 2026: clangtx.com (تقرير أسعار يوليو 2026)
 *   ومواقع made-in-china / alibaba (قوائم موردين موثقة).
 * - القواسم PLC وتجربة نشر FTTH: bwnfiber.com (يونيو 2026).
 * - أنابيب HDPE 32/26mm: ecomtelco.com (~0.45$/م) + alvapipe.com.
 * - غرف التفتيش: chemicalsuppliesmktplc.co.uk (غرفة ~£170).
 * - تكاليف اللحام: fiber-products.com (8-15€/شعيرة أوروبا)،
 *   thepricer.org و nfmconsulting.com (أمريكا)، lffenquanban.com (آسيا).
 * - تكاليف الحفر المدنية: fiberbroadband.org 2025 deployment report،
 *   fiber-products.com (أعمال مدنية 10-85€/م).
 * - العراق: معدّلة لأجور العمل المحلية (أدنى من أوروبا/أمريكا).
 */

export type CatalogCategory =
  | 'cable'
  | 'duct'
  | 'civil'
  | 'structure'
  | 'passive'
  | 'termination'
  | 'equipment';

export type CatalogUnit = 'm' | 'pc' | 'set' | 'splice' | 'port';

export interface CatalogItem {
  id: string;
  category: CatalogCategory;
  nameAr: string;
  unit: CatalogUnit;
  /** السعر بالدولار الأمريكي (تقريبي — سوق 2026) */
  priceUSD: number;
  note?: string;
}

const ITEMS: CatalogItem[] = [
  /* ---------------- كابلات الألياف الضوئية ---------------- */
  { id: 'cable_drop_1f', category: 'cable', nameAr: 'كابل إسقاط 1 شعيرة GJYXFCH (Figure-8)', unit: 'm', priceUSD: 0.06, note: 'FOB 0.02-0.03$/م × معامل موقعي' },
  { id: 'cable_drop_2f', category: 'cable', nameAr: 'كابل إسقاط 2 شعيرة GJYXFCH', unit: 'm', priceUSD: 0.08 },
  { id: 'cable_dist_24f', category: 'cable', nameAr: 'كابل توزيع 24 شعيرة GYTS (مدرع)', unit: 'm', priceUSD: 0.7, note: 'FOB 0.31-0.46$/م' },
  { id: 'cable_dist_48f', category: 'cable', nameAr: 'كابل توزيع 48 شعيرة GYTS', unit: 'm', priceUSD: 0.9 },
  { id: 'cable_feeder_96f', category: 'cable', nameAr: 'كابل رئيسي 96 شعيرة GYTS', unit: 'm', priceUSD: 1.1, note: 'FOB ~0.66-0.72$/م (تقرير 2026)' },
  { id: 'cable_feeder_144f', category: 'cable', nameAr: 'كابل رئيسي 144 شعيرة GYTS', unit: 'm', priceUSD: 1.45 },
  { id: 'cable_feeder_288f', category: 'cable', nameAr: 'كابل رئيسي 288 شعيرة GYTS', unit: 'm', priceUSD: 2.6 },

  /* ---------------- الأنابيب (Ducts) ---------------- */
  { id: 'duct_hdpe32', category: 'duct', nameAr: 'أنبوب HDPE 32/26 مم (Silicon Core)', unit: 'm', priceUSD: 0.55 },
  { id: 'duct_hdpe40', category: 'duct', nameAr: 'أنبوب HDPE 40/33 مم', unit: 'm', priceUSD: 0.7 },
  { id: 'duct_micro7', category: 'duct', nameAr: 'حزمة مايكروداكت 7 مسارات 12/10مم', unit: 'm', priceUSD: 1.2 },
  { id: 'duct_sub12', category: 'duct', nameAr: 'مايكروداكت مفرد 12مم', unit: 'm', priceUSD: 0.25 },

  /* ---------------- الأعمال المدنية (للأمتار) ---------------- */
  { id: 'civil_open_soil', category: 'civil', nameAr: 'حفر ترابي مفتوح + ردم (لكل متر)', unit: 'm', priceUSD: 4 },
  { id: 'civil_open_asphalt', category: 'civil', nameAr: 'قطع أسفلت + حفر + إعادة تأهيل (لكل متر)', unit: 'm', priceUSD: 12 },
  { id: 'civil_micro', category: 'civil', nameAr: 'حفر ميكروي Micro-Trenching (لكل متر)', unit: 'm', priceUSD: 6 },
  { id: 'civil_hdd', category: 'civil', nameAr: 'حفر موجّه HDD (لكل متر)', unit: 'm', priceUSD: 40, note: 'استخدام عند العبور تحت الطرق' },
  { id: 'civil_aerial', category: 'civil', nameAr: 'تمديد هوائي على أعمدة قائمة (لكل متر)', unit: 'm', priceUSD: 2.5 },
  { id: 'warning_tape', category: 'civil', nameAr: 'شريط تحذيري + فرشة رمل', unit: 'm', priceUSD: 0.15 },

  /* ---------------- المنشآت ---------------- */
  { id: 'manhole_concrete', category: 'structure', nameAr: 'غرفة تفتيش خرسانية 1×1×1.2م (توريد + تركيب)', unit: 'pc', priceUSD: 180 },
  { id: 'handhole_polymer', category: 'structure', nameAr: 'هاند هول بوليمري 45×45سم', unit: 'pc', priceUSD: 45 },
  { id: 'fdc_cabinet', category: 'structure', nameAr: 'كبينة FDC خارجية 288 شعيرة مع ODF', unit: 'pc', priceUSD: 350 },
  { id: 'fat_16', category: 'structure', nameAr: 'صندوق توزيع FAT خارجي 16 منفذ', unit: 'pc', priceUSD: 15 },
  { id: 'fat_32', category: 'structure', nameAr: 'صندوق توزيع FAT خارجي 32 منفذ', unit: 'pc', priceUSD: 22 },
  { id: 'closure_48f', category: 'structure', nameAr: 'كلوزر لحام قبة 48 شعيرة', unit: 'pc', priceUSD: 25 },

  /* ---------------- العناصر البصرية السلبية ---------------- */
  { id: 'splitter_1x4', category: 'passive', nameAr: 'قاسم PLC مقاس 1:4 (LGX/ABS)', unit: 'pc', priceUSD: 3 },
  { id: 'splitter_1x8', category: 'passive', nameAr: 'قاسم PLC مقاس 1:8', unit: 'pc', priceUSD: 5 },
  { id: 'splitter_1x16', category: 'passive', nameAr: 'قاسم PLC مقاس 1:16', unit: 'pc', priceUSD: 9, note: 'ABS مع SC/APC: 8-15$ قطاعي، 4.8-7$ بالجملة' },
  { id: 'splitter_1x32', category: 'passive', nameAr: 'قاسم PLC مقاس 1:32', unit: 'pc', priceUSD: 16 },

  /* ---------------- الإنهاءات والعمالة ---------------- */
  { id: 'splice_fusion', category: 'termination', nameAr: 'لحام حراري (للشعيرة الواحدة شاملة الحماية والتوثيق)', unit: 'splice', priceUSD: 6, note: 'أوروبا 8-15€/شعيرة — معدّل لأجور العراق' },
  { id: 'connector_fast', category: 'termination', nameAr: 'كبسة سريعة SC/APC', unit: 'pc', priceUSD: 0.8 },
  { id: 'pigtail_sc', category: 'termination', nameAr: 'بيج تيل SC/APC 1.5م', unit: 'pc', priceUSD: 0.7 },
  { id: 'patch_cord', category: 'termination', nameAr: 'باتش كورد SC/SC APC 1.5م', unit: 'pc', priceUSD: 1.2 },
  { id: 'drop_set', category: 'termination', nameAr: 'طقم إسقاط (كلامب + براكيت + روزيتة)', unit: 'set', priceUSD: 3.5 },

  /* ---------------- المعدات النشطة ---------------- */
  { id: 'olt_port', category: 'equipment', nameAr: 'منفذ PON في الـ OLT (تكلفة موزعة)', unit: 'port', priceUSD: 8 },
  { id: 'ont_xpon', category: 'equipment', nameAr: 'جهاز ONT للمشترك', unit: 'pc', priceUSD: 18 },
];

export const CATALOG: Record<string, CatalogItem> = Object.fromEntries(
  ITEMS.map((i) => [i.id, i])
);

export const catalogItem = (id: string): CatalogItem | undefined => CATALOG[id];

export const itemCost = (id: string, qty: number): number =>
  (CATALOG[id]?.priceUSD ?? 0) * qty;

/* ===================== خصائص طرق الحفر ===================== */

import type { TrenchMethod } from '../types';

export interface TrenchMethodMeta {
  id: TrenchMethod;
  nameAr: string;
  color: string; // لون العرض على الخريطة
  costItemId: string;
  note: string;
}

export const TRENCH_METHODS: Record<TrenchMethod, TrenchMethodMeta> = {
  open_asphalt: {
    id: 'open_asphalt',
    nameAr: 'حفر أسفلت مفتوح',
    color: '#f59e0b',
    costItemId: 'civil_open_asphalt',
    note: 'الأكثر تكلفة — للشوارع المعبدة، عمق 80-100سم',
  },
  open_soil: {
    id: 'open_soil',
    nameAr: 'حفر ترابي مفتوح',
    color: '#d97706',
    costItemId: 'civil_open_soil',
    note: 'للمسارات الترابية والأرصفة',
  },
  micro: {
    id: 'micro',
    nameAr: 'حفر ميكروي',
    color: '#06b6d4',
    costItemId: 'civil_micro',
    note: 'خندق ضيق 4-8سم عميق 25-40سم — للمايكروداكت',
  },
  hdd: {
    id: 'hdd',
    nameAr: 'حفر موجّه HDD',
    color: '#a78bfa',
    costItemId: 'civil_hdd',
    note: 'لعبور الطرق دون قطع الأسفلت — الأغلى للمتر',
  },
  aerial: {
    id: 'aerial',
    nameAr: 'تمديد هوائي',
    color: '#f472b6',
    costItemId: 'civil_aerial',
    note: 'على أعمدة قائمة — أرخص حل مدني',
  },
};

/** سعر صرف عرضي لتحويل الدولار إلى دينار عراقي في التقارير */
export const USD_TO_IQD = 1310;
