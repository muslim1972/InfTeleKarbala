/**
 * kioskService.ts
 * ─────────────────────────────────────────────────────────────
 * طبقة البيانات والخدمات الخاصة بأكشاك البصمة البيومترية:
 *  - عميل Supabase مستقل ومعزول كلياً (kioskSupabase) بمفتاح تخزين منفصل
 *    (kiosk_auth_token_isolated_v2) يمنع أي تعارض مع جلسة المشرف في تطبيق الإدارة الموحد
 *  - فحص النطاق الجغرافي الحقيقي لهاتف الطرفية (Terminal GPS Geofencing)
 *  - تطبيق التحقق الصارم من موقع الموظف المعتمد (Strict Employee Location Binding)
 *  - تشغيل المؤثرات الصوتية العراقية المخزنة محلياً (/audio/kiosk/)
 *  - تفعيل الجهاز برمز الكشك والتحقق البيومتري من وجه المشرف المخوّل
 *  - تسجيل البصمات مباشرة عبر حساب الخدمة وعزلها عن جلسات المتصفح الأخرى
 */

import { createClient } from '@supabase/supabase-js';
import { supabaseUrl, supabaseAnonKey } from '../../lib/supabase';
import { getServerNow } from '../attendance/services/serverTimeService';
import { categorizePunches, type RawPunch } from '../attendance/utils/punchCategorizer';
import { temporaryWorkHoursService } from '../attendance/services/temporaryWorkHoursService';
import { resolveEffectiveDutyWindows } from '../attendance/utils/shiftScheduleUtils';
import type { AttendanceRecord } from '../attendance/types';

/**
 * عميل Supabase مستقل ومعزول كلياً لأكشاك البصمة
 * يحمل جلسة حساب الخدمة المعتمد ولا يمس تخزين جلسات المستخدمين في التطبيق الموحد
 */
export const kioskSupabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
    storageKey: 'kiosk_auth_token_isolated_v2',
    lock: async (_name: string, _acquireTimeout: number, fn: () => Promise<any>) => await fn(),
  }
});

export interface KioskLocation {
  id: string;
  name: string;
  latitude?: number | null;
  longitude?: number | null;
  radius_meters?: number | null;
}

export interface KioskDeviceInfo {
  device_id: string;
  name: string;
  governorate?: string;
  activated_by_supervisor_name?: string | null;
  locations: KioskLocation[];
}

export interface KioskSupervisor {
  id: string;
  full_name: string;
  role_label: string;
  face_descriptor: number[][];
}

export interface KioskEmployee {
  id: string;
  full_name: string;
  job_number: string | null;
  department_name: string | null;
  dept_text: string | null;
  section_text: string | null;
  unit_text: string | null;
  governorate: string | null;
  assigned_location_ids: string[];
  schedule_name: string | null;
  today_start: string | null;  // 'HH:MM:SS'
  today_end: string | null;
  today_rest: boolean;
  today_is_evening: boolean;
  today_is_night: boolean;
  face_descriptor: number[][]; // 3 مراجع × 128 بعداً
}

export type KioskSound = 
  | 'punch_success' 
  | 'not_enrolled' 
  | 'punch_retry' 
  | 'cooldown' 
  | 'outside_location' 
  | 'supervisor_approved' 
  | 'supervisor_unauthorized' 
  | 'align_face';

let currentAudio: HTMLAudioElement | null = null;

/** تشغيل المقاطع الصوتية المحلية المجهزة مسبقاً بصوت عراقي هادئ */
export const playKioskAudio = (sound: KioskSound): Promise<void> => {
  return new Promise((resolve) => {
    try {
      if (currentAudio) {
        currentAudio.pause();
        currentAudio.currentTime = 0;
      }
      const audio = new Audio(`/audio/kiosk/${sound}.mp3`);
      currentAudio = audio;
      audio.onended = () => resolve();
      audio.onerror = () => resolve();
      audio.play().catch(() => resolve());
    } catch {
      resolve();
    }
  });
};

const STORAGE_KEY = 'kiosk_activation_v2';
const LEGACY_STORAGE_KEY = 'kiosk_activation_v1';

export const DEFAULT_KIOSK_EMAIL = 'kiosk.system@inftelekarbala.iq';
export const DEFAULT_KIOSK_PASSWORD = 'InfTele#KioskKarbala2026';

export interface KioskActivation {
  code: string;
  device: KioskDeviceInfo;
}

/** قراءة التفعيل المحفوظ محلياً (إن وجد) */
export const getStoredActivation = (): KioskActivation | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY);
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
  localStorage.removeItem(LEGACY_STORAGE_KEY);
};

export const storeActivation = (activation: KioskActivation) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(activation));
};

/** حساب المسافة الجغرافية بين نقطتين بالامتار عبر صيغة Haversine */
export const calculateKioskDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371e3; // نصف قطر الأرض بالمتر
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c);
};

export interface KioskGeofenceCheck {
  allowed: boolean;
  status: 'locating' | 'inside' | 'outside' | 'no_coords';
  nearestLoc: KioskLocation | null;
  distanceMeters: number | null;
  matchedLoc: KioskLocation | null;
  message: string;
}

/**
 * فحص السياج الجغرافي لهاتف الطرفية (Kiosk Terminal GPS)
 * يتحقق هل الجهاز الحالي موجود داخل حرم أي من المواقع المصرح بها لهذا الكشك
 */
export const evaluateKioskGeofence = (
  locations: KioskLocation[],
  userLat: number,
  userLon: number
): KioskGeofenceCheck => {
  const validLocs = (locations || []).filter(
    l => l.latitude != null && l.longitude != null && !isNaN(Number(l.latitude)) && !isNaN(Number(l.longitude))
  );

  if (validLocs.length === 0) {
    return {
      allowed: true,
      status: 'no_coords',
      nearestLoc: null,
      distanceMeters: null,
      matchedLoc: null,
      message: 'لم يتم ربط إحداثيات جغرافية لهذه الطرفية'
    };
  }

  let minDistance = Infinity;
  let nearestLoc: KioskLocation = validLocs[0];
  let matchedLoc: KioskLocation | null = null;

  for (const loc of validLocs) {
    const d = calculateKioskDistance(userLat, userLon, Number(loc.latitude), Number(loc.longitude));
    const radius = loc.radius_meters || 150;
    if (d < minDistance) {
      minDistance = d;
      nearestLoc = loc;
    }
    if (d <= radius) {
      matchedLoc = loc;
      break;
    }
  }

  if (matchedLoc) {
    return {
      allowed: true,
      status: 'inside',
      nearestLoc,
      distanceMeters: minDistance,
      matchedLoc,
      message: `الطرفية داخل نطاق العمل المصرح به (${matchedLoc.name})`
    };
  }

  return {
    allowed: false,
    status: 'outside',
    nearestLoc,
    distanceMeters: minDistance,
    matchedLoc: null,
    message: `الطرفية خارج نطاق العمل المصرح به (تبعد ${minDistance}م عن ${nearestLoc.name})`
  };
};

/**
 * تطبيق توجيه المدير: التحقق الصارم من ربط الموظف بموقع عمل الكشك (Strict Employee Location Binding)
 * إذا كان الموظف مسجلاً في موقع آخر غير مواقع هذا الكشك، يتم رفض البصمة قطعياً
 */
export const verifyEmployeeLocationBinding = (
  emp: KioskEmployee,
  deviceLocations: KioskLocation[]
): { allowed: boolean; reason?: string } => {
  const assigned = emp.assigned_location_ids || [];
  if (assigned.length === 0) {
    return {
      allowed: false,
      reason: 'لم يتم ربط حسابك بأي موقع عمل رسمي في النظام — يرجى مراجعة مسؤول البصمة'
    };
  }
  const kioskLocIds = (deviceLocations || []).map(l => l.id);
  const isMatch = kioskLocIds.some(id => assigned.includes(id));
  if (!isMatch) {
    return {
      allowed: false,
      reason: 'أنت خارج مقر عملك الرسمي المصرح به — لا يمكن تثبيت البصمة في هذا الموقع'
    };
  }
  return { allowed: true };
};

/** جلب المشرفين المخولين بتفعيل هذا الكشك للتحقق البيومتري من الوجه عبر عميل الكيوسك المعزول */
export const fetchAuthorizedSupervisors = async (code: string): Promise<KioskSupervisor[]> => {
  const cleanCode = code.trim().toUpperCase();
  const { data, error } = await kioskSupabase.rpc('kiosk_get_authorized_supervisors', { p_code: cleanCode });
  if (error) throw new Error('تعذر جلب المشرفين المخولين: ' + error.message);
  const res = data as any;
  if (!res?.success) throw new Error(res?.message || 'رمز التفعيل غير صالح');
  return (res.supervisors || []) as KioskSupervisor[];
};

/** تسجيل الدخول بحساب خدمة الكيوسك المعتمد داخل العميل المعزول */
export const signInKioskAccount = async (email = DEFAULT_KIOSK_EMAIL, password = DEFAULT_KIOSK_PASSWORD) => {
  const { error } = await kioskSupabase.auth.signInWithPassword({ email: email.trim(), password });
  if (error) {
    if (error.message?.toLowerCase().includes('invalid')) {
      throw new Error('بيانات حساب خدمة الطرفيات العامة غير متطابقة على الخادم');
    }
    throw new Error('تعذر تسجيل الدخول لحساب الخدمة: ' + (error.message || 'خطأ غير معروف'));
  }
};

/**
 * التفعيل الكامل: دخول حساب الخدمة + التحقق البيومتري من المشرف + تسجيل في قاعدة البيانات
 */
export const activateKiosk = async (
  code: string,
  supervisorId?: string,
  email = DEFAULT_KIOSK_EMAIL,
  password = DEFAULT_KIOSK_PASSWORD
): Promise<KioskActivation> => {
  await signInKioskAccount(email, password);

  const cleanCode = code.trim().toUpperCase();
  const { data, error } = await kioskSupabase.rpc('kiosk_activate', {
    p_code: cleanCode,
    p_supervisor_id: supervisorId || null
  });

  if (error) throw new Error('تعذر تفعيل الطرفية العامة: ' + error.message);
  const res = data as any;
  if (!res?.success) throw new Error(res?.message || 'رمز التفعيل غير صالح أو الجهاز موقوف');

  const activation: KioskActivation = {
    code: cleanCode,
    device: {
      device_id: res.device_id,
      name: res.name,
      governorate: res.governorate,
      activated_by_supervisor_name: res.activated_by_supervisor_name,
      locations: (res.locations || []).map((loc: any) => ({
        id: loc.id,
        name: loc.name,
        latitude: loc.latitude,
        longitude: loc.longitude,
        radius_meters: loc.radius_meters ?? 150
      }))
    }
  };

  storeActivation(activation);
  return activation;
};

/** جلب موظفي البصمة مفلترة بمحافظة الكيوسك مع مسارهم الإداري وجداولهم */
export const fetchKioskEmployees = async (code: string): Promise<KioskEmployee[]> => {
  const { data, error } = await kioskSupabase.rpc('kiosk_get_employees', { p_code: code.trim().toUpperCase() });
  if (error) throw new Error('تعذر جلب قائمة الموظفين: ' + error.message);
  const res = data as any;
  if (!res?.success) throw new Error(res?.message || 'فشل جلب الموظفين');
  return (res.employees || []) as KioskEmployee[];
};

/** نص موقع البصمة للكيوسك */
export const buildKioskLocationText = (device: KioskDeviceInfo, matchedLocName?: string): string => {
  const label = matchedLocName || (device.locations || []).map(l => l.name).join(' / ') || 'موقع معتمد';
  const firstWithCoords = (device.locations || []).find(loc => loc.latitude != null && loc.longitude != null);
  const coords = firstWithCoords
    ? `${firstWithCoords.latitude!.toFixed(6)}, ${firstWithCoords.longitude!.toFixed(6)}`
    : 'إحداثيات جغرافية';
  return `${coords} - ${label} (طرفية عامة)`;
};

/** تحويل بصمات الوجه من jsonb إلى Float32Array جاهزة للمطابقة البيومترية السريعة */
export const toDescriptorArrays = (json: number[][] | null | undefined): Float32Array[] => {
  if (!Array.isArray(json)) return [];
  return json
    .filter(d => Array.isArray(d) && d.length === 128)
    .map(d => new Float32Array(d));
};

const getBaghdadDateStr = (d: Date): string => {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Baghdad',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  return formatter.format(d);
};

/**
 * تنسيق الوقت المتبقي لمهلة الأمان باللغة العربية الفصحى السليمة
 */
export const formatRemainingCooldown = (seconds: number): string => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 3 && s === 0) return '3 دقائق';
  if (m === 2 && s === 0) return 'دقيقتان';
  if (m === 1 && s === 0) return 'دقيقة واحدة';
  if (m > 0 && s > 0) {
    const minText = m === 2 ? 'دقيقتان' : m === 1 ? 'دقيقة' : `${m} دقائق`;
    return `${minText} و ${s} ثانية`;
  }
  if (m > 0) return `${m} دقائق`;
  return `${s} ثانية`;
};

const localDayRangeUTC = (dateStr: string): { start: string; end: string } => {
  const [y, m, d] = dateStr.split('-').map(Number);
  const start = new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0) - (3 * 3600 * 1000));
  const end = new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999) - (3 * 3600 * 1000));
  return { start: start.toISOString(), end: end.toISOString() };
};

/**
 * تسجيل البصمة البيومترية للكشك عبر عميل kioskSupabase المعزول كلياً:
 *  - استخراج سجل اليوم للموظف
 *  - تصنيف البصمة وفق نظام الحضور/الانصراف الرسمي
 *  - استدعاء submit_attendance_record_secure بحساب خدمة الكيوسك (v_is_kiosk)
 *  - عدم المساس بأي جلسة للمستخدم الشخصي في التطبيق الرئيسي
 */
export const kioskRegisterPunch = async (
  emp: KioskEmployee,
  device: KioskDeviceInfo,
  code: string,
  snapshotUrl?: string,
  matchedLocationName?: string
): Promise<{ record: AttendanceRecord; prevRecord: AttendanceRecord | null }> => {
  const nowServer = getServerNow();
  const today = getBaghdadDateStr(nowServer);
  const range = localDayRangeUTC(today);

  // 1. جلب سجل اليوم إن وجد
  const { data: existingRecords, error: fetchErr } = await kioskSupabase
    .from('attendance_records')
    .select('*')
    .eq('employee_id', emp.id)
    .gte('created_at', range.start)
    .lte('created_at', range.end)
    .order('created_at', { ascending: false })
    .limit(1);

  if (fetchErr) {
    throw new Error('فشل جلب سجل اليوم: ' + fetchErr.message);
  }

  const prevRecord = ((existingRecords?.[0] as AttendanceRecord) || null);

  // 1.1 فحص مهلة الأمان الصارمة (180 ثانية / 3 دقائق) لمنع التكرار العرضي للبصمات
  if (prevRecord) {
    let latestPunchTimeMs = 0;
    if (Array.isArray(prevRecord.raw_punches) && prevRecord.raw_punches.length > 0) {
      for (const p of prevRecord.raw_punches) {
        if (p?.time) {
          const t = new Date(p.time).getTime();
          if (!isNaN(t) && t > latestPunchTimeMs) latestPunchTimeMs = t;
        }
      }
    }
    const cols = ['check_out', 'time_leave_return_2', 'time_leave_out_2', 'time_leave_return', 'time_leave_out', 'check_in'];
    for (const col of cols) {
      const val = (prevRecord as any)[col];
      if (val) {
        const t = new Date(val).getTime();
        if (!isNaN(t) && t > latestPunchTimeMs) latestPunchTimeMs = t;
      }
    }

    const COOLDOWN_SECONDS = 180; // 3 دقائق
    if (latestPunchTimeMs > 0) {
      const elapsedSeconds = Math.floor((nowServer.getTime() - latestPunchTimeMs) / 1000);
      if (elapsedSeconds < COOLDOWN_SECONDS) {
        const remainingSeconds = COOLDOWN_SECONDS - elapsedSeconds;
        const error: any = new Error(`COOLDOWN_ACTIVE:${remainingSeconds}`);
        error.code = 'COOLDOWN_ACTIVE';
        error.remainingSeconds = remainingSeconds;
        throw error;
      }
    }
  }

  // 2. تجميع قائمة البصمات الخام (raw_punches)
  let rawPunches: RawPunch[] = [];
  if (prevRecord && Array.isArray(prevRecord.raw_punches)) {
    rawPunches = [...prevRecord.raw_punches];
  }

  const newPunch: RawPunch = {
    time: nowServer.toISOString(),
    location: buildKioskLocationText(device, matchedLocationName),
    device_id: `kiosk-${code.replace('KSK-', '')}`,
    snapshot_url: snapshotUrl,
    notes: `بصمة عامة — ${device.name}`,
    verified_by_biometric: true
  };

  rawPunches.push(newPunch);

  // 3. تصنيف البصمات وفق قواعد الورديات وتزحيف ساعات الدوام
  const shiftType = (emp.today_is_night || emp.today_is_evening) ? 'shift' : 'morning';
  const effectiveHours = await temporaryWorkHoursService.getEffectiveWorkHoursForDate(
    today,
    (emp as any).governorate || device.governorate || 'karbala',
    kioskSupabase as any
  );
  const dutyWindows = resolveEffectiveDutyWindows(effectiveHours);
  const updates = categorizePunches(rawPunches, null, today, shiftType, false, false, dutyWindows);
  if (!updates.raw_punches || updates.raw_punches.length === 0) {
    updates.raw_punches = rawPunches;
  }
  updates.is_device_pending = false;

  if (!prevRecord) {
    updates.employee_id = emp.id;
    updates.department_id = (emp as any).department_id || null;
    updates.status = 'present';
  }

  // 4. حفظ البصمة في السيرفر عبر دالة RPC المحصنة
  const { data: savedData, error: saveErr } = await kioskSupabase.rpc('submit_attendance_record_secure', {
    p_employee_id: emp.id,
    p_record_id: prevRecord?.id || null,
    p_updates: updates
  });

  if (saveErr) {
    throw new Error('فشل تسجيل البصمة على السيرفر: ' + saveErr.message);
  }

  return {
    record: savedData as AttendanceRecord,
    prevRecord
  };
};
