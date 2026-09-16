/**
 * خطوة رفع الملف واختيار الجدول
 */
import { Upload, FileSpreadsheet, ArrowLeft } from 'lucide-react';
import { useRef } from 'react';
import { TABLE_DEFINITIONS } from '../../../utils/universalPatcherConfig';
import { GOVERNORATES } from '../../../constants/governorates';
import type { UseUniversalPatcherReturn } from '../../../hooks/useUniversalPatcher';
import { SnapshotNamePicker } from '../../snapshots/SnapshotNamePicker';

export function UP_UploadStep({ patcher }: { patcher: UseUniversalPatcherReturn }) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { fileName, selectedTable, setSelectedTable, handleFileSelect, headers, goToConfig, sheetNames, selectedSheet, setSelectedSheet, headerRowIndex, setHeaderRowIndex, gov, setGov } = patcher;

    return (
        <div className="p-3 md:p-4 space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">

            {/* 🗺️ المحافظة المستهدفة — تُحدد تبعية كل المطابقات والحقن */}
            <div className="p-2.5 rounded-xl border-2 animate-blink-rgb bg-blue-500/5 flex items-center gap-3 relative">
                <label className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300 whitespace-nowrap">المحافظة المستهدفة</label>
                <select
                    value={gov}
                    onChange={(e) => setGov(e.target.value)}
                    className="flex-1 p-1.5 text-[13px] font-bold rounded-lg bg-white dark:bg-zinc-800 border-2 border-green-500 dark:border-green-500 text-green-700 dark:text-green-400 focus:ring-2 ring-blue-500 outline-none transition-colors"
                >
                    {GOVERNORATES.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
                <p className="text-[10px] text-zinc-500 dark:text-zinc-400 hidden md:block max-w-[220px]">
                    تُطابق البيانات وتُحقن لموظفي هذه المحافظة فقط.
                </p>
            </div>

            {/* اختيار الجدول المستهدف */}
            <div className="space-y-2">
                <h3 className="text-sm font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-600 text-xs flex items-center justify-center font-black">1</span>
                    اختر الجدول المستهدف
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                    {TABLE_DEFINITIONS.map(table => (
                        <button
                            key={table.tableName}
                            onClick={() => setSelectedTable(table.tableName)}
                            className={`p-2 rounded-xl border-2 text-right transition-all group flex flex-col justify-center ${selectedTable === table.tableName
                                ? `border-${table.color}-500 bg-${table.color}-50 dark:bg-${table.color}-900/20 ring-2 ring-${table.color}-500/20`
                                : 'border-zinc-200 dark:border-zinc-700 hover:border-zinc-400 bg-white dark:bg-zinc-900'
                                }`}
                        >
                            <div className="text-lg mb-0.5">{table.icon}</div>
                            <div className="text-[11px] font-bold text-zinc-800 dark:text-white truncate">{table.label}</div>
                            <div className="text-[9px] text-zinc-400 font-mono mt-0.5 hidden sm:block">{table.tableName}</div>
                            <div className="text-[9px] text-zinc-500 mt-0.5">
                                {table.type === 'single' ? '📄 سجل واحد' :
                                    table.type === 'yearly' ? '📅 سنوي' :
                                        '📋 تفصيلي'}
                            </div>
                        </button>
                    ))}
                </div>
            </div>

            {selectedTable === 'summer_training_students' && (
                <div className="p-3 rounded-xl border-2 border-emerald-500 bg-emerald-50/50 dark:bg-emerald-900/10 flex flex-col md:flex-row md:items-start gap-3">
                    <label className="text-[12px] font-bold text-emerald-800 dark:text-emerald-300 whitespace-nowrap mt-2">
                        اسم النسخة / الدورة
                    </label>
                    <div className="flex-1">
                        <SnapshotNamePicker 
                            value={patcher.targetBatch} 
                            onChange={patcher.setTargetBatch} 
                            accent="green" 
                            prefix="تدريب " 
                        />
                    </div>
                </div>
            )}

            {/* رفع الملف والإعدادات */}
            <div className="space-y-2">
                <h3 className="text-sm font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-600 text-xs flex items-center justify-center font-black">2</span>
                    رفع ملف Excel والإعدادات
                </h3>
                <input
                    type="file"
                    accept=".xlsx, .xls"
                    ref={fileInputRef}
                    className="hidden"
                    onChange={handleFileSelect}
                />
                
                <div className={`grid gap-3 transition-all duration-500 ${fileName ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'}`}>
                    {/* منطقة الرفع */}
                    <div
                        onClick={() => fileInputRef.current?.click()}
                        className={`w-full border-2 border-dashed border-zinc-200 dark:border-zinc-700 rounded-2xl bg-white dark:bg-zinc-900 hover:bg-blue-50/50 dark:hover:bg-blue-950/20 transition-all cursor-pointer flex flex-col items-center justify-center group ${fileName ? 'py-4' : 'py-6'}`}
                    >
                        {fileName ? (
                            <>
                                <FileSpreadsheet className="w-8 h-8 text-green-500 mb-2 group-hover:scale-110 transition-transform" />
                                <p className="font-bold text-sm text-zinc-800 dark:text-white text-center px-4 line-clamp-1" dir="ltr">{fileName}</p>
                                <p className="text-[11px] text-zinc-500 mt-1">{headers.length} عمود مكتشف • انقر لتغيير</p>
                            </>
                        ) : (
                            <>
                                <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                                    <Upload className="w-6 h-6 text-blue-500" />
                                </div>
                                <p className="font-bold text-sm text-zinc-800 dark:text-white mb-1">انقر لاختيار ملف Excel</p>
                                <p className="text-[11px] text-zinc-500">(.xlsx, .xls)</p>
                            </>
                        )}
                    </div>

                    {/* الإعدادات وزر التالي */}
                    {fileName && headers.length > 0 && (
                        <div className="flex flex-col justify-between space-y-3 bg-zinc-50 dark:bg-zinc-800/50 p-3 rounded-2xl border border-zinc-100 dark:border-zinc-800 animate-in fade-in slide-in-from-right-4 duration-300">
                            <div className="space-y-3">
                                {sheetNames.length > 1 && (
                                    <div className="space-y-1">
                                        <label className="text-[11px] font-bold text-zinc-600 dark:text-zinc-400">ورقة العمل (Sheet)</label>
                                        <select
                                            value={selectedSheet}
                                            onChange={e => setSelectedSheet(e.target.value)}
                                            className="w-full px-2 py-1.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm font-medium focus:ring-2 ring-blue-500 outline-none"
                                        >
                                            {sheetNames.map(s => <option key={s} value={s}>{s}</option>)}
                                        </select>
                                    </div>
                                )}
                                <div className="space-y-1">
                                    <label className="text-[11px] font-bold text-zinc-600 dark:text-zinc-400">صف العناوين (Header Row)</label>
                                    <div className="flex items-center bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg overflow-hidden focus-within:ring-2 ring-blue-500">
                                        <div className="px-2 py-1.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 border-l border-zinc-200 dark:border-zinc-700 text-[11px] font-bold">الصف</div>
                                        <input
                                            type="number"
                                            min="1"
                                            value={headerRowIndex + 1}
                                            onChange={e => setHeaderRowIndex(Math.max(0, parseInt(e.target.value || '1') - 1))}
                                            className="w-full px-2 py-1.5 bg-transparent border-none text-sm font-medium outline-none"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* زر التالي */}
                            <button
                                onClick={goToConfig}
                                disabled={!selectedTable}
                                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2 mt-2"
                            >
                                التالي: ربط الأعمدة 
                                <ArrowLeft className="w-4 h-4" />
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
