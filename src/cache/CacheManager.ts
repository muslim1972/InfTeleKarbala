/**
 * مدير الكاش المتقدم باستخدام localForage
 * يوفر تخزين محلي موثوق للبيانات
 */

import localForage from 'localforage';
import { CACHE_CONFIG } from './CacheConfig';

interface CacheEntry<T> {
    data: T;
    timestamp: number;
    expiresAt: number;
    version: number;
}

class CacheManager {
    private store: LocalForage;

    constructor() {
        this.store = localForage.createInstance({
            name: 'inftele_karbala',
            storeName: 'app_cache',
            description: 'تطبيق إدارة الموظفين'
        });
    }

    /**
     * حفظ البيانات في الكاش
     */
    async set<T>(key: string, value: T, ttlMs?: number): Promise<void> {
        const now = Date.now();
        const entry: CacheEntry<T> = {
            data: value,
            timestamp: now,
            expiresAt: now + (ttlMs ?? CACHE_CONFIG.CACHE_LIFETIME),
            version: CACHE_CONFIG.VERSION
        };

        try {
            await this.store.setItem(key, entry);
        } catch (error) {
            console.error('[CacheManager] خطأ في الحفظ:', error);
        }
    }

    /**
     * جلب البيانات من الكاش
     */
    async get<T>(key: string): Promise<T | null> {
        try {
            const entry = await this.store.getItem<CacheEntry<T>>(key);

            if (!entry) return null;

            // التحقق من انتهاء الصلاحية
            if (Date.now() > entry.expiresAt) {
                await this.store.removeItem(key);
                return null;
            }

            // التحقق من إصدار الكاش
            if (entry.version !== CACHE_CONFIG.VERSION) {
                await this.store.removeItem(key);
                return null;
            }

            return entry.data;
        } catch (error) {
            console.error('[CacheManager] خطأ في الجلب:', error);
            return null;
        }
    }

    /**
     * حذف مفتاح معين
     */
    async delete(key: string): Promise<void> {
        try {
            await this.store.removeItem(key);
        } catch (error) {
            console.error('[CacheManager] خطأ في الحذف:', error);
        }
    }

    /**
     * مسح كل الكاش
     */
    async clear(): Promise<void> {
        try {
            await this.store.clear();
            console.log('[CacheManager] تم مسح الكاش بالكامل');
        } catch (error) {
            console.error('[CacheManager] خطأ في المسح:', error);
        }
    }

    /**
     * جلب جميع المفاتيح
     */
    async keys(): Promise<string[]> {
        try {
            return await this.store.keys();
        } catch (error) {
            console.error('[CacheManager] خطأ في جلب المفاتيح:', error);
            return [];
        }
    }

    /**
     * تنظيف الكاش المنتهي الصلاحية
     */
    async cleanup(): Promise<number> {
        let deletedCount = 0;
        try {
            const keys = await this.store.keys();
            for (const key of keys) {
                const entry = await this.store.getItem<CacheEntry<any>>(key);
                if (entry && Date.now() > entry.expiresAt) {
                    await this.store.removeItem(key);
                    deletedCount++;
                }
            }
        } catch (error) {
            console.error('[CacheManager] خطأ في التنظيف:', error);
        }
        return deletedCount;
    }
}

// Singleton instance
export const cacheManager = new CacheManager();
