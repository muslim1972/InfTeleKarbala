/**
 * خطوة رفع الملف واختيار الجدول
 */
import { Upload, FileSpreadsheet } from 'lucide-react';
import { useRef } from 'react';
import { TABLE_DEFINITIONS } from '../../../utils/universalPatcherConfig';
import type { UseUniversalPatcherReturn } from '../../../hooks/useUniversalPatcher';

export function UP_UploadStep({ patcher }: { patcher: UseUniversalPatcherReturn }) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { fileName, selectedTable, setSelectedTable, handleFileSelect, headers, goToConfig, sheetNames, selectedSheet, setSelectedSheet, headerRowIndex, setHeaderRowIndex } = patcher;

    return (
        <div className="p-4 md:p-6 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">

            {/* اختيار الجدول المستهدف */}
            <div className="space-y-3">
                <h3 className="text-sm font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-600 text-xs flex items-center justify-center font-black">1</span>
                    اختر الجدول المستهدف
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                    {TABLE_DEFINITIONS.map(table => (
                        <button
                            key={table.tableName}
                            onClick={() => setSelectedTable(table.tableName)}
                            className={`p-3 rounded-xl border-2 text-right transition-all group ${selectedTable === table.tableName
                                ? `border-${table.color}-500 bg-${table.color}-50 dark:bg-${table.color}-900/20 ring-2 ring-${table.color}-500/20`
                                : 'border-zinc-200 dark:border-zinc-700 hover:border-zinc-400 bg-white dark:bg-zinc-900'
                                }`}
                        >
                            <div className="text-lg mb-1">{table.icon}</div>
                            <div className="text-xs font-bold text-zinc-800 dark:text-white truncate">{table.label}</div>
                            <div className="text-[10px] text-zinc-400 font-mono mt-0.5">{table.tableName}</div>
                            <div className="text-[10px] text-zinc-500 mt-1">
                                {table.type === 'single' ? '📄 سجل واحد/موظف' :
                                    table.type === 'yearly' ? '📅 سنوي' :
                                        '📋 تفصيلي (عدة سجلات)'}
                            </div>
                        </button>
                    ))}
                </div>
            </div>

            {/* رفع الملف */}
            <div className="space-y-3">
                <h3 className="text-sm font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-600 text-xs flex items-center justify-center font-black">2</span>
                    رفع ملف Excel
                </h3>
                <input
                    type="file"
                    accept=".xlsx, .xls"
                    ref={fileInputRef}
                    className="hidden"
                    onChange={handleFileSelect}
                />
                <div
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full border-2 border-dashed border-zinc-200 dark:border-zinc-700 rounded-2xl bg-white dark:bg-zinc-900 hover:bg-blue-50/50 dark:hover:bg-blue-950/20 transition-all cursor-pointer flex flex-col items-center justify-center py-10 group"
                >
                    {fileName ? (
                        <>
                            <FileSpreadsheet className="w-10 h-10 text-green-500 mb-3" />
                            <p className="font-bold text-zinc-800 dark:text-white">{fileName}</p>
                            <p className="text-xs text-zinc-500 mt-1">{headers.length} عمود مكتشف • انقر لتغيير الملف</p>
                        </>
                    ) : (
                        <>
                            <div className="w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                                <Upload className="w-7 h-7 text-blue-500" />
                            </div>
                            <p className="font-bold text-zinc-800 dark:text-white mb-1">انقر لاختيار ملف Excel</p>
                            <p className="text-xs text-zinc-500">(.xlsx, .xls)</p>
                        </>
                    )}
                </div>
            </div>

            {/* إعدادات الملف (تظهر بعد رفع الملف) */}
            {fileName && headers.length > 0 && (
                <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {sheetNames.length > 1 && (
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-zinc-500">ورقة العمل (Sheet)</label>
                                <select
                                    value={selectedSheet}
                                    onChange={e => setSelectedSheet(e.target.value)}
                                    className="w-full px-3 py-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm"
                                >
                                    {sheetNames.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>
                        )}
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-zinc-500">صف العناوين (Header Row)</label>
                            <input
                                type="number"
                                min="1"
                                value={headerRowIndex + 1}
                                onChange={e => setHeaderRowIndex(Math.max(0, parseInt(e.target.value || '1') - 1))}
                                className="w-full px-3 py-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm"
                            />
                        </div>
                    </div>

                    {/* زر التالي */}
                    <button
                        onClick={goToConfig}
                        disabled={!selectedTable}
                        className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-blue-500/20"
                    >
                        التالي: ربط الأعمدة →
                    </button>
                </div>
            )}
        </div>
    );
}
