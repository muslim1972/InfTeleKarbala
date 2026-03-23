import { Save } from 'lucide-react';
import type { UseDataPatcherReturn } from '../../../hooks/useDataPatcher';
import { dbFields } from '../../../utils/dataPatcherUtils';
import { EmployeeSearch } from '../../shared/EmployeeSearch';

export function ManualStep({ patcher }: { patcher: UseDataPatcherReturn }) {
    const {
        step, setStep,
        selectedManualProfile, setSelectedManualProfile,
        manualFormData, setManualFormData,
        handleSelectProfile, handleManualSave
    } = patcher;

    return (
        <div className="flex-1 min-h-0 overflow-y-auto relative bg-zinc-50/50 dark:bg-black/20 overscroll-contain scroll-smooth">
            {step === 'manual_search' && (
                <div className="p-6 h-full flex flex-col items-center animate-in slide-in-from-bottom-5 duration-300">
                    <div className="w-full max-w-xl space-y-4 shadow-sm bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4">
                        <EmployeeSearch
                            onSelect={handleSelectProfile}
                            placeholder="بحث عن موظف (الاسم، الرقم الوظيفي)..."
                            includeFinancialRecords={true}
                            searchUsername={true}
                            limit={15}
                            inputClassName="focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                        />
                    </div>
                </div>
            )}

            {step === 'manual_edit' && selectedManualProfile && (
                <div className="p-6 animate-in slide-in-from-right-10 duration-300 pb-24">
                    <div className="max-w-3xl mx-auto space-y-6">
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center text-amber-600 font-bold text-xl ring-2 ring-amber-100 dark:ring-amber-900">
                                    {selectedManualProfile.full_name?.[0] || '?'}
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-zinc-900 dark:text-white">{selectedManualProfile.full_name}</h3>
                                    <p className="text-sm text-zinc-500 font-mono mt-0.5">@{selectedManualProfile.username}</p>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-white dark:bg-zinc-800 p-6 rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-sm">
                            {dbFields.map((field) => (
                                <div key={field.value} className="space-y-1">
                                    <label className="text-xs font-bold text-zinc-500 block truncate" title={field.label}>{field.label}</label>
                                    <input
                                        type={field.value.includes('date') ? 'date' : 'text'}
                                        className="w-full p-2.5 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition-shadow text-sm font-medium text-zinc-900 dark:text-zinc-100 shadow-sm"
                                        value={manualFormData[field.value] || ''}
                                        onChange={(e) => setManualFormData({ ...manualFormData, [field.value]: e.target.value })}
                                    />
                                </div>
                            ))}
                        </div>

                        <div className="absolute bottom-0 left-0 w-full p-4 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border-t border-zinc-200 dark:border-zinc-800 flex justify-end gap-3 z-50">
                            <button
                                onClick={() => {
                                    setStep('manual_search');
                                    setSelectedManualProfile(null);
                                    setManualFormData({});
                                }}
                                className="px-6 py-2 rounded-lg font-bold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors shadow-sm border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800"
                            >
                                إلغاء
                            </button>
                            <button
                                onClick={handleManualSave}
                                className="px-6 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold transition-all shadow-md shadow-amber-500/20 flex items-center gap-2 hover:scale-105 active:scale-95"
                            >
                                <Save className="w-4 h-4" />
                                حفظ التغييرات
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
