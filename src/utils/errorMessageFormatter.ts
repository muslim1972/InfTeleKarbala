/**
 * errorMessageFormatter.ts
 * ─────────────────────────────────────────────────────────
 * وحدة معالجة وتنسيق رسائل الأخطاء وتحويل الأخطاء البرمجية
 * المعقدة إلى رسائل عربية دقيقة وواضحة للمستخدم.
 */

export function formatArabicErrorMessage(err: any, fallbackMessage = 'حدث خطأ أثناء تنفيذ العملية، يرجى المحاولة لاحقاً'): string {
  if (!err) return fallbackMessage;

  // استخراج نص الخطأ من مختلف هياكل الكائنات
  let msg = '';
  if (typeof err === 'string') {
    msg = err;
  } else if (err?.message) {
    msg = String(err.message);
  } else if (err?.details) {
    msg = String(err.details);
  } else if (err?.error_description) {
    msg = String(err.error_description);
  } else {
    try {
      msg = JSON.stringify(err);
    } catch {
      msg = String(err);
    }
  }

  // 1. أخطاء الكاميرا والفيديو
  if (/NotAllowedError|PermissionDeniedError|permission denied/i.test(msg)) {
    return 'تم رفض إذن استخدام الكاميرا. يرجى السماح للمتصفح بالوصول للكاميرا من إعدادات الموقع.';
  }
  if (/NotFoundError|DevicesNotFoundError/i.test(msg)) {
    return 'لم يتم العثور على كاميرا متصلة بهذا الجهاز.';
  }
  if (/NotReadableError|TrackStartError|Could not start video source/i.test(msg)) {
    return 'الكاميرا مستخدمة حالياً من قبل تطبيق آخر. يرجى إغلاق التطبيقات الأخرى وإعادة المحاولة.';
  }
  if (/OverconstrainedError|ConstraintNotSatisfiedError/i.test(msg)) {
    return 'دقة الكاميرا المطلوبة غير مدعومة في هذا الجهاز.';
  }

  // 2. أخطاء الشبكة والاتصال بالسيرفر
  if (/Failed to fetch|NetworkError|ENOTFOUND|ECONNREFUSED|network|fetch failed|Offline/i.test(msg)) {
    return 'تعذر الاتصال بالسيرفر. يرجى التأكد من تشغيل الـ VPN وجودة الاتصال بالشبكة.';
  }

  // 3. أخطاء قاعدة البيانات والـ Schema
  if (/Could not find the '.*' column/i.test(msg) || /schema cache/i.test(msg)) {
    return 'تم تحديث حقول قاعدة البيانات بالسيرفر بنجاح. يرجى إعادة المحاولة الآن.';
  }
  if (/duplicate key|already exists|unique constraint/i.test(msg)) {
    return 'السجل مُدخل مسبقاً في النظام ولا يمكن تكراره.';
  }
  if (/foreign key constraint|violates foreign key/i.test(msg)) {
    return 'فشلت العملية لارتباط هذا السجل ببيانات أخرى في النظام.';
  }
  if (/JWT|unauthorized|invalid claim|401|token expired/i.test(msg)) {
    return 'انتهت جلسة تسجيل الدخول. يرجى إعادة تسجيل الدخول للنظام.';
  }
  if (/row-level security|RLS|permission denied for table/i.test(msg)) {
    return 'ليس لديك الصلاحية الكافية لتنفيذ هذه العملية.';
  }

  // 4. أخطاء الـ GPS والموقع الجغرافي
  if (/Geolocation|GPS|Only secure origins|PERMISSION_DENIED|User denied Geolocation/i.test(msg)) {
    return 'تعذر تحديد الموقع الجغرافي. يرجى التأكد من تفعيل الـ GPS والرابط الآمن (HTTPS).';
  }

  // 5. أخطاء الذكاء الاصطناعي وبصمة الوجه
  if (/Models not loaded/i.test(msg)) {
    return 'جاري تحميل نماذج الذكاء الاصطناعي... يرجى الانتظار ثوانٍ قليلة.';
  }
  if (/face_descriptor/i.test(msg)) {
    return 'بيانات بصمة الوجه غير صالحة، يرجى إعادة تسجيل الوجه.';
  }

  // إذا كانت الرسالة بالعربية أصلاً ولا تحتوي على مصطلحات تقنية إنكليزية
  if (/[\u0600-\u06FF]/.test(msg) && !/Error|Failed|column|schema|fetch|PGRST/i.test(msg)) {
    return msg;
  }

  return fallbackMessage;
}
