import { ArrowRight, FileSpreadsheet } from 'lucide-react';
import type { UseDataPatcherReturn } from '../../../hooks/useDataPatcher';
import { dbFields } from '../../../utils/dataPatcherUtils';

export function MappingStep({ patcher }: { patcher: UseDataPatcherReturn }) {
    const {
        mode, fileName, sheetNames, selectedSheet, setSelectedSheet,
        headerRowIndex, setHeaderRowIndex, matchBy, setMatchBy,
        keyCol, setKeyCol, headers, valCol, setValCol,
        targetDbField, setTargetDbField, syncMapping, setSyncMapping
    } = patcher;

    return (
        <div className="p-4 md:p-8 animate-in slide-in-from-right-10 duration-300">
            <div className="max-w-2xl mx-auto space-y-8">
                <div className="flex items-center gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200 rounded-xl border border-blue-100 dark:border-blue-900/50">
                    <FileSpreadsheet className="w-5 h-5 flex-shrink-0" />
                    <div>
                        <p className="font-bold text-sm">الملف المحدد: {fileName}</p>
                        <p className="text-xs opacity-80 mt-0.5">يرجى ربط الأعمدة أدناه لبدء عملية المطابقة</p>
                    </div>
                </div>

                {/* Configuration: Sheet & Header Row */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {sheetNames.length > 1 && (
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                                ورقة العمل (Sheet)
                            </label>
                            <select
                                value={selectedSheet}
                                onChange={e => setSelectedSheet(e.target.value)}
                                className="w-full px-3 py-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                {sheetNames.map((sheet: string) => (
                                    <option key={sheet} value={sheet}>{sheet}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                            رقم صف العناوين (Header Row)
                        </label>
                        <input
                            type="number"
                            min="1"
                            value={headerRowIndex + 1}
                            onChange={e => setHeaderRowIndex(Math.max(0, parseInt(e.target.value) - 1))}
                            className="w-full px-3 py-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <p className="text-xs text-zinc-500">حدد رقم الصف الذي يحتوي على أسماء الأعمدة</p>
                    </div>
                </div>

                <div className="grid gap-6">
                    {mode === 'patch' ? (
                        <>
                            {/* Match Configuration */}
                            <div className="bg-zinc-50 dark:bg-zinc-800/50 p-4 rounded-xl border border-zinc-200 dark:border-zinc-700 space-y-4">
                                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                                    معيار المطابقة (Matching Field)
                                </label>
                                <div className="grid grid-cols-2 gap-4">
                                    <button
                                        onClick={() => setMatchBy('full_name')}
                                        className={`px-4 py-3 rounded-lg border text-sm font-bold transition-all ${matchBy === 'full_name'
                                            ? 'bg-blue-600 text-white border-blue-600'
                                            : 'bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700 hover:border-blue-400'
                                            }`}
                                    >
                                        الاسم الكامل (Full Name)
                                    </button>
                                    <button
                                        onClick={() => setMatchBy('username')}
                                        className={`px-4 py-3 rounded-lg border text-sm font-bold transition-all ${matchBy === 'username'
                                            ? 'bg-blue-600 text-white border-blue-600'
                                            : 'bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700 hover:border-blue-400'
                                            }`}
                                    >
                                        اسم المستخدم (Username)
                                    </button>
                                </div>
                                <p className="text-xs text-zinc-500">
                                    {matchBy === 'full_name'
                                        ? 'سيتم مطابقة الاسم العربي مع معالجة الاختلافات (الهمزات، المسافات).'
                                        : 'سيتم المطابقة بدقة مع حقل اسم المستخدم (Username) في النظام.'}
                                </p>
                            </div>

                            {/* Source Key */}
                            <div className="space-y-3">
                                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                                    1. عمود المطابقة من الإكسل
                                </label>
                                <div className="relative">
                                    <select
                                        value={keyCol}
                                        onChange={(e) => setKeyCol(e.target.value)}
                                        className="w-full p-4 pl-10 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl appearance-none focus:ring-2 focus:ring-blue-500 outline-none text-right"
                                    >
                                        <option value="">اختر العمود...</option>
                                        {headers.map((h: string, i: number) => (
                                            <option key={i} value={i.toString()}>
                                                {h || `عمود ${i + 1}`}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="flex justify-center">
                                <div className="bg-zinc-100 dark:bg-zinc-800 p-2 rounded-full">
                                    <ArrowRight className="w-5 h-5 text-zinc-400 rotate-90" />
                                </div>
                            </div>

                            {/* Source Value */}
                            <div className="space-y-3">
                                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                                    2. عمود القيمة الجديدة من الإكسل
                                </label>
                                <select
                                    value={valCol}
                                    onChange={(e) => setValCol(e.target.value)}
                                    className="w-full p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl appearance-none focus:ring-2 focus:ring-blue-500 outline-none text-right"
                                >
                                    <option value="">اختر العمود...</option>
                                    {headers.map((h: string, i: number) => (
                                        <option key={i} value={i.toString()}>
                                            {h || `عمود ${i + 1}`}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Target DB Field */}
                            <div className="space-y-3">
                                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                                    3. الحقل المستهدف في النظام
                                </label>
                                <select
                                    value={targetDbField}
                                    onChange={(e) => setTargetDbField(e.target.value)}
                                    className="w-full p-4 bg-white dark:bg-zinc-900 border-2 border-green-500/20 dark:border-green-500/20 rounded-xl appearance-none focus:ring-2 focus:ring-green-500 outline-none text-right font-bold text-green-700 dark:text-green-400"
                                >
                                    <option value="">اختر الحقل...</option>
                                    {dbFields.map((field) => (
                                        <option key={field.value} value={field.value}>
                                            {field.label}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </>
                    ) : (
                        /* SYNC MODE MAPPING */
                        <div className="space-y-6">
                            <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-xl border border-purple-100 dark:border-purple-900/50 flex gap-3">
                                <div className="p-2 bg-purple-100 dark:bg-purple-800 rounded-lg h-fit">
                                    <FileSpreadsheet className="w-5 h-5 text-purple-600 dark:text-purple-300" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-purple-900 dark:text-purple-100">المزامنة الشاملة (Smart Sync)</h3>
                                    <p className="text-sm text-purple-700 dark:text-purple-300 mt-1">
                                        سيتم تحديث سجلات الموظفين بناءً على <strong>الاسم الكامل (Full Name)</strong> أو <strong>اسم المستخدم</strong>.
                                        يرجى ربط الأعمدة الأساسية أدناه.
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="p-3 bg-zinc-100 dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700">
                                    <h4 className="font-bold text-sm mb-3 text-zinc-700 dark:text-zinc-300">1. الحقول التعريفية (إجبارية)</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {[
                                            { label: 'الرقم الوظيفي (Key)', key: 'job_number', required: false },
                                            { label: 'الاسم الكامل', key: 'full_name', required: true },
                                            { label: 'اسم المستخدم', key: 'username', required: false },
                                        ].map((f) => (
                                            <div key={f.key}>
                                                <label className="block text-xs font-bold text-zinc-500 mb-1">
                                                    {f.label} {f.required && <span className="text-red-500">*</span>}
                                                </label>
                                                <select
                                                    className="w-full p-2.5 bg-white dark:bg-zinc-900 border rounded-lg text-sm"
                                                    value={syncMapping[f.key] || ''}
                                                    onChange={(e) => setSyncMapping(prev => ({ ...prev, [f.key]: e.target.value }))}
                                                >
                                                    <option value="">(غير محدد)</option>
                                                    {headers.map((h: string, i: number) => (
                                                        <option key={i} value={i.toString()}>{h || `Column ${i + 1}`}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="p-3 bg-zinc-100 dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700">
                                    <h4 className="font-bold text-sm mb-3 text-zinc-700 dark:text-zinc-300">2. البيانات المالية</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {dbFields.map((f) => (
                                            <div key={f.value}>
                                                <label className="block text-xs font-medium text-zinc-500 mb-1 truncate">
                                                    {f.label}
                                                </label>
                                                <select
                                                    className="w-full p-2.5 bg-white dark:bg-zinc-900 border rounded-lg text-sm"
                                                    value={syncMapping[f.value] || ''}
                                                    onChange={(e) => setSyncMapping(prev => ({ ...prev, [f.value]: e.target.value }))}
                                                >
                                                    <option value="">(تجاهل)</option>
                                                    {headers.map((h: string, i: number) => (
                                                        <option key={i} value={i.toString()}>{h || `Column ${i + 1}`}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
