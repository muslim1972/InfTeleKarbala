import { Database, X, Loader2, Save, ArrowRight } from 'lucide-react';
import { useDataPatcher } from '../../hooks/useDataPatcher';
import { UploadStep } from './data-patcher/UploadStep';
import { MappingStep } from './data-patcher/MappingStep';
import { PreviewStep } from './data-patcher/PreviewStep';
import { ManualStep } from './data-patcher/ManualStep';

interface DataPatcherProps {
    onClose: () => void;
}

export function DataPatcher({ onClose }: DataPatcherProps) {
    const patcher = useDataPatcher();
    const { step, setStep, mode, setMode } = patcher;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800 flex flex-col max-h-[85vh]">
                
                {/* Header */}
                <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-start bg-zinc-50/50 dark:bg-zinc-900/50 backdrop-blur">
                    <div>
                        <h2 className="text-lg font-bold flex items-center gap-2 text-zinc-900 dark:text-white">
                            <Database className="w-5 h-5 text-blue-600" />
                            حقن البيانات (Smart Injector)
                        </h2>
                        <div className="flex gap-2 mt-2">
                            <button
                                onClick={() => { setMode('patch'); setStep('upload'); }}
                                className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all border ${mode === 'patch'
                                    ? 'bg-blue-100 text-blue-700 border-blue-200'
                                    : 'bg-transparent text-zinc-500 border-transparent hover:bg-zinc-100'
                                    }`}
                            >
                                تحديث حقل واحد
                            </button>
                            <button
                                onClick={() => { setMode('sync'); setStep('upload'); }}
                                className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all border ${mode === 'sync'
                                    ? 'bg-purple-100 text-purple-700 border-purple-200'
                                    : 'bg-transparent text-zinc-500 border-transparent hover:bg-zinc-100'
                                    }`}
                            >
                                مزامنة شاملة
                            </button>
                            <button
                                onClick={() => { setMode('manual'); setStep('manual_search'); }}
                                className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all border ${mode === 'manual'
                                    ? 'bg-amber-100 text-amber-700 border-amber-200'
                                    : 'bg-transparent text-zinc-500 border-transparent hover:bg-zinc-100'
                                    }`}
                            >
                                حقن يدوي
                            </button>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-full transition-colors"
                    >
                        <X className="w-5 h-5 text-zinc-500" />
                    </button>
                </div>

                {/* Progress Bar */}
                <div className="w-full h-0.5 bg-zinc-100 dark:bg-zinc-800">
                    <div
                        className="h-full bg-blue-600 transition-all duration-500 ease-out"
                        style={{
                            width: step === 'upload' ? '25%' :
                                step === 'map' ? '50%' :
                                    step === 'preview' ? '75%' : '100%'
                        }}
                    />
                </div>

                {/* Content Area */}
                <div className="flex-1 min-h-0 overflow-y-auto relative bg-zinc-50/50 dark:bg-black/20 overscroll-contain scroll-smooth">
                    
                    {/* Manual Mode */}
                    {(step === 'manual_search' || step === 'manual_edit') && <ManualStep patcher={patcher} />}
                    
                    {/* Step 1: Upload */}
                    {step === 'upload' && <UploadStep patcher={patcher} />}
                    
                    {/* Step 2: Mapping */}
                    {step === 'map' && <MappingStep patcher={patcher} />}
                    
                    {/* Step 3: Preview */}
                    {step === 'preview' && <PreviewStep patcher={patcher} />}
                    
                    {/* Step: Done */}
                    {step === 'done' && (
                        <div className="h-full flex flex-col items-center justify-center p-10 animate-in zoom-in duration-300">
                            <div className="w-24 h-24 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-6">
                                {/* Success Icon Here */}
                            </div>
                            <h2 className="text-3xl font-bold text-zinc-900 dark:text-white mb-2">تمت العملية بنجاح!</h2>
                            <p className="text-zinc-500 mb-8">تم تحديث بيانات الموظفين في النظام وفقاً للملف المرفق.</p>
                            <button
                                onClick={onClose}
                                className="px-8 py-3 bg-zinc-900 dark:bg-white text-white dark:text-black rounded-xl font-bold hover:scale-105 transition-transform"
                            >
                                إغلاق النافذة
                            </button>
                        </div>
                    )}

                    {/* Step: Executing (Loading Overlay) */}
                    {step === 'executing' && (
                        <div className="absolute inset-0 bg-white/80 dark:bg-zinc-900/90 backdrop-blur-sm flex flex-col items-center justify-center z-20">
                            <Loader2 className="w-16 h-16 text-blue-600 animate-spin mb-6" />
                            <h3 className="text-xl font-bold text-zinc-800 dark:text-zinc-200">جاري معالجة البيانات...</h3>
                            <p className="text-zinc-500 mt-2">يرجى الانتظار حتى اكتمال العملية</p>
                        </div>
                    )}
                </div>

                {/* Footer Controls */}
                {step !== 'done' && step !== 'executing' && (
                    <div className="flex-none w-full p-4 border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex justify-between items-center z-50 shadow-[0_-10px_40px_rgba(0,0,0,0.1)]">
                        <button
                            onClick={() => {
                                if (step === 'map') setStep('upload');
                                if (step === 'preview') setStep('map');
                                if (step === 'manual_edit') {
                                    setStep('manual_search');
                                    patcher.setSelectedManualProfile(null);
                                    patcher.setManualFormData({});
                                }
                                if (step === 'manual_search') onClose();
                            }}
                            disabled={step === 'upload'}
                            className="px-6 py-2.5 rounded-lg text-zinc-600 dark:text-zinc-400 font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            رجوع
                        </button>

                        {step === 'map' && (
                            <button
                                onClick={patcher.analyzeData}
                                disabled={mode === 'patch' ? (!patcher.keyCol || !patcher.valCol || !patcher.targetDbField) : (!patcher.syncMapping['job_number'] || !patcher.syncMapping['full_name'])}
                                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-blue-500/20"
                            >
                                التالي: معاينة المطابقة <ArrowRight className="w-4 h-4" />
                            </button>
                        )}

                        {step === 'preview' && (
                            <div className="flex items-center gap-4">
                                {patcher.stats.missing > 0 && (
                                    <label className="flex items-center gap-2 cursor-pointer bg-amber-50 dark:bg-amber-900/20 px-4 py-2 rounded-lg border border-amber-200 dark:border-amber-800/50 hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors">
                                        <input
                                            type="checkbox"
                                            checked={patcher.allowMissingSkip}
                                            onChange={(e) => patcher.setAllowMissingSkip(e.target.checked)}
                                            className="w-4 h-4 text-amber-600 rounded border-amber-300 focus:ring-amber-500 focus:ring-offset-0 disabled:opacity-50 cursor-pointer"
                                        />
                                        <span className="text-sm font-bold text-amber-900 dark:text-amber-300">
                                            أؤكد تجاوز الأسماء المفقودة ({patcher.stats.missing}) وحقن المُطابَق فقط
                                        </span>
                                    </label>
                                )}
                                <button
                                    onClick={patcher.executeUpdate}
                                    disabled={(patcher.stats.found + patcher.stats.new) === 0 || (patcher.stats.missing > 0 && !patcher.allowMissingSkip)}
                                    className="px-6 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-green-500/20"
                                >
                                    <Save className="w-4 h-4" />
                                    تنفيذ التحديث ({patcher.stats.found + patcher.stats.new})
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
