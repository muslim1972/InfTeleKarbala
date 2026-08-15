import OneSignal from 'react-onesignal';

const APP_ID = "beae0757-7abe-46a8-b223-8f6c65e47fb5";

let initPromise: Promise<void> | null = null;
let isInitialized = false;
let hasFailedPermanently = false;

/**
 * تهيئة OneSignal - تكتشف النطاق تلقائياً وتتخطى النطاقات غير الرسمية بهدوء وبسرعة 0ms
 */
export const initializeOneSignal = (): Promise<void> => {
  if (typeof window === 'undefined') return Promise.resolve();
  if (isInitialized || hasFailedPermanently) return Promise.resolve();
  
  if (initPromise) return initPromise;

  initPromise = OneSignal.init({
    appId: APP_ID,
    allowLocalhostAsSecureOrigin: true,
  }).then(() => {
    isInitialized = true;
  }).catch((e: any) => {
    const errStr = String(e || '');
    if (errStr.includes('already initialized')) {
      isInitialized = true;
    } else {
      hasFailedPermanently = true; // منع تكرار المحاولة نهائياً عند العمل على Vercel أو النطاقات التجريبية
    }
  });

  return initPromise;
};

export const requestNotificationPermission = async () => {
  if (typeof window === 'undefined') return;
  try {
    await initializeOneSignal();
    if (isInitialized) {
      await OneSignal.Notifications.requestPermission();
    }
  } catch (err) {}
};

export const initOneSignal = async (userId: string) => {
  if (typeof window === 'undefined' || !userId) return;
  try {
    await initializeOneSignal();
    if (!isInitialized) return;

    await OneSignal.login(userId);

    const nativePermission = OneSignal.Notifications.permissionNative;
    if (nativePermission === 'default') {
      try {
        await OneSignal.Notifications.requestPermission();
      } catch (promptErr) {}
    }

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
  } catch (e) {}
};

export const checkNotificationStatus = (): NotificationPermission => {
  if (typeof window === 'undefined') return 'default';
  if ('Notification' in window) {
    return Notification.permission;
  }
  return 'default';
};

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
  } catch (err) {}

  return checkNotificationStatus() === 'granted';
};

export const logoutOneSignal = async () => {
  if (typeof window === 'undefined' || !isInitialized) return;
  try {
    await OneSignal.logout();
  } catch (e: any) {}
};
