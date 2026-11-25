/**
 * temporaryWorkHoursService.ts
 * خدمة إدارة تعديلات ساعات الدوام المؤقتة، ذاكرة الجهات المصدرة للكتب،
 * ومسار اعتماد السيد مدير المديرية (FE-ATT-01).
 */

import { supabase } from '../../../lib/supabase';
import { normalizeHHMM, type EffectiveWorkHours } from '../utils/shiftScheduleUtils';

export interface TemporaryWorkHourOverride extends EffectiveWorkHours {
  id: string;
  governorate: string;
  book_number: string;
  book_date: string;
  issuing_entity: string;
  status: 'pending_director' | 'approved';
  pending_revision?: {
    start_date: string;
    end_date: string;
    morning_start: string;
    morning_end: string;
    evening_start: string;
    evening_end: string;
    night_start: string;
    night_end: string;
    book_number: string;
    book_date: string;
    issuing_entity: string;
    requested_by?: string;
    requester_name?: string;
    requested_at?: string;
  } | null;
  created_by: string;
  approved_by?: string | null;
  approved_at?: string | null;
  updated_by?: string | null;
  created_at: string;
  updated_at: string;
  creator_profile?: { full_name?: string | null } | null;
}

export interface SaveWorkHoursPayload {
  overrideId?: string | null;
  governorate: string;
  startDate: string;
  endDate: string;
  morningStart: string;
  morningEnd: string;
  eveningStart: string;
  eveningEnd: string;
  nightStart: string;
  nightEnd: string;
  bookNumber: string;
  bookDate: string;
  issuingEntity: string;
}

// كاش سريع في الذاكرة لمدة قصيرة (60 ثانية) لتفادي تكرار الاستعلامات عند حساب كشوفات عشرات الموظفين
const effectiveCache = new Map<string, { fetchedAt: number; data: EffectiveWorkHours | null }>();
const CACHE_TTL_MS = 60 * 1000;

export function invalidateEffectiveWorkHoursCache() {
  effectiveCache.clear();
}

export const temporaryWorkHoursService = {
  /**
   * جلب جميع سجلات تعديل ساعات الدوام المؤقتة لمحافظة محددة
   */
  async listOverrides(governorate: string = 'karbala'): Promise<TemporaryWorkHourOverride[]> {
    const { data, error } = await supabase
      .from('temporary_work_hour_overrides')
      .select(`
        *,
        creator_profile:profiles!temporary_work_hour_overrides_created_by_fkey(full_name)
      `)
      .eq('governorate', governorate || 'karbala')
      .order('start_date', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []) as TemporaryWorkHourOverride[];
  },

  /**
   * جلب قائمة الجهات المصدرة المحفوظة في الذاكرة للفلترة التلقائية
   */
  async listIssuingEntities(governorate: string = 'karbala'): Promise<string[]> {
    const { data, error } = await supabase
      .from('work_hour_issuing_entities')
      .select('name')
      .eq('governorate', governorate || 'karbala')
      .order('name', { ascending: true });

    if (error) {
      console.warn('Error loading issuing entities:', error);
      return [];
    }
    return (data || []).map((r: any) => r.name).filter(Boolean);
  },

  /**
   * جلب الأوقات القياسية العامة للصباحي والمسائي والخفر من جداول العمل الدائمة
   */
  async getBaseShiftDefaults(): Promise<{
    morningStart: string;
    morningEnd: string;
    eveningStart: string;
    eveningEnd: string;
    nightStart: string;
    nightEnd: string;
  }> {
    const defaults = {
      morningStart: '08:00',
      morningEnd: '15:00',
      eveningStart: '14:30',
      eveningEnd: '20:00',
      nightStart: '20:00',
      nightEnd: '08:00',
    };

    try {
      const { data } = await supabase
        .from('work_schedules')
        .select('id, name, type, is_default, days:work_schedule_days(day_of_week, start_time, end_time, is_rest_day)')
        .eq('type', 'fixed');

      if (data && data.length > 0) {
        const morningSched = data.find((s: any) => s.is_default || s.name?.includes('صباحي'));
        const eveningSched = data.find((s: any) => s.name?.includes('مسائي'));
        const nightSched = data.find((s: any) => s.name?.includes('خفر'));

        const mDay = morningSched?.days?.find((d: any) => !d.is_rest_day && d.start_time && d.end_time);
        if (mDay) {
          defaults.morningStart = normalizeHHMM(mDay.start_time, '08:00');
          defaults.morningEnd = normalizeHHMM(mDay.end_time, '15:00');
        }

        const eDay = eveningSched?.days?.find((d: any) => !d.is_rest_day && d.start_time && d.end_time);
        if (eDay) {
          defaults.eveningStart = normalizeHHMM(eDay.start_time, '14:30');
          defaults.eveningEnd = normalizeHHMM(eDay.end_time, '20:00');
        }

        const nDay = nightSched?.days?.find((d: any) => !d.is_rest_day && d.day_of_week !== 4 && d.start_time && d.end_time)
          || nightSched?.days?.find((d: any) => !d.is_rest_day && d.start_time && d.end_time);
        if (nDay) {
          defaults.nightStart = normalizeHHMM(nDay.start_time, '20:00');
          defaults.nightEnd = normalizeHHMM(nDay.end_time, '08:00');
        }
      }
    } catch (err) {
      console.warn('Error fetching base shift defaults:', err);
    }

    return defaults;
  },

  /**
   * جلب الأمر المعتمد الساري لتاريخ معين ومحافظة معينة (مع تخزين مؤقت سريع)
   * يقبل client اختياري لدعم الجلسة المعزولة في الكشك (kioskSupabase)
   */
  async getEffectiveWorkHoursForDate(
    dateStr: string,
    governorate: string = 'karbala',
    client: typeof supabase = supabase
  ): Promise<EffectiveWorkHours | null> {
    if (!dateStr) return null;
    const gov = governorate || 'karbala';
    const key = `${gov}|${dateStr}`;
    const cached = effectiveCache.get(key);
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
      return cached.data;
    }

    try {
      const { data, error } = await client
        .from('temporary_work_hour_overrides')
        .select('id, governorate, start_date, end_date, morning_start, morning_end, evening_start, evening_end, night_start, night_end, book_number, book_date, issuing_entity')
        .eq('governorate', gov)
        .eq('status', 'approved')
        .lte('start_date', dateStr)
        .gte('end_date', dateStr)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.warn('getEffectiveWorkHoursForDate error:', error);
        return null;
      }

      const result = (data as EffectiveWorkHours) || null;
      effectiveCache.set(key, { fetchedAt: Date.now(), data: result });
      return result;
    } catch (err) {
      console.warn('getEffectiveWorkHoursForDate exception:', err);
      return null;
    }
  },

  /**
   * جلب كافة الأوامر المعتمدة المتداخلة مع شهر كامل (مفيدة لشاشة Timesheets دفعة واحدة بدون استعلام لكل يوم)
   */
  async listApprovedOverridesForRange(
    fromDate: string,
    toDate: string,
    governorate: string = 'karbala'
  ): Promise<EffectiveWorkHours[]> {
    const gov = governorate || 'karbala';
    const { data, error } = await supabase
      .from('temporary_work_hour_overrides')
      .select('id, governorate, start_date, end_date, morning_start, morning_end, evening_start, evening_end, night_start, night_end, book_number, book_date, issuing_entity')
      .eq('governorate', gov)
      .eq('status', 'approved')
      .lte('start_date', toDate)
      .gte('end_date', fromDate)
      .order('updated_at', { ascending: false });

    if (error) {
      console.warn('listApprovedOverridesForRange error:', error);
      return [];
    }
    return (data || []) as EffectiveWorkHours[];
  },

  /**
   * التحقق من كون المستخدم الحالي هو مدير المديرية لهذه المحافظة
   */
  async checkIsGovernorateDirector(governorate: string = 'karbala'): Promise<boolean> {
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData?.user?.id;
    if (!uid) return false;
    const { data, error } = await supabase.rpc('is_governorate_director', {
      p_user_id: uid,
      p_governorate: governorate || 'karbala',
    });
    if (error) return false;
    return Boolean(data);
  },

  /**
   * حفظ أو تعديل أمر ساعات الدوام المؤقتة عبر RPC المحصنة
   */
  async saveOverride(payload: SaveWorkHoursPayload): Promise<{
    success: boolean;
    id: string;
    status: 'approved' | 'pending_director';
    direct_execution: boolean;
    message: string;
  }> {
    const ensureTime = (t: string) => (t.length === 5 ? `${t}:00` : t);

    const { data, error } = await supabase.rpc('save_temporary_work_hour_override', {
      p_override_id: payload.overrideId || null,
      p_governorate: payload.governorate || 'karbala',
      p_start_date: payload.startDate,
      p_end_date: payload.endDate,
      p_morning_start: ensureTime(payload.morningStart),
      p_morning_end: ensureTime(payload.morningEnd),
      p_evening_start: ensureTime(payload.eveningStart),
      p_evening_end: ensureTime(payload.eveningEnd),
      p_night_start: ensureTime(payload.nightStart),
      p_night_end: ensureTime(payload.nightEnd),
      p_book_number: payload.bookNumber.trim(),
      p_book_date: payload.bookDate,
      p_issuing_entity: payload.issuingEntity.trim(),
    });

    if (error) throw new Error(error.message);
    invalidateEffectiveWorkHoursCache();
    return data as any;
  },

  /**
   * استجابة السيد مدير المديرية (موافقة أو رفض) على طلب تعديل ساعات الدوام
   */
  async respondToOverride(
    overrideId: string,
    decision: 'approve' | 'reject',
    notificationId?: string
  ): Promise<{ success: boolean; decision: 'approve' | 'reject'; message: string }> {
    const { data, error } = await supabase.rpc('respond_temporary_work_hour_override', {
      p_override_id: overrideId,
      p_decision: decision,
      p_notification_id: notificationId || null,
    });

    if (error) throw new Error(error.message);
    invalidateEffectiveWorkHoursCache();
    return data as any;
  },
};
