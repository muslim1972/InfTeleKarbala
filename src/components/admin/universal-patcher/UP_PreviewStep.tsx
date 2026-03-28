/**
 * خطوة معاينة النتائج والتنفيذ
 */
import { Save } from 'lucide-react';
import type { UseUniversalPatcherReturn } from '../../../hooks/useUniversalPatcher';

export function UP_PreviewStep({ patcher }: { patcher: UseUniversalPatcherReturn }) {
    const {
        tableDef, stats, filteredMatches,
        previewFilter, setPreviewFilter,
        allowMissingSkip, setAllowMissingSkip,
        executeUpdate, setStep,
        targetYear, setTargetYear, analyzeData
    } = patcher;

    if (!tableDef) return null;

    const needsYear = tableDef.type === 'yearly' || tableDef.type === 'detail';

    // البحث عن labels للحقول المربوطة
    const getFieldLabel = (fieldValue: string): string => {
        const field = tableDef.fields.find(f => f.value === fieldValue);
        return field?.label || fieldValue;
    };

    return (
        <div className="animate-in slide-in-from-right-8 duration-500 flex flex-col h-full">

            {/* تنبيه السنة — قابل للتعديل */}
            {needsYear && (
                <div className="mx-4 mt-3 p-3 bg-purple-100 dark:bg-purple-900/30 rounded-xl border-2 border-purple-300 dark:border-purple-700 flex items-center justify-center gap-3 shrink-0 flex-wrap">
                    <span className="text-purple-800 dark:text-purple-200 font-bold text-sm">📅 البيانات ستُحقن لسنة:</span>
                    <input
                        type="number"
                        min="2020"
                        max="2030"
                        value={targetYear}
                        onChange={e => setTargetYear(parseInt(e.target.value) || new Date().getFullYear())}
                        className="w-24 text-2xl font-black text-center text-purple-700 dark:text-purple-300 bg-white dark:bg-zinc-800 px-3 py-1 rounded-lg border-2 border-purple-300 dark:border-purple-600"
                    />
                    <button
                        onClick={analyzeData}
                        className="text-xs font-bold bg-purple-600 text-white px-3 py-1.5 rounded-lg hover:bg-purple-700 transition-colors"
                    >
                        🔄 إعادة تحليل
                    </button>
                </div>
            )}

            {/* بطاقات الإحصائيات */}
            <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-3 shrink-0">
                <StatCard
                    label="الكل"
                    count={stats.total}
                    active={previewFilter === 'all'}
                    onClick={() => setPreviewFilter('all')}
                    bgClass="bg-zinc-50 dark:bg-zinc-900"
                    borderClass="border-zinc-200 dark:border-zinc-800"
                    activeClass="border-zinc-500 ring-2 ring-zinc-500/20"
                    countClass="text-zinc-900 dark:text-white"
                />
                <StatCard
                    label="تحديث"
                    count={stats.found}
                    active={previewFilter === 'match'}
                    onClick={() => setPreviewFilter('match')}
                    bgClass="bg-blue-50/50 dark:bg-blue-950/20"
                    borderClass="border-blue-100 dark:border-blue-900/30"
                    activeClass="border-blue-500 ring-2 ring-blue-500/30"
                    countClass="text-blue-700 dark:text-blue-300"
                />
                <StatCard
                    label={tableDef.type === 'detail' ? 'إضافة جديدة' : 'سجل جديد'}
                    count={stats.newRecords}
                    active={previewFilter === 'new_record'}
                    onClick={() => setPreviewFilter('new_record')}
                    bgClass="bg-amber-50/50 dark:bg-amber-950/20"
                    borderClass="border-amber-100 dark:border-amber-900/30"
                    activeClass="border-amber-500 ring-2 ring-amber-500/30"
                    countClass="text-amber-600"
                />
                <StatCard
                    label="غير مطابق"
                    count={stats.missing}
                    active={previewFilter === 'missing'}
                    onClick={() => setPreviewFilter('missing')}
                    bgClass="bg-red-50/50 dark:bg-red-950/20"
                    borderClass="border-red-100 dark:border-red-900/30"
                    activeClass="border-red-500 ring-2 ring-red-500/30"
                    countClass="text-red-600"
                />
            </div>

            {/* قائمة النتائج - بطاقات للموبايل */}
            <div className="flex-1 overflow-auto px-3 md:px-4 pb-4 space-y-1.5">
                {filteredMatches.slice(0, 500).map((m, i) => (
                    <div
                        key={i}
                        className={`p-2.5 rounded-lg border transition-colors ${
                            m.status === 'missing' ? 'bg-red-50/40 dark:bg-red-900/10 border-red-100 dark:border-red-900/30' :
                            m.status === 'new_record' ? 'bg-amber-50/40 dark:bg-amber-900/10 border-amber-100 dark:border-amber-900/30' :
                            'bg-white dark:bg-zinc-900 border-zinc-100 dark:border-zinc-800'
                        }`}
                    >
                        <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                                <StatusBadge status={m.status} />
                                <span className="text-xs font-bold text-zinc-900 dark:text-white truncate">
                                    {m.excelName}
                                </span>
                            </div>
                            {m.currentName && m.currentName !== m.excelName && (
                                <span className="text-[10px] text-zinc-400 truncate max-w-[100px]">
                                    {m.currentName}
                                </span>
                            )}
                        </div>
                        {/* التغييرات */}
                        {Object.keys(m.diffs).length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mt-2 mr-1">
                                {Object.entries(m.diffs).slice(0, 4).map(([key, diff]) => (
                                    <span key={key} className="text-[11px] bg-zinc-100 dark:bg-zinc-800 border dark:border-zinc-700 px-2 py-1 rounded inline-flex items-center gap-1">
                                        <span className="text-zinc-500 font-bold">{getFieldLabel(key)}:</span>
                                        <span className="text-red-400 line-through">{String(diff.old ?? '—')}</span>
                                        <span className="text-zinc-300 mx-0.5">→</span>
                                        <span className="text-green-600 font-bold">{String(diff.new ?? '—')}</span>
                                    </span>
                                ))}
                                {Object.keys(m.diffs).length > 4 && (
                                    <span className="text-[11px] text-zinc-400">+{Object.keys(m.diffs).length - 4}</span>
                                )}
                            </div>
                        )}
                        {Object.keys(m.diffs).length === 0 && m.status === 'new_record' && (
                            <p className="text-xs text-amber-500 mt-1.5 mr-1">الموظف موجود — سيتم إنشاء سجل جديد له في الجدول</p>
                        )}
                        {m.status === 'missing' && (
                            <p className="text-xs text-red-400 mt-1.5 mr-1">الاسم غير مطابق لأي موظف في النظام</p>
                        )}
                    </div>
                ))}
                {filteredMatches.length === 0 && (
                    <div className="py-10 text-center text-zinc-500 font-bold">لا يوجد نتائج</div>
                )}
                {filteredMatches.length > 500 && (
                    <div className="py-3 text-center text-xs text-zinc-500 border-t border-dashed">
                        +{filteredMatches.length - 500} سجل إضافي (سيتم معالجتهم جميعاً)
                    </div>
                )}
            </div>

            {/* Footer Controls */}
            <div className="shrink-0 p-4 border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex justify-between items-center">
                <button
                    onClick={() => setStep('config')}
                    className="px-6 py-2.5 rounded-xl text-zinc-600 dark:text-zinc-400 font-bold hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                >
                    رجوع
                </button>

                <div className="flex items-center gap-3">
                    {stats.missing > 0 && (
                        <label className="flex items-center gap-2 cursor-pointer bg-amber-50 dark:bg-amber-900/20 px-3 py-2 rounded-lg border border-amber-200 dark:border-amber-800/50 text-xs">
                            <input
                                type="checkbox"
                                checked={allowMissingSkip}
                                onChange={e => setAllowMissingSkip(e.target.checked)}
                                className="w-3.5 h-3.5 text-amber-600 rounded"
                            />
                            <span className="font-bold text-amber-900 dark:text-amber-300">
                                تجاوز غير المطابق ({stats.missing})
                            </span>
                        </label>
                    )}
                    <button
                        onClick={executeUpdate}
                        disabled={(stats.found + stats.newRecords) === 0 || (stats.missing > 0 && !allowMissingSkip)}
                        className="px-6 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold text-sm flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-lg shadow-green-500/20"
                    >
                        <Save className="w-4 h-4" />
                        تنفيذ ({stats.found + stats.newRecords})
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Sub-components ─────────────────────────────

function StatCard({ label, count, active, onClick, bgClass, borderClass, activeClass, countClass }: {
    label: string; count: number; active: boolean; onClick: () => void;
    bgClass: string; borderClass: string; activeClass: string; countClass: string;
}) {
    return (
        <div
            onClick={onClick}
            className={`cursor-pointer transition-all p-3 rounded-xl border ${bgClass} ${active ? activeClass : `${borderClass} hover:shadow-md`}`}
        >
            <p className="text-xs font-bold text-zinc-500 mb-1">{label}</p>
            <p className={`text-2xl font-black ${countClass}`}>{count}</p>
        </div>
    );
}

function StatusBadge({ status }: { status: string }) {
    if (status === 'match') {
        return <span className="text-[10px] bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 px-2 py-0.5 rounded-full font-bold">تحديث</span>;
    }
    if (status === 'new_record') {
        return <span className="text-[10px] bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 px-2 py-0.5 rounded-full font-bold">جديد</span>;
    }
    return <span className="text-[10px] bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 px-2 py-0.5 rounded-full font-bold">مفقود</span>;
}
