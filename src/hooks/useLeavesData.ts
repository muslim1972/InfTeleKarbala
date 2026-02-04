/**
 * Hook لكاش بيانات الإجازات
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { cacheManager } from '../cache/CacheManager';
import { getOptimalSettings } from '../cache/CacheConfig';

interface LeavesData {
    leavesList: any[];
    lifetimeUsage: { regular: number; sick: number };
}

/**
 * جلب بيانات الإجازات مع الكاش
 */
async function fetchLeavesData(userId: string, year: number): Promise<LeavesData> {
    const cacheKey = `leaves_${userId}_${year}`;

    // محاولة جلب من الكاش
    const cached = await cacheManager.get<LeavesData>(cacheKey);
    if (cached) {
        console.log('[useLeavesData] جلب من الكاش');
        return cached;
    }

    console.log('[useLeavesData] جلب من قاعدة البيانات...');

    // جلب الإجازات وإجمالي الاستخدام بالتوازي
    const [leavesResult, lifetimeResult] = await Promise.all([
        supabase
            .from('leaves_details')
            .select('*')
            .eq('user_id', userId)
            .eq('year', year)
            .order('start_date', { ascending: false }),

        supabase.rpc('get_lifetime_leaves_usage', { target_user_id: userId })
    ]);

    const data: LeavesData = {
        leavesList: leavesResult.data || [],
        lifetimeUsage: {
            regular: lifetimeResult.data?.total_regular_days || 0,
            sick: lifetimeResult.data?.total_sick_days || 0
        }
    };

    // حفظ في الكاش
    await cacheManager.set(cacheKey, data);

    return data;
}

/**
 * Hook لاستخدام بيانات الإجازات مع الكاش
 */
export function useLeavesData(userId: string | undefined, year: number) {
    const settings = getOptimalSettings();
    const queryClient = useQueryClient();

    const query = useQuery({
        queryKey: ['leavesData', userId, year],
        queryFn: () => fetchLeavesData(userId!, year),
        enabled: !!userId,
        staleTime: settings.staleTime,
        gcTime: settings.gcTime,
        refetchOnWindowFocus: false,
        retry: 2,
    });

    // دالة لإعادة التحميل
    const invalidateCache = async () => {
        if (userId) {
            await cacheManager.delete(`leaves_${userId}_${year}`);
            queryClient.invalidateQueries({ queryKey: ['leavesData', userId, year] });
        }
    };

    return {
        ...query,
        invalidateCache,
    };
}
