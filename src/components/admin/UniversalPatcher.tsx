/**
 * المحدث العام للبيانات
 * Universal Data Patcher
 * 
 * أداة مرنة لحقن بيانات Excel إلى أي جدول فعال في النظام
 */
import { Database, X, CheckCircle2, Zap } from 'lucide-react';
import { useUniversalPatcher } from '../../hooks/useUniversalPatcher';
import { UP_UploadStep } from './universal-patcher/UP_UploadStep';
import { UP_ConfigStep } from './universal-patcher/UP_ConfigStep';
import { UP_PreviewStep } from './universal-patcher/UP_PreviewStep';

interface UniversalPatcherProps {
    onClose: () => void;
}

export function UniversalPatcher({ onClose }: UniversalPatcherProps) {
    const patcher = useUniversalPatcher();
    const { step, tableDef, stats } = patcher;

    const stepLabels: Record<string, string> = {
        upload: '1. رفع الملف واختيار الجدول',
        config: '2. ربط الأعمدة',
        preview: '3. معاينة النتائج',
        executing: '4. التنفيذ',
        done: '✓ اكتمال',
    };

    const stepProgress: Record<string, number> = {
        upload: 20,
        config: 45,
        preview: 70,
        executing: 90,
        done: 100,
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-in fade-in duration-300">
            <div className="bg-white dark:bg-zinc-950 rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.15)] w-[98vw] max-w-screen-xl overflow-hidden border border-zinc-200 dark:border-zinc-800 flex flex-col h-[92vh]">

                {/* Header */}
                <div className="shrink-0 p-4 border-b border-zinc-100 dark:border-zinc-800 bg-gradient-to-r from-zinc-50 to-white dark:from-zinc-900 dark:to-zinc-950 flex justify-between items-center relative">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-green-500" />
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 text-white flex items-center justify-center shadow-lg shadow-blue-500/20">
                            <Zap className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-lg font-black text-zinc-900 dark:text-white">
                                المحدث العام ⚡
                            </h2>
                            <p className="text-xs text-zinc-500 font-medium">
                                حقن بيانات Excel إلى أي جدول في النظام
                                {tableDef && (
                                    <span className="text-blue-600 font-bold mr-2">
                                        • {tableDef.icon} {tableDef.label}
                                    </span>
                                )}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors group"
                    >
                        <X className="w-5 h-5 text-zinc-400 group-hover:text-red-500 transition-colors" />
                    </button>
                </div>

                {/* Progress Bar */}
                <div className="shrink-0 flex w-full bg-zinc-100 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800">
                    {Object.entries(stepLabels).map(([key, label]) => (
                        <div
                            key={key}
                            className={`flex-1 py-2.5 px-3 text-center text-[11px] font-bold transition-all border-l first:border-l-0 dark:border-zinc-800 ${step === key
                                ? 'bg-white dark:bg-zinc-950 text-blue-600'
                                : 'text-zinc-400 opacity-50'
                                }`}
                        >
                            {label}
                        </div>
                    ))}
                </div>

                {/* Thin Progress */}
                <div className="shrink-0 w-full h-0.5 bg-zinc-100 dark:bg-zinc-800">
                    <div
                        className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-700 ease-out"
                        style={{ width: `${stepProgress[step] || 0}%` }}
                    />
                </div>

                {/* Content Area */}
                <div className="flex-1 min-h-0 overflow-y-auto bg-zinc-50/30 dark:bg-black/20 relative">

                    {step === 'upload' && <UP_UploadStep patcher={patcher} />}
                    {step === 'config' && <UP_ConfigStep patcher={patcher} />}
                    {step === 'preview' && <UP_PreviewStep patcher={patcher} />}

                    {/* Executing */}
                    {step === 'executing' && (
                        <div className="h-full flex flex-col items-center justify-center space-y-6 animate-in fade-in zoom-in duration-500">
                            <div className="relative">
                                <div className="w-20 h-20 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin" />
                                <Database className="w-7 h-7 text-blue-600 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                            </div>
                            <div className="text-center">
                                <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-1">
                                    جاري معالجة البيانات...
                                </h3>
                                <p className="text-sm text-zinc-500">يرجى عدم إغلاق النافذة</p>
                            </div>
                        </div>
                    )}

                    {/* Done */}
                    {step === 'done' && (
                        <div className="h-full flex flex-col items-center justify-center space-y-6 animate-in slide-in-from-bottom-5 fade-in duration-500">
                            <div className="w-20 h-20 bg-green-100 dark:bg-green-900/40 rounded-full flex items-center justify-center text-green-600 relative overflow-hidden">
                                <span className="absolute inset-0 bg-green-400/20 animate-ping rounded-full" />
                                <CheckCircle2 className="w-10 h-10 relative z-10" />
                            </div>
                            <div className="text-center max-w-sm">
                                <h3 className="text-2xl font-black text-zinc-900 dark:text-white mb-1">
                                    تم بنجاح! 🎉
                                </h3>
                                <p className="text-zinc-500 mb-6">
                                    تم تحديث <span className="font-bold text-green-600">{stats.found + stats.newRecords}</span> سجل
                                    في {tableDef?.label || 'الجدول'}
                                </p>
                                <button
                                    onClick={onClose}
                                    className="w-full bg-zinc-900 hover:bg-black dark:bg-white dark:hover:bg-zinc-200 dark:text-black text-white py-3 rounded-xl font-bold transition-all"
                                >
                                    إغلاق
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
