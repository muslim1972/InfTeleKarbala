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
      alert("OneSignal: 1. Start setupUser");
      // 1. Identify User (Isolated to prevent it from blocking the prompt if it fails/hangs)
      try {
        if (typeof OS.login === 'function') {
          // Do NOT await this! If OneSignal backend hangs, it blocks the prompt forever.
          OS.login(userId).catch((err: any) => alert('OneSignal login failed: ' + err));
          alert('OneSignal: 2. Login request sent for: ' + userId);
        } else {
          alert('OneSignal: OS.login is not a function');
        }
      } catch (loginErr) {
        alert('OneSignal: 3. Login error: ' + loginErr);
      }

      // 2. Polite Permission Prompt (Slidedown)
      const permission = await OS.Notifications.permission;
      alert('OneSignal: 4. Current permission status: ' + permission);
      
      if (!permission) {
          const canPrompt = await OS.Notifications.canPrompt();
          alert('OneSignal: 5. canPrompt status: ' + canPrompt);
          
          if (canPrompt) {
              alert('OneSignal: 6. Attempting to show Slidedown prompt...');
              OS.Slidedown.promptPush({ force: true });
          } else {
              alert('OneSignal: 6. canPrompt is false. Forcing prompt anyway...');
              OS.Slidedown.promptPush({ force: true });
          }
      } else {
          alert('OneSignal: 5. Permission already granted naturally.');
      }
    } catch (e) {
      alert('OneSignal setup error: ' + e);
    }
  };

  const OneSignal = (window as any).OneSignal;
  if (OneSignal && typeof OneSignal.login === 'function') {
    alert('OneSignal: Executing setupUser immediately');
    setupUser(OneSignal);
  } else {
    alert('OneSignal: Not fully loaded yet. Using Deferred queue.');
    const OneSignalDeferred = (window as any).OneSignalDeferred || [];
    (window as any).OneSignalDeferred = OneSignalDeferred;
    OneSignalDeferred.push((OS: any) => {
      alert('OneSignal: Deferred queue triggered setupUser');
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
