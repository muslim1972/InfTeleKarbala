
export const initOneSignal = (userId: string) => {
  if (typeof window === 'undefined') return;
  
  // Skip on localhost
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return;
  }

  const setupUser = async (OS: any) => {
    try {
      // 1. Identify User
      if (userId && typeof OS.login === 'function') {
        await OS.login(userId);
      }

      // 2. Force Subscription Opt-In
      const isPushSupported = OS.Notifications.isPushSupported();
      if (isPushSupported) {
        console.log('OneSignal: Forcing Opt-In for push notifications...');
        // This is the most powerful way to re-enable push after re-install
        await OS.User.PushSubscription.optIn();
        
        const permission = await OS.Notifications.permission;
        if (permission !== 'granted') {
          await OS.Notifications.requestPermission();
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
