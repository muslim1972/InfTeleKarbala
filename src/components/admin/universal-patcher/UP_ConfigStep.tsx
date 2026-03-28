/**
 * خطوة إعداد الربط بين أعمدة Excel وأعمدة DB
 */
import { ArrowRight, FileSpreadsheet, Calendar } from 'lucide-react';
import type { UseUniversalPatcherReturn } from '../../../hooks/useUniversalPatcher';

export function UP_ConfigStep({ patcher }: { patcher: UseUniversalPatcherReturn }) {
    const {
        tableDef, fileName, headers,
        matchColumn, setMatchColumn,
        matchBy, setMatchBy,
        columnMapping, setColumnMapping,
        targetYear, setTargetYear,
        analyzeData,
    } = patcher;

    if (!tableDef) return null;

    const needsYear = tableDef.type === 'yearly' || tableDef.type === 'detail';

    return (
        <div className="p-4 md:p-6 animate-in slide-in-from-right-8 duration-300">
            <div className="max-w-2xl mx-auto space-y-6">

                {/* معلومات الملف والجدول */}
                <div className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200 rounded-xl border border-blue-100 dark:border-blue-900/50">
                    <FileSpreadsheet className="w-5 h-5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm truncate">{fileName}</p>
                        <p className="text-xs opacity-80 mt-0.5">
                            الجدول: <span className="font-bold">{tableDef.icon} {tableDef.label}</span>
                            {' • '}{headers.length} عمود
                        </p>
                    </div>
                </div>

                {/* إدخال السنة (للجداول السنوية/التفصيلية) */}
                {needsYear && (
                    <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-xl border-2 border-purple-300 dark:border-purple-700 space-y-3">
                        <label className="text-base font-black text-purple-800 dark:text-purple-200 flex items-center gap-2">
                            <Calendar className="w-5 h-5" />
                            ⚠️ السنة المستهدفة
                        </label>
                        <input
                            type="number"
                            min="2020"
                            max="2030"
                            value={targetYear}
                            onChange={e => setTargetYear(parseInt(e.target.value) || new Date().getFullYear())}
                            className="w-full px-4 py-3 bg-white dark:bg-zinc-800 border-2 border-purple-300 dark:border-purple-700 rounded-xl text-2xl font-black text-center text-purple-700 dark:text-purple-300"
                        />
                        <p className="text-xs font-bold text-purple-600 dark:text-purple-400 bg-purple-100 dark:bg-purple-900/40 p-2 rounded-lg text-center">
                            {tableDef.type === 'detail'
                                ? '⚠️ تأكد من السنة! سيتم إضافة السجلات الجديدة لهذه السنة'
                                : '⚠️ تأكد من السنة! سيتم البحث عن سجلات هذه السنة وتحديثها'}
                        </p>
                    </div>
                )}

                {/* معيار المطابقة */}
                <div className="p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl border border-zinc-200 dark:border-zinc-700 space-y-3">
                    <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300">
                        معيار المطابقة
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                        <button
                            onClick={() => setMatchBy('full_name')}
                            className={`px-4 py-2.5 rounded-lg border text-sm font-bold transition-all ${matchBy === 'full_name'
                                ? 'bg-blue-600 text-white border-blue-600'
                                : 'bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700 hover:border-blue-400'}`}
                        >
                            الاسم الكامل
                        </button>
                        <button
                            onClick={() => setMatchBy('job_number')}
                            className={`px-4 py-2.5 rounded-lg border text-sm font-bold transition-all ${matchBy === 'job_number'
                                ? 'bg-blue-600 text-white border-blue-600'
                                : 'bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700 hover:border-blue-400'}`}
                        >
                            الرقم الوظيفي
                        </button>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-zinc-500">
                            عمود المطابقة من Excel
                        </label>
                        <select
                            value={matchColumn}
                            onChange={e => setMatchColumn(e.target.value)}
                            className="w-full p-2.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm"
                        >
                            <option value="">اختر العمود...</option>
                            {headers.map((h, i) => (
                                <option key={i} value={String(i)}>
                                    {h || `عمود ${i + 1}`}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* ربط الحقول */}
                <div className="p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl border border-zinc-200 dark:border-zinc-700 space-y-3">
                    <div className="flex items-center justify-between">
                        <h4 className="font-bold text-sm text-zinc-700 dark:text-zinc-300">
                            ربط الأعمدة ↔ الحقول
                        </h4>
                        <span className="text-[10px] text-zinc-400 bg-zinc-200 dark:bg-zinc-700 px-2 py-0.5 rounded">
                            {tableDef.fields.length} حقل متاح
                        </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {tableDef.fields.map(field => (
                            <div key={field.value} className="space-y-1">
                                <label className="text-xs font-bold text-zinc-500 flex items-center gap-1">
                                    <span className={`w-1.5 h-1.5 rounded-full ${columnMapping[field.value] ? 'bg-green-500' : 'bg-zinc-300'}`} />
                                    {field.label}
                                    <span className="text-[9px] text-zinc-400 font-mono">({field.type})</span>
                                </label>
                                <select
                                    value={columnMapping[field.value] || ''}
                                    onChange={e => setColumnMapping(prev => ({ ...prev, [field.value]: e.target.value }))}
                                    className="w-full p-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm"
                                >
                                    <option value="">(تجاهل)</option>
                                    {headers.map((h, i) => (
                                        <option key={i} value={String(i)}>
                                            {h || `عمود ${i + 1}`}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        ))}
                    </div>
                </div>

                {/* أزرار التحكم */}
                <div className="flex gap-3">
                    <button
                        onClick={() => patcher.setStep('upload')}
                        className="px-6 py-2.5 rounded-xl text-zinc-600 dark:text-zinc-400 font-bold hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                    >
                        رجوع
                    </button>
                    <button
                        onClick={analyzeData}
                        disabled={!matchColumn || Object.values(columnMapping).filter(v => v !== '').length === 0}
                        className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-lg shadow-blue-500/20"
                    >
                        التالي: معاينة المطابقة <ArrowRight className="w-4 h-4" />
                    </button>
                </div>

            </div>
        </div>
    );
}
