import { Capacitor } from '@capacitor/core';

const ONESIGNAL_APP_ID = "beae0757-7abe-46a8-b223-8f6c65e47fb5";

/**
 * دالة لطلب الإذن بالإشعارات بشكل صريح (مفيدة للأندرويد 13+)
 */
export const requestNotificationPermission = async () => {
  if (typeof window === 'undefined') return;
  
  const isNative = Capacitor.isNativePlatform();
  
  if (isNative) {
    // التعامل مع المشغل الأصلي (Cordova Plugin)
    const OS = (window as any).OneSignal;
    if (OS && OS.Notifications) {
      console.log('OneSignal Native: Requesting permission...');
      return await OS.Notifications.requestPermission(true);
    }
  } else {
    // التعامل مع نسخة الويب
    const OS = (window as any).OneSignal;
    if (OS && OS.Notifications) {
      try {
        console.log('OneSignal Web: Requesting permission...');
        const permission = await OS.Notifications.requestPermission();
        console.log('OneSignal Web: Permission result:', permission);
        return permission;
      } catch (err) {
        console.error('OneSignal Web: Permission request failed:', err);
      }
    } else {
      const OneSignalDeferred = (window as any).OneSignalDeferred || [];
      OneSignalDeferred.push(async (deferredOS: any) => {
        await deferredOS.Notifications.requestPermission();
      });
    }
  }
};

/**
 * تهيئة OneSignal للمستخدم
 * @param userId معرف المستخدم في Supabase
 */
export const initOneSignal = (userId: string) => {
  if (typeof window === 'undefined') return;
  
  const isNative = Capacitor.isNativePlatform();

  // منع التشغيل في المتصفح العادي على localhost (فقط للأغراض التطويرية)
  if (!isNative && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
    console.log('OneSignal: Debug mode on localhost (Web)');
    return;
  }

  if (isNative) {
    // --- تهيئة النسخة الأصلية (APK) ---
    const OS = (window as any).OneSignal;
    if (OS) {
      try {
        OS.initialize(ONESIGNAL_APP_ID);
        OS.login(userId);
        
        // طلب الإذن فور تسجيل الدخول في الـ APK
        OS.Notifications.requestPermission(true).then((accepted: boolean) => {
          console.log("OneSignal Native: Permission accepted:", accepted);
        });

        // الاستماع لإشعارات المقدمة لتجنب تكرار الأصوات
        OS.Notifications.addEventListener('foregroundWillDisplay', (event: any) => {
          const notificationData = event.getNotification().getAdditionalData();
          if (notificationData?.isBuzz === true || notificationData?.isBuzz === 'true') {
            event.preventDefault(); // منع الإشعار الافتراضي لأن التطبيق سيهتز يدوياً
          }
        });

      } catch (err) {
        console.error("OneSignal Native Init Error:", err);
      }
    } else {
      console.warn("OneSignal Native Plugin not found on window object.");
    }
  } else {
    // --- تهيئة نسخة الويب (PWA) ---
    const setupWebUser = async (OS: any) => {
      try {
        if (typeof OS.login === 'function') {
          OS.login(userId).catch((err: any) => console.error('OneSignal Web login failed:', err));
        }

        const permission = await OS.Notifications.permission;
        if (!permission) {
          OS.Slidedown.promptPush({ force: true });
        }
      } catch (e) {
        console.error('OneSignal Web setup error:', e);
      }
    };

    const OneSignal = (window as any).OneSignal;
    if (OneSignal && typeof OneSignal.login === 'function') {
      setupWebUser(OneSignal);
    } else {
      const OneSignalDeferred = (window as any).OneSignalDeferred || [];
      (window as any).OneSignalDeferred = OneSignalDeferred;
      OneSignalDeferred.push((OS: any) => {
        setupWebUser(OS);
      });
    }
  }
};

/**
 * تسجيل الخروج من OneSignal
 */
export const logoutOneSignal = () => {
  if (typeof window === 'undefined') return;
  const OS = (window as any).OneSignal;
  
  if (OS && typeof OS.logout === 'function') {
    OS.logout();
    console.log('OneSignal: Logged out');
  }
};
