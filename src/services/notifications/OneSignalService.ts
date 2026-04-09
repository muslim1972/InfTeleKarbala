/**
 * OneSignalService.ts
 */

import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';

const ONESIGNAL_APP_ID = "beae0757-7abe-46a8-b223-8f6c65e47fb5";

export const requestNotificationPermission = async () => {
  if (typeof window === 'undefined') return;
  const isNative = Capacitor.isNativePlatform();
  if (isNative) {
    try {
      const result = await PushNotifications.requestPermissions();
      return result.receive === 'granted';
    } catch (err: any) {
      console.error("Permission request failed", err);
    }
  } else {
    const OS = (window as any).OneSignal;
    if (OS) return await OS.Notifications.requestPermission();
  }
};

/**
 * البحث عن كائن OneSignal الأصل في كل مكان ممكن مع دعم الـ Module
 */
const findOneSignal = () => {
  const win = window as any;
  let OS = win.OneSignal || (win.plugins && win.plugins.OneSignal) || (win.cordova && win.cordova.plugins && win.cordova.plugins.OneSignal);
  
  // إذا وجدنا الكائن، نتأكد من الوصول للمستوى الذي يحتوي على الدوال (دعم الإصدار 5.x)
  if (OS && !OS.initialize && OS.default && OS.default.initialize) {
    return OS.default;
  }
  return OS;
};

export const initOneSignal = (userId: string) => {
  if (typeof window === 'undefined' || !userId) return;
  const isNative = Capacitor.isNativePlatform();

  if (!isNative) {
    const OneSignal = (window as any).OneSignal;
    const setup = (OS: any) => {
       if (OS && typeof OS.login === 'function') {
         OS.login(userId).catch(() => {});
         if (!OS.Notifications.permission) OS.Slidedown.promptPush({ force: true });
       }
    };
    if (OneSignal && (typeof OneSignal.login === 'function' || OneSignal.default)) {
      setup(OneSignal.default || OneSignal);
    } else {
      (window as any).OneSignalDeferred = (window as any).OneSignalDeferred || [];
      (window as any).OneSignalDeferred.push((OS: any) => setup(OS));
    }
    return;
  }

  // --- منطق الـ APK (Native) ---
  let attempts = 0;
  const maxAttempts = 5;

  const tryInitialize = () => {
    attempts++;
    const OS = findOneSignal();

    if (OS && typeof OS.initialize === 'function') {
      try {
        OS.initialize(ONESIGNAL_APP_ID);
        OS.login(userId);
        
        // تنبيه نجاح نهائي
        alert("🎉 مبروك! تم تفعيل نظام الإشعارات الأصلي وربطه بـ " + userId);
        
        PushNotifications.checkPermissions().then(perm => {
          if (perm.receive !== 'granted') requestNotificationPermission();
        });
      } catch (e: any) {
        alert("❌ خطأ عند التشغيل: " + e.message);
      }
    } else {
      if (attempts < maxAttempts) {
        setTimeout(tryInitialize, 2000);
      } else {
        const keys = OS ? Object.keys(OS).join(', ') : 'null';
        alert(`🚨 فشل نهائي: لم نتمكن من العثور على دوال التشغيل.\nKeys: ${keys}`);
      }
    }
  };

  tryInitialize();
};

export const logoutOneSignal = () => {
  if (typeof window === 'undefined') return;
  const OS = findOneSignal();
  if (OS && typeof OS.logout === 'function') OS.logout();
};
