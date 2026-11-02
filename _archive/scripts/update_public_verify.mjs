import fs from 'fs';

const verifyPath = 'D:/InfTeleKarbala/src/features/hr/components/PublicContinuityVerifyPage.tsx';
let content = fs.readFileSync(verifyPath, 'utf8');

// 1. Update import
content = content.replace(
    `import { getCcActionPhrase } from './ServiceContinuityProcessModal';`,
    `import { getCcActionPhrase, getHonorific } from './ServiceContinuityProcessModal';`
);

// 2. Add gender to VerifiedLetterData
content = content.replace(
    `    department?: string;`,
    `    department?: string;\n    gender?: number | string | null;`
);

// 3. Replace letter container JSX
const targetStart = `{/* Official Letter Paper Representation */}`;
const targetEnd = `{/* Quick Print and Info Actions */}`;

const sIdx = content.indexOf(targetStart);
const eIdx = content.indexOf(targetEnd);

if (sIdx === -1 || eIdx === -1) {
    console.error('Could not find target in PublicContinuityVerifyPage!');
    process.exit(1);
}

const newVerifyJsx = `{/* Official Letter Paper Representation */}
                    <div className="relative p-6 sm:p-10 rounded-2xl bg-white text-slate-950 font-serif border border-slate-200 shadow-xl space-y-4 overflow-hidden">
                        {/* Subtle background watermark */}
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 pointer-events-none opacity-10 select-none z-0">
                            <img src="/itpc-watermark-gray.png" alt="ITPC Watermark" className="w-full h-auto block" />
                        </div>

                        <div className="relative z-10 space-y-3">
                            {/* Letter Header: 3-column Grid */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 items-center gap-3 pb-2">
                                <div className="text-right space-y-0.5 text-xs">
                                    <h4 className="font-extrabold text-[13px] text-slate-950">جمهورية العراق</h4>
                                    <h5 className="font-bold text-[11.5px] text-slate-800">وزارة الاتصالات</h5>
                                    <h5 className="font-bold text-[11.5px] text-slate-800">الشركة العامة للاتصالات والمعلوماتية</h5>
                                    <h5 className="font-extrabold text-[12px] text-slate-950">مديرية اتصالات ومعلوماتية كربلاء المقدسة</h5>
                                    <p className="text-[11px] font-bold text-slate-700">القسم المالي والاداري</p>
                                    <p className="text-[11px] font-bold text-slate-700">شعبة الموارد البشرية</p>
                                </div>
                                <div className="flex justify-center items-center py-1">
                                    <img
                                        src="/itpc-official-header.png"
                                        alt="شعار الشركة العامة للاتصالات والمعلوماتية"
                                        className="w-28 sm:w-32 object-contain"
                                    />
                                </div>
                                <div className="text-left space-y-0.5 text-[10.5px] font-sans text-slate-800" dir="ltr">
                                    <h4 className="font-bold text-[11px] text-slate-950">Republic of Iraq</h4>
                                    <h5 className="font-semibold text-slate-800">Ministry of Communications</h5>
                                    <h5 className="font-semibold text-slate-800">Informatics & Telecommunications Public Company</h5>
                                    <h5 className="font-bold text-slate-950">Karbala Telecom & Informatics Directorate</h5>
                                    <p className="font-medium text-slate-700">Financial & Administrative Department</p>
                                    <p className="font-medium text-slate-700">Human Resources Division</p>
                                </div>
                            </div>

                            {/* Header Double Divider */}
                            <div className="border-t-[2.5px] border-b-[0.8px] border-slate-900 h-1 my-1" />

                            {/* Official Dispatch Metadata Bar */}
                            <div className="h-10 border border-slate-200 rounded-lg flex items-center justify-between px-3 text-[11px] bg-slate-50/80 my-1 font-mono">
                                <span>العدد: <b>{letterData.official_letter_number}</b></span>
                                <span>التاريخ: <b>{letterData.official_letter_date}</b></span>
                            </div>

                            {/* Destination (Right) & Subject (Center) */}
                            <div className="pt-1">
                                <div className="text-right">
                                    <h3 className="font-extrabold text-base sm:text-lg underline underline-offset-4 decoration-2 text-slate-950 inline-block">
                                        إلى / {letterData.destination_entity}
                                    </h3>
                                </div>
                                <div className="text-center py-1.5">
                                    <h4 className="font-extrabold text-sm sm:text-base text-slate-900">م / تأييد استمرار بالخدمة</h4>
                                </div>
                            </div>

                            {/* Official Body */}
                            <div className="text-justify leading-loose text-xs sm:text-sm space-y-3 font-sans">
                                <p className="leading-loose text-justify text-slate-900 text-[13.5px]">
                                    نؤيد لكم بأن {getHonorific(letterData.gender, letterData.employee_name)} ( <b>{letterData.employee_name}</b> ) أحد منتسبي هذه المديرية على الملاك الدائم وما زال مستمراً بالخدمة في الوقت الحاضر وبناءً على طلبه زُوّد بهذا التأييد
                                    {letterData.notes ? (
                                        <span>
                                            {' '}وذلك لغرض (<b>{letterData.notes}</b>)
                                        </span>
                                    ) : null}
                                </p>

                                {/* Request Conclusion Phrase (In Center) */}
                                <div className="text-center my-2 text-[14px] font-extrabold text-slate-900">
                                    ... مـع التقديــر ...
                                </div>

                                {/* Salary Box (if requested) */}
                                {(letterData.include_nominal_salary || letterData.include_total_salary) && (
                                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 leading-normal text-xs sm:text-sm space-y-1 my-2">
                                        <p className="font-extrabold text-slate-950">علماً أن:</p>
                                        <div className="pr-3 space-y-1">
                                            {letterData.include_nominal_salary && (
                                                <div className="flex items-center gap-2">
                                                    <span className="font-bold min-w-[90px]">الراتب الاسمي /</span>
                                                    <span className="font-mono font-bold text-emerald-700">{formatCurrency(letterData.nominal_salary_snapshot)}</span>
                                                </div>
                                            )}
                                            {letterData.include_total_salary && (
                                                <>
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-bold min-w-[90px]">الراتب الكلي /</span>
                                                        <span className="font-mono font-bold text-emerald-700">{formatCurrency(letterData.total_salary_snapshot)}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-bold min-w-[90px]">الراتب الصافي /</span>
                                                        <span className="font-mono font-bold text-emerald-700">{formatCurrency(letterData.total_salary_snapshot)}</span>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Signatures & Footer Layout */}
                            <div className="space-y-4 pt-3">
                                {/* Balanced Row: CC on the Right, Director on the Left */}
                                <div className="flex items-end justify-between gap-4">
                                    {/* CC Section */}
                                    {Array.isArray(letterData.cc_recipients) && letterData.cc_recipients.length > 0 ? (
                                        <div className="text-right space-y-1 text-xs max-w-sm">
                                            <p className="font-bold text-slate-900 underline underline-offset-4 text-[11.5px]">نسخة منه إلى /</p>
                                            <ul className="space-y-0.5 text-slate-800 pr-1 text-[11px]">
                                                {letterData.cc_recipients.map((cc, idx) => (
                                                    <li
                                                        key={idx}
                                                        className="border-b border-dotted border-slate-200 pb-0.5 last:border-b-0"
                                                    >
                                                        <span className="font-bold text-slate-900">• {cc}</span>
                                                        <span className="text-slate-600 font-medium text-[10.5px] pr-1">
                                                            {getCcActionPhrase(cc)}
                                                        </span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    ) : (
                                        <div />
                                    )}

                                    {/* Director Signature on the Left */}
                                    <div className="text-center space-y-0.5 shrink-0 min-w-[200px]">
                                        <p className="text-[12px] text-slate-700 font-bold">الدكتور المهندس</p>
                                        <p className="font-extrabold text-sm text-slate-950">علي عباس جاسم الصباغ</p>
                                        <p className="text-[11px] text-slate-700 font-semibold">مدير مديرية اتصالات ومعلوماتية</p>
                                        <p className="text-[11px] text-slate-700 font-semibold">كربلاء المقدسة</p>
                                    </div>
                                </div>

                                {/* Bottom Footer */}
                                <div className="pt-2">
                                    <div className="border-t-[2.5px] border-b-[0.8px] border-slate-900 h-1 mb-2" />
                                    <div className="flex items-center justify-between text-[10px] text-slate-700 leading-tight">
                                        <div className="space-y-0.5 text-right font-medium">
                                            <p>العنوان : محافظة كربلاء المقدسة – شارع العباس -ع-</p>
                                            <p>رقم الهاتف : 032333316 &nbsp;|&nbsp; البريد الألكتروني : kerbalatelecoms@itpc.gov.iq</p>
                                            <p>الموقع الألكتروني : www.itpc.gov.iq</p>
                                        </div>
                                        <div className="text-right space-y-0.5 text-[10px] text-slate-500 font-mono">
                                            <p className="text-emerald-700 font-bold font-sans flex items-center gap-1">
                                                <ShieldCheck size={14} /> صادرة ومعتمدة أصولياً
                                            </p>
                                            <p>كود التحقق الأمني: #{letterData.request_id?.slice(0, 8)}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    `;

content = content.slice(0, sIdx) + newVerifyJsx + content.slice(eIdx);

fs.writeFileSync(verifyPath, content, 'utf8');
console.log('PublicContinuityVerifyPage successfully updated!');
