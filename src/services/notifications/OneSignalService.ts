import OneSignal from 'react-onesignal';

const APP_ID = "beae0757-7abe-46a8-b223-8f6c65e47fb5";

// قفل التهيئة: يضمن أن init يُنادى مرة واحدة فقط حتى لو استُدعي من عدة أماكن
let initPromise: Promise<void> | null = null;
let isInitialized = false;

/**
 * تهيئة OneSignal - تُنادى من App.tsx عند التحميل الأول
 * تستخدم Promise singleton لمنع السباق الزمني
 */
export const initializeOneSignal = (): Promise<void> => {
  if (typeof window === 'undefined') return Promise.resolve();
  if (isInitialized) return Promise.resolve();
  
  // إذا كانت التهيئة جارية بالفعل، أعد نفس الـ Promise
  if (initPromise) return initPromise;

  initPromise = OneSignal.init({
    appId: APP_ID,
    allowLocalhostAsSecureOrigin: true,
  }).then(() => {
    isInitialized = true;
    console.warn('✅ OneSignal: Initialized successfully');
  }).catch((e: any) => {
    // "OneSignal is already initialized" ليس خطأ حقيقي
    if (typeof e === 'string' && e.includes('already initialized')) {
      isInitialized = true;
      console.warn('✅ OneSignal: Was already initialized');
    } else {
      console.error('❌ OneSignal Init Error:', e);
      initPromise = null; // السماح بإعادة المحاولة
    }
  });

  return initPromise;
};

/**
 * طلب صلاحية الإشعارات يدوياً - زر في صفحة الإعدادات
 */
export const requestNotificationPermission = async () => {
  if (typeof window === 'undefined') return;

  try {
    // انتظر اكتمال التهيئة أولاً
    await initializeOneSignal();

    // طلب الصلاحية المباشر عبر مكتبة OneSignal
    if (isInitialized) {
      console.warn('🔔 Requesting permission via OneSignal...');
      await OneSignal.Notifications.requestPermission();
    }
  } catch (err) {
    console.error('Notification Request Error:', err);
  }
};

/**
 * تسجيل دخول المستخدم في OneSignal + طلب الصلاحية تلقائياً
 * تُنادى من AuthContext بعد كل تسجيل دخول
 */
export const initOneSignal = async (userId: string) => {
  if (typeof window === 'undefined' || !userId) return;

  try {
    // انتظر اكتمال التهيئة (أو ابدأها إن لم تبدأ)
    await initializeOneSignal();
    
    if (!isInitialized) {
      console.error('❌ OneSignal: Failed to initialize, skipping login');
      return;
    }

    // تسجيل دخول المستخدم بمعرفه
    await OneSignal.login(userId);
    console.warn('✅ OneSignal: User logged in:', userId);

    // طلب صلاحية الإشعارات تلقائياً إذا كانت 'default' (لم تُطلب بعد)
    const nativePermission = OneSignal.Notifications.permissionNative;
    console.warn('Current native permission:', nativePermission);

    if (nativePermission === 'default') {
      try {
        console.warn('Prompting for push permission...');
        await OneSignal.Notifications.requestPermission();
      } catch (promptErr) {
        console.warn('OneSignal auto-prompt error:', promptErr);
      }
    }

    // ربط أحداث النقر للـ PWA
    OneSignal.Notifications.addEventListener('click', (event: any) => {
      const data = event.notification.additionalData;
      if (data && data.path) {
        if ((window as any).navigateApp) {
          (window as any).navigateApp(data.path);
        } else {
          window.location.hash = data.path;
        }
      }
    });
  } catch (e) {
    console.error('OneSignal User Setup Error:', e);
  }
};

/**
 * فحص حالة صلاحية الإشعارات
 */
export const checkNotificationStatus = (): NotificationPermission => {
  if (typeof window === 'undefined') return 'default';
  if ('Notification' in window) {
    return Notification.permission;
  }
  return 'default';
};

/**
 * التأكد من إذن الإشعارات وطلب الصلاحية إذا كانت ملغاة أو غير مفعّلة
 */
export const ensureNotificationPermission = async (): Promise<boolean> => {
  if (typeof window === 'undefined') return false;

  const currentStatus = checkNotificationStatus();
  if (currentStatus === 'granted') return true;

  try {
    await initializeOneSignal();
    if (isInitialized) {
      const permission = await OneSignal.Notifications.requestPermission();
      return permission;
    }
  } catch (err) {
    console.error('Failed to request notification permission:', err);
  }

  return checkNotificationStatus() === 'granted';
};

/**
 * تسجيل خروج المستخدم من OneSignal
 */
export const logoutOneSignal = async () => {
  if (typeof window === 'undefined' || !isInitialized) return;
  
  try {
    await OneSignal.logout();
  } catch (e: any) {
    console.error('OneSignal Logout Error:', e);
  }
};


