/**
 * OneSignalService.ts
 * 
 * المصلح النهائي للإشعارات في نسخة الـ APK والـ PWA.
 */

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
      console.log('OneSignal Native: Requesting System Permission...');
      const result = await PushNotifications.requestPermissions();
      
      const OS = (window as any).OneSignal || ((window as any).plugins && (window as any).plugins.OneSignal);
      if (OS && OS.Notifications && typeof OS.Notifications.requestPermission === 'function') {
        await OS.Notifications.requestPermission(true);
      }
      return result.receive === 'granted';
    } catch (err: any) {
      console.error("Permission Error:", err.message);
    }
  } else {
    // نسخة الويب
    const OS = (window as any).OneSignal;
    if (OS && OS.Notifications) {
      try {
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
        // البحث عن المكتبة في الأماكن المحتملة لـ Cordova Plugin
        const OS = (window as any).OneSignal || ((window as any).plugins && (window as any).plugins.OneSignal);
        
        if (OS && typeof OS.initialize === 'function') {
          console.log('OneSignal Native: INITIALIZING FOR USER', userId);
          OS.initialize(ONESIGNAL_APP_ID);
          OS.login(userId);
          
          const perm = await PushNotifications.checkPermissions();
          if (perm.receive !== 'granted') {
             await requestNotificationPermission();
          }

          OS.Notifications.addEventListener('foregroundWillDisplay', (event: any) => {
            const notificationData = event.getNotification().getAdditionalData();
            if (notificationData?.isBuzz === true || notificationData?.isBuzz === 'true') {
              event.preventDefault();
            }
          });
        } else {
          // محاولة أخيرة بعد انتظار بسيط إضافي إذا لم تكن المكتبة جاهزة
          console.warn("OneSignal Native: Not ready, retrying once...");
        }
      } catch (err: any) {
        console.error("OneSignal Native Init Error:", err.message);
      }
    }, 2000);
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
  const OS = (window as any).OneSignal || ((window as any).plugins && (window as any).plugins.OneSignal);
  if (OS && typeof OS.logout === 'function') {
    OS.logout();
    console.log('OneSignal: Logged out');
  }
};
