import { useState, useEffect, useRef } from 'react';
import { EyeOff, Eye, Edit2, Save, Trash2, X, Navigation, Loader2, AlertCircle } from 'lucide-react';
import type { WorkLocation } from '../types';

interface WorkLocationCardProps {
    loc: WorkLocation;
    onToggleActive: (id: string, currentStatus: boolean) => void;
    onEdit: (loc: WorkLocation) => void;
    onSave: (loc: WorkLocation, patch: Partial<WorkLocation>) => Promise<void>;
    onCancel: () => void;
    onDelete: (id: string) => void;
    /** جلب إحداثيات GPS الحالية */
    onGetCurrentLocation: () => Promise<{ latitude: number; longitude: number } | null>;
}

/**
 * بطاقة موقع عمل — وضعان في وحدة بصرية واحدة:
 *  - وضع العرض: اسم + شارة + سطر إحداثيات واحد + سطر نصف قطر + سطر أزرار.
 *  - وضع التحرير: نفس البطاقة تتنقّل إلى حقول إدخال + أزرار (جلب إحداثيات / حفظ / إلغاء).
 *
 * مبدأ التفاعل: لا تُفتح بطاقة ثانية أسفل البطاقة المُعدَّلة — التحويل يتم
 * داخل نفس الوحدة حفاظاً على علاقة "أنا أعدّل هذا" لدى المستخدم.
 */
export default function WorkLocationCard({
    loc,
    onToggleActive,
    onEdit,
    onSave,
    onCancel,
    onDelete,
    onGetCurrentLocation
}: WorkLocationCardProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [radius, setRadius] = useState<number>(loc.radius_meters);
    const [coords, setCoords] = useState({ lat: loc.latitude, lng: loc.longitude });
    const [isGettingLocation, setIsGettingLocation] = useState(false);
    const [gpsError, setGpsError] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [coordsChanged, setCoordsChanged] = useState(false);
    const radiusRef = useRef<HTMLInputElement>(null);

    // إعادة المزامنة عند تغيّر الموقع في الخلفية
    useEffect(() => {
        if (!isEditing) {
            setRadius(loc.radius_meters);
            setCoords({ lat: loc.latitude, lng: loc.longitude });
            setGpsError(null);
            setCoordsChanged(false);
        }
    }, [loc.id, loc.latitude, loc.longitude, loc.radius_meters, isEditing]);

    // التركيز على حقل نصف القطر عند بدء التحرير
    useEffect(() => {
        if (isEditing) {
            requestAnimationFrame(() => radiusRef.current?.focus());
        }
    }, [isEditing]);

    const handleStartEdit = () => {
        setRadius(loc.radius_meters);
        setCoords({ lat: loc.latitude, lng: loc.longitude });
        setGpsError(null);
        setCoordsChanged(false);
        setIsEditing(true);
        onEdit(loc);
    };

    const handleCancel = () => {
        setIsEditing(false);
        setRadius(loc.radius_meters);
        setCoords({ lat: loc.latitude, lng: loc.longitude });
        setGpsError(null);
        setCoordsChanged(false);
        onCancel();
    };

    const handleGetCoords = async () => {
        setIsGettingLocation(true);
        setGpsError(null);
        try {
            const result = await onGetCurrentLocation();
            if (result) {
                setCoords({ lat: result.latitude, lng: result.longitude });
                setCoordsChanged(true);
            }
        } catch (e: any) {
            setGpsError(e?.message || 'تعذّر جلب الإحداثيات. تأكد من تفعيل GPS ومنح إذن المتصفح.');
        } finally {
            setIsGettingLocation(false);
        }
    };

    const handleSave = async () => {
        if (!Number.isFinite(radius) || radius < 10 || radius > 1000) {
            setGpsError('نصف القطر يجب أن يكون بين 10 و 1000 متر.');
            return;
        }
        setIsSaving(true);
        try {
            await onSave(loc, {
                radius_meters: radius,
                latitude: coords.lat,
                longitude: coords.lng
            });
            setIsEditing(false);
            setCoordsChanged(false);
        } catch (e: any) {
            setGpsError(e?.message || 'تعذّر حفظ التعديلات.');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div
            id={`loc-card-${loc.id}`}
            className={`bg-white dark:bg-slate-800 rounded-2xl shadow-md border transition-all duration-200 ${
                isEditing
                    ? 'border-blue-400 dark:border-blue-500/50 shadow-lg ring-1 ring-blue-500/20'
                    : loc.is_active
                        ? 'border-slate-100 dark:border-slate-700/50 hover:shadow-lg'
                        : 'border-rose-200/60 dark:border-rose-900/30 opacity-75'
            }`}
        >
            {/* الرأس: الاسم + الشارة */}
            <div className="flex justify-between items-start gap-2 px-4 pt-4 pb-2">
                <h3 className="font-bold text-base leading-snug text-slate-800 dark:text-slate-100 break-words">
                    {loc.name}
                </h3>
                <span className={`shrink-0 px-2 py-0.5 rounded-full text-[11px] font-bold ${
                    loc.is_active
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400'
                        : 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400'
                }`}>
                    {loc.is_active ? 'نشط' : 'معطل'}
                </span>
            </div>

            {/* الإحداثيات + نصف القطر */}
            <div className="px-4 pb-3 space-y-1.5">
                {isEditing ? (
                    <>
                        <div className="flex items-center gap-2 rounded-lg bg-slate-50 dark:bg-slate-900/60 px-3 py-2 border border-slate-200 dark:border-slate-700">
                            <span className="text-[11px] font-bold text-slate-400 shrink-0">إحداثيات</span>
                            <span className="flex-1 text-xs font-mono font-bold text-slate-700 dark:text-slate-200 truncate" dir="ltr">
                                ع: {coords.lat.toFixed(6)} / ط: {coords.lng.toFixed(6)}
                            </span>
                            {coordsChanged && (
                                <span className="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                                    محدّث
                                </span>
                            )}
                        </div>

                        <div className="flex items-center gap-2 rounded-lg bg-blue-50 dark:bg-blue-950/25 px-3 py-2 border border-blue-200 dark:border-blue-800">
                            <label htmlFor={`radius-${loc.id}`} className="text-[11px] font-bold text-blue-600 dark:text-blue-400 shrink-0">
                                نصف القطر
                            </label>
                            <input
                                id={`radius-${loc.id}`}
                                ref={radiusRef}
                                type="number"
                                inputMode="numeric"
                                min={10}
                                max={1000}
                                value={radius}
                                onChange={(e) => setRadius(Number(e.target.value))}
                                className="flex-1 min-w-0 bg-white dark:bg-slate-900 border border-blue-300 dark:border-blue-700 rounded-md px-2 py-1 text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <span className="shrink-0 text-[11px] font-bold text-blue-500 dark:text-blue-400">متر</span>
                        </div>
                    </>
                ) : (
                    <>
                        {/* سطر واحد: خط العرض / خط الطول */}
                        <div className="flex items-center justify-between gap-2 text-xs">
                            <span className="font-mono font-bold text-slate-700 dark:text-slate-300 whitespace-nowrap" dir="ltr">
                                ع: {loc.latitude.toFixed(6)} / ط: {loc.longitude.toFixed(6)}
                            </span>
                        </div>
                        {/* سطر نصف القطر */}
                        <div className="flex items-center justify-between gap-2 text-xs">
                            <span className="text-slate-500 dark:text-slate-400">نصف القطر</span>
                            <span className="font-bold text-blue-600 dark:text-blue-400">{loc.radius_meters} متر</span>
                        </div>
                    </>
                )}

                {gpsError && (
                    <div className="flex items-start gap-1.5 text-[11px] text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/25 rounded-lg px-2.5 py-1.5">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-px" />
                        <span>{gpsError}</span>
                    </div>
                )}
            </div>

            {/* الأزرار */}
            <div className="flex gap-1.5 border-t border-slate-100 dark:border-slate-700/50 px-3 py-2.5">
                {isEditing ? (
                    <>
                        <button
                            type="button"
                            onClick={handleGetCoords}
                            disabled={isGettingLocation}
                            className="flex-1 px-2 py-1.5 rounded-lg bg-emerald-100 hover:bg-emerald-200 dark:bg-emerald-900/30 dark:hover:bg-emerald-900/50 text-emerald-800 dark:text-emerald-400 font-bold text-[11px] flex items-center justify-center gap-1 transition-colors disabled:opacity-50"
                            title="جلب إحداثيات جهازك الحالية"
                        >
                            {isGettingLocation
                                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                : <Navigation className="w-3.5 h-3.5" />}
                            {isGettingLocation ? 'جارٍ الجلب' : 'جلب إحداثيات'}
                        </button>
                        <button
                            type="button"
                            onClick={handleSave}
                            disabled={isSaving}
                            className="flex-1 px-2 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-[11px] flex items-center justify-center gap-1 transition-colors"
                        >
                            {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                            {isSaving ? 'جارٍ الحفظ' : 'حفظ'}
                        </button>
                        <button
                            type="button"
                            onClick={handleCancel}
                            disabled={isSaving}
                            className="px-2.5 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 font-bold text-[11px] flex items-center justify-center gap-1 transition-colors"
                            title="إلغاء التعديل"
                        >
                            <X className="w-3.5 h-3.5" />
                            إلغاء
                        </button>
                    </>
                ) : (
                    <>
                        <button
                            type="button"
                            onClick={() => onToggleActive(loc.id, loc.is_active)}
                            className={`flex-1 px-2 py-1.5 rounded-lg font-bold text-[11px] flex items-center justify-center gap-1 transition-colors ${
                                loc.is_active
                                    ? 'bg-amber-100 hover:bg-amber-200 text-amber-800 dark:bg-amber-900/25 dark:text-amber-400 dark:hover:bg-amber-900/40'
                                    : 'bg-emerald-100 hover:bg-emerald-200 text-emerald-800 dark:bg-emerald-900/25 dark:text-emerald-400 dark:hover:bg-emerald-900/40'
                            }`}
                            title={loc.is_active ? 'تعطيل الموقع' : 'تفعيل الموقع'}
                        >
                            {loc.is_active ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            {loc.is_active ? 'تعطيل' : 'تفعيل'}
                        </button>
                        <button
                            type="button"
                            onClick={handleStartEdit}
                            className="flex-1 px-2 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-700/50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-[11px] flex items-center justify-center gap-1 transition-colors"
                            title="تعديل الإعدادات"
                        >
                            <Edit2 className="w-3.5 h-3.5" />
                            تعديل
                        </button>
                        <button
                            type="button"
                            onClick={() => onDelete(loc.id)}
                            className="px-2.5 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/25 dark:hover:bg-rose-950/50 text-rose-600 dark:text-rose-400 font-bold text-[11px] flex items-center justify-center gap-1 transition-colors"
                            title="حذف الموقع"
                        >
                            <Trash2 className="w-3.5 h-3.5" />
                            حذف
                        </button>
                    </>
                )}
            </div>
        </div>
    );
}
