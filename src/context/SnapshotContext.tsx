/**
 * SnapshotContext.tsx - سياق النسخ الشهرية
 * يوفر النسخة المعروضة حالياً لكل التطبيق مع دوال التحديث والتفعيل
 * ويوفر ميزة المعاينة التاريخية للقراءة فقط (Read-Only Historical Inspection)
 */
import { createContext, useContext, useCallback, useEffect, useState, useRef } from 'react';
import { toast } from 'react-hot-toast';
import { useAuth } from './AuthContext';
import { useGovernorate } from './GovernorateContext';
import {
    fetchActiveSnapshot,
    activateMonthlySnapshot,
    fetchHistoricalUserData,
    type MonthlySnapshot,
    type HistoricalUserData
} from '../utils/snapshots';

interface SnapshotContextValue {
    activeSnapshot: MonthlySnapshot | null;
    historicalSnapshot: MonthlySnapshot | null;
    isHistorical: boolean;
    loading: boolean;
    refresh: (targetGov?: string) => Promise<void>;
    activate: (id: string) => Promise<{ restored: number; name: string }>;
    viewSnapshot: (snapshot: MonthlySnapshot) => void;
    exitHistoricalView: () => void;
    getHistoricalData: (userId: string) => Promise<HistoricalUserData | null>;
}

const SnapshotContext = createContext<SnapshotContextValue | undefined>(undefined);

const HISTORICAL_SESSION_KEY = 'inftele_historical_snapshot';

export const SnapshotProvider = ({ children }: { children: React.ReactNode }) => {
    const { user } = useAuth();
    const { activeGovernorate } = useGovernorate();
    const [activeSnapshot, setActiveSnapshot] = useState<MonthlySnapshot | null>(null);
    const [historicalSnapshot, setHistoricalSnapshot] = useState<MonthlySnapshot | null>(() => {
        try {
            const saved = sessionStorage.getItem(HISTORICAL_SESSION_KEY);
            return saved ? JSON.parse(saved) : null;
        } catch {
            return null;
        }
    });
    const [loading, setLoading] = useState(false);

    // كاش لحظي لبيانات الموظفين في الشهر المستعرض لمنع تكرار طلبات الشبكة
    const cacheRef = useRef<Map<string, HistoricalUserData>>(new Map());

    const refresh = useCallback(async (targetGov?: string) => {
        setLoading(true);
        try {
            // النسخة المعروضة تخص محافظة المستخدم (من بياناته أو من اختياره بالواجهة)
            const gov = targetGov || activeGovernorate || 'karbala';
            const snap = await fetchActiveSnapshot(gov);
            setActiveSnapshot(snap);
        } catch (err) {
            console.error('فشل جلب النسخة المعروضة:', err);
        } finally {
            setLoading(false);
        }
    }, [activeGovernorate]);

    useEffect(() => {
        if (user || activeGovernorate) {
            refresh();
        } else {
            setActiveSnapshot(null);
        }
    }, [user?.id, activeGovernorate, refresh]);

    // مسح الكاش عند تغيير النسخة التاريخية المستعرضة
    useEffect(() => {
        cacheRef.current.clear();
    }, [historicalSnapshot?.id]);

    const activate = useCallback(async (id: string) => {
        const result = await activateMonthlySnapshot(id);
        await refresh();
        return result;
    }, [refresh]);

    const viewSnapshot = useCallback((snapshot: MonthlySnapshot) => {
        setHistoricalSnapshot(snapshot);
        cacheRef.current.clear();
        try {
            sessionStorage.setItem(HISTORICAL_SESSION_KEY, JSON.stringify(snapshot));
        } catch (e) {
            console.warn('تعذر حفظ حالة الاستعراض في sessionStorage:', e);
        }
    }, []);

    const exitHistoricalView = useCallback(() => {
        setHistoricalSnapshot(null);
        cacheRef.current.clear();
        try {
            sessionStorage.removeItem(HISTORICAL_SESSION_KEY);
        } catch (e) {
            console.warn('تعذر إزالة حالة الاستعراض من sessionStorage:', e);
        }
    }, []);

    const getHistoricalData = useCallback(async (userId: string): Promise<HistoricalUserData | null> => {
        if (!historicalSnapshot?.id || !userId) return null;
        const cacheKey = `${historicalSnapshot.id}:${userId}`;
        if (cacheRef.current.has(cacheKey)) {
            return cacheRef.current.get(cacheKey)!;
        }
        try {
            const data = await fetchHistoricalUserData(historicalSnapshot.id, userId);
            if (data) {
                cacheRef.current.set(cacheKey, data);
            }
            return data;
        } catch (err: any) {
            console.error('فشل جلب البيانات التاريخية:', err);
            toast.error('تعذر جلب بيانات الأرشيف لهذا الشهر: ' + (err?.message || 'خطأ غير معروف'));
            return null;
        }
    }, [historicalSnapshot?.id]);

    const isHistorical = historicalSnapshot !== null;

    return (
        <SnapshotContext.Provider value={{
            activeSnapshot,
            historicalSnapshot,
            isHistorical,
            loading,
            refresh,
            activate,
            viewSnapshot,
            exitHistoricalView,
            getHistoricalData
        }}>
            {children}
        </SnapshotContext.Provider>
    );
};

export const useSnapshots = (): SnapshotContextValue => {
    const ctx = useContext(SnapshotContext);
    if (!ctx) throw new Error('useSnapshots must be used within SnapshotProvider');
    return ctx;
};
