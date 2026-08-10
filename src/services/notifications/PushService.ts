export interface PushNotificationOptions {
  title?: string;
  url?: string;
  data?: Record<string, any>;
  isBuzz?: boolean;
  type?: 'call' | 'chat' | 'buzz' | 'default';
}

import { supabase } from '../../lib/supabase';

export const sendPushNotification = async (
  recipientId: string,
  message: string,
  options?: PushNotificationOptions
): Promise<void> => {
  if (!recipientId || !message) {
    console.warn('sendPushNotification: Missing recipientId or message');
    return;
  }

  try {
    
    // تحويل الرابط الكامل إلى مسار نسبي للتنقل الداخلي
    let internalPath = options?.url;
    if (internalPath && internalPath.startsWith('http')) {
      try {
        const urlObj = new URL(internalPath);
        internalPath = urlObj.pathname + urlObj.search + urlObj.hash;
      } catch (e) { /* اتركها كما هي إذا فشل التحليل */ }
    }

    const payload = {
      recipientId,
      message,
      title: options?.title || 'إشعار جديد',
      // نترك الـ url فارغاً لمنع المتصفح من الفتح التلقائي
      url: undefined, 
      data: {
        ...options?.data,
        path: internalPath, // نضع المسار هنا ليتم التعامل معه برمجياً
        type: options?.type 
      },
      isBuzz: options?.isBuzz,
      type: options?.type
    };

    const { error } = await supabase.functions.invoke('send-notification', {
      body: payload
    });

    if (error) {
      console.warn('OneSignal API Relay Error:', error);
    } else {
      console.log('📬 Push notification sent successfully to', recipientId);
    }
  } catch (error) {
    console.warn('Failed to send push notification (Network):', error);
  }
};
