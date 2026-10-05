/**
 * kioskService.ts
 * ─────────────────────────────────────────────────────────────
 * طبقة البيانات الخاصة بكيوسك البصمة (نسخة الأجهزة اللوحية):
 *  - تفعيل الجهاز برمز مرتبط بموقع عمل مسجل (يُدخل مرة واحدة)
 *  - جلب موظفي البصمة (اسم، دوام اليوم، بصمات الوجه) عبر RPC محصّن
 *  - جلسة Supabase لحساب خدمة الكيوسك تُنشأ عند التفعيل وتُخزَّن محلياً
 * كل الاستدعاءات تتطلب (جلسة خدمة كيوسك + رمز تفعيل نشط) سيرفرياً.
 */

import { supabase } from '../../lib/supabase';

export interface KioskLocation {
  id: string;
  name: string;
  latitude?: number | null;
  longitude?: number | null;
}

export interface KioskDeviceInfo {
  device_id: string;
  name: string;
  /** الأقسام/الوحدات المرتبطة بالجهاز (قد يكون الموقع الواحد عدة أقسام وشعب) */
  locations: KioskLocation[];
}

export interface KioskEmployee {
  id: string;
  full_name: string;
  job_number: string | null;
  department_name: string | null;
  schedule_name: string | null;
  today_start: string | null;  // 'HH:MM:SS'
  today_end: string | null;
  today_rest: boolean;
  today_is_evening: boolean;
  today_is_night: boolean;
  face_descriptor: number[][]; // 3 مراجع × 128 بعداً
}

const STORAGE_KEY = 'kiosk_activation_v1';

export interface KioskActivation {
  code: string;
  device: KioskDeviceInfo;
}

/** قراءة التفعيل المحفوظ محلياً (إن وجد) */
export const getStoredActivation = (): KioskActivation | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.code && parsed?.device?.device_id) return parsed as KioskActivation;
    return null;
  } catch {
    return null;
  }
};

export const clearStoredActivation = () => {
  localStorage.removeItem(STORAGE_KEY);
};

const storeActivation = (activation: KioskActivation) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(activation));
};

/** تسجيل الدخول بحساب خدمة الكيوسك (يُدخله مسؤول الإدارة عند التفعيل) */
export const signInKioskAccount = async (email: string, password: string) => {
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
  if (error) {
    if (error.message?.toLowerCase().includes('invalid')) {
      throw new Error('بيانات حساب الخدمة غير صحيحة');
    }
    throw new Error('تعذر تسجيل الدخول لحساب الخدمة: ' + (error.message || 'خطأ غير معروف'));
  }
};

/**
 * التفعيل الكامل: دخول حساب الخدمة + التحقق من رمز التفعيل + الحفظ المحلي
 * كلمة السر لا تُخزَّن إطلاقاً — الجلسة يتولاها supabase-js محلياً.
 */
export const activateKiosk = async (code: string, email: string, password: string): Promise<KioskActivation> => {
  await signInKioskAccount(email, password);

  const { data, error } = await supabase.rpc('kiosk_activate', { p_code: code.trim().toUpperCase() });
  if (error) throw new Error('تعذر التحقق من رمز التفعيل: ' + error.message);
  const res = data as any;
  if (!res?.success) throw new Error(res?.message || 'رمز التفعيل غير صالح');

  const activation: KioskActivation = {
    code: code.trim().toUpperCase(),
    device: {
      device_id: res.device_id,
      name: res.name,
      locations: (res.locations || []).map((loc: any) => ({
        id: loc.id,
        name: loc.name,
        latitude: loc.latitude,
        longitude: loc.longitude
      }))
    }
  };
  storeActivation(activation);
  return activation;
};

/** جلب موظفي البصمة (يُستدعى دورياً لالتقاط التسجيلات الجديدة) */
export const fetchKioskEmployees = async (code: string): Promise<KioskEmployee[]> => {
  const { data, error } = await supabase.rpc('kiosk_get_employees', { p_code: code });
  if (error) throw new Error('تعذر جلب قائمة الموظفين: ' + error.message);
  const res = data as any;
  if (!res?.success) throw new Error(res?.message || 'فشل جلب الموظفين');
  return (res.employees || []) as KioskEmployee[];
};

/** نص موقع البصمة الثابت للكيوسك — كل الأقسام/الوحدات المرتبطة بالجهاز */
export const buildKioskLocationText = (device: KioskDeviceInfo): string => {
  const names = (device.locations || []).map(loc => loc.name);
  const namesLabel = names.length > 0 ? names.join(' / ') : 'أقسام غير محددة';
  const firstWithCoords = (device.locations || []).find(loc => loc.latitude != null && loc.longitude != null);
  const coords = firstWithCoords
    ? `${firstWithCoords.latitude!.toFixed(6)}, ${firstWithCoords.longitude!.toFixed(6)}`
    : 'إحداثيات غير مسجلة';
  return `${coords} - ${namesLabel} (كيوسك ثابت)`;
};

/** تحويل بصمات الوجه من jsonb إلى Float32Array جاهزة للمطابقة */
export const toDescriptorArrays = (json: number[][] | null | undefined): Float32Array[] => {
  if (!Array.isArray(json)) return [];
  return json
    .filter(d => Array.isArray(d) && d.length === 128)
    .map(d => new Float32Array(d));
};
