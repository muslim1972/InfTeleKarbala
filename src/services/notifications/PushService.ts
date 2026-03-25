/**
 * PushService.ts
 * 
 * Handles sending push notifications via our Vercel API relay.
 * This isolates the notification sending logic from the rest of the app.
 */

// Define standard options for notifications to keep them consistent
export interface PushNotificationOptions {
  title?: string;
  url?: string;
  data?: Record<string, any>;
  isBuzz?: boolean;
}

export const sendPushNotification = async (
  recipientId: string,
  message: string,
  options?: PushNotificationOptions
): Promise<void> => {
  // Defensive check: Do not block the UI if something is missing
  if (!recipientId || !message) {
    console.warn('sendPushNotification: Missing recipientId or message');
    return;
  }

  // Skip sending if we're on localhost to prevent console errors
  // since the Vercel Serverless Function (/api/notify) isn't running locally by default
  const isLocalhost = typeof window !== 'undefined' && 
      (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

  if (isLocalhost) {
    console.log('📬 [Localhost Dev] Push notification blocked. Payload:', { recipientId, message, options });
    return;
  }

  try {
    const response = await fetch('/api/notify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        recipientId,
        message,
        title: options?.title || 'إشعار جديد',
        url: options?.url,
        data: options?.data,
        isBuzz: options?.isBuzz
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.warn('OneSignal API Relay Error:', response.status, errorData);
      // We don't throw an error here to prevent blocking the user's flow
      // if notifications fail (e.g. they sent a message, they shouldn't see an error
      // just because the notification didn't go through).
    } else {
      console.log('📬 Push notification sent successfully to', recipientId);
    }
  } catch (error) {
    // Network errors or other unexpected exceptions
    console.warn('Failed to send push notification (Network/CORS):', error);
  }
};
