
export const initOneSignal = (userId: string) => {
  if (typeof window === 'undefined') return;
  
  // Skip on localhost
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return;
  }

  const setupUser = async (OS: any) => {
    try {
      // 1. Identify User - Aggressive Approach
      if (userId && typeof OS.login === 'function') {
        await OS.login(userId);
        console.log('OneSignal: Forced Identity Sync for', userId);
      }

      // 2. Force Subscription Refresh
      // Using requestPermission() handles both new users and re-installations
      const isPushSupported = OS.Notifications.isPushSupported();
      if (isPushSupported) {
        const permission = await OS.Notifications.permission;
        if (permission !== 'granted') {
          console.log('OneSignal: Requesting fresh permission...');
          await OS.Notifications.requestPermission();
        } else {
          // Even if granted, we ensure the user is registered
          console.log('OneSignal: Refreshing subscription status...');
        }
      }
    } catch (e) {
      console.error('OneSignal setup error:', e);
    }
  };

  const OneSignal = (window as any).OneSignal;
  if (OneSignal && typeof OneSignal.login === 'function') {
    setupUser(OneSignal);
  } else {
    (window as any).OneSignalDeferred = (window as any).OneSignalDeferred || [];
    (window as any).OneSignalDeferred.push(async (OS: any) => {
      await setupUser(OS);
    });
  }
};

export const logoutOneSignal = () => {
  if (typeof window === 'undefined') return;
  const OneSignal = (window as any).OneSignal;
  if (OneSignal && typeof OneSignal.logout === 'function') {
    OneSignal.logout();
    console.log('OneSignal: Logged out');
  }
};
