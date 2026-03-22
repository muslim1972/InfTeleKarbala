/**
 * OneSignalService.ts
 * 
 * Handles SDK initialization, user authentication (login/logout), 
 * and dynamic script injection to keep index.html clean.
 */

const ONESIGNAL_SDK_URL = "https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js";

/**
 * Dynamically injects the OneSignal SDK script into the document head.
 * This prevents blocking page load and keeps index.html clean.
 */
export const injectOneSignalScript = (): void => {
  if (typeof window === 'undefined') return;

  // Skip if already injected
  if (document.querySelector(`script[src="${ONESIGNAL_SDK_URL}"]`)) {
    return;
  }

  const script = document.createElement('script');
  script.src = ONESIGNAL_SDK_URL;
  script.async = true;
  document.head.appendChild(script);

  console.log("🛠️ OneSignal SDK script injected dynamically");

  // Initialize OneSignal once the script is loaded or push it to Deferred
  const OneSignalDeferred = (window as any).OneSignalDeferred || [];
  (window as any).OneSignalDeferred = OneSignalDeferred;
  
  OneSignalDeferred.push(async function (OneSignal: any) {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      console.log('OneSignal: Initialized in debug mode on localhost');
      return; // Skip actual init on localhost to prevent domain errors
    }
    
    try {
      await OneSignal.init({
        appId: "beae0757-7abe-46a8-b223-8f6c65e47fb5",
        safari_web_id: "web.onesignal.auto.5a0e5a59-674b-4394-aabc-01283d58ef8a",
        notifyButton: {
          enable: false,
        },
      });
    } catch (error) {
      console.error('OneSignal Init Error:', error);
    }
  });
};

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
      console.log('OneSignal: Current permission status:', permission);
      
      if (!permission) {
          const canPrompt = await OS.Notifications.canPrompt();
          console.log('OneSignal: canPrompt status:', canPrompt);
          
          if (canPrompt) {
              console.log('OneSignal: Attempting to show Slidedown prompt...');
              OS.Slidedown.promptPush({ force: true });
          } else {
              console.log('OneSignal: canPrompt is false. Forcing prompt anyway for testing...');
              OS.Slidedown.promptPush({ force: true });
          }
      } else {
          console.log('OneSignal: Permission already granted naturally.');
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
