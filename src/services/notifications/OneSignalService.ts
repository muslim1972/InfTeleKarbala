import OneSignal from 'react-onesignal';

const APP_ID = "beae0757-7abe-46a8-b223-8f6c65e47fb5";

let isInitialized = false;

// تهيئة الخدمة لأول مرة - يتم استدعاؤها من App.tsx أو main.tsx
export const initializeOneSignal = async () => {
  if (typeof window === 'undefined') return;
  
  if (!isInitialized) {
    try {
      await OneSignal.init({
        appId: APP_ID,
        allowLocalhostAsSecureOrigin: true,
      });
      isInitialized = true;
      console.log('✅ OneSignal Initialized via React-OneSignal');
    } catch (e) {
      console.error('❌ OneSignal Initialization Error:', e);
    }
  }
};

export const requestNotificationPermission = async () => {
  if (typeof window === 'undefined') return;

  try {
    // المحاولة بالواجهة الأم للمتصفح أولاً
    if ('Notification' in window && Notification.permission === 'default') {
      await Notification.requestPermission();
    }
    
    // ثم عبر مكتبة OneSignal
    if (isInitialized) {
      await OneSignal.Slidedown.promptPush({ force: true });
    }
  } catch (err) {
    console.error('Notification Request Error:', err);
  }
};

export const initOneSignal = async (userId: string) => {
  if (typeof window === 'undefined' || !userId) return;

  try {
    if (!isInitialized) {
      await initializeOneSignal();
    }
    
    // تسجيل الدخول بالرقم التعريفي للمستخدم
    if (isInitialized) {
      await OneSignal.login(userId);
      
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
    }
  } catch (e) {
    console.error('OneSignal User Setup Error:', e);
  }
};

export const logoutOneSignal = async () => {
  if (typeof window === 'undefined') return;
  
  if (isInitialized) {
    try {
      await OneSignal.logout();
    } catch (e: any) {
      console.error('OneSignal Logout Error:', e);
    }
  }
};
