/**
 * governorates.ts - قائمة المحافظات المعتمدة
 * تُستخدم في واجهة اختيار المحافظة وأدوات رفع البيانات لكل المحافظات
 */
export interface GovernorateOption {
    id: string;
    name: string;
}

export const GOVERNORATES: GovernorateOption[] = [
    { id: 'itpc_hq', name: 'مقر الشركة العامة للاتصالات والمعلوماتية' },
    { id: 'baghdad_karkh', name: 'بغداد الكرخ' },
    { id: 'baghdad_rusafa', name: 'بغداد الرصافة' },
    { id: 'karbala', name: 'كربلاء المقدسة' },
    { id: 'najaf', name: 'النجف الأشرف' },
    { id: 'basra', name: 'البصرة' },
    { id: 'nineveh', name: 'نينوى' },
    { id: 'babil', name: 'بابل' },
    { id: 'dhi_qar', name: 'ذي قار' },
    { id: 'maysan', name: 'ميسان' },
    { id: 'wasit', name: 'واسط' },
    { id: 'muthanna', name: 'المثنى' },
    { id: 'qadisiyyah', name: 'القادسية' },
    { id: 'diyala', name: 'ديالى' },
    { id: 'anbar', name: 'الأنبار' },
    { id: 'kirkuk', name: 'كركوك' },
    { id: 'salah_al_din', name: 'صلاح الدين' },
];

/** المحافظة الافتراضية (كربلاء) */
export const DEFAULT_GOVERNORATE = 'karbala';

/** اسم المحافظة من معرفها */
export function governorateName(id: string | null | undefined): string {
    return GOVERNORATES.find(g => g.id === id)?.name || 'كربلاء المقدسة';
}
