/**
 * إعدادات الكاش المركزية لتطبيق InfTeleKarbala
 * مستوحى من نظام Shamil
 */

export const CACHE_CONFIG = {
    VERSION: 1,

    // مفاتيح الكاش
    EMPLOYEES_KEY: 'employees',
    FINANCIAL_KEY: 'financial_',
    ADMIN_SUMMARY_KEY: 'admin_summary_',
    YEARLY_RECORDS_KEY: 'yearly_records_',
    POLLS_KEY: 'polls',
    MEDIA_CONTENT_KEY: 'media_content',
    USER_ACKNOWLEDGMENTS_KEY: 'acknowledgments_',

    // إعدادات الوقت
    CACHE_LIFETIME: 5 * 60 * 1000,        // 5 دقائق
    STALE_TIME: 30 * 1000,                 // 30 ثانية قبل اعتبار البيانات قديمة
    GC_TIME: 10 * 60 * 1000,               // 10 دقائق في الذاكرة

    // حدود التحميل
    INITIAL_LOAD_LIMIT: 20,
    BATCH_SIZE: 10,
} as const;

// دالة للكشف عن الموبايل
export function isMobile(): boolean {
    if (typeof window === 'undefined') return false;
    return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

// إعدادات حسب نوع الجهاز
export function getOptimalSettings() {
    const mobile = isMobile();

    return {
        staleTime: mobile ? 60000 : 30000,  // دقيقة للموبايل، 30 ثانية للديسكتوب
        gcTime: mobile ? 5 * 60 * 1000 : 10 * 60 * 1000,
        refetchOnWindowFocus: !mobile,      // تعطيل للموبايل
    };
}
