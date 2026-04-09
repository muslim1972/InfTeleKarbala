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

import { Capacitor } from '@capacitor/core';

// الرابط الأساسي للـ API في نسخة الـ APK لضمان الوصول للسيرفر من خارج localhost
const PROD_API_URL = 'https://inf-tele-karbala.vercel.app';

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

  // تحديد ما إذا كان التطبيق يعمل كـ Native (APK)
  const isNative = Capacitor.isNativePlatform();

  // السماح بالإشعارات في حالة الـ APK حتى لو كان العنوان localhost
  const isLocalhost = typeof window !== 'undefined' && 
      (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

  if (isLocalhost && !isNative) {
    console.log('📬 [Localhost Dev] Push notification blocked. Payload:', { recipientId, message, options });
    return;
  }

  try {
    const baseUrl = isNative ? PROD_API_URL : '';
    const url = `${baseUrl}/api/notify`;
    
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
        path: internalPath // نضع المسار هنا ليتم التعامل معه برمجياً
      },
      isBuzz: options?.isBuzz
    };

    if (isNative) {
      // استخدام CapacitorHttp لتخطي قيود CORS في الـ APK
      const { CapacitorHttp } = await import('@capacitor/core');
      const response = await CapacitorHttp.post({
        url,
        headers: { 'Content-Type': 'application/json' },
        data: payload
      });

      if (response.status >= 300) {
        console.warn('OneSignal API Relay Error (Native):', response.status, response.data);
      } else {
        console.log('📬 Push notification sent successfully to', recipientId);
      }
    } else {
      // استخدام fetch التقليدي في المتصفح (PWA)
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
    }
  } catch (error) {
    // Network errors or other unexpected exceptions
    console.warn('Failed to send push notification (Network/CORS):', error);
  }
};
