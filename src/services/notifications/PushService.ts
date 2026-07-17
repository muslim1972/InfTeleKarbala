/**
 * PushService.ts
 * 
 * Handles sending push notifications via our local self-hosted Ntfy server.
 * This replaces OneSignal and ensures 100% offline capability.
 */

export interface PushNotificationOptions {
  title?: string;
  url?: string;
  data?: Record<string, any>;
  isBuzz?: boolean;
  type?: 'call' | 'chat' | 'buzz' | 'default';
}

export const sendPushNotification = async (
  recipientId: string,
  message: string,
  options?: PushNotificationOptions
): Promise<void> => {
  if (!recipientId || !message) {
    console.warn('sendPushNotification: Missing recipientId or message');
    return;
  }

  // في بيئة التطوير، يتم توجيه الطلبات عبر Kong إلى ntfy
  let ntfyUrl = 'http://10.56.3.3/ntfy';
  if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
      // إذا كان المضيف هو khr-itpc.egov.iq
      ntfyUrl = 'http://10.56.3.3/ntfy'; // مبدئيا حتى يتم إعداد الـ Proxy
  }

  // Topic name depends on recipientId (removed hyphens if necessary, but ntfy supports hyphens)
  const topic = `hr_alerts_${recipientId}`;
  
  try {
    const headers: Record<string, string> = {
      'Title': options?.title || 'مديرية الاتصالات - إشعار جديد',
      'Priority': options?.isBuzz || options?.type === 'call' ? 'high' : 'default',
      'Tags': options?.type === 'call' ? 'telephone_receiver' : 'bell'
    };

    if (options?.url) {
      headers['Click'] = options.url;
    }

    const response = await fetch(`${ntfyUrl}/${topic}`, {
      method: 'POST',
      headers,
      body: message
    });

    if (!response.ok) {
      console.warn('Ntfy Push Error:', response.status);
    } else {
      console.log('📬 Ntfy Push notification sent successfully to', topic);
    }
  } catch (error) {
    console.warn('Failed to send ntfy push notification:', error);
  }
};
