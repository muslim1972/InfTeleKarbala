/**
 * Hook لكاش الاستطلاعات
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { cacheManager } from '../cache/CacheManager';
import { CACHE_CONFIG, getOptimalSettings } from '../cache/CacheConfig';

export interface Poll {
    id: string;
    title: string;
    description: string;
    is_active: boolean;
    questions: {
        id: string;
        question_text: string;
        allow_multiple_answers: boolean;
        options: { id: string; option_text: string }[];
    }[];
}

/**
 * جلب الاستطلاعات النشطة مع الكاش
 */
async function fetchPolls(category: 'media' | 'training' = 'media'): Promise<Poll[]> {
    const cacheKey = `${CACHE_CONFIG.POLLS_KEY}_${category}`;

    // محاولة جلب من الكاش
    const cached = await cacheManager.get<Poll[]>(cacheKey);
    if (cached) {
        console.log('[usePolls] جلب من الكاش:', cached.length, 'استطلاع');
        return cached;
    }

    console.log('[usePolls] جلب من قاعدة البيانات...');

    // جلب الاستطلاعات
    const { data: pollsData, error: pollsError } = await supabase
        .from('polls')
        .select('*')
        .eq('is_deleted', false)
        .eq('category', category)
        .order('created_at', { ascending: false });

    if (pollsError) throw pollsError;
    if (!pollsData || pollsData.length === 0) return [];

    // جلب الأسئلة والخيارات
    const pollIds = pollsData.map(p => p.id);
    const { data: questionsData, error: qError } = await supabase
        .from('poll_questions')
        .select('id, question_text, allow_multiple_answers, order_index, poll_id, poll_options(id, option_text, order_index)')
        .in('poll_id', pollIds)
        .order('order_index');

    if (qError) throw qError;

    // تجميع البيانات
    const polls: Poll[] = pollsData.map(poll => {
        const pollQuestions = (questionsData || [])
            .filter((q: any) => q.poll_id === poll.id)
            .map((q: any) => ({
                id: q.id,
                question_text: q.question_text,
                allow_multiple_answers: q.allow_multiple_answers,
                options: (q.poll_options || []).sort((a: any, b: any) => a.order_index - b.order_index)
            }));

        return {
            id: poll.id,
            title: poll.title,
            description: poll.description,
            is_active: poll.is_active,
            questions: pollQuestions
        };
    });

    // حفظ في الكاش
    await cacheManager.set(cacheKey, polls);

    return polls;
}

/**
 * Hook لاستخدام الاستطلاعات مع الكاش
 */
export function usePolls(category: 'media' | 'training' = 'media') {
    const settings = getOptimalSettings();
    const queryClient = useQueryClient();

    const query = useQuery({
        queryKey: ['polls', category],
        queryFn: () => fetchPolls(category),
        staleTime: settings.staleTime,
        gcTime: settings.gcTime,
        refetchOnWindowFocus: false,
        retry: 2,
    });

    // دالة لإعادة التحميل
    const invalidateCache = async (cat: 'media' | 'training' = category) => {
        await cacheManager.delete(`${CACHE_CONFIG.POLLS_KEY}_${cat}`);
        queryClient.invalidateQueries({ queryKey: ['polls', cat] });
    };

    return {
        ...query,
        invalidateCache,
    };
}
