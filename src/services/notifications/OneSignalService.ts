/**
 * OneSignalService.ts
 * 
 * Handles SDK initialization, user authentication (login/logout), 
 * and dynamic script injection to keep index.html clean.
 */



/**
 * Initializes OneSignal for a specific user and requests permissions.
 * @param userId The UUID of the logged-in user
 */
export const initOneSignal = (userId: string) => {
  if (typeof window === 'undefined') return;
  
  // Skip on localhost
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return;
  }

  const setupUser = async (OS: any) => {
    try {
      // 1. Identify User (Isolated to prevent it from blocking the prompt if it fails/hangs)
      try {
        if (typeof OS.login === 'function') {
          // Do NOT await this! If OneSignal backend hangs, it blocks the prompt forever.
          OS.login(userId).catch((err: any) => console.error('OneSignal login failed:', err));
          console.log('OneSignal: Login request sent for', userId);
        }
      } catch (loginErr) {
        console.error('OneSignal: Login error (ignoring to proceed with prompt):', loginErr);
      }

      // 2. Polite Permission Prompt (Slidedown)
      const permission = await OS.Notifications.permission;
      
      if (!permission) {
          // canPrompt is not a function in OneSignal v16, removed to prevent TypeError
          console.log('OneSignal: Attempting to show Slidedown prompt...');
          OS.Slidedown.promptPush({ force: true });
      } else {
          console.log('OneSignal: Permission already granted naturally.');
      }

      // 3. Handle Foreground Notifications to avoid sound conflict
      OS.Notifications.addEventListener('foregroundWillDisplay', (event: any) => {
          const notificationData = event.notification.data;
          // Robust check for isBuzz flag (handles boolean or string from OneSignal)
          const isBuzz = notificationData?.isBuzz === true || notificationData?.isBuzz === 'true';
          
          if (isBuzz) {
              // Prevent the system notification from showing when the app is open
              // because ChatContext.tsx is already playing the custom buzz.wav sound.
              event.preventDefault();
              console.log('OneSignal: Suppressed foreground Buzz notification to prevent sound conflict.');
          }
      });
    } catch (e) {
      console.error('OneSignal setup error:', e);
    }
  };

  const OneSignal = (window as any).OneSignal;
  if (OneSignal && typeof OneSignal.login === 'function') {
    setupUser(OneSignal);
  } else {
    const OneSignalDeferred = (window as any).OneSignalDeferred || [];
    (window as any).OneSignalDeferred = OneSignalDeferred;
    OneSignalDeferred.push((OS: any) => {
      setupUser(OS);
    });
  }
};

/**
 * Logs the user out of OneSignal (stopping notifications for this device).
 */
export const logoutOneSignal = () => {
  if (typeof window === 'undefined') return;
  const OneSignal = (window as any).OneSignal;
  if (OneSignal && typeof OneSignal.logout === 'function') {
    OneSignal.logout();
    console.log('OneSignal: Logged out');
  }
};
