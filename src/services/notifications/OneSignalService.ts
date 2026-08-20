const APP_ID = "beae0757-7abe-46a8-b223-8f6c65e47fb5";

let initPromise: Promise<void> | null = null;
let isInitialized = false;

const getOS = () => {
  return (typeof window !== 'undefined') ? (window as any).OneSignal : null;
};

/**
 * تهيئة OneSignal محلياً باستخدام السكريبت المرفق (v16)
 */
export const initializeOneSignal = (): Promise<void> => {
  if (typeof window === 'undefined') return Promise.resolve();
  if (isInitialized) return Promise.resolve();
  
  if (initPromise) return initPromise;

  initPromise = new Promise((resolve) => {
    const timer = setTimeout(() => {
      resolve();
    }, 2000);

    const win = window as any;
    win.OneSignalDeferred = win.OneSignalDeferred || [];
    win.OneSignalDeferred.push(async function(OneSignal: any) {
      try {
        await OneSignal.init({
          appId: APP_ID,
          allowLocalhostAsSecureOrigin: true,
        });
        isInitialized = true;
      } catch (e: any) {
        if (String(e).includes('already initialized')) {
          isInitialized = true;
        }
      }
      clearTimeout(timer);
      resolve();
    });
    
    // Fallback if OneSignal is already loaded and not using Deferred
    if (win.OneSignal && typeof win.OneSignal.init === 'function' && !isInitialized) {
       win.OneSignal.init({
          appId: APP_ID,
          allowLocalhostAsSecureOrigin: true,
       }).then(() => {
           isInitialized = true;
           clearTimeout(timer);
           resolve();
       }).catch(() => {
           clearTimeout(timer);
           resolve();
       });
    }
  });

  return initPromise;
};

export const requestNotificationPermission = async () => {
  if (typeof window === 'undefined') return;
  try {
    await initializeOneSignal();
    const OS = getOS();
    if (isInitialized && OS && OS.Notifications) {
      await OS.Notifications.requestPermission();
    }
  } catch (err) {}
};

export const initOneSignal = async (userId: string) => {
  if (typeof window === 'undefined' || !userId) return;
  try {
    await initializeOneSignal();
    const OS = getOS();
    if (!OS) return;

    if (OS.login) {
      await OS.login(userId);
    }

    if (OS.Notifications) {
      const nativePermission = OS.Notifications.permissionNative;
      if (nativePermission === 'default') {
        try {
          await OS.Notifications.requestPermission();
        } catch (promptErr) {}
      }

      OS.Notifications.addEventListener('click', (event: any) => {
        const data = event.notification.additionalData;
        if (data && data.path) {
          if ((window as any).navigateApp) {
            (window as any).navigateApp(data.path);
          } else {
            window.location.hash = data.path;
          }
        }
      });
    }
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
    const OS = getOS();
    if (isInitialized && OS && OS.Notifications) {
      const permission = await OS.Notifications.requestPermission();
      return permission;
    }
  } catch (err) {}

  return checkNotificationStatus() === 'granted';
};

export const logoutOneSignal = async () => {
  if (typeof window === 'undefined' || !isInitialized) return;
  try {
    const OS = getOS();
    if (OS && OS.logout) {
      await OS.logout();
    }
  } catch (e: any) {}
};
