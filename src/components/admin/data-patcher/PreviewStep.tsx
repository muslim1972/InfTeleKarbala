import { AlertTriangle, CheckCircle2, PlusCircle, X } from 'lucide-react';
import type { UseDataPatcherReturn } from '../../../hooks/useDataPatcher';

export function PreviewStep({ patcher }: { patcher: UseDataPatcherReturn }) {
    const {
        stats, showMissingModal, setShowMissingModal,
        matches, mode, headers
    } = patcher;

    return (
        <div className="h-full flex flex-col p-6 animate-in slide-in-from-right-10 duration-300">
            {/* Missing Records Warning Zone */}
            {stats.missing > 0 && (
                <div className="mb-4 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-900/50 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div>
                        <h4 className="font-bold text-amber-800 dark:text-amber-400 flex items-center gap-2">
                            <AlertTriangle className="w-5 h-5" />
                            تنبيه مهم: {stats.missing} سجل إضافي في الإكسل
                        </h4>
                        <p className="text-sm text-amber-700/80 dark:text-amber-400/80 mt-1">
                            تم إيجاد أسماء وأرقام في هذا الملف لا تمتلك أي قيود أساسية لدينا في قاعدة البيانات لتتم المطابقة المعيارية عليها.
                        </p>
                    </div>
                    <button
                        onClick={() => setShowMissingModal(true)}
                        className="whitespace-nowrap px-4 py-2 bg-amber-100 hover:bg-amber-200 dark:bg-amber-800/50 dark:hover:bg-amber-800 text-amber-700 dark:text-amber-300 font-bold rounded-lg transition-colors border border-amber-300 dark:border-amber-700 shadow-sm"
                    >
                        استعراض الأسماء الإضافية
                    </button>
                </div>
            )}

            {/* Stats Bar */}
            <div className="grid grid-cols-4 gap-2 mb-4">
                <div className="bg-blue-50 dark:bg-blue-900/20 p-2 rounded-lg border border-blue-100 dark:border-blue-900/50 flex flex-col items-center justify-center">
                    <p className="text-[10px] text-blue-600 dark:text-blue-400 font-bold uppercase">العدد الكلي</p>
                    <p className="text-xl font-bold text-blue-700 dark:text-blue-300">{stats.total}</p>
                </div>
                <div className="bg-green-50 dark:bg-green-900/20 p-2 rounded-lg border border-green-100 dark:border-green-900/50 flex flex-col items-center justify-center">
                    <p className="text-[10px] text-green-600 dark:text-green-400 font-bold uppercase">تحديث</p>
                    <p className="text-xl font-bold text-green-700 dark:text-green-300">{stats.found}</p>
                </div>
                <div className="bg-purple-50 dark:bg-purple-900/20 p-2 rounded-lg border border-purple-100 dark:border-purple-900/50 flex flex-col items-center justify-center">
                    <p className="text-[10px] text-purple-600 dark:text-purple-400 font-bold uppercase">سجلات جديدة</p>
                    <p className="text-xl font-bold text-purple-700 dark:text-purple-300">{stats.new}</p>
                </div>
                <div className="bg-amber-50 dark:bg-amber-900/20 p-2 rounded-lg border border-amber-100 dark:border-amber-900/50 flex flex-col items-center justify-center">
                    <p className="text-[10px] text-amber-600 dark:text-amber-400 font-bold uppercase">غير موجود</p>
                    <p className="text-xl font-bold text-amber-700 dark:text-amber-300">{stats.missing}</p>
                </div>
            </div>

            {/* Table */}
            <div className="flex-1 overflow-hidden border border-zinc-200 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-900">
                <div className="overflow-y-auto h-full">
                    <table className="w-full text-right bg-white dark:bg-zinc-900">
                        <thead className="sticky top-0 bg-zinc-50 dark:bg-zinc-800 text-xs font-bold text-zinc-500 uppercase tracking-wider z-10 shadow-sm">
                            <tr>
                                <th className="p-3 w-16 text-center">الحالة</th>
                                <th className="p-3">الاسم (النظام/الملف)</th>
                                <th className="p-3 text-left">القيمة الجديدة</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                            {matches.map((m, idx) => (
                                <tr key={idx} className={`group transition-colors ${m.status === 'match' ? 'hover:bg-green-50/50 dark:hover:bg-green-900/10' :
                                    m.status === 'new_record' ? 'bg-purple-50/30 hover:bg-purple-50/50 dark:bg-purple-900/10 dark:hover:bg-purple-900/20' :
                                        'bg-red-50/30 dark:bg-red-900/10'
                                    }`}>
                                    <td className="p-3 text-center">
                                        {m.status === 'match' ? (
                                            <div className="flex justify-center" title="تحديث سجل موجود">
                                                <CheckCircle2 className="w-5 h-5 text-green-500" />
                                            </div>
                                        ) : m.status === 'new_record' ? (
                                            <div className="flex justify-center" title="إنشاء سجل جديد">
                                                <PlusCircle className="w-5 h-5 text-purple-500" />
                                            </div>
                                        ) : (
                                            <div className="flex justify-center" title="غير موجود في النظام">
                                                <AlertTriangle className="w-5 h-5 text-amber-500" />
                                            </div>
                                        )}
                                    </td>
                                    <td className="p-3">
                                        <div className="flex flex-col">
                                            <span className={`font-bold ${m.status === 'match' ? 'text-zinc-900 dark:text-zinc-100' :
                                                m.status === 'new_record' ? 'text-purple-700 dark:text-purple-300' :
                                                    'text-zinc-400'
                                                }`}>
                                                {m.currentName || '—'}
                                            </span>
                                            <span className="text-xs text-zinc-500 font-mono mt-0.5">
                                                {m.excelName}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="p-3 text-left font-mono font-bold text-blue-600 dark:text-blue-400 dir-ltr">
                                        {mode === 'patch' ? (
                                            m.newValue
                                        ) : (
                                            <div className="text-xs">
                                                {m.newValue && typeof m.newValue === 'object' ? (
                                                    Object.keys(m.newValue).length + ' حقول'
                                                ) : (
                                                    '—'
                                                )}
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Missing Records Modal */}
            {showMissingModal && (
                <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-2xl w-full max-w-5xl max-h-[85vh] flex flex-col border border-zinc-200 dark:border-zinc-800 animate-in zoom-in-95 duration-200">
                        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center bg-zinc-50 dark:bg-zinc-800/50 rounded-t-xl">
                            <h3 className="font-bold text-lg flex items-center gap-2 text-zinc-900 dark:text-white">
                                <AlertTriangle className="w-5 h-5 text-amber-500" />
                                الأسماء الإضافية غير المتطابقة مع النظام ({stats.missing})
                            </h3>
                            <button
                                onClick={() => setShowMissingModal(false)}
                                className="p-1.5 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg transition-colors"
                            >
                                <X className="w-5 h-5 text-zinc-500" />
                            </button>
                        </div>
                        <div className="p-4 flex-1 overflow-auto bg-zinc-50/30 dark:bg-black/10">
                            <div className="border border-zinc-200 dark:border-zinc-700 rounded-xl overflow-hidden bg-white dark:bg-zinc-900 shadow-sm">
                                <table className="w-full text-right text-sm">
                                    <thead className="bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 font-bold border-b border-zinc-200 dark:border-zinc-700">
                                        <tr>
                                            <th className="p-3 w-12 text-center">#</th>
                                            <th className="p-3">الاسم في الإكسل</th>
                                            <th className="p-3">القيمة الجديدة</th>
                                            <th className="p-3 w-1/2">بيانات الصف بالكامل (مقتطف مع العناوين)</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                                        {matches.filter(m => m.status === 'missing').map((m, idx) => (
                                            <tr key={idx} className="hover:bg-amber-50/30 dark:hover:bg-amber-900/10 transition-colors">
                                                <td className="p-3 text-center font-mono text-zinc-400">{idx + 1}</td>
                                                <td className="p-3 font-bold text-amber-700 dark:text-amber-500">
                                                    {m.excelName || 'بدون اسم'}
                                                </td>
                                                <td className="p-3 text-blue-600 dark:text-blue-400 font-mono" dir="ltr">
                                                    {typeof m.newValue === 'object' ? JSON.stringify(m.newValue) : String(m.newValue)}
                                                </td>
                                                <td className="p-3 text-xs text-zinc-500 font-mono leading-relaxed" dir="ltr">
                                                    {m.rawRow ?
                                                        m.rawRow.map((cell: any, i: number) =>
                                                            cell && headers[i] ? `[${headers[i]}]: ${cell}` : null
                                                        ).filter(Boolean).join(' | ').substring(0, 150) + (m.rawRow.length > 5 ? '...' : '')
                                                        : '—'}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
