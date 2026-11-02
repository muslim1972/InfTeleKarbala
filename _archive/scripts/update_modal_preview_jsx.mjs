import fs from 'fs';

const modalPath = 'D:/InfTeleKarbala/src/features/hr/components/ServiceContinuityProcessModal.tsx';
let content = fs.readFileSync(modalPath, 'utf8');

const targetStart = `{/* Official Letter Preview Component (Refined A4 Government Layout) */}`;
const targetEnd = `{/* Reject Form toggle */}`;

const sIdx = content.indexOf(targetStart);
const eIdx = content.indexOf(targetEnd);

if (sIdx === -1 || eIdx === -1) {
    console.error('Could not find preview target block!');
    process.exit(1);
}

const newPreviewJsx = `{/* Official Letter Preview Component (Refined A4 Government Layout) */}
                    <div
                        id={\`official-letter-print-\${request.id}\`}
                        className="relative p-6 sm:p-8 border rounded-xl bg-white text-slate-950 font-serif space-y-3 shadow-sm overflow-hidden"
                    >
                        {/* Subtle background watermark */}
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 pointer-events-none opacity-10 select-none z-0">
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

                            {/* Dispatch Office Blank Space (Visual guide in modal preview) */}
                            <div className="h-12 border border-dashed border-slate-300 rounded-lg flex items-center justify-between px-3 text-[10.5px] text-slate-400 bg-slate-50/60 my-1">
                                <span>مساحة مخصصة لطابعة الصادرة (تُسحب الورقة فارغة ليُطبع فيها العدد والتاريخ)</span>
                                <span className="font-mono font-bold text-slate-500">العدد: {letterNumber} | التاريخ: {letterDate}</span>
                            </div>

                            {/* Destination (Right) & Subject (Center) */}
                            <div className="pt-1">
                                <div className="text-right">
                                    <h3 className="font-extrabold text-base underline underline-offset-4 decoration-2 text-slate-950 inline-block">
                                        إلى / {request.destination_entity}
                                    </h3>
                                </div>
                                <div className="text-center py-1.5">
                                    <h4 className="font-extrabold text-sm text-slate-900">م / تأييد استمرار بالخدمة</h4>
                                </div>
                            </div>

                            {/* Body - Streamlined according to official instructions */}
                            <div className="text-justify leading-relaxed text-xs space-y-3 font-tajawal">
                                <p className="leading-loose text-[13.5px] text-justify text-slate-900">
                                    نؤيد لكم بأن {honorific} ( <b>{employeeName}</b> ) أحد منتسبي هذه المديرية على الملاك الدائم وما زال مستمراً بالخدمة في الوقت الحاضر وبناءً على طلبه زُوّد بهذا التأييد
                                    {cleanedPurpose ? (
                                        <span>
                                            {' '}وذلك لغرض (<b>{cleanedPurpose}</b>)
                                        </span>
                                    ) : null}
                                </p>

                                {/* Request Conclusion Phrase (In Center) */}
                                <div className="text-center my-2 text-[13.5px] font-extrabold text-slate-900">
                                    ... مـع التقديــر ...
                                </div>

                                {/* Salary Section: ONLY if requested */}
                                {(request.include_nominal_salary || request.include_total_salary) && (
                                    <div className="p-2.5 rounded-lg bg-slate-50/80 border border-slate-200 text-slate-900 leading-normal text-xs space-y-1 my-2">
                                        <p className="font-extrabold text-slate-950">علماً أن:</p>
                                        <div className="pr-3 space-y-1">
                                            {request.include_nominal_salary && (
                                                <div className="flex items-center gap-2">
                                                    <span className="font-bold min-w-[90px]">الراتب الاسمي /</span>
                                                    <span className="font-mono font-bold text-emerald-700">{formatIQD(request.nominal_salary_snapshot)}</span>
                                                </div>
                                            )}
                                            {request.include_total_salary && (
                                                <>
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-bold min-w-[90px]">الراتب الكلي /</span>
                                                        <span className="font-mono font-bold text-emerald-700">{formatIQD(request.total_salary_snapshot)}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-bold min-w-[90px]">الراتب الصافي /</span>
                                                        <span className="font-mono font-bold text-emerald-700">{formatIQD(request.total_salary_snapshot)}</span>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Signatures & Footer Layout */}
                            <div className="space-y-4 pt-3">
                                {/* Dynamic Balanced Row: CC on the Right, Director Signature on the Left */}
                                <div className="flex items-end justify-between gap-4">
                                    {/* CC Recipients Block (نسخة منه إلى) on Right (ONLY if cleanCcList.length > 0) */}
                                    {cleanCcList.length > 0 ? (
                                        <div className="text-right space-y-1 text-xs max-w-sm">
                                            <p className="font-bold text-slate-900 underline underline-offset-4 text-[11.5px]">نسخة منه إلى /</p>
                                            <ul className="space-y-0.5 text-slate-800 pr-1 text-[11px]">
                                                {cleanCcList.map((cc, idx) => (
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

                                {/* Bottom Footer with Double Line and Details */}
                                <div className="pt-2">
                                    <div className="border-t-[2.5px] border-b-[0.8px] border-slate-900 h-1 mb-2" />
                                    <div className="flex items-center justify-between text-[10px] text-slate-700 leading-tight">
                                        <div className="space-y-0.5 text-right font-medium">
                                            <p>العنوان : محافظة كربلاء المقدسة – شارع العباس -ع-</p>
                                            <p>رقم الهاتف : 032333316 &nbsp;|&nbsp; البريد الألكتروني : kerbalatelecoms@itpc.gov.iq</p>
                                            <p>الموقع الألكتروني : www.itpc.gov.iq</p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {qrCodeDataUrl ? (
                                                <div className="p-0.5 rounded border border-slate-300 bg-white shrink-0">
                                                    <img
                                                        src={qrCodeDataUrl}
                                                        alt="QR Code للتحقق"
                                                        className="w-12 h-12 object-contain block"
                                                    />
                                                </div>
                                            ) : null}
                                            <div className="space-y-0.5 text-[9.5px] text-slate-600 font-sans text-right">
                                                <p className="font-bold text-slate-900 flex items-center gap-1">
                                                    <ShieldCheck size={11} className="text-emerald-600 shrink-0" />
                                                    <span>وثيقة رسمية معتمدة</span>
                                                </p>
                                                <p className="font-mono text-slate-500">
                                                    كود: #{request.id.slice(0, 8)}
                                                </p>
                                                <p className="text-[8.5px] text-slate-400 leading-tight">
                                                    امسح الرمز للتحقق الرقمي
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    `;

content = content.slice(0, sIdx) + newPreviewJsx + content.slice(eIdx);

fs.writeFileSync(modalPath, content, 'utf8');
console.log('Preview JSX successfully updated!');
