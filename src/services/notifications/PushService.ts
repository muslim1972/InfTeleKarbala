export interface PushNotificationOptions {
  title?: string;
  url?: string;
  data?: Record<string, any>;
  isBuzz?: boolean;
  type?: 'call' | 'chat' | 'buzz' | 'default';
}

import { supabase } from '../../lib/supabase';

// قاطع دائرة محلي (Circuit Breaker) لحماية مسبح اتصالات المتصفح (HTTP/1.1 Socket Pool)
// في حال تعذر وصول الخادم إلى موفّر الإشعارات الخارجي، يمنع خنق استعلامات المستخدم والبحث
let consecutiveFailures = 0;
let circuitBrokenUntil = 0;

export const sendPushNotification = async (
  recipientId: string,
  message: string,
  options?: PushNotificationOptions
): Promise<void> => {
  if (!recipientId || !message) {
    console.warn('sendPushNotification: Missing recipientId or message');
    return;
  }

  // إذا كانت الدائرة مفصولة مؤقتاً بسبب انقطاع المسار الخارجي، نتجاوز الطلب فوراً دون استهلاك أي اتصال HTTP
  if (Date.now() < circuitBrokenUntil) {
    return;
  }

  try {
    // تحويل الرابط الكامل إلى مسار نسبي للتنقل الداخلي
    let internalPath = options?.url;
    if (internalPath && internalPath.startsWith('http')) {
      try {
        const urlObj = new URL(internalPath);
        internalPath = urlObj.pathname + urlObj.search + urlObj.hash;
      } catch { /* اتركها كما هي إذا فشل التحليل */ }
    }

    const payload = {
      recipientId,
      message,
      title: options?.title || 'إشعار جديد',
      url: undefined, 
      data: {
        ...options?.data,
        path: internalPath,
        type: options?.type 
      },
      isBuzz: options?.isBuzz,
      type: options?.type
    };

    // مهلة إجبارية بـ 1500ms لمنع حجز أي Socket في المتصفح في حال التأخير
    const { data, error } = await supabase.functions.invoke('send-notification', {
      body: payload,
      signal: AbortSignal.timeout(1500)
    });

    if (error || (data && (data as any).error)) {
      consecutiveFailures++;
      if (consecutiveFailures >= 2) {
        circuitBrokenUntil = Date.now() + 3 * 60 * 1000; // فصل الدائرة لـ 3 دقائق لحماية الأداء
        console.warn('PushService: Circuit breaker tripped. Pausing external push relay for 3m.');
      }
    } else {
      consecutiveFailures = 0;
      console.log('📬 Push notification sent successfully to', recipientId);
    }
  } catch (error) {
    consecutiveFailures++;
    if (consecutiveFailures >= 2) {
      circuitBrokenUntil = Date.now() + 3 * 60 * 1000;
    }
    console.warn('Failed to send push notification (Network):', error);
  }
};
