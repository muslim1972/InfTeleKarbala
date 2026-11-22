import fs from 'fs';

const filePath = 'src/components/admin/universal-patcher/UP_PreviewStep.tsx';
let code = fs.readFileSync(filePath, 'utf8');

// 1. Destructure skip props from patcher
const destructureOld = `        gov, govOpening,
        itSupervisorId, setItSupervisorId
    } = patcher;`;

const destructureNew = `        gov, govOpening,
        itSupervisorId, setItSupervisorId,
        toggleSkipRecord,
        skipAllRecords,
        unskipAllRecords,
        isRecordSkipped,
        getMatchKey
    } = patcher;`;

code = code.replace(destructureOld.replace(/\r\n/g, '\n'), destructureNew.replace(/\r\n/g, '\n'));
code = code.replace(destructureOld, destructureNew);

// 2. Update totalExecutionCount calculation
const totalCountOld = `const totalExecutionCount = stats.found + stats.newRecords + (createMissingAccounts ? stats.missing : 0);`;
const totalCountNew = `const approvedExecutionCount = Math.max(0, (stats.found + stats.newRecords + (createMissingAccounts ? stats.missing : 0)) - (stats.skipped || 0));
    const totalExecutionCount = approvedExecutionCount;`;

code = code.replace(totalCountOld, totalCountNew);

// 3. Add toolbar above the list
const listStartOld = `            {/* قائمة النتائج - بطاقات للموبايل */}
            <div className="flex-1 overflow-auto px-3 md:px-4 pb-4 space-y-1.5">`;

const listStartNew = `            {/* شريط إدارة التجاوز والإحصاءات الحية */}
            <div className="mx-3 md:mx-4 mb-2 p-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 rounded-xl flex flex-wrap items-center justify-between gap-2 text-xs shrink-0">
                <div className="flex items-center gap-3">
                    <span className="font-bold text-slate-700 dark:text-slate-200">
                        المعتمد للحقن: <span className="text-emerald-600 dark:text-emerald-400 font-extrabold text-sm">{approvedExecutionCount}</span>
                    </span>
                    {(stats.skipped || 0) > 0 && (
                        <span className="font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 px-2 py-0.5 rounded-md">
                            المتجاوز (تأجيل): {stats.skipped}
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={skipAllRecords}
                        className="px-2.5 py-1 bg-red-50 hover:bg-red-100 dark:bg-red-950/30 dark:hover:bg-red-900/40 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800 rounded-lg font-bold transition-all text-xs"
                    >
                        تجاوز الكل (تأجيل الجميع)
                    </button>
                    <button
                        type="button"
                        onClick={unskipAllRecords}
                        className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600 rounded-lg font-bold transition-all text-xs"
                    >
                        اعتماد الكل
                    </button>
                </div>
            </div>

            {/* قائمة النتائج - بطاقات للموبايل */}
            <div className="flex-1 overflow-auto px-3 md:px-4 pb-4 space-y-1.5">`;

code = code.replace(listStartOld.replace(/\r\n/g, '\n'), listStartNew.replace(/\r\n/g, '\n'));
code = code.replace(listStartOld, listStartNew);

// 4. Update the match item rendering
const matchItemOld = `                {filteredMatches.slice(0, 500).map((m, i) => (
                    <div
                        key={i}
                        className={\`p-2.5 rounded-lg border transition-colors \${
                            m.status === 'missing' ? 'bg-red-50/40 dark:bg-red-900/10 border-red-100 dark:border-red-900/30' :
                            m.status === 'new_record' ? 'bg-amber-50/40 dark:bg-amber-900/10 border-amber-100 dark:border-amber-900/30' :
                            'bg-white dark:bg-zinc-900 border-zinc-100 dark:border-zinc-800'
                        }\`}
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
                        </div>`;

const matchItemNew = `                {filteredMatches.slice(0, 500).map((m, i) => {
                    const itemKey = getMatchKey(m);
                    const isSkipped = isRecordSkipped(itemKey);

                    return (
                    <div
                        key={itemKey || i}
                        className={\`p-2.5 rounded-lg border transition-all \${
                            isSkipped
                                ? 'opacity-40 grayscale bg-zinc-100/90 dark:bg-zinc-800/50 border-dashed border-red-300 dark:border-red-800'
                                : m.status === 'missing'
                                    ? 'bg-red-50/40 dark:bg-red-900/10 border-red-100 dark:border-red-900/30'
                                    : m.status === 'new_record'
                                        ? 'bg-amber-50/40 dark:bg-amber-900/10 border-amber-100 dark:border-amber-900/30'
                                        : 'bg-white dark:bg-zinc-900 border-zinc-100 dark:border-zinc-800'
                        }\`}
                    >
                        <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                                {/* زر/مربع تجاوز القيد */}
                                <label className={\`inline-flex items-center gap-1.5 cursor-pointer px-2 py-0.5 rounded-md border text-[11px] font-bold transition-all select-none shrink-0 \${
                                    isSkipped
                                        ? 'bg-red-100 border-red-300 text-red-700 dark:bg-red-900/40 dark:border-red-700 dark:text-red-300 shadow-sm'
                                        : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-600 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300'
                                }\`}>
                                    <input
                                        type="checkbox"
                                        checked={isSkipped}
                                        onChange={() => toggleSkipRecord(itemKey)}
                                        className="w-3.5 h-3.5 text-red-600 rounded cursor-pointer"
                                    />
                                    <span>{isSkipped ? 'متجاوز ⛔' : 'تجاوز القيد'}</span>
                                </label>

                                <StatusBadge status={m.status} tableName={tableDef.tableName} tableType={tableDef.type} />
                                <span className={\`text-xs font-bold truncate \${isSkipped ? 'line-through text-zinc-400' : 'text-zinc-900 dark:text-white'}\`}>
                                    {m.excelName}
                                </span>
                            </div>
                            {m.currentName && m.currentName !== m.excelName && (
                                <span className="text-[10px] text-zinc-400 truncate max-w-[100px]">
                                    {m.currentName}
                                </span>
                            )}
                        </div>

                        {/* شارة تطمين الحسابات للملفات الشخصية */}
                        {!isSkipped && isProfiles && m.status === 'match' && (
                            <div className="mt-1.5 flex flex-wrap gap-1.5 items-center">
                                <span className="text-[10px] font-bold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 px-2 py-0.5 rounded-md">
                                    🔒 الهوية محفوظة: الاسم والرقم الوظيفي واسم المستخدم لن يتغيروا
                                </span>
                            </div>
                        )}

                        {/* تكليفات المنصب الإداري والبديل */}
                        {!isSkipped && m.posAssignment && (
                            <div className="mt-1.5 flex flex-wrap gap-1.5 items-center">
                                {m.posAssignment.managerDeptName && (
                                    <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 px-2 py-0.5 rounded-md flex items-center gap-1">
                                        <span>👑</span>
                                        <span>سيُعيّن مسؤولاً لـ: {m.posAssignment.managerDeptName}</span>
                                    </span>
                                )}
                                {m.posAssignment.deputyDeptName && (
                                    <span className="text-[10px] font-bold text-cyan-700 dark:text-cyan-300 bg-cyan-50 dark:bg-cyan-950/40 border border-cyan-200 dark:border-cyan-800 px-2 py-0.5 rounded-md flex items-center gap-1">
                                        <span>🛡️</span>
                                        <span>سيُعيّن بديلاً لـ: {m.posAssignment.deputyDeptName}</span>
                                    </span>
                                )}
                                {m.posAssignment.isAmbiguous && (
                                    <span className="text-[10px] font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 px-2 py-0.5 rounded-md flex items-center gap-1">
                                        <span>⚠️</span>
                                        <span>تنبيه إداري: {m.posAssignment.ambiguityReason} (يمكنك تجاوز القيد)</span>
                                    </span>
                                )}
                            </div>
                        )}

                        {isSkipped && (
                            <p className="text-[11px] text-red-600 dark:text-red-400 mt-1.5 font-bold">
                                ⛔ تم تجاوز هذا القيد بناءً على اختيارك — لن يتم تحديثه أو مساسه نهائياً في هذه الدفعة.
                            </p>
                        )}`;

code = code.replace(matchItemOld.replace(/\r\n/g, '\n'), matchItemNew.replace(/\r\n/g, '\n'));
code = code.replace(matchItemOld, matchItemNew);

// Close the inner return
code = code.replace(
    '                    </div>\r\n                ))}\r\n                {filteredMatches.length === 0 && (',
    '                    </div>\r\n                    );\r\n                })}\r\n                {filteredMatches.length === 0 && ('
);
if (!code.includes(');\n                })}\n                {filteredMatches.length === 0 && (')) {
    code = code.replace(
        '                    </div>\n                ))}\n                {filteredMatches.length === 0 && (',
        '                    </div>\n                    );\n                })}\n                {filteredMatches.length === 0 && ('
    );
}

fs.writeFileSync(filePath, code, 'utf8');
console.log('Successfully updated src/components/admin/universal-patcher/UP_PreviewStep.tsx');
