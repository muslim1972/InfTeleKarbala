import { useState } from 'react';
import { FileText, Printer, CheckCircle, X, Loader2, Building, DollarSign, User } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { useTheme } from '../../../context/ThemeContext';
import { cn } from '../../../lib/utils';
import { toast } from 'react-hot-toast';

export interface ContinuityRequestItem {
    id: string;
    user_id: string;
    destination_entity: string;
    include_nominal_salary: boolean;
    include_total_salary: boolean;
    nominal_salary_snapshot: number;
    total_salary_snapshot: number;
    notes?: string | null;
    status: 'pending_supervisor' | 'rejected_by_supervisor' | 'pending_hr' | 'rejected_by_hr' | 'issued_and_dispatched';
    supervisor_id?: string | null;
    supervisor_decision_at?: string | null;
    supervisor_notes?: string | null;
    hr_processor_id?: string | null;
    hr_decision_at?: string | null;
    hr_notes?: string | null;
    official_letter_number?: string | null;
    official_letter_date?: string | null;
    created_at: string;
    employee?: {
        full_name?: string;
        job_number?: string;
        job_title?: string;
        department?: string;
    } | null;
    supervisor?: {
        full_name?: string;
    } | null;
}

interface ServiceContinuityProcessModalProps {
    request: ContinuityRequestItem;
    onClose: () => void;
    onSuccess: () => void;
}

export const ServiceContinuityProcessModal = ({
    request,
    onClose,
    onSuccess
}: ServiceContinuityProcessModalProps) => {
    const { theme } = useTheme();
    const isDark = theme === 'dark';

    const [letterNumber, setLetterNumber] = useState(
        request.official_letter_number || `ت/${new Date().getFullYear()}/${Math.floor(Math.random() * 800 + 100)}`
    );
    const [letterDate, setLetterDate] = useState(
        request.official_letter_date || new Date().toISOString().split('T')[0]
    );
    const [dispatchNotes, setDispatchNotes] = useState(request.hr_notes || '');
    const [rejectReason, setRejectReason] = useState('');
    const [showRejectBox, setShowRejectBox] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const formatIQD = (val: number | undefined | null) => {
        if (!val) return '0 د.ع';
        return Number(val).toLocaleString('ar-IQ') + ' د.ع';
    };

    const handleIssue = async () => {
        if (!letterNumber.trim()) {
            toast.error('يرجى إدخال رقم الكتاب الرسمي الصادر');
            return;
        }

        try {
            setIsLoading(true);
            const { data, error } = await supabase.rpc('process_service_continuity_hr_issue', {
                p_request_id: request.id,
                p_action: 'issue',
                p_official_letter_number: letterNumber.trim(),
                p_official_letter_date: letterDate,
                p_dispatch_notes: dispatchNotes.trim() || null,
                p_notes: dispatchNotes.trim() || null
            });

            if (error) throw error;
            const res = data as any;
            if (!res?.success) {
                toast.error(res?.message || 'تعذر إصدار الكتاب');
                return;
            }

            toast.success('تم إصدار كتاب تأييد الاستمرارية الرسمي بنجاح وتوثيقه أصولياً');
            onSuccess();
            onClose();
        } catch (err: any) {
            console.error('Error issuing continuity letter:', err);
            toast.error(err?.message || 'حدث خطأ أثناء إصدار الكتاب');
        } finally {
            setIsLoading(false);
        }
    };

    const handleReject = async () => {
        if (!rejectReason.trim()) {
            toast.error('يرجى ذكر سبب رفض الطلب للموظف');
            return;
        }

        try {
            setIsLoading(true);
            const { data, error } = await supabase.rpc('process_service_continuity_hr_issue', {
                p_request_id: request.id,
                p_action: 'reject',
                p_notes: rejectReason.trim()
            });

            if (error) throw error;
            const res = data as any;
            if (!res?.success) {
                toast.error(res?.message || 'تعذر رفض الطلب');
                return;
            }

            toast.success('تم رفض الطلب وإشعار الموظف بالسبب أصولياً');
            onSuccess();
            onClose();
        } catch (err: any) {
            console.error('Error rejecting continuity request:', err);
            toast.error(err?.message || 'حدث خطأ أثناء الرفض');
        } finally {
            setIsLoading(false);
        }
    };

    const employeeName = request.employee?.full_name || 'الموظف';
    const jobNumber = request.employee?.job_number || 'غير محدد';
    const jobTitle = request.employee?.job_title || 'موظف';
    const department = request.employee?.department || 'مديرية اتصالات ومعلوماتية كربلاء';
    const isAlreadyIssued = request.status === 'issued_and_dispatched';

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 pt-16 sm:pt-20 pb-6 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className={cn(
                "w-full max-w-2xl rounded-2xl border shadow-2xl relative max-h-[calc(100vh-5.5rem)] flex flex-col my-auto overflow-hidden",
                isDark ? "bg-slate-900 border-slate-700 text-white" : "bg-white border-slate-200 text-slate-900"
            )}>
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-border shrink-0">
                    <div className="flex items-center gap-2">
                        <FileText className="w-5 h-5 text-blue-500" />
                        <div>
                            <h3 className="font-bold text-sm">
                                {isAlreadyIssued ? 'معاينة كتاب تأييد الاستمرارية الصادر' : 'معالجة وإصدار كتاب تأييد استمرارية بالخدمة'}
                            </h3>
                            <p className="text-[11px] text-muted-foreground">
                                شعبة الموارد البشرية • الإدارة الموحدة
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-4 space-y-4 overflow-y-auto pr-2 flex-1 text-xs">
                    {/* Employee Profile Box */}
                    <div className={cn(
                        "p-3 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3",
                        isDark ? "bg-slate-800/60 border-slate-700" : "bg-slate-50 border-slate-200"
                    )}>
                        <div className="space-y-1">
                            <div className="flex items-center gap-2">
                                <User className="w-4 h-4 text-blue-500" />
                                <span className="font-bold text-sm text-foreground">{employeeName}</span>
                                <span className="px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 font-mono text-[11px]">
                                    رقم وظيفي: {jobNumber}
                                </span>
                            </div>
                            <p className="text-[11px] text-muted-foreground">
                                {jobTitle} • {department}
                            </p>
                        </div>

                        <div className="text-right sm:text-left text-[11px] text-muted-foreground">
                            <span>تاريخ تقديم الطلب:</span>
                            <span className="font-mono block text-foreground font-medium">
                                {new Date(request.created_at).toLocaleDateString('ar-IQ')}
                            </span>
                        </div>
                    </div>

                    {/* Destination & Purpose */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className={cn(
                            "p-3 rounded-xl border",
                            isDark ? "bg-slate-800/40 border-slate-700" : "bg-white border-slate-200"
                        )}>
                            <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                                <Building className="w-3.5 h-3.5 text-emerald-500" />
                                <span className="font-bold text-[11px]">الجهة المعنون إليها التأييد:</span>
                            </div>
                            <p className="font-bold text-sm text-foreground">{request.destination_entity}</p>
                        </div>

                        <div className={cn(
                            "p-3 rounded-xl border",
                            isDark ? "bg-slate-800/40 border-slate-700" : "bg-white border-slate-200"
                        )}>
                            <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                                <DollarSign className="w-3.5 h-3.5 text-amber-500" />
                                <span className="font-bold text-[11px]">البيانات المالية المطلوبة:</span>
                            </div>
                            <div className="flex flex-col gap-1 text-[11px]">
                                <span>
                                    الراتب الاسمي: {request.include_nominal_salary ? <b className="text-emerald-600">{formatIQD(request.nominal_salary_snapshot)}</b> : <span className="text-muted-foreground">غير مطلوب</span>}
                                </span>
                                <span>
                                    الراتب الصافي الكلي: {request.include_total_salary ? <b className="text-emerald-600">{formatIQD(request.total_salary_snapshot)}</b> : <span className="text-muted-foreground">غير مطلوب</span>}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Official Letter Number & Date (Required for HR Issue) */}
                    <div className={cn(
                        "p-3.5 rounded-xl border space-y-3",
                        isDark ? "bg-slate-800/50 border-blue-500/30" : "bg-blue-50/50 border-blue-200"
                    )}>
                        <div className="flex items-center gap-2">
                            <span className="font-bold text-xs text-blue-600 dark:text-blue-400">
                                {isAlreadyIssued ? 'بيانات الكتاب الصادر المعتمد' : 'بيانات إصدار الكتاب الرسمي (صادر الموارد البشرية)'}
                            </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <label className="block font-bold mb-1">رقم الكتاب الصادر *</label>
                                <input
                                    type="text"
                                    required
                                    disabled={isAlreadyIssued}
                                    value={letterNumber}
                                    onChange={(e) => setLetterNumber(e.target.value)}
                                    placeholder="مثال: ت/2026/142"
                                    className={cn(
                                        "w-full p-2.5 rounded-xl border text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/30",
                                        isDark ? "bg-slate-800 border-slate-700 text-white" : "bg-white border-slate-300 text-slate-900"
                                    )}
                                />
                            </div>
                            <div>
                                <label className="block font-bold mb-1">تاريخ الكتاب الصادر *</label>
                                <input
                                    type="date"
                                    required
                                    disabled={isAlreadyIssued}
                                    value={letterDate}
                                    onChange={(e) => setLetterDate(e.target.value)}
                                    className={cn(
                                        "w-full p-2.5 rounded-xl border text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/30",
                                        isDark ? "bg-slate-800 border-slate-700 text-white" : "bg-white border-slate-300 text-slate-900"
                                    )}
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block font-bold mb-1">ملاحظات الإصدار والتسليم</label>
                            <input
                                type="text"
                                disabled={isAlreadyIssued}
                                value={dispatchNotes}
                                onChange={(e) => setDispatchNotes(e.target.value)}
                                placeholder="ملاحظات التسليم باليد أو الإحالة بالبريد الداخلي..."
                                className={cn(
                                    "w-full p-2.5 rounded-xl border text-xs focus:outline-none",
                                    isDark ? "bg-slate-800 border-slate-700 text-white" : "bg-white border-slate-300 text-slate-900"
                                )}
                            />
                        </div>
                    </div>

                    {/* Official Letter Preview Component (Hidden on screen, visible during print) */}
                    <div id={`official-letter-print-${request.id}`} className="p-6 border rounded-xl bg-white text-slate-950 font-serif space-y-4 shadow-sm">
                        <div className="flex items-center justify-between border-b pb-3 border-slate-300">
                            <div className="text-right space-y-0.5 text-xs">
                                <h4 className="font-bold text-sm">جمهورية العراق</h4>
                                <h5>وزارة الاتصالات</h5>
                                <h5>الشركة العامة للاتصالات والمعلوماتية</h5>
                                <h5 className="font-bold">مديرية اتصالات ومعلوماتية كربلاء المقدسة</h5>
                                <p className="text-[11px] text-slate-600">شعبة الموارد البشرية</p>
                            </div>
                            <div className="text-left space-y-1 text-xs font-mono">
                                <p><b>العدد:</b> {letterNumber}</p>
                                <p><b>التاريخ:</b> {letterDate}</p>
                            </div>
                        </div>

                        <div className="text-center py-2">
                            <h3 className="font-bold text-base underline decoration-double">
                                إلى / {request.destination_entity}
                            </h3>
                            <h4 className="font-bold text-sm mt-1">م / تأييد استمرارية بالخدمة</h4>
                        </div>

                        <div className="text-justify leading-relaxed text-xs space-y-3 font-tajawal">
                            <p>
                                نؤيد لكم بأن الموظف (<b>{employeeName}</b>) ذي الرقم الوظيفي (<b>{jobNumber}</b>)، المنسوب إلى ملاك مديريتنا بعنوان وظيفي (<b>{jobTitle}</b>) ومقر عمله في (<b>{department}</b>)، <b>مستمر بالخدمة الفعلية</b> لدى مديريتنا حتى تاريخ صدور هذا الكتاب.
                            </p>

                            {(request.include_nominal_salary || request.include_total_salary) && (
                                <p className="p-2.5 rounded-lg bg-slate-100 border border-slate-300">
                                    {request.include_nominal_salary && (
                                        <span>يبلغ راتبه الاسمي الشهري: (<b>{formatIQD(request.nominal_salary_snapshot)}</b>). </span>
                                    )}
                                    {request.include_total_salary && (
                                        <span>ويبلغ راتبه الصافي الإجمالي: (<b>{formatIQD(request.total_salary_snapshot)}</b>). </span>
                                    )}
                                </p>
                            )}

                            <p className="text-muted-foreground text-[11px] italic">
                                زُوّد بهذا التأييد بناءً على طلبه لتقديمه إليكم دون أن تتحمل مديريتنا أي تبعات أو التزامات مالية أو قانونية تجاه الغير.
                            </p>
                        </div>

                        <div className="flex justify-between items-end pt-6">
                            <div className="text-right text-[10px] text-slate-500 font-mono">
                                <span>نظام الإدارة الموحد • كود التحقق الأمني: #{request.id.slice(0, 8)}</span>
                            </div>
                            <div className="text-center">
                                <p className="font-bold text-xs">د. علي عباس جاسم الصباغ</p>
                                <p className="text-[11px] text-slate-600">مدير مديرية اتصالات ومعلوماتية كربلاء المقدسة</p>
                            </div>
                        </div>
                    </div>

                    {/* Reject Form toggle */}
                    {!isAlreadyIssued && showRejectBox && (
                        <div className="p-3 rounded-xl border border-rose-500/30 bg-rose-500/10 space-y-2">
                            <label className="block font-bold text-rose-600 dark:text-rose-400">سبب رفض الطلب للموظف:</label>
                            <textarea
                                rows={2}
                                value={rejectReason}
                                onChange={(e) => setRejectReason(e.target.value)}
                                placeholder="اكتب سبب الرفض أو النواقص في الطلب..."
                                className={cn(
                                    "w-full p-2 rounded-lg border text-xs focus:outline-none",
                                    isDark ? "bg-slate-800 border-slate-700 text-white" : "bg-white border-slate-300 text-slate-900"
                                )}
                            />
                            <div className="flex justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => setShowRejectBox(false)}
                                    className="px-3 py-1 rounded-lg border text-xs"
                                >
                                    تراجع
                                </button>
                                <button
                                    type="button"
                                    onClick={handleReject}
                                    disabled={isLoading}
                                    className="px-3 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center gap-1"
                                >
                                    {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                                    <span>تأكيد رفض الطلب</span>
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Buttons */}
                <div className="flex flex-wrap items-center justify-between gap-2 p-4 border-t border-border shrink-0">
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => window.print()}
                            className="px-3 py-2 rounded-xl border hover:bg-secondary text-xs font-bold flex items-center gap-1.5 transition-colors"
                        >
                            <Printer className="w-4 h-4 text-emerald-500" />
                            <span>طباعة الكتاب الرسمي</span>
                        </button>
                    </div>

                    <div className="flex items-center gap-2">
                        {!isAlreadyIssued && !showRejectBox && (
                            <button
                                type="button"
                                onClick={() => setShowRejectBox(true)}
                                className="px-3 py-2 rounded-xl border border-rose-500/30 hover:bg-rose-500/10 text-rose-600 dark:text-rose-400 text-xs font-bold transition-colors"
                            >
                                رفض الطلب
                            </button>
                        )}

                        <button
                            type="button"
                            onClick={onClose}
                            className="px-3 py-2 rounded-xl border hover:bg-secondary text-xs font-bold"
                        >
                            إغلاق
                        </button>

                        {!isAlreadyIssued && (
                            <button
                                type="button"
                                onClick={handleIssue}
                                disabled={isLoading}
                                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-blue-600/20 disabled:opacity-50 transition-all"
                            >
                                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                                <span>اعتماد وإصدار الكتاب أصولياً</span>
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
