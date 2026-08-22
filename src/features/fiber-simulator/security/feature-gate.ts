/**
 * ============================================================
 * بوابة الميزة — عزل التشغيل أثناء التطوير
 * ============================================================
 * 1) بوابة الحساب: الميزة تظهر حصرياً لحساب المطور (مسلم)
 *    إلى حين اكتمال الاختبار قبل الإطلاق للجميع.
 * 2) بوابة الشاشة: القسم يعمل على الحاسوب فقط — يُرفض التشغيل
 *    على الجوال/الشاشات اللمسية/الشاشات الأصغر من 7 بوصة.
 */

import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import type { AppUser } from '../../../context/AuthContext';

/** الرقم الوظيفي الموثق لحساب المطور */
export const DEVELOPER_JOB_NUMBER = '103130486';

/**
 * هل هذا حساب المطور؟ (مطابق للفحوص المعتمدة في بقية النظام)
 * يمنع تفعيل الميزة لأي حساب آخر خلال فترة التطوير.
 */
export function isDeveloperAccount(u: AppUser | null | undefined): boolean {
  if (!u) return false;
  if (u.admin_role === 'developer') return true;
  if (u.job_number === DEVELOPER_JOB_NUMBER) return true;
  const name = (u.full_name ?? '').trim();
  return name.includes('مسلم عقيل') || name.includes('مسلم قيل');
}

export interface ScreenCheck {
  ok: boolean;
  /** القطر التقديري للشاشة بالبوصة (افتراض 96dpi) */
  inches: number;
  /** سبب الرفض بالعربية — فارغ عند القبول */
  reasonAr: string;
}

/** القطر التقديري بالبوصة */
export function screenInches(): number {
  return Math.hypot(window.screen.width, window.screen.height) / 96;
}

/** فحص واحد للحظة الحالية — هل الشاشة مؤهلة لتشغيل المحاكي؟ */
export function checkDesktopScreen(): ScreenCheck {
  const inches = screenInches();
  if (Capacitor.isNativePlatform()) {
    return { ok: false, inches, reasonAr: 'هذا القسم يعمل على الحاسوب فقط ولا يتوفر داخل تطبيق الهاتف.' };
  }
  if (window.matchMedia('(pointer: coarse)').matches) {
    return { ok: false, inches, reasonAr: 'الجهاز الحالي يعمل باللمس الأساسي — استخدم حاسوباً بفأرة ولوحة مفاتيح.' };
  }
  if (!window.matchMedia('(min-width: 1280px)').matches) {
    return { ok: false, inches, reasonAr: 'عرض النافذة أقل من 1280 بكسل — كبّر النافذة إلى ملء الشاشة ثم أعد المحاولة.' };
  }
  if (inches < 7) {
    return {
      ok: false,
      inches,
      reasonAr: `قطر الشاشة التقديري ${inches.toFixed(1)}" أصغر من الحد الأدنى 7 بوصة المطلوب للعمل الاحترافي.`,
    };
  }
  return { ok: true, inches, reasonAr: '' };
}

/** فحص حي يتحدث تلقائياً عند تغيير حجم النافذة */
export function useScreenGate(): ScreenCheck {
  const [check, setCheck] = useState<ScreenCheck>(checkDesktopScreen);
  useEffect(() => {
    const onChange = () => setCheck(checkDesktopScreen());
    window.addEventListener('resize', onChange);
    return () => window.removeEventListener('resize', onChange);
  }, []);
  return check;
}
