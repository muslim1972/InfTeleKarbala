/**
 * Hook لكاش بيانات الموظف المالية والإدارية
 * يستخدم react-query للتحميل الذكي والكاش
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { cacheManager } from '../cache/CacheManager';
import { CACHE_CONFIG, getOptimalSettings } from '../cache/CacheConfig';

interface EmployeeFinancialData {
    financialData: any;
    adminData: any;
    yearlyData: any[];
}

/**
 * جلب البيانات المالية والإدارية للموظف مع الكاش
 */
async function fetchEmployeeData(userId: string): Promise<EmployeeFinancialData> {
    const cacheKey = `${CACHE_CONFIG.FINANCIAL_KEY}${userId}`;

    // محاولة جلب من الكاش أولاً
    const cached = await cacheManager.get<EmployeeFinancialData>(cacheKey);
    if (cached) {
        console.log('[useEmployeeData] جلب من الكاش');
        return cached;
    }

    console.log('[useEmployeeData] جلب من قاعدة البيانات...');

    // جلب كل البيانات بالتوازي
    const [financialResult, adminResult, yearlyResult] = await Promise.all([
        supabase
            .from('financial_records')
            .select('*')
            .eq('user_id', userId)
            .order('updated_at', { ascending: false })
            .limit(1)
            .maybeSingle(),

        supabase
            .from('administrative_summary')
            .select('*')
            .eq('user_id', userId)
            .maybeSingle(),

        supabase
            .from('yearly_records')
            .select('*')
            .eq('user_id', userId)
    ]);

    const data: EmployeeFinancialData = {
        financialData: financialResult.data || { user_id: userId, nominal_salary: 0 },
        adminData: adminResult.data || null,
        yearlyData: yearlyResult.data || []
    };

    // حفظ في الكاش
    await cacheManager.set(cacheKey, data);

    return data;
}

/**
 * Hook لاستخدام بيانات الموظف مع الكاش
 */
export function useEmployeeData(userId: string | undefined) {
    const settings = getOptimalSettings();
    const queryClient = useQueryClient();

    const query = useQuery({
        queryKey: ['employeeData', userId],
        queryFn: () => fetchEmployeeData(userId!),
        enabled: !!userId,
        staleTime: settings.staleTime,
        gcTime: settings.gcTime,
        refetchOnWindowFocus: settings.refetchOnWindowFocus,
        retry: 2,
    });

    // دالة لإعادة التحميل من الخادم
    const invalidateCache = async () => {
        if (userId) {
            await cacheManager.delete(`${CACHE_CONFIG.FINANCIAL_KEY}${userId}`);
            queryClient.invalidateQueries({ queryKey: ['employeeData', userId] });
        }
    };

    return {
        ...query,
        invalidateCache,
    };
}
