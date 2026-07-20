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

  const isLocalhost = typeof window !== 'undefined' && 
      (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

  if (isLocalhost) {
    console.log('📬 [Localhost Dev] Push notification blocked. Payload:', { recipientId, message, options });
    return;
  }

  try {
    const url = `/api/notify`;
    
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

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.warn('OneSignal API Relay Error:', response.status, errorData);
    } else {
      console.log('📬 Push notification sent successfully to', recipientId);
    }
  } catch (error) {
    console.warn('Failed to send push notification (Network):', error);
  }
};
