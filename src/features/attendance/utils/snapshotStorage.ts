import { createClient } from '@supabase/supabase-js';
import { supabaseUrl, supabaseAnonKey } from '../../../lib/supabase';

export interface SnapshotUploadResult {
  url: string | null;
  /** سبب فشل الرفع بالتفصيل — يُستخدم في ملاحظات البصمة للتشخيص */
  error?: string;
}

/**
 * عميل تخزين مخصص مثبَّت على مفتاح التطبيق (anon) دون أي جلسة مستخدم.
 * السبب: supabase-js يستبدل ترويسة Authorization برمز جلسة الموظف المسجَّل،
 * وخدمة التخزين على الخادم ترفض رموز المستخدمين بخطأ 500 Internal Server Error
 * بينما تقبل مفتاح التطبيق (مثبت بالاختبار: 200 عبر النطاق الرسمي).
 * هذا العميل لا يملك جلسة إطلاقاً فتبقى الترويسة على مفتاح التطبيق دائماً.
 */
const storageClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * رفع لقطة الكاميرا إلى حاوية attendance-snapshots على تخزين خادم الوزارة
 * (same-origin عبر khr-itpc.egov.iq/storage/v1) — تخزين محلي فقط بلا أي مسار خارجي:
 * بيئة الوزارة مقفلة خارجياً ولا يمكن اعتماد ممرات اتصال خارجية (حتى onesignal
 * معطلة بانتظار ممر أمني) — أي اعتماد على R2/Vercel غير موثوق رفعاً وعرضاً.
 * يعيد { url } عند النجاح أو { url: null, error } مع سبب مفصّل — لا يرمي استثناءات.
 */
export const uploadSnapshot = async (base64Data: string, prefix: string = 'snapshot'): Promise<SnapshotUploadResult> => {
  try {
    if (!base64Data) return { url: null, error: 'لا توجد بيانات صورة' };

    // تحليل صارم لصيغة data URL — اللوحات الفارغة ("data:,") تُرفض فوراً
    const match = /^data:(image\/[a-z+]+);base64,(.+)$/i.exec(base64Data);
    if (!match) return { url: null, error: 'صيغة الصورة غير صالحة' };
    if (match[2].length < 64) return { url: null, error: 'بيانات الصورة فارغة' };

    const contentType = match[1];
    const raw = window.atob(match[2]);
    if (raw.length < 32) return { url: null, error: 'محتوى الصورة فارغة' };

    const uInt8Array = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; ++i) uInt8Array[i] = raw.charCodeAt(i);
    const blob = new Blob([uInt8Array], { type: contentType });

    const timestamp = new Date().toISOString().replace(/[-:.]/g, '');
    const randomStr = Math.random().toString(36).substring(2, 8);
    const fileName = `${prefix}_${timestamp}_${randomStr}.webp`;

    // 3 محاولات تلقائية قبل تثبيت البصمة (إعادة المحاولة اليدوية تحسب بصمة جديدة)
    const MAX_ATTEMPTS = 3;
    let lastError: unknown = 'سبب غير معروف';
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const { data, error } = await storageClient.storage
        .from('attendance-snapshots')
        .upload(fileName, blob, { contentType: 'image/webp', upsert: true });

      if (!error) {
        const { data: publicUrlData } = storageClient.storage
          .from('attendance-snapshots')
          .getPublicUrl(data?.path || fileName);
        const publicUrl = publicUrlData?.publicUrl || null;
        return publicUrl
          ? { url: publicUrl }
          : { url: null, error: 'تعذر تركيب رابط الصورة العام' };
      }

      lastError = error;
      console.error(`Snapshot upload attempt ${attempt}/${MAX_ATTEMPTS} failed:`, error);
      // خطأ الصلاحيات أو الحاوية لا يتغير بالمحاولة — نكسر فوراً لتوفير الوقت
      const msg = String((error as any)?.message || error || '');
      if (/\b(401|403|404|unauthorized|invalid|jws|jwt|bucket|not found)\b/i.test(msg)) break;
      if (attempt < MAX_ATTEMPTS) await sleep(250 * attempt);
    }
    return { url: null, error: String((lastError as any)?.message || lastError).slice(0, 140) };
  } catch (error: any) {
    console.error('Snapshot upload exception:', error);
    return { url: null, error: String(error?.message || error).slice(0, 140) };
  }
};
