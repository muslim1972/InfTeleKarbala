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
 * البحث عن كائن OneSignal في كل مكان ممكن
 */
const findOneSignal = () => {
  const win = window as any;
  return win.OneSignal || (win.plugins && win.plugins.OneSignal) || (win.cordova && win.cordova.plugins && win.cordova.plugins.OneSignal);
};

export const initOneSignal = (userId: string) => {
  if (typeof window === 'undefined' || !userId) return;
  const isNative = Capacitor.isNativePlatform();

  if (!isNative) {
    // منطق الويب (PWA)
    const OneSignal = (window as any).OneSignal;
    const setup = (OS: any) => {
       OS.login(userId).catch(() => {});
       if (!OS.Notifications.permission) OS.Slidedown.promptPush({ force: true });
    };
    if (OneSignal && typeof OneSignal.login === 'function') setup(OneSignal);
    else {
      (window as any).OneSignalDeferred = (window as any).OneSignalDeferred || [];
      (window as any).OneSignalDeferred.push(setup);
    }
    return;
  }

  // --- منطق الـ APK (Native) مع محاولات البحث ---
  let attempts = 0;
  const maxAttempts = 5;

  const tryInitialize = () => {
    attempts++;
    const OS = findOneSignal();

    if (OS && typeof OS.initialize === 'function') {
      try {
        OS.initialize(ONESIGNAL_APP_ID);
        OS.login(userId);
        alert("✅ SEARCH SUCCESS: OneSignal found and linked to " + userId);
        
        // التحقق من الأذونات فوراً
        PushNotifications.checkPermissions().then(perm => {
          if (perm.receive !== 'granted') requestNotificationPermission();
        });
      } catch (e: any) {
        alert("❌ INIT ERROR: " + e.message);
      }
    } else {
      if (attempts < maxAttempts) {
        console.log(`OneSignal search attempt ${attempts} failed, retrying...`);
        setTimeout(tryInitialize, 2000);
      } else {
        // تشخيص نهائي للمبرمج
        const keys = OS ? Object.keys(OS).join(', ') : 'null';
        alert(`🚨 DIAGNOSIS: OneSignal not found after 10s.\nObject: ${OS ? "Exists but incomplete" : "Missing"}\nKeys: ${keys}`);
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
