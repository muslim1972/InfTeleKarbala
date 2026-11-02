import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
    ShieldCheck,
    AlertTriangle,
    Printer,
    CheckCircle2,
    Loader2,
    Home
} from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { getCcActionPhrase, getHonorific } from './ServiceContinuityProcessModal';

interface VerifiedLetterData {
    success: boolean;
    message?: string;
    request_id?: string;
    official_letter_number?: string;
    official_letter_date?: string;
    destination_entity?: string;
    employee_name?: string;
    job_number?: string;
    job_title?: string;
    department?: string;
    gender?: number | string | null;
    include_nominal_salary?: boolean;
    nominal_salary_snapshot?: number;
    include_total_salary?: boolean;
    total_salary_snapshot?: number;
    notes?: string;
    cc_recipients?: string[];
    created_at?: string;
    issued_at?: string;
    verified_at?: string;
}

const formatCurrency = (val: number | undefined | null) => {
    if (!val) return '0 د.ع';
    return Number(val).toLocaleString('ar-IQ') + ' د.ع';
};

export const PublicContinuityVerifyPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const [isLoading, setIsLoading] = useState(true);
    const [letterData, setLetterData] = useState<VerifiedLetterData | null>(null);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    useEffect(() => {
        const verifyLetter = async () => {
            if (!id) {
                setErrorMsg('معرّف الوثيقة مفقود في الرابط');
                setIsLoading(false);
                return;
            }

            try {
                setIsLoading(true);
                const { data, error } = await supabase.rpc('verify_continuity_letter', {
                    p_request_id: id
                });

                if (error) throw error;

                const res = data as VerifiedLetterData;
                if (!res || !res.success) {
                    setErrorMsg(res?.message || 'تعذر التحقق من صحة صدور الوثيقة');
                } else {
                    setLetterData(res);
                }
            } catch (err: any) {
                console.error('Verification error:', err);
                setErrorMsg(err.message || 'حدث خطأ أثناء الاتصال بخادم التحقق');
            } finally {
                setIsLoading(false);
            }
        };

        verifyLetter();
    }, [id]);

    return (
        <div className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans p-3 sm:p-6 flex flex-col items-center justify-start antialiased selection:bg-cyan-500 selection:text-white">
            {/* Top Verification Header Bar */}
            <div className="w-full max-w-3xl mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-cyan-600 text-white flex items-center justify-center font-bold shadow-md shadow-cyan-600/20">
                        <ShieldCheck size={20} />
                    </div>
                    <div>
                        <h1 className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100">
                            منظومة التحقق الرقمي من الوثائق
                        </h1>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400">
                            مديرية الاتصالات ومعلوماتية كربلاء المقدسة
                        </p>
                    </div>
                </div>

                <Link
                    to="/login"
                    className="text-[11px] font-semibold text-cyan-700 dark:text-cyan-400 hover:underline flex items-center gap-1"
                >
                    <Home size={14} />
                    <span>البوابة الرسمية</span>
                </Link>
            </div>

            {/* Loading State */}
            {isLoading && (
                <div className="w-full max-w-3xl p-12 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col items-center justify-center gap-3">
                    <Loader2 size={36} className="animate-spin text-cyan-600" />
                    <p className="text-xs font-bold text-slate-600 dark:text-slate-300">
                        جاري التحقق من صحة صدور الوثيقة من قاعدة البيانات المركزية...
                    </p>
                </div>
            )}

            {/* Error / Invalid Document State */}
            {!isLoading && (errorMsg || !letterData || !letterData.success) && (
                <div className="w-full max-w-3xl p-6 sm:p-8 rounded-2xl bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-900/60 shadow-lg text-center space-y-4">
                    <div className="w-16 h-16 rounded-full bg-rose-100 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto">
                        <AlertTriangle size={32} />
                    </div>
                    <div className="space-y-1">
                        <h2 className="text-base sm:text-lg font-extrabold text-rose-600 dark:text-rose-400">
                            تعذر التحقق من الوثيقة
                        </h2>
                        <p className="text-xs text-slate-600 dark:text-slate-400 max-w-md mx-auto">
                            {errorMsg || 'الوثيقة غير موجودة في السجل الرسمي، أو أنها ملغاة أو لم تصدر أصولياً من قبل الموارد البشرية.'}
                        </p>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 text-[11px] text-slate-500 font-mono">
                        معرّف الفحص: {id || 'غير محدد'}
                    </div>
                </div>
            )}

            {/* Valid & Verified Document View */}
            {!isLoading && letterData && letterData.success && (
                <div className="w-full max-w-3xl space-y-4">
                    {/* Live Authenticity Banner */}
                    <div className="p-4 sm:p-4.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-700 text-white shadow-lg shadow-emerald-700/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                            <div className="w-11 h-11 rounded-xl bg-white/15 backdrop-blur-sm flex items-center justify-center text-white shrink-0">
                                <CheckCircle2 size={26} />
                            </div>
                            <div className="space-y-0.5">
                                <div className="flex items-center gap-2">
                                    <span className="font-extrabold text-sm sm:text-base">
                                        وثيقة رسمية صادرة ومعتمدة أصولياً
                                    </span>
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-white/20">
                                        موثقة إلكترونياً
                                    </span>
                                </div>
                                <p className="text-xs text-emerald-100">
                                    الكتاب الصادر بالعدد ({letterData.official_letter_number}) بتاريخ ({letterData.official_letter_date})
                                </p>
                            </div>
                        </div>

                        <div className="text-right sm:text-left text-[11px] text-emerald-100/90 font-mono shrink-0">
                            <span>تاريخ الفحص اللحظي:</span>
                            <span className="block font-bold text-white">
                                {letterData.verified_at
                                    ? new Date(letterData.verified_at).toLocaleString('ar-IQ')
                                    : new Date().toLocaleString('ar-IQ')}
                            </span>
                        </div>
                    </div>

                    {/* Official Letter Paper Representation */}
                    <div className="relative p-6 sm:p-10 rounded-2xl bg-white text-slate-950 font-serif border border-slate-200 shadow-xl space-y-4 overflow-hidden">
                        {/* Subtle background watermark */}
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 pointer-events-none opacity-10 select-none z-0">
                            <img src="/itpc-watermark-gray.png" alt="ITPC Watermark" className="w-full h-auto block" />
                        </div>

                        <div className="relative z-10 space-y-3">
                            {/* Letter Header: 3-column Grid */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 items-center gap-3 pb-2">
                                <div className="text-center space-y-0.5 text-xs">
                                    <h4 className="font-extrabold text-[12px] text-slate-950">وزارة الاتصالات</h4>
                                    <h5 className="font-bold text-[11px] text-slate-800">الشركة العامة للاتصالات والمعلوماتية</h5>
                                    <h5 className="font-extrabold text-[11px] text-slate-950">مديرية اتصالات ومعلوماتية كربلاء المقدسة</h5>
                                    <p className="text-[10px] font-bold text-slate-700">القسم المالي والاداري</p>
                                    <p className="text-[10px] font-bold text-slate-700">شعبة الموارد البشرية</p>
                                </div>
                                <div className="flex justify-center items-center py-1">
                                    <img
                                        src="/itpc-official-header.png"
                                        alt="شعار الشركة العامة للاتصالات والمعلوماتية"
                                        className="w-36 sm:w-40 object-contain"
                                    />
                                </div>
                                <div className="text-center space-y-0.5 text-[10px] font-sans text-slate-800" dir="ltr">
                                    <h4 className="font-bold text-[11px] text-slate-950">Ministry of Communications</h4>
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
                                <div className="flex items-end justify-between gap-4 w-full">
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
                                        <div className="max-w-sm flex-1" />
                                    )}

                                    {/* Director Signature permanently anchored on the Left */}
                                    <div className="text-center space-y-0.5 shrink-0 min-w-[200px] mr-auto">
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

                    {/* Quick Print and Info Actions */}
                    <div className="flex items-center justify-between gap-2 pt-2">
                        <button
                            type="button"
                            onClick={() => window.print()}
                            className="px-4 py-2 rounded-xl bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 text-xs font-bold flex items-center gap-2 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-750 transition-all"
                        >
                            <Printer size={16} className="text-emerald-600" />
                            <span>طباعة نسخة من الوثيقة</span>
                        </button>

                        <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                            نظام الإدارة الموحد • ITPC Karbala
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PublicContinuityVerifyPage;
