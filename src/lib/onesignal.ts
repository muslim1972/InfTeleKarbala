
export const initOneSignal = (userId: string) => {
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return;
  }
  const OneSignal = (window as any).OneSignal;
  if (OneSignal) {
    try {
      OneSignal.login(userId);
      console.log('OneSignal: Logged in as', userId);
    } catch (e) {
      console.error('OneSignal: Error logging in', e);
    }
  } else {
    // If SDK is not loaded yet, push to deferred
    (window as any).OneSignalDeferred = (window as any).OneSignalDeferred || [];
    (window as any).OneSignalDeferred.push(async (OS: any) => {
      OS.login(userId);
      console.log('OneSignal (Deferred): Logged in as', userId);
    });
  }
};

export const logoutOneSignal = () => {
  const OneSignal = (window as any).OneSignal;
  if (OneSignal) {
    OneSignal.logout();
    console.log('OneSignal: Logged out');
  }
};
