/**
 * Hook لكاش محتوى الإعلام (التوجيهات والنشاطات)
 * محسّن - جميع الاستعلامات بالتوازي
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { cacheManager } from '../cache/CacheManager';
import { CACHE_CONFIG, getOptimalSettings } from '../cache/CacheConfig';

interface MediaContent {
    directive: { id: string; content: string } | null;
    conference: { id: string; content: string } | null;
    isDirectiveAcknowledged: boolean;
}

/**
 * جلب محتوى الإعلام مع الكاش - نسخة محسّنة
 */
async function fetchMediaContent(userId: string): Promise<MediaContent> {
    const cacheKey = `${CACHE_CONFIG.MEDIA_CONTENT_KEY}_${userId}`;

    // محاولة جلب من الكاش أولاً
    const cached = await cacheManager.get<MediaContent>(cacheKey);
    if (cached) {
        console.log('[useMediaContent] ✅ جلب من الكاش');
        return cached;
    }

    console.log('[useMediaContent] 📡 جلب من قاعدة البيانات...');
    const startTime = Date.now();

    // جلب كل شيء بالتوازي (أسرع بكثير!)
    const [directiveResult, conferenceResult, allAcknowledgments] = await Promise.all([
        // التوجيه النشط
        supabase
            .from('media_content')
            .select('id, content')
            .eq('type', 'directive')
            .eq('is_active', true)
            .limit(1)
            .maybeSingle(),

        // النشاط النشط
        supabase
            .from('media_content')
            .select('id, content')
            .eq('type', 'conference')
            .eq('is_active', true)
            .limit(1)
            .maybeSingle(),

        // جلب إقرارات المستخدم مسبقاً (بدلاً من انتظار نتيجة التوجيه)
        supabase
            .from('user_acknowledgments')
            .select('content_id')
            .eq('user_id', userId)
    ]);

    // التحقق من الإقرار
    const acknowledgedIds = new Set(allAcknowledgments.data?.map(a => a.content_id) || []);
    const isDirectiveAcknowledged = directiveResult.data
        ? acknowledgedIds.has(directiveResult.data.id)
        : false;

    const data: MediaContent = {
        directive: directiveResult.data,
        conference: conferenceResult.data,
        isDirectiveAcknowledged
    };

    console.log(`[useMediaContent] ⏱️ استغرق ${Date.now() - startTime}ms`);

    // حفظ في الكاش
    await cacheManager.set(cacheKey, data, 2 * 60 * 1000);

    return data;
}

/**
 * Hook لاستخدام محتوى الإعلام مع الكاش
 */
export function useMediaContent(userId: string | undefined) {
    const settings = getOptimalSettings();
    const queryClient = useQueryClient();

    const query = useQuery({
        queryKey: ['mediaContent', userId],
        queryFn: () => fetchMediaContent(userId!),
        enabled: !!userId,
        staleTime: 60000, // دقيقة واحدة
        gcTime: settings.gcTime,
        refetchOnWindowFocus: false,
        retry: 1,
    });

    // دالة لإعادة التحميل (بعد الإقرار مثلاً)
    const invalidateCache = async () => {
        if (userId) {
            await cacheManager.delete(`${CACHE_CONFIG.MEDIA_CONTENT_KEY}_${userId}`);
            queryClient.invalidateQueries({ queryKey: ['mediaContent', userId] });
        }
    };

    return {
        ...query,
        invalidateCache,
    };
}
