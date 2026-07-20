export const requestNotificationPermission = async () => {
  if (typeof window === 'undefined') return;
  const OS = (window as any).OneSignal;
  if (OS) return await OS.Notifications.requestPermission();
};

export const initOneSignal = (userId: string) => {
  if (typeof window === 'undefined' || !userId) return;

  // Skip OneSignal on localhost to prevent "Web OS Error" and console noise
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    console.log('OneSignal: Skipped initialization on localhost');
    return;
  }

  const OneSignal = (window as any).OneSignal;
  
  const setupWebUser = async (OS: any) => {
    try {
      if (typeof OS.login === 'function') OS.login(userId).catch(() => {});
      const permission = await OS.Notifications.permission;
      if (!permission) OS.Slidedown.promptPush({ force: true });

      // Click listener for PWA
      OS.Notifications.addEventListener('click', (event: any) => {
        const data = event.notification.additionalData;
        if (data && data.path) {
          // Navigate in PWA
          if ((window as any).navigateApp) {
            (window as any).navigateApp(data.path);
          } else {
            window.location.hash = data.path;
          }
        }
      });
    } catch (e) {
      console.error('OneSignal Web Error:', e);
    }
  };

  if (OneSignal && (typeof OneSignal.login === 'function' || OneSignal.default)) {
    setupWebUser(OneSignal.default || OneSignal);
  } else {
    (window as any).OneSignalDeferred = (window as any).OneSignalDeferred || [];
    (window as any).OneSignalDeferred.push((OS: any) => setupWebUser(OS));
  }
};

export const logoutOneSignal = async () => {
  if (typeof window === 'undefined') return;
  const OS = (window as any).OneSignal || ((window as any).OneSignalDeferred && (window as any).OneSignalDeferred[0]);
  if (OS && typeof OS.logout === 'function') {
    try {
      await OS.logout();
    } catch (e: any) {
      // Ignore errors
    }
  }
};
