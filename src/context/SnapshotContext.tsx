/**
 * SnapshotContext.tsx - سياق النسخ الشهرية
 * يوفر النسخة المعروضة حالياً لكل التطبيق مع دوال التحديث والتفعيل
 */
import { createContext, useContext, useCallback, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import {
    fetchActiveSnapshot,
    activateMonthlySnapshot,
    type MonthlySnapshot
} from '../utils/snapshots';

interface SnapshotContextValue {
    activeSnapshot: MonthlySnapshot | null;
    loading: boolean;
    refresh: (targetGov?: string) => Promise<void>;
    activate: (id: string) => Promise<{ restored: number; name: string }>;
}

const SnapshotContext = createContext<SnapshotContextValue | undefined>(undefined);

export const SnapshotProvider = ({ children }: { children: React.ReactNode }) => {
    const { user } = useAuth();
    const [activeSnapshot, setActiveSnapshot] = useState<MonthlySnapshot | null>(null);
    const [loading, setLoading] = useState(false);

    const refresh = useCallback(async (targetGov?: string) => {
        setLoading(true);
        try {
            // النسخة المعروضة تخص محافظة المستخدم (من بياناته أو من اختياره بالواجهة)
            const gov = targetGov
                || user?.governorate
                || sessionStorage.getItem('selectedGovernorate')
                || 'karbala';
            const snap = await fetchActiveSnapshot(gov);
            setActiveSnapshot(snap);
        } catch (err) {
            console.error('فشل جلب النسخة المعروضة:', err);
        } finally {
            setLoading(false);
        }
    }, [user?.governorate]);

    useEffect(() => {
        if (user || sessionStorage.getItem('selectedGovernorate')) {
            refresh();
        } else {
            setActiveSnapshot(null);
        }
    }, [user?.id, user?.governorate, refresh]);

    const activate = useCallback(async (id: string) => {
        const result = await activateMonthlySnapshot(id);
        await refresh();
        return result;
    }, [refresh]);

    return (
        <SnapshotContext.Provider value={{ activeSnapshot, loading, refresh, activate }}>
            {children}
        </SnapshotContext.Provider>
    );
};

export const useSnapshots = (): SnapshotContextValue => {
    const ctx = useContext(SnapshotContext);
    if (!ctx) throw new Error('useSnapshots must be used within SnapshotProvider');
    return ctx;
};
