import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';

const ONESIGNAL_APP_ID = "beae0757-7abe-46a8-b223-8f6c65e47fb5";

/**
 * دالة لطلب الإذن بالإشعارات بشكل صريح
 */
export const requestNotificationPermission = async () => {
  if (typeof window === 'undefined') return;
  const isNative = Capacitor.isNativePlatform();
  
  if (isNative) {
    try {
      // 1. طلب الإذن عبر Capacitor (هذا ما يظهر النافذة الأصلية في أندرويد 13+)
      alert("DEBUG: Requesting System Permission...");
      const result = await PushNotifications.requestPermissions();
      alert("DEBUG: System Permission Result: " + result.receive);
      
      // 2. إبلاغ OneSignal بالنتيجة
      const OS = (window as any).OneSignal;
      if (OS && OS.Notifications) {
        await OS.Notifications.requestPermission(true);
      }
      return result.receive === 'granted';
    } catch (err: any) {
      alert("DEBUG: Permission Error: " + err.message);
    }
  } else {
    // نسخة الويب
    const OS = (window as any).OneSignal;
    if (OS && OS.Notifications) {
      try {
        console.log('OneSignal Web: Requesting permission...');
        const permission = await OS.Notifications.requestPermission();
        return permission;
      } catch (err) {
        console.error('OneSignal Web: Permission request failed:', err);
      }
    }
  }
};

/**
 * تهيئة OneSignal للمستخدم
 */
export const initOneSignal = (userId: string) => {
  if (typeof window === 'undefined') return;
  const isNative = Capacitor.isNativePlatform();

  if (!isNative && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
    return;
  }

  if (isNative) {
    // ننتظر ثانية واحدة لضمان تحميل الإضافات في الأندرويد
    setTimeout(async () => {
      try {
        const OS = (window as any).OneSignal;
        
        if (OS) {
          alert("DEBUG: OneSignal Plugin FOUND in APK");
          OS.initialize(ONESIGNAL_APP_ID);
          OS.login(userId);
          
          // محاولة طلب الإذن فوراً عند التهيئة
          const perm = await PushNotifications.checkPermissions();
          if (perm.receive !== 'granted') {
             alert("DEBUG: Prompting for permission now...");
             await requestNotificationPermission();
          } else {
             alert("DEBUG: Permission already granted.");
          }

          OS.Notifications.addEventListener('foregroundWillDisplay', (event: any) => {
            const notificationData = event.getNotification().getAdditionalData();
            if (notificationData?.isBuzz === true || notificationData?.isBuzz === 'true') {
              event.preventDefault();
            }
          });
        } else {
          alert("DEBUG ERROR: OneSignal NOT found on window object!");
        }
      } catch (err: any) {
        alert("DEBUG INIT ERROR: " + err.message);
      }
    }, 1500);
  } else {
    // نسخة الويب
    const setupWebUser = async (OS: any) => {
      try {
        if (typeof OS.login === 'function') {
          OS.login(userId).catch(() => {});
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
