/**
 * خطوة معاينة النتائج والتنفيذ
 */
import { useState } from 'react';
import { Save, UserPlus, AlertTriangle, Check, ShieldCheck } from 'lucide-react';
import { governorateName } from '../../../constants/governorates';
import type { UseUniversalPatcherReturn } from '../../../hooks/useUniversalPatcher';
import { SnapshotNamePicker } from '../../snapshots/SnapshotNamePicker';
import { UP_ItSupervisorField } from './UP_ItSupervisorField';

export function UP_PreviewStep({ patcher }: { patcher: UseUniversalPatcherReturn }) {
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const {
        tableDef, stats, filteredMatches,
        previewFilter, setPreviewFilter,
        allowMissingSkip, setAllowMissingSkip,
        createMissingAccounts, setCreateMissingAccounts,
        executeUpdate, setStep,
        targetYear, setTargetYear, analyzeData,
        snapshotName, setSnapshotName,
        gov, govOpening,
        itSupervisorId, setItSupervisorId
    } = patcher;

    if (!tableDef) return null;

    const totalExecutionCount = stats.found + stats.newRecords + (createMissingAccounts ? stats.missing : 0);
    const needsYear = tableDef.type === 'yearly' || tableDef.type === 'detail';
    // 📅 الجداول المُدارة بنظام النسخ الشهرية تتطلب تسمية النسخة
    const needsSnapshotName = tableDef.tableName === 'financial_records' || tableDef.tableName === 'profiles';

    const isProfiles = tableDef.tableName === 'profiles';
    const isFinancial = tableDef.tableName === 'financial_records';
    const isYearly = tableDef.tableName === 'yearly_records';
    const isDetail = tableDef.type === 'detail';

    const matchLabel = isProfiles 
        ? 'تحديث موظف' 
        : isFinancial 
            ? 'تحديث قيد مالي' 
            : isYearly 
                ? 'تحديث قيد سنوي' 
                : 'تحديث قيد';

    const newRecordLabel = isProfiles 
        ? 'حساب جديد' 
        : isDetail 
            ? 'إضافة جديدة' 
            : isFinancial 
                ? 'قيد مالي أول' 
                : isYearly 
                    ? 'قيد سنوي أول' 
                    : 'قيد جديد';

    const missingLabel = isProfiles ? 'غير مطابق' : 'موظف غير مسجل';

    // البحث عن labels للحقول المربوطة
    const getFieldLabel = (fieldValue: string): string => {
        const field = tableDef.fields.find(f => f.value === fieldValue);
        return field?.label || fieldValue;
    };

    return (
        <div className="animate-in slide-in-from-right-8 duration-500 flex flex-col h-full">

            {/* 🛡️ شريط التطمين والتحقق الذكي للجداول التابعة */}
            {!isProfiles && !tableDef.isStandalone && stats.missing === 0 && stats.total > 0 && (
                <div className="mx-4 mt-3 p-3 bg-emerald-50 dark:bg-emerald-950/20 border-2 border-emerald-300 dark:border-emerald-800 rounded-xl flex items-center gap-2.5 shrink-0">
                    <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <div className="text-xs text-emerald-800 dark:text-emerald-300 flex-1">
                        <p className="font-bold">
                            ✅ تم التحقق والمطابقة التامة: جميع الموظفين ({stats.total}) مسجلون ومطابقون في المنظومة
                        </p>
                        <p className="text-[11px] mt-0.5 opacity-90 font-medium">
                            سيتم ربط البيانات بحساباتهم الأصلية مباشرة
                            {stats.found > 0 ? ` (${stats.found} تحديث قيد موجود` : ''}
                            {stats.found > 0 && stats.newRecords > 0 ? ' + ' : ''}
                            {stats.newRecords > 0 ? `${stats.newRecords} إنشاء قيد أول في ${tableDef.label}` : ''}
                            {stats.found > 0 || stats.newRecords > 0 ? ')' : ''}
                            {' '}بأمان تام ودون إنشاء أو تكرار أي حساب مستخدم.
                        </p>
                    </div>
                </div>
            )}

            {/* 🆕 وضع افتتاح محافظة جديدة */}
            {govOpening && (
                <div className="mx-4 mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl border-2 border-blue-300 dark:border-blue-800 flex gap-2.5 shrink-0">
                    <UserPlus className="w-5 h-5 shrink-0 text-blue-600 dark:text-blue-400 mt-0.5" />
                    <div className="text-xs space-y-1 text-blue-700 dark:text-blue-400 flex-1">
                        <p className="font-bold">🆕 افتتاح محافظة جديدة — {governorateName(gov)}</p>
                        <p>عند التنفيذ ستُنشأ حسابات الموظفين تلقائياً من عمودي «اسم المستخدم» و«كلمة المرور» في الملف، ثم تُحقن السجلات وتُربط حسب عمود المطابقة المختار.</p>
                    </div>
                </div>
            )}

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

            {/* 📅 تسمية النسخة الشهرية — إلزامية للجداول المُدارة */}
            {needsSnapshotName && (
                <div className="mx-4 mt-3 p-2.5 md:p-3 rounded-xl border-2 animate-blink-rgb bg-blue-500/5 shrink-0 relative">
                    <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1 font-tajawal">
                        📅 اسم النسخة الشهرية <span className="text-red-500">*</span>
                    </label>
                    <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mb-2 font-tajawal">
                        اختر الشهر والسنة ليُبنى اسم النسخة تلقائياً، وستُحفظ البيانات بعد التنفيذ كنسخة يمكن لأي مستخدم الرجوع إليها.
                    </p>
                    <SnapshotNamePicker value={snapshotName} onChange={setSnapshotName} accent="blue" />
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
                    label={matchLabel}
                    count={stats.found}
                    active={previewFilter === 'match'}
                    onClick={() => setPreviewFilter('match')}
                    bgClass="bg-blue-50/50 dark:bg-blue-950/20"
                    borderClass="border-blue-100 dark:border-blue-900/30"
                    activeClass="border-blue-500 ring-2 ring-blue-500/30"
                    countClass="text-blue-700 dark:text-blue-300"
                />
                <StatCard
                    label={newRecordLabel}
                    count={stats.newRecords}
                    active={previewFilter === 'new_record'}
                    onClick={() => setPreviewFilter('new_record')}
                    bgClass="bg-amber-50/50 dark:bg-amber-950/20"
                    borderClass="border-amber-100 dark:border-amber-900/30"
                    activeClass="border-amber-500 ring-2 ring-amber-500/30"
                    countClass="text-amber-600"
                />
                <StatCard
                    label={missingLabel}
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
                                <StatusBadge status={m.status} tableName={tableDef.tableName} tableType={tableDef.type} />
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
                            <p className="text-xs text-amber-600 dark:text-amber-400 mt-1.5 mr-1 font-medium">
                                {isProfiles
                                    ? 'حساب جديد — سيتم إنشاؤه في المنظومة عند التنفيذ'
                                    : `الموظف مطابق ومسجل بالمنظومة — سيتم إنشاء أول قيد له في ${tableDef.label} وربطه بحسابه الأصلي`
                                }
                            </p>
                        )}
                        {m.status === 'missing' && (
                            <p className="text-xs text-red-500 mt-1.5 mr-1 font-medium">
                                {isProfiles
                                    ? 'غير موجود في محافظة الهدف — لن يُحقن إلا بعد إنشاء حسابه'
                                    : 'الموظف غير مسجل في ملفات المحافظة بالمنظومة — يجب إضافته للملفات الشخصية أولاً'
                                }
                            </p>
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

            {/* 🛡️ تحديد مشرف IT — اختياري: يظهر فقط عند وجود قيود للمحافظة في النظام أو عند حقن المعلومات المالية وما يليها، ولا يظهر للتدريب الصيفي */}
            {tableDef.tableName !== 'summer_training_students' && (tableDef.tableName !== 'profiles' || !govOpening) && (
                <div className="mx-4 mt-3 p-4 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shrink-0">
                    <UP_ItSupervisorField
                        onSelect={setItSupervisorId}
                        selectedSupervisorId={itSupervisorId}
                        governorate={gov}
                    />
                </div>
            )}

            {/* Footer Controls */}
            <div className="shrink-0 p-4 border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex justify-between items-center">
                <button
                    onClick={() => setStep('config')}
                    className="px-6 py-2.5 rounded-xl text-zinc-600 dark:text-zinc-400 font-bold hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                >
                    رجوع
                </button>

                <div className="flex items-center gap-2 flex-wrap justify-end">
                    {stats.missing > 0 && (
                        <>
                            <label className={`flex items-center gap-2 cursor-pointer px-3 py-2 rounded-xl border-2 text-xs transition-all ${
                                createMissingAccounts
                                    ? 'bg-blue-500/15 border-blue-500 text-blue-800 dark:text-blue-200 shadow-sm font-bold'
                                    : 'bg-zinc-50 dark:bg-zinc-800/60 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300'
                            }`}>
                                <input
                                    type="checkbox"
                                    checked={createMissingAccounts}
                                    onChange={e => {
                                        setCreateMissingAccounts(e.target.checked);
                                        if (e.target.checked) setAllowMissingSkip(false);
                                    }}
                                    className="w-4 h-4 text-blue-600 rounded"
                                />
                                <span className="flex items-center gap-1.5 font-tajawal font-bold">
                                    <UserPlus className="w-3.5 h-3.5 text-blue-600" />
                                    إضافة غير المطابقين ({stats.missing}) كحسابات جديدة
                                </span>
                            </label>

                            {!createMissingAccounts && (
                                <label className="flex items-center gap-2 cursor-pointer bg-amber-50 dark:bg-amber-900/20 px-3 py-2 rounded-xl border border-amber-200 dark:border-amber-800/50 text-xs">
                                    <input
                                        type="checkbox"
                                        checked={allowMissingSkip}
                                        onChange={e => setAllowMissingSkip(e.target.checked)}
                                        className="w-3.5 h-3.5 text-amber-600 rounded"
                                    />
                                    <span className="font-bold text-amber-900 dark:text-amber-300 font-tajawal">
                                        تجاوز غير المطابق ({stats.missing})
                                    </span>
                                </label>
                            )}
                        </>
                    )}

                    <button
                        onClick={() => {
                            if (needsSnapshotName || createMissingAccounts) {
                                setShowConfirmModal(true);
                            } else {
                                executeUpdate();
                            }
                        }}
                        disabled={totalExecutionCount === 0 || (stats.missing > 0 && !allowMissingSkip && !createMissingAccounts)}
                        className="px-6 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold text-sm flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-lg shadow-green-500/20 font-tajawal"
                    >
                        <Save className="w-4 h-4" />
                        {createMissingAccounts && (stats.found + stats.newRecords === 0)
                            ? `إنشاء الحسابات الجديدة (${stats.missing})`
                            : createMissingAccounts && stats.missing > 0
                            ? `تنفيذ (${totalExecutionCount}) [معالجة ${stats.found + stats.newRecords} + إضافة ${stats.missing}]`
                            : isProfiles
                            ? `تنفيذ (${totalExecutionCount}) [تحديث ${stats.found}${stats.newRecords > 0 ? ` + إضافة ${stats.newRecords}` : ''}]`
                            : `تنفيذ (${totalExecutionCount}) [${stats.found > 0 ? `تحديث ${stats.found}` : ''}${stats.found > 0 && stats.newRecords > 0 ? ' + ' : ''}${stats.newRecords > 0 ? `قيد أول ${stats.newRecords}` : ''}]`}
                    </button>
                </div>
            </div>

            {/* ⚠️ نافذة التأكيد الإلزامية قبل اعتماد النسخة الشهرية أو إنشاء الحسابات */}
            {showConfirmModal && (
                <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-zinc-900 border-2 border-amber-500 rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/40 text-amber-600 flex items-center justify-center shrink-0">
                                <AlertTriangle className="w-6 h-6" />
                            </div>
                            <div>
                                <h3 className="font-bold text-base text-zinc-900 dark:text-white font-tajawal">
                                    تأكيد تنفيذ العملية
                                </h3>
                                <p className="text-xs text-zinc-500 font-tajawal">
                                    يرجى مراجعة وتأكيد بيانات العملية قبل المتابعة
                                </p>
                            </div>
                        </div>

                        <div className="p-3 bg-zinc-50 dark:bg-zinc-800/60 rounded-xl border border-zinc-200 dark:border-zinc-700 space-y-2 text-xs font-tajawal">
                            {patcher.fileName && (
                                <div className="flex justify-between items-center">
                                    <span className="text-zinc-500">الملف المرفوع:</span>
                                    <span className="font-bold text-zinc-800 dark:text-zinc-200 dir-ltr">{patcher.fileName}</span>
                                </div>
                            )}
                            <div className="flex justify-between items-center">
                                <span className="text-zinc-500">المحافظة:</span>
                                <span className="font-bold text-blue-600 dark:text-blue-400">{governorateName(gov)}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-zinc-500">العملية المقررة:</span>
                                <span className="font-bold text-zinc-800 dark:text-zinc-200">
                                    {createMissingAccounts && stats.missing > 0
                                        ? `إضافة (${stats.missing}) حساب جديد ${stats.found + stats.newRecords > 0 ? `+ معالجة (${stats.found + stats.newRecords})` : ''}`
                                        : isProfiles
                                        ? `تحديث (${stats.found}) موظفاً ${stats.newRecords > 0 ? `+ (${stats.newRecords}) حساب جديد` : ''}`
                                        : `معالجة (${stats.found + stats.newRecords}) قيداً [${stats.found > 0 ? `${stats.found} تحديث قيد سابق` : ''}${stats.found > 0 && stats.newRecords > 0 ? ' + ' : ''}${stats.newRecords > 0 ? `${stats.newRecords} إنشاء قيد أول` : ''}] في ${tableDef.label}`
                                    }
                                </span>
                            </div>
                            {needsSnapshotName && (
                                <div className="pt-2 border-t border-zinc-200 dark:border-zinc-700">
                                    <span className="block text-zinc-500 mb-1">الاسم الذي ستُعتمد به النسخة في النظام:</span>
                                    <span className="block p-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-300 font-black text-sm text-center">
                                        {snapshotName}
                                    </span>
                                </div>
                            )}
                        </div>

                        {createMissingAccounts && stats.missing > 0 && (
                            <div className="p-3 bg-blue-50 dark:bg-blue-900/30 rounded-xl border border-blue-300 dark:border-blue-700 space-y-1">
                                <p className="font-black text-xs text-blue-900 dark:text-blue-200 flex items-center gap-1.5 font-tajawal">
                                    <UserPlus className="w-4 h-4 text-blue-600" />
                                    تأكيد فتح قيود جديدة:
                                </p>
                                <p className="text-[11px] text-blue-800 dark:text-blue-300 font-tajawal">
                                    سيتم إنشاء ({stats.missing}) حساب رسمي جديد في نظام {governorateName(gov)}. تأكد أن هذه الأسماء موظفون جدد أو عقود وليس لديهم حسابات سابقة في النظام لتفادي التكرار.
                                </p>
                            </div>
                        )}

                        {needsSnapshotName && (
                            <p className="text-[11px] text-amber-700 dark:text-amber-300 bg-amber-500/10 p-2.5 rounded-lg border border-amber-500/20 font-tajawal">
                                ⚠️ <strong>تنبيه النسخة:</strong> هل تأكدت أن اسم النسخة يطابق تماماً شهر واستحقاق الملف المرفوع؟
                            </p>
                        )}

                        <div className="flex items-center justify-end gap-2 pt-2">
                            <button
                                onClick={() => setShowConfirmModal(false)}
                                className="px-4 py-2 rounded-xl text-zinc-600 dark:text-zinc-400 text-xs font-bold hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors font-tajawal"
                            >
                                تراجع وتعديل الشهر
                            </button>
                            <button
                                onClick={() => {
                                    setShowConfirmModal(false);
                                    executeUpdate();
                                }}
                                className="px-5 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-green-500/20 font-tajawal flex items-center gap-1.5"
                            >
                                <Check className="w-4 h-4" />
                                نعم، متأكد واعتمد الآن
                            </button>
                        </div>
                    </div>
                </div>
            )}
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

function StatusBadge({ status, tableName, tableType }: { status: string; tableName?: string; tableType?: string }) {
    if (status === 'match') {
        return <span className="text-[10px] bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 px-2 py-0.5 rounded-full font-bold">تحديث</span>;
    }
    if (status === 'new_record') {
        const text = tableName === 'profiles' ? 'حساب جديد' : (tableType === 'detail' ? 'إضافة جديدة' : 'قيد أول');
        return <span className="text-[10px] bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 px-2 py-0.5 rounded-full font-bold">{text}</span>;
    }
    return <span className="text-[10px] bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 px-2 py-0.5 rounded-full font-bold">{tableName === 'profiles' ? 'مفقود' : 'غير مسجل'}</span>;
}
