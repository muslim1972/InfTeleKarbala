/**
 * ============================================================
 * المسارات التدريبية — ثلاثة مستويات خبرة متدرجة
 * ============================================================
 * كل مسار يحدد خريطته ومعايير نجاحه ومهاراته المستهدفة،
 * ويعرض في الجولة التدريبية وفي لوحة الفاحص الحي.
 */

export interface TrainingPath {
  id: string;
  level: 'beginner' | 'intermediate' | 'advanced';
  nameAr: string;
  audienceAr: string;
  skillsAr: string[];
  mapId: string;
  /** الحد الأدنى للنجوم لاجتياز المسار */
  targetStars: number;
  color: string;
}

export const TRAINING_PATHS: TrainingPath[] = [
  {
    id: 'path-beginner',
    level: 'beginner',
    nameAr: 'المسار التأسيسي — مهندس الشبكة الجديد',
    audienceAr: 'لمن يسمع بـ FTTH أول مرة: مفاهيم + أول شبكة كاملة بإرشاد خطوة بخطوة',
    skillsAr: [
      'التمييز بين عناصر الشبكة (مسار/منهل/FDC/FAT/إسقاط)',
      'ترتيب البناء الهندسي الصحيح',
      'قراءة الفحص الحي والتغطية',
      'لحام أساسي وفق التسلسل اللوني TIA-598',
    ],
    mapId: 'alley-16',
    targetStars: 3,
    color: '#38bdf8',
  },
  {
    id: 'path-intermediate',
    level: 'intermediate',
    nameAr: 'المسار المهني — مصمم شبكات معتمد',
    audienceAr: 'لمن أتم التأسيس: تصميم كثيف بقيود كلفة وإشارة حقيقية وقراءة OTDR',
    skillsAr: [
      'موازنة Power Budget ضد كلفة BOQ',
      'اختيار نسب التقسيم (1:8 ↔ 1:32) حسب الكثافة',
      'تشخيص الأعطال عبر OTDR وVFL',
      'كفاءة كلفة الدار الواحدة',
    ],
    mapId: 'alley-16',
    targetStars: 4,
    color: '#818cf8',
  },
  {
    id: 'path-advanced',
    level: 'advanced',
    nameAr: 'المسار الخبير — تخطيط مناطق ومنافسة عالمية',
    audienceAr: 'للمحترفين: سيناريوهات متعددة الكبائن وتحسين ★5 والالتزام الكامل بالمعايير',
    skillsAr: [
      'هندسة Multi-FDC وتقسيم المناطق',
      'تحقيق ★5 (تغطية/إشارة/كلفة/سلامة/لحام)',
      'جدول كميات تصديري جاهز للعطاءات',
      'توثيق قرارات التصميم وفق ITU-T G.984',
    ],
    mapId: 'alley-16',
    targetStars: 5,
    color: '#f59e0b',
  },
];
