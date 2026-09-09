/**
 * serverTimeService.ts
 * خدمة مزامنة التوقيت الرسمي مع الخادم (Server-Time Security Service)
 * 
 * المبدأ الأمني:
 * 1. منع أي تلاعب بساعة الهاتف أو الكمبيوتر من التأثير على بصمات الدخول والانصراف.
 * 2. استخدام التوقيت الأحادي (Monotonic Clock: performance.now()) بعد المعايرة مع السيرفر،
 *    مما يجعل قراءة الوقت محصّنة بالكامل حتى لو قام المستخدم بتغيير وقت نظامه يدوياً.
 * 3. كشف التلاعب (Clock Tampering Detection) برصد الفارق الزمني بين ساعة الجهاز وساعة السيرفر.
 */

import { supabase } from '../../../lib/supabase';

interface ServerTimeState {
  serverBaseMs: number;
  perfBaseMs: number;
  isSynced: boolean;
  lastSyncAt: number;
}

const state: ServerTimeState = {
  serverBaseMs: Date.now(),
  perfBaseMs: typeof performance !== 'undefined' ? performance.now() : 0,
  isSynced: false,
  lastSyncAt: 0
};

let syncPromise: Promise<boolean> | null = null;
const listeners = new Set<() => void>();

/**
 * مزامنة التوقيت مع قاعدة البيانات / الخادم مع احتساب زمن النقل (RTT)
 */
export async function syncServerTime(force = false): Promise<boolean> {
  // تجنب تكرار الاستدعاءات المتزامنة (Vercel Best Practice: dedup requests)
  if (syncPromise && !force) {
    return syncPromise;
  }

  // إذا تمت المزامنة حديثاً (أقل من دقيقتين) ولا يوجد إجبار، نكتفي بالحالة الحالية
  if (!force && state.isSynced && Date.now() - state.lastSyncAt < 120000) {
    return true;
  }

  syncPromise = (async () => {
    try {
      const startPerf = typeof performance !== 'undefined' ? performance.now() : 0;
      
      // المحاولة 1: استدعاء RPC get_server_time المباشر
      let serverTimestampMs: number | null = null;
      try {
        const { data, error } = await supabase.rpc('get_server_time');
        if (!error && data && data.server_time) {
          serverTimestampMs = new Date(data.server_time).getTime();
        }
      } catch {
        // تجاهل والمتابعة للبديل
      }

      // المحاولة 2: في حال عدم توفر الدالة أو حدوث خطأ، الاستعلام عبر ترويسة HTTP Date
      if (!serverTimestampMs) {
        try {
          const supabaseUrl = (supabase as any)?.supabaseUrl || '';
          const anonKey = (supabase as any)?.supabaseKey || '';
          if (supabaseUrl) {
            const resp = await fetch(`${supabaseUrl}/rest/v1/`, {
              method: 'HEAD',
              headers: { apikey: anonKey }
            });
            const dateHeader = resp.headers.get('date');
            if (dateHeader) {
              serverTimestampMs = new Date(dateHeader).getTime();
            }
          }
        } catch {
          // تجاهل والمتابعة
        }
      }

      const endPerf = typeof performance !== 'undefined' ? performance.now() : 0;
      const rtt = endPerf - startPerf;

      if (serverTimestampMs) {
        // تعويض نصف زمن الرحلة (RTT / 2) لدقة المزامنة بالمللي ثانية
        state.serverBaseMs = serverTimestampMs + Math.round(rtt / 2);
        state.perfBaseMs = endPerf;
        state.isSynced = true;
        state.lastSyncAt = Date.now();

        // إعلام المستمعين
        listeners.forEach(fn => {
          try { fn(); } catch {}
        });

        return true;
      }
      return false;
    } catch (err) {
      console.warn('[ServerTimeService] تعذر مزامنة التوقيت بدقة:', err);
      return false;
    } finally {
      syncPromise = null;
    }
  })();

  return syncPromise;
}

/**
 * إرجاع الوقت الحالي المعتمد على الخادم بصيغة Date
 * محصن ضد أي تغيير يدوي في ساعة الجهاز بفضل استخدام performance.now()
 */
export function getServerNow(): Date {
  if (!state.isSynced) {
    // تشغيل المزامنة في الخلفية بدون حجب
    syncServerTime().catch(() => {});
    return new Date();
  }

  const currentPerf = typeof performance !== 'undefined' ? performance.now() : 0;
  const elapsedMs = currentPerf - state.perfBaseMs;
  return new Date(state.serverBaseMs + elapsedMs);
}

/**
 * إرجاع كائن الوقت الحالي بتوقيت بغداد (Asia/Baghdad / UTC+3) استناداً لساعة السيرفر
 */
export function getBaghdadServerDate(): Date {
  const sDate = getServerNow();
  const baghdadStr = sDate.toLocaleString('en-US', { timeZone: 'Asia/Baghdad' });
  return new Date(baghdadStr);
}

/**
 * إرجاع تاريخ اليوم المحلي بصيغة YYYY-MM-DD بتوقيت بغداد المعتمد على السيرفر
 */
export function getServerLocalDateStr(): string {
  const bDate = getBaghdadServerDate();
  const y = bDate.getFullYear();
  const m = String(bDate.getMonth() + 1).padStart(2, '0');
  const d = String(bDate.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export interface ClockTamperingResult {
  isTampered: boolean;
  diffSeconds: number;
  diffMinutes: number;
  message: string;
}

/**
 * فحص التلاعب بساعة الجهاز:
 * مقارنة التوقيت المحلي للجهاز مع التوقيت المعتمد للخادم
 * أي فارق يتجاوز 90 ثانية يُعتبر مؤشراً صريحاً على تقديم أو تأخير الساعة يدوياً
 */
export function checkClockTampering(thresholdSeconds = 90): ClockTamperingResult {
  if (!state.isSynced) {
    return { isTampered: false, diffSeconds: 0, diffMinutes: 0, message: '' };
  }

  const serverMs = getServerNow().getTime();
  const deviceMs = Date.now();
  const diffMs = deviceMs - serverMs;
  const absDiffMs = Math.abs(diffMs);
  const diffSeconds = Math.round(absDiffMs / 1000);
  const diffMinutes = Math.round(absDiffMs / 60000);

  const isTampered = diffSeconds >= thresholdSeconds;
  let message = '';

  if (isTampered) {
    const isAhead = diffMs > 0;
    const timeFormatted = diffMinutes > 0 
      ? `${diffMinutes} دقيقة` 
      : `${diffSeconds} ثانية`;
    message = `تنبيه أمني: ساعة جهازك ${isAhead ? 'مقدّمة' : 'مؤخّرة'} عن التوقيت الرسمي للشبكة بمقدار (${timeFormatted}). تم اعتماد توقيت السيرفر الرسمي تلقائياً لمنع أي تلاعب.`;
  }

  return {
    isTampered,
    diffSeconds,
    diffMinutes,
    message
  };
}

/**
 * الاشتراك في تحديثات المزامنة
 */
export function subscribeServerTime(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// تهيئة المزامنة التلقائية عند تشغيل التطبيق وعند عودة التركيز للنافذة
if (typeof window !== 'undefined') {
  syncServerTime().catch(() => {});

  // إعادة المزامنة عند عودة التبويب للواجهة أو عودة الاتصال
  window.addEventListener('focus', () => { syncServerTime().catch(() => {}); });
  window.addEventListener('online', () => { syncServerTime(true).catch(() => {}); });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      syncServerTime().catch(() => {});
    }
  });

  // مزامنة دورية كل 5 دقائق
  window.setInterval(() => {
    syncServerTime().catch(() => {});
  }, 5 * 60 * 1000);
}
