
export const initOneSignal = (userId: string) => {
  if (typeof window === 'undefined') return;
  
  // Skip on localhost
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return;
  }

  const setupUser = async (OS: any) => {
    try {
      // 1. Identify User
      if (typeof OS.login === 'function') {
        await OS.login(userId);
        console.log('OneSignal: Logged in as', userId);
      }

      // 2. Polite Permission Prompt (Slidedown)
      const permission = await OS.Notifications.permission;
      if (!permission) {
          OS.Slidedown.promptPush({ force: true });
      }
    } catch (e) {
      console.error('OneSignal setup error:', e);
    }
  };

  const OneSignal = (window as any).OneSignal;
  if (OneSignal && typeof OneSignal.login === 'function') {
    setupUser(OneSignal);
  } else {
    // If not loaded or method not ready, use the Deferred queue
    const OneSignalDeferred = (window as any).OneSignalDeferred || [];
    (window as any).OneSignalDeferred = OneSignalDeferred;
    OneSignalDeferred.push((OS: any) => {
      setupUser(OS);
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
