/**
 * ============================================================
 * محرك ترتيب بناء شبكة FTTH — قيود التسلسل + حساب التقدم
 * ============================================================
 * المنطق التدريبي: البناء الهندسي الحقيقي له ترتيب صارم —
 * مدني (حفر ← منشآت) ثم بصري (كبينة ← قواسم ← إسقاطات).
 * هذا المحرك يفرض الترتيب عبر checkToolAllowed/checkPhaseAllowed
 * ويحسب نسبة الإنجاز عبر computeBuildProgress.
 */

import type { PhaseId, ProjectEntities, ToolId } from '../types';

/* ===================== خطوات البناء الخمس ===================== */

export type BuildStepId = 'trenches' | 'structures' | 'fdc' | 'fats' | 'drops';

export interface BuildStepMeta {
  id: BuildStepId;
  order: 1 | 2 | 3 | 4 | 5;
  titleAr: string;
  goalAr: string;
  tools: ToolId[];
  phase: PhaseId;
}

export const BUILD_STEPS: BuildStepMeta[] = [
  {
    id: 'trenches',
    order: 1,
    titleAr: 'مسارات الحفر',
    goalAr: 'ارسم مسارات أنابيب بمحاذاة محاور الشوارع — لا شيء يُبنى قبلها',
    tools: ['trench'],
    phase: 'civil',
  },
  {
    id: 'structures',
    order: 2,
    titleAr: 'المنشآت (مناهل/هاند هول)',
    goalAr: 'ركّب منشآت وصول فوق المسارات عند التقاطعات والتفريعات',
    tools: ['manhole', 'handhole'],
    phase: 'civil',
  },
  {
    id: 'fdc',
    order: 3,
    titleAr: 'كبينة التوزيع FDC',
    goalAr: 'ثبّت الكبينة واربطها بمسار يصلها بالمقسم',
    tools: ['fdc'],
    phase: 'optical',
  },
  {
    id: 'fats',
    order: 4,
    titleAr: 'صناديق FAT والقواسم',
    goalAr: 'وزّع صناديق FAT بقواسم بصرية تتغذى من الكبينة',
    tools: ['fat'],
    phase: 'optical',
  },
  {
    id: 'drops',
    order: 5,
    titleAr: 'إسقاطات الدور',
    goalAr: 'مدّ كابل إسقاط من FAT إلى كل دار ضمن الحد الأقصى للطول',
    tools: ['drop'],
    phase: 'optical',
  },
];

/* ===================== قيود التسلسل ===================== */

export interface GuardResult {
  ok: boolean;
  /** رمز الخطأ — يُستخدم في سجل الأخطاء التعليمي */
  code?: string;
  titleAr?: string;
  messageAr?: string;
  /** الدرس المستفاد — لماذا هذا الترتيب هندسياً؟ */
  lessonAr?: string;
  /** الخطوة المطلوب إنجازها أولاً */
  requiredStep?: BuildStepMeta;
}

/**
 * هل يُسمح باستخدام الأداة الآن؟
 * الأدوات المساعدة (تحديد/تحريك/قياس/ممحاة/تلميح) حرة دائماً،
 * أما أدوات البناء فتحتاج استيفاء خطواتها السابقة.
 */
export function checkToolAllowed(tool: ToolId, e: ProjectEntities): GuardResult {
  const step = (id: BuildStepId) => BUILD_STEPS.find((s) => s.id === id)!;

  if (tool === 'manhole' || tool === 'handhole') {
    if (e.trenches.length === 0)
      return {
        ok: false,
        code: 'ORDER_STRUCTURE_BEFORE_TRENCH',
        titleAr: 'ترتيب خاطئ: منشأة بلا مسار',
        messageAr:
          'لا يمكن تركيب منشأة قبل رسم مسار حفر واحد على الأقل — المنشأة تُبنى فوق المسار عند التقاطعات.',
        lessonAr:
          'هندسياً: المنهل غرفة تلتقي فيها مسارات الأنابيب؛ وضعه وسط أرض بلا مسار يعني حفراً مضاعفاً لاحقاً وكلفة بلا فائدة.',
        requiredStep: step('trenches'),
      };
    return { ok: true };
  }

  if (tool === 'fdc') {
    if (e.trenches.length === 0)
      return {
        ok: false,
        code: 'ORDER_FDC_BEFORE_TRENCH',
        titleAr: 'ترتيب خاطئ: كبينة بلا مسار',
        messageAr:
          'الكبينة FDC تحتاج مسار حفر يربطها بالمقسم قبل تركيبها — ارسم المسار أولاً.',
        lessonAr:
          'الكبينة نقطة وصل الكابل المغذي؛ بلا مسار أنابيب لن يصلها الكابل وستبقى ديكوراً فارغاً.',
        requiredStep: step('trenches'),
      };
    return { ok: true };
  }

  if (tool === 'fat') {
    if (e.cabinets.length === 0)
      return {
        ok: false,
        code: 'ORDER_FAT_BEFORE_FDC',
        titleAr: 'ترتيب خاطئ: قاسم بلا تغذية',
        messageAr:
          'صندوق FAT يتغذى من كبينة FDC — ركّب الكبينة أولاً ثم وزّع القواسم.',
        lessonAr:
          'القاسم البصري يحتاج ليفة مغذية من ODF الكبينة؛ قاسم بلا تغذية لا يقسم شيئاً.',
        requiredStep: step('fdc'),
      };
    return { ok: true };
  }

  if (tool === 'drop') {
    const fedFat = e.fats.find((f) => f.splitter !== null);
    if (!fedFat)
      return {
        ok: false,
        code: 'ORDER_DROP_BEFORE_FAT',
        titleAr: 'ترتيب خاطئ: إسقاط بلا مصدر',
        messageAr:
          'الإسقاط يخرج من منفذ FAT مزوّد بقاسم بصري — ثبّت FAT واختر له قاسماً أولاً.',
        lessonAr:
          'منفذ بلا قاسم لا يحمل إشارة أصلاً؛ ترتيب التغذية (FDC ← FAT ← دار) هو جوهر بنية GPON السلبية.',
        requiredStep: step('fats'),
      };
    return { ok: true };
  }

  return { ok: true };
}

/** هل يُسمح بدخول الطور؟ (يحمي الانتقال المبكر للحام/الاختبار) */
export function checkPhaseAllowed(phase: PhaseId, e: ProjectEntities): GuardResult {
  if (phase === 'splicing' || phase === 'testing') {
    const coveredHomes = new Set(e.drops.map((d) => d.toBuildingId)).size;
    if (coveredHomes === 0)
      return {
        ok: false,
        code: 'PHASE_BEFORE_DROPS',
        titleAr: 'طور مبكر جداً',
        messageAr:
          phase === 'splicing'
            ? 'لا يوجد ما يُلحم بعد — أكمل الإسقاطات نحو الدور أولاً ثم تعال للحام.'
            : 'لا يوجد مسار بصري لاختباره — أكمل التصميم والإسقاطات أولاً.',
        lessonAr:
          'اللحام والاختبار يحتاجان مساراً فيزيائياً مكتمل الإسناد؛ الاختبار على شبكة فارغ لا معنى له.',
        requiredStep: BUILD_STEPS.find((s) => s.id === 'drops')!,
      };
  }
  return { ok: true };
}

/* ===================== حساب التقدم ===================== */

export interface StepProgress {
  meta: BuildStepMeta;
  /** نسبة إنجاز هذه الخطوة 0..1 */
  pct: number;
  done: boolean;
  current: boolean;
  locked: boolean;
  /** رقم إنجاز مختصر يظهر في الشريط (مثل «3 مسارات» أو «16/16 داراً») */
  countAr: string;
}

export interface BuildProgress {
  steps: StepProgress[];
  overallPct: number;
  currentStep: BuildStepMeta | null;
}

const WEIGHTS: Record<BuildStepId, number> = {
  trenches: 0.25,
  structures: 0.15,
  fdc: 0.15,
  fats: 0.15,
  drops: 0.3,
};

export function computeBuildProgress(e: ProjectEntities, homesTotal: number): BuildProgress {
  const trenchMeters = e.trenches.reduce((s, t) => s + countLength(t.points), 0);

  const raw: Record<BuildStepId, { pct: number; countAr: string }> = {
    trenches: {
      pct: e.trenches.length >= 1 ? Math.min(1, trenchMeters / 120) : 0,
      countAr: `${e.trenches.length} مسار · ${Math.round(trenchMeters)}م`,
    },
    structures: {
      pct: Math.min(1, e.structures.length / 2),
      countAr: `${e.structures.length} منشأة`,
    },
    fdc: {
      pct: e.cabinets.length >= 1 ? 1 : 0,
      countAr: `${e.cabinets.length} كبينة`,
    },
    fats: {
      pct: e.fats.length >= 1 ? 1 : 0,
      countAr: `${e.fats.length} FAT`,
    },
    drops: {
      pct: Math.min(1, new Set(e.drops.map((d) => d.toBuildingId)).size / Math.max(1, homesTotal)),
      countAr: `${new Set(e.drops.map((d) => d.toBuildingId)).size}/${homesTotal} دار`,
    },
  };

  const steps: StepProgress[] = BUILD_STEPS.map((meta) => {
    const pct = raw[meta.id].pct;
    return {
      meta,
      pct,
      done: pct >= 1,
      current: false,
      locked: false,
      countAr: raw[meta.id].countAr,
    };
  });

  /* قواعد الإتاحة — مطابقة حرفياً لقواعد حرّاس الأدوات في checkToolAllowed،
     كي لا يعرض الشريط خطوة «مقفلة» تسمح بها اللوحة أو العكس */
  const unlocked: Record<BuildStepId, boolean> = {
    trenches: true,
    structures: e.trenches.length >= 1,
    fdc: e.trenches.length >= 1,
    fats: e.cabinets.length >= 1,
    drops: e.fats.some((f) => f.splitter !== null),
  };

  /* الخطوة الحالية = أول خطوة متاحة وغير مكتملة */
  let currentIdx = steps.findIndex((s) => !s.done && unlocked[s.meta.id]);
  if (currentIdx === -1) currentIdx = steps.findIndex((s) => !s.done);

  steps.forEach((s, i) => {
    s.current = i === currentIdx;
    s.locked = !unlocked[s.meta.id];
  });

  const overallPct = Math.round(
    steps.reduce((sum, s) => sum + s.pct * WEIGHTS[s.meta.id], 0) * 100
  );

  return {
    steps,
    overallPct,
    currentStep: currentIdx < steps.length ? steps[currentIdx].meta : null,
  };
}

function countLength(pts: { x: number; y: number }[]): number {
  let len = 0;
  for (let i = 1; i < pts.length; i++)
    len += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  return len;
}
