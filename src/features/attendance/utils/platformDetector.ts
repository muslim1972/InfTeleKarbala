/**
 * كاشف بيئة العميل الذكي (Client OS & Environment Detector)
 */

export interface PlatformInfo {
  isIOS: boolean;
  isAndroid: boolean;
  isMobile: boolean;
  isSafari: boolean;
  isChrome: boolean;
  supportsBackgroundSync: boolean;
}

export const getPlatformInfo = (): PlatformInfo => {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return {
      isIOS: false,
      isAndroid: false,
      isMobile: false,
      isSafari: false,
      isChrome: false,
      supportsBackgroundSync: false,
    };
  }

  const ua = navigator.userAgent || '';
  const vendor = navigator.vendor || '';

  // كشف أجهزة Apple iOS (iPhone, iPad, iPod)
  // ملاحظة: iPadOS الحديث قد يُعرّف نفسه كـ Macintosh لكنه يمتلك touch points > 1
  const isIOS =
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  // كشف أجهزة Android
  const isAndroid = /Android/i.test(ua);

  // كشف الجوال عموماً
  const isMobile = isIOS || isAndroid || /Mobi|Tablet/i.test(ua);

  // كشف Safari (Apple WebKit)
  const isSafari =
    /Safari/i.test(ua) &&
    /Apple Computer/i.test(vendor) &&
    !/Chrome|CriOS|FxiOS|EdgiOS/i.test(ua);

  // كشف Chrome / Chromium
  const isChrome = /Chrome|CriOS/i.test(ua) && !/Edge|Edg/i.test(ua);

  // دعم Background Sync (مدعوم في Chromium على Android، غير مدعوم في iOS Safari)
  const supportsBackgroundSync =
    'serviceWorker' in navigator && 'SyncManager' in window;

  return {
    isIOS,
    isAndroid,
    isMobile,
    isSafari,
    isChrome,
    supportsBackgroundSync,
  };
};
