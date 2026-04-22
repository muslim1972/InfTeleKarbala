/**
 * GeolocationManager.ts
 * 
 * مدير خدمات الموقع الجغرافي.
 * يضمن عدم استدعاء خدمات الموقع إلا عند الضرورة القصوى،
 * ويوفر آلية موحدة لتنظيف جميع المستمعين (Watches) عند تسجيل الخروج أو تبديل التبويبة.
 */

class GeolocationManager {
    private static instance: GeolocationManager;
    private activeWatches: number[] = [];

    private constructor() {}

    public static getInstance(): GeolocationManager {
        if (!GeolocationManager.instance) {
            GeolocationManager.instance = new GeolocationManager();
        }
        return GeolocationManager.instance;
    }

    public registerWatchId(id: number) {
        if (!this.activeWatches.includes(id)) {
            this.activeWatches.push(id);
        }
    }

    /**
     * الحصول على الموقع الحالي مرة واحدة فقط
     */
    public async getCurrentPosition(): Promise<GeolocationPosition> {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                reject(new Error('خدمة الموقع غير مدعومة في هذا المتصفح'));
                return;
            }

            navigator.geolocation.getCurrentPosition(
                (position) => resolve(position),
                (error) => reject(error),
                {
                    enableHighAccuracy: true,
                    timeout: 5000,
                    maximumAge: 0
                }
            );
        });
    }

    /**
     * بدء تتبع الموقع (مع حفظ المعرف لإغلاقه لاحقاً)
     */
    public watchPosition(
        onSuccess: PositionCallback,
        onError?: PositionErrorCallback
    ): number {
        if (!navigator.geolocation) return -1;

        const watchId = navigator.geolocation.watchPosition(
            onSuccess,
            onError,
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0
            }
        );

        this.activeWatches.push(watchId);
        console.log(`📍 Started Geolocation Watch: ${watchId}`);
        return watchId;
    }

    /**
     * إيقاف مستمع معين
     */
    public clearWatch(watchId: number) {
        if (watchId === -1) return;
        navigator.geolocation.clearWatch(watchId);
        this.activeWatches = this.activeWatches.filter(id => id !== watchId);
        console.log(`📍 Cleared Geolocation Watch: ${watchId}`);
    }

    /**
     * إيقاف جميع المستمعين النشطين فوراً
     */
    public clearAllWatches() {
        if (this.activeWatches.length === 0) return;
        
        console.log(`📍 Clearing all (${this.activeWatches.length}) Geolocation watches...`);
        this.activeWatches.forEach(id => {
            navigator.geolocation.clearWatch(id);
        });
        this.activeWatches = [];
    }
}

export const geolocationManager = GeolocationManager.getInstance();
