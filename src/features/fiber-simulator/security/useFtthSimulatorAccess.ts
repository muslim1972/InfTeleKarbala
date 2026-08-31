/**
 * ============================================================
 * خطاف الوصول إلى محاكي FTTH — قراءة صلاحية ftth_simulator
 * ============================================================
 * - المطور: مُسمّى فوراً دون أي نداء شبكي (حالة ابتدائية محسوبة).
 * - غير المطور: نداء RPC واحد (get_ftth_simulator_access) يعيد
 *   { permission_levels, user_granted } — مستويات صلاحيات الحقول
 *   إضافة إلى المنح الفردية (جدول field_user_permissions)، مع كاش
 *   جلسة قصير (60 ثانية) كي لا يتكرر النداء عند كل فتح لتبويب
 *   «عزز معلوماتك»، ويُطبَّق أي منح جديد خلال دقيقة كحد أقصى.
 * - الوصول: منح فردي صريح، أو انتماء المستخدم لأحد المستويات
 *   المصرّح بها. كل إخفاق شبكي أو غياب للسجل يعني الإخفاء
 *   (fail-closed).
 */

import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../context/AuthContext';
import {
  evaluateFtthAccess,
} from './ftthAccess';
import { isDeveloperAccount } from './feature-gate';

export interface FtthAccessState {
  /** هل يُعرض المحاكي لهذا المستخدم؟ */
  allowed: boolean;
  /** قيد جلب الصلاحية — تُخفى البطاقة حتى الحسم (fail-closed) */
  checking: boolean;
}

/** كاش جلسة لكل مستخدم — يمنع تكرار النداء عند تنقّل التبويبات */
const CACHE_TTL_MS = 60_000;
const accessCache = new Map<string, { allowed: boolean; fetchedAt: number }>();

function cachedDecision(userId: string): boolean | null {
  const hit = accessCache.get(userId);
  if (hit && Date.now() - hit.fetchedAt < CACHE_TTL_MS) return hit.allowed;
  return null;
}

export function useFtthSimulatorAccess(): FtthAccessState {
  const { user } = useAuth();
  const isDeveloper = isDeveloperAccount(user);

  const [state, setState] = useState<FtthAccessState>(() => {
    if (!user) return { allowed: false, checking: false };
    if (isDeveloper) return { allowed: true, checking: false };
    const cached = cachedDecision(user.id);
    if (cached !== null) return { allowed: cached, checking: false };
    return { allowed: false, checking: true };
  });

  useEffect(() => {
    /* المطور أو غياب المستخدم: حُسم في الحالة الابتدائية */
    if (!user || isDeveloper) return;

    /* الزائر بلا جلسة Supabase أصلاً — مرفوض بلا نداء */
    if (user.role === 'visitor') {
      setState({ allowed: false, checking: false });
      return;
    }

    /* كاش سارٍ → قرار فوري بلا شبكة */
    const cached = cachedDecision(user.id);
    if (cached !== null) {
      setState({ allowed: cached, checking: false });
      return;
    }

    let cancelled = false;
    setState({ allowed: false, checking: true });

    (async () => {
      try {
        /* القراءة عبر دالة RPC معزولة (SECURITY DEFINER) تتجاوز RLS:
         * سياسات field_permissions وfield_user_permissions صارمة
         * (للمطور فقط)، فالقراءة المباشرة للجدولين تعود فارغة لغير
         * المطور حتى مع المنح. الدالة تُعيد للمصادقين فقط:
         * { permission_levels: number[], user_granted: boolean } */
        const { data, error } = await supabase.rpc(
          'get_ftth_simulator_access'
        );

        if (cancelled) return;

        /* المنح الفردي صريح → مسموح؛ وإلا يُقيَّم انتماء المستخدم
         * للمستويات المصرّح بها. أي خطأ شبكي/RLS → رفض (fail-closed). */
        const payload =
          data && typeof data === 'object'
            ? (data as { permission_levels?: unknown; user_granted?: unknown })
            : null;
        const levels = Array.isArray(payload?.permission_levels)
          ? (payload!.permission_levels as number[])
          : null;
        const allowed =
          !error &&
          (payload?.user_granted === true ||
            evaluateFtthAccess(
              user,
              levels ? { permission_levels: levels } : null
            ));
        accessCache.set(user.id, { allowed, fetchedAt: Date.now() });
        setState({ allowed, checking: false });
      } catch {
        if (!cancelled) setState({ allowed: false, checking: false });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user, isDeveloper]);

  return state;
}
