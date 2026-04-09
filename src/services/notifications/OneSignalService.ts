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
        return await OS.Notifications.requestPermission();
      } catch (err) {
        console.error('OneSignal Web Error:', err);
      }
    }
  }
};

export const initOneSignal = (userId: string) => {
  if (typeof window === 'undefined' || !userId) return;
  const isNative = Capacitor.isNativePlatform();

  if (!isNative && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
    return;
  }

  if (isNative) {
    // ننتظر قليلاً لضمان استقرار النظام
    setTimeout(async () => {
      try {
        const OS = (window as any).OneSignal || ((window as any).plugins && (window as any).plugins.OneSignal);
        
        if (OS && typeof OS.initialize === 'function') {
          // 1. التهيئة الأساسية
          OS.initialize(ONESIGNAL_APP_ID);
          
          // 2. ربط المستخدم بشكل صريح ومؤكد
          // نستخدم logout قبل login أحياناً في الـ Native لضمان ريفريش الهوية
          OS.login(userId);
          
          // تنبيه واحد فقط للتأكد من وصول الكود لهذه النقطة بنجاح
          alert("OneSignal: تم ربط جهازك بنجاح للمستخدم " + userId);

          // 3. التحقق من الأذونات
          const perm = await PushNotifications.checkPermissions();
          if (perm.receive !== 'granted') {
             await requestNotificationPermission();
          }

          // 4. السماح بظهور الإشعارات في المقدمة (للاختبار)
          OS.Notifications.addEventListener('foregroundWillDisplay', () => {
            console.log("Notification in Foreground");
          });
          
        }
      } catch (err: any) {
        alert("Internal Error: " + err.message);
      }
    }, 2500);
  } else {
    // نسخة الويب
    const setupWebUser = async (OS: any) => {
      try {
        if (typeof OS.login === 'function') OS.login(userId).catch(() => {});
        const permission = await OS.Notifications.permission;
        if (!permission) OS.Slidedown.promptPush({ force: true });
      } catch (e) {
        console.error('OneSignal Web Error:', e);
      }
    };

    const OneSignal = (window as any).OneSignal;
    if (OneSignal && typeof OneSignal.login === 'function') {
      setupWebUser(OneSignal);
    } else {
      const OneSignalDeferred = (window as any).OneSignalDeferred || [];
      (window as any).OneSignalDeferred = OneSignalDeferred;
      OneSignalDeferred.push((OS: any) => setupWebUser(OS));
    }
  }
};

export const logoutOneSignal = () => {
  if (typeof window === 'undefined') return;
  const OS = (window as any).OneSignal || ((window as any).plugins && (window as any).plugins.OneSignal);
  if (OS && typeof OS.logout === 'function') {
    OS.logout();
  }
};
