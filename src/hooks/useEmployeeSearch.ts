import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

/**
 * خطاف بحث الموظفين العالمي
 * يستخدم نمط "يبدأ بـ" (ilike.query%) لدقة أعلى
 * مع debouncing تلقائي وترتيب أبجدي
 */

export interface EmployeeSearchResult {
    id: string;
    full_name: string;
    job_number: string;
    department_id?: string;
    avatar_url?: string;
    role?: string;
    username?: string;
    financial_records?: any;
    [key: string]: any;
}

export interface UseEmployeeSearchOptions {
    /** الحقول المطلوب جلبها من قاعدة البيانات */
    selectFields?: string;
    /** هل يشمل السجلات المالية */
    includeFinancialRecords?: boolean;
    /** هل يشمل الدور */
    includeRole?: boolean;
    /** هل يبحث في اسم المستخدم */
    searchUsername?: boolean;
    /** أقصى عدد نتائج */
    limit?: number;
    /** مدة التأخير بالمللي ثانية */
    debounceMs?: number;
    /** استثناء معرف مستخدم من النتائج */
    excludeUserId?: string;
    /** هل يفعل البحث */
    enabled?: boolean;
}

export function useEmployeeSearch(options: UseEmployeeSearchOptions = {}) {
    const {
        selectFields,
        includeFinancialRecords = false,
        includeRole = false,
        searchUsername = false,
        limit = 20,
        debounceMs = 300,
        excludeUserId,
        enabled = true
    } = options;

    const [query, setQuery] = useState('');
    const [results, setResults] = useState<EmployeeSearchResult[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const abortRef = useRef<AbortController | null>(null);

    useEffect(() => {
        const trimmed = query.trim();

        if (!trimmed || !enabled) {
            setResults([]);
            setIsSearching(false);
            return;
        }

        setIsSearching(true);

        const timer = setTimeout(async () => {
            // إلغاء الاستعلام السابق
            abortRef.current?.abort();
            const controller = new AbortController();
            abortRef.current = controller;

            try {
                // بناء الحقول المطلوبة
                let select = selectFields || 'id, full_name, job_number, department_id';
                if (!selectFields) {
                    if (includeRole) select += ', role';
                    if (searchUsername) select += ', username';
                    if (includeFinancialRecords) select += ', financial_records(*)';
                }

                // بناء شرط البحث: "يبدأ بـ" للاسم والرقم الوظيفي
                let orClause = `job_number.ilike.${trimmed}%,full_name.ilike.${trimmed}%`;
                if (searchUsername) orClause += `,username.ilike.${trimmed}%`;

                let queryBuilder = supabase
                    .from('profiles')
                    .select(select)
                    .or(orClause)
                    .order('full_name')
                    .limit(limit);

                const { data, error } = await queryBuilder;

                // تجاهل لو تم إلغاؤه
                if (controller.signal.aborted) return;
                if (error) throw error;

                let filtered: any[] = data || [];
                if (excludeUserId) {
                    filtered = filtered.filter((u: any) => u.id !== excludeUserId);
                }

                setResults(filtered as EmployeeSearchResult[]);
            } catch (err: any) {
                if (err?.name !== 'AbortError') {
                    console.error('Employee search error:', err);
                    setResults([]);
                }
            } finally {
                if (!controller.signal.aborted) {
                    setIsSearching(false);
                }
            }
        }, debounceMs);

        return () => {
            clearTimeout(timer);
        };
    }, [query, enabled, selectFields, includeFinancialRecords, includeRole, searchUsername, limit, debounceMs, excludeUserId]);

    const clearSearch = () => {
        setQuery('');
        setResults([]);
        setIsSearching(false);
    };

    return {
        query,
        setQuery,
        results,
        isSearching,
        clearSearch
    };
}
