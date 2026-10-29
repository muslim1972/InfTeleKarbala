import { useState, useMemo, useEffect } from 'react';
import QRCode from 'qrcode';
import {
    FileText,
    Printer,
    CheckCircle,
    X,
    Loader2,
    Building,
    DollarSign,
    User,
    Plus,
    Trash2,
    Share2,
    Tag,
    ShieldCheck
} from 'lucide-react';
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
    cc_recipients?: string[] | null;
    created_at: string;
    employee?: {
        full_name?: string;
        job_number?: string;
        dept_text?: string;
        section_text?: string;
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

export const getCcActionPhrase = (entityName: string): string => {
    const text = entityName.trim().toLowerCase();
    // 1. الإضبارة الشخصية / الملف الشخصي / الأرشيف
    if (/إضبارة|اضبارة|أضبارة|اضباره|إضباره|ملف شخصي|الملف الشخصي|أرشيف|ارشيف/.test(text)) {
        return ' / للحفظ .';
    }
    // 2. المومأ إليه / صاحب الطلب / المعني
    if (/موما|مومأ|صاحب الطلب|المعني/.test(text)) {
        return ' / للاطلاع .';
    }
    // 3. بقية الجهات الإدارية والأشخاص الرسميين
    return ' / للتفضل بالاطلاع مع التقدير .';
};

const COMMON_CC_SUGGESTIONS = [
    'دائرة عقارات كربلاء',
    'ديوان محافظة كربلاء',
    'الشركة العامة للاتصالات والمعلوماتية',
    'نقابة المهندسين العراقيين',
    'الإضبارة الشخصية',
    'المومأ إليه'
];

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
    const [rejectReason, setRejectReason] = useState('');
    const [showRejectBox, setShowRejectBox] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    // QR Code Data URL State
    const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');

    useEffect(() => {
        if (!request.id) return;
        const origin = window.location.origin;
        const verifyUrl = `${origin}/verify/continuity/${request.id}`;
        QRCode.toDataURL(verifyUrl, {
            width: 160,
            margin: 1,
            color: {
                dark: '#0f172a',
                light: '#ffffff'
            }
        })
            .then((url) => setQrCodeDataUrl(url))
            .catch((err) => console.error('Failed to generate letter QR code:', err));
    }, [request.id]);

    // CC (نسخة منه إلى) State
    const [ccRecipients, setCcRecipients] = useState<string[]>(() => {
        if (Array.isArray(request.cc_recipients) && request.cc_recipients.length > 0) {
            return request.cc_recipients;
        }
        return [];
    });
    const [customCcInput, setCustomCcInput] = useState('');

    const cleanCcList = useMemo(() => {
        return ccRecipients.map((s) => s.trim()).filter(Boolean);
    }, [ccRecipients]);

    const handleAddCc = (entityToAdd?: string) => {
        const val = (entityToAdd !== undefined ? entityToAdd : customCcInput).trim();
        if (!val) {
            toast.error('يرجى إدخال اسم الدائرة أو الجهة');
            return;
        }
        if (ccRecipients.includes(val)) {
            toast.error('هذه الجهة مضافة مسبقاً في القائمة');
            return;
        }
        setCcRecipients((prev) => [...prev, val]);
        if (entityToAdd === undefined) {
            setCustomCcInput('');
        }
    };

    const handleRemoveCc = (index: number) => {
        setCcRecipients((prev) => prev.filter((_, i) => i !== index));
    };

    const formatIQD = (val: number | undefined | null) => {
        if (!val) return '0 د.ع';
        return Number(val).toLocaleString('ar-IQ') + ' د.ع';
    };

    // Clean Purpose / Notes (removing redundant prefixes)
    const cleanedPurpose = useMemo(() => {
        if (!request.notes?.trim()) return '';
        return request.notes.trim().replace(/^(لأغراض|لاغراض|لغرض|بغرض|غرض)\s+/i, '').trim();
    }, [request.notes]);

    // Isolated A4 Single-Page Print Engine
    const handlePrintLetter = () => {
        const printIframe = document.createElement('iframe');
        printIframe.style.position = 'fixed';
        printIframe.style.right = '0';
        printIframe.style.bottom = '0';
        printIframe.style.width = '0';
        printIframe.style.height = '0';
        printIframe.style.border = '0';
        document.body.appendChild(printIframe);

        const iframeDoc = printIframe.contentWindow?.document;
        if (!iframeDoc) return;

        const salaryHtml = (request.include_nominal_salary || request.include_total_salary) ? `
            <div style="background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; padding: 8px 12px; margin: 12px 0; font-size: 13.5px; line-height: 1.8; color: #0f172a;">
                ${request.include_nominal_salary && request.include_total_salary ? `
                    ويتقاضى راتباً اسمياً شهرياً قدره (<b>${formatIQD(request.nominal_salary_snapshot)}</b>)، وراتباً كلياً (صافياً) قدره (<b>${formatIQD(request.total_salary_snapshot)}</b>).
                ` : request.include_nominal_salary ? `
                    ويتقاضى راتباً اسمياً شهرياً قدره (<b>${formatIQD(request.nominal_salary_snapshot)}</b>).
                ` : `
                    ويتقاضى راتباً كلياً (صافياً) قدره (<b>${formatIQD(request.total_salary_snapshot)}</b>).
                `}
            </div>
        ` : '';

        const ccHtml = cleanCcList.length > 0 ? `
            <div style="margin-top: 10px; text-align: right; font-size: 11px; line-height: 1.7; color: #1e293b; page-break-inside: avoid; max-width: 75%;">
                <div style="font-weight: 800; text-decoration: underline; text-underline-offset: 4px; margin-bottom: 4px;">نسخة منه إلى /</div>
                <ul style="list-style: none; padding: 0; margin: 0;">
                    ${cleanCcList.map(cc => `
                        <li style="border-bottom: 1px dotted #cbd5e1; padding: 2px 0;">
                            <span style="font-weight: 700;">• ${cc}</span>
                            <span style="color: #334155; font-size: 11px; font-weight: 600;">${getCcActionPhrase(cc)}</span>
                        </li>
                    `).join('')}
                </ul>
            </div>
        ` : '';

        const purposeClause = cleanedPurpose
            ? ` ولأغراض (<b>${cleanedPurpose}</b>)،`
            : '،';

        const htmlContent = `
            <!DOCTYPE html>
            <html dir="rtl" lang="ar">
            <head>
                <meta charset="utf-8">
                <title>تأييد استمرارية بالخدمة - ${letterNumber}</title>
                <style>
                    @page {
                        size: A4 portrait;
                        margin: 12mm 16mm 12mm 16mm;
                    }
                    * {
                        box-sizing: border-box;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                    html, body {
                        margin: 0;
                        padding: 0;
                        background: #ffffff;
                        color: #0f172a;
                        font-family: 'Tajawal', 'Cairo', 'Amiri', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                        direction: rtl;
                        text-align: right;
                        width: 100%;
                    }
                    .page-container {
                        width: 100%;
                        max-width: 178mm;
                        margin: 0 auto;
                        min-height: 265mm;
                        display: flex;
                        flex-direction: column;
                        justify-content: space-between;
                        page-break-inside: avoid;
                        page-break-after: avoid;
                    }
                    .header-grid {
                        display: grid;
                        grid-template-columns: 1fr auto 1fr;
                        align-items: center;
                        border-bottom: 2px solid #0f172a;
                        padding-bottom: 8px;
                        margin-bottom: 14px;
                        gap: 12px;
                    }
                    .header-right {
                        text-align: center;
                        line-height: 1.45;
                    }
                    .header-right h3 {
                        font-size: 14px;
                        font-weight: 800;
                        margin: 0 0 2px 0;
                        color: #0f172a;
                    }
                    .header-right h4 {
                        font-size: 12px;
                        font-weight: 700;
                        margin: 0 0 2px 0;
                        color: #1e293b;
                    }
                    .header-right h5 {
                        font-size: 12.5px;
                        font-weight: 800;
                        margin: 0 0 2px 0;
                        color: #0f172a;
                    }
                    .header-right p {
                        font-size: 11px;
                        font-weight: 700;
                        margin: 0;
                        color: #334155;
                    }
                    .header-center {
                        text-align: center;
                        display: flex;
                        justify-content: center;
                        align-items: center;
                    }
                    .emblem-img {
                        height: 96px;
                        width: 96px;
                        object-fit: contain;
                        display: block;
                        margin: 0 auto;
                    }
                    .header-left {
                        text-align: left;
                        direction: rtl;
                        font-size: 13px;
                        line-height: 1.8;
                        color: #0f172a;
                        padding-left: 4px;
                    }
                    .subject-box {
                        text-align: center;
                        margin: 14px 0 16px 0;
                    }
                    .destination-title {
                        font-size: 16px;
                        font-weight: 900;
                        text-decoration: underline;
                        text-underline-offset: 5px;
                        margin-bottom: 6px;
                        color: #0f172a;
                    }
                    .subject-title {
                        font-size: 14.5px;
                        font-weight: 800;
                        color: #0f172a;
                    }
                    .salutation {
                        font-weight: 800;
                        font-size: 14px;
                        margin-bottom: 10px;
                        color: #0f172a;
                    }
                    .body-paragraph {
                        font-size: 14px;
                        line-height: 2.1;
                        text-align: justify;
                        color: #0f172a;
                        margin-bottom: 10px;
                    }
                    .director-row {
                        display: flex;
                        justify-content: flex-end;
                        margin-top: 24px;
                        margin-bottom: 8px;
                        page-break-inside: avoid;
                    }
                    .director-block {
                        text-align: center;
                        line-height: 1.45;
                        min-width: 200px;
                    }
                    .director-title-1 {
                        font-size: 13px;
                        font-weight: 700;
                        color: #1e293b;
                        margin: 0 0 3px 0;
                    }
                    .director-name {
                        font-size: 16px;
                        font-weight: 900;
                        color: #0f172a;
                        margin: 0 0 3px 0;
                    }
                    .director-post {
                        font-size: 11.5px;
                        font-weight: 700;
                        color: #334155;
                        margin: 0;
                    }
                    .qr-row {
                        display: flex;
                        justify-content: flex-start;
                        align-items: flex-end;
                        margin-top: 18px;
                        padding-top: 6px;
                        page-break-inside: avoid;
                    }
                    .qr-block {
                        display: flex;
                        align-items: center;
                        gap: 10px;
                    }
                    .qr-image {
                        width: 64px;
                        height: 64px;
                        border: 1px solid #cbd5e1;
                        padding: 2px;
                        border-radius: 5px;
                    }
                </style>
            </head>
            <body>
                <div class="page-container">
                    <div>
                        <!-- Header: Right (Hierarchy), Center (Emblem), Left (Number & Date) -->
                        <div class="header-grid">
                            <div class="header-right">
                                <h3>جمهورية العراق</h3>
                                <h4>وزارة الاتصالات</h4>
                                <h4>الشركة العامة للاتصالات والمعلوماتية</h4>
                                <h5>مديرية اتصالات ومعلوماتية كربلاء المقدسة</h5>
                                <p>شعبة الموارد البشرية</p>
                            </div>
                            <div class="header-center">
                                <img src="/icon-192.png" alt="شعار مديرية اتصالات ومعلوماتية كربلاء" class="emblem-img" />
                            </div>
                            <div class="header-left">
                                <div><b>العدد:</b> ${letterNumber}</div>
                                <div><b>التاريخ:</b> ${letterDate}</div>
                            </div>
                        </div>

                        <!-- Subject & Destination -->
                        <div class="subject-box">
                            <div class="destination-title">إلى / ${request.destination_entity}</div>
                            <div class="subject-title">م / تأييد استمرار بالخدمة</div>
                        </div>

                        <!-- Salutation -->
                        <div class="salutation">تحية طيبة ...</div>

                        <!-- Body Content: Streamlined according to official instructions -->
                        <div class="body-paragraph">
                            نؤيد لكم بأن السيد/السيدة (<b>${employeeName}</b>) <b>هو أحد منتسبينا وعلى الملاك الدائم ومستمر بالخدمة الفعلية</b> لدى مديريتنا في الوقت الحاضر.
                        </div>

                        <!-- Salary Block -->
                        ${salaryHtml}

                        <!-- Disclaimer & Purpose -->
                        <div class="body-paragraph" style="font-size: 13px;">
                            زُوّد بهذا التأييد بناءً على طلبه${purposeClause} دون أن تتحمل مديريتنا أي تبعات أو التزامات مالية أو قانونية تجاه الغير.
                        </div>

                        <!-- Request Conclusion Phrase (Centered) -->
                        <div style="text-align: center; margin: 18px 0 10px 0; font-size: 13.5px; font-weight: 800; color: #0f172a;">
                            للتفضل بالاطلاع . . . مع التقدير
                        </div>
                    </div>

                    <!-- Bottom Section: Director Signature (Top Left), CC (Right below), Security QR (Bottom Right) -->
                    <div>
                        <!-- Director Signature placed higher on the left -->
                        <div class="director-row">
                            <div class="director-block">
                                <p class="director-title-1">الدكتور المهندس</p>
                                <p class="director-name">علي عباس جاسم الصباغ</p>
                                <p class="director-post">مدير مديرية اتصالات ومعلوماتية</p>
                                <p class="director-post">كربلاء المقدسة</p>
                            </div>
                        </div>

                        <!-- CC Recipients (نسخة منه إلى) on Right (only if cleanCcList.length > 0) -->
                        ${ccHtml}

                        <!-- Verification Security QR on Bottom Right -->
                        <div class="qr-row">
                            <div class="qr-block">
                                ${qrCodeDataUrl ? `<img src="${qrCodeDataUrl}" class="qr-image" alt="QR" />` : ''}
                                <div style="font-size: 10.5px; line-height: 1.4; color: #475569; text-align: right;">
                                    <div style="font-weight: 800; color: #0f172a;">وثيقة رسمية معتمدة</div>
                                    <div style="font-family: monospace;">كود: #${request.id.slice(0, 8)}</div>
                                    <div style="font-size: 9.5px; color: #64748b;">امسح الرمز للتحقق الرقمي</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </body>
            </html>
        `;

        iframeDoc.open();
        iframeDoc.write(htmlContent);
        iframeDoc.close();

        printIframe.contentWindow?.addEventListener('afterprint', () => {
            printIframe.remove();
        });

        printIframe.contentWindow?.focus();
        printIframe.contentWindow?.print();
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
                p_dispatch_notes: null,
                p_notes: null,
                p_cc_recipients: cleanCcList
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
    const department = request.employee?.dept_text || request.employee?.department || 'مديرية اتصالات ومعلوماتية كربلاء';
    const isAlreadyIssued = request.status === 'issued_and_dispatched';

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 pt-16 sm:pt-20 pb-6 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div
                className={cn(
                    'w-full max-w-2xl rounded-2xl border shadow-2xl relative max-h-[calc(100vh-5.5rem)] flex flex-col my-auto overflow-hidden',
                    isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'
                )}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-border shrink-0">
                    <div className="flex items-center gap-2">
                        <FileText className="w-5 h-5 text-blue-500" />
                        <div>
                            <h3 className="font-bold text-sm">
                                {isAlreadyIssued
                                    ? 'معاينة كتاب تأييد الاستمرارية الصادر'
                                    : 'معالجة وإصدار كتاب تأييد استمرارية بالخدمة'}
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
                    <div
                        className={cn(
                            'p-3 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3',
                            isDark ? 'bg-slate-800/60 border-slate-700' : 'bg-slate-50 border-slate-200'
                        )}
                    >
                        <div className="space-y-1">
                            <div className="flex items-center gap-2">
                                <User className="w-4 h-4 text-blue-500" />
                                <span className="font-bold text-sm text-foreground">
                                    الموظف: {employeeName}
                                </span>
                            </div>
                            {department && (
                                <p className="text-[11px] text-muted-foreground pr-6">
                                    {department}
                                </p>
                            )}
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
                        <div
                            className={cn(
                                'p-3 rounded-xl border',
                                isDark ? 'bg-slate-800/40 border-slate-700' : 'bg-white border-slate-200'
                            )}
                        >
                            <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                                <Building className="w-3.5 h-3.5 text-emerald-500" />
                                <span className="font-bold text-[11px]">الجهة المعنون إليها التأييد:</span>
                            </div>
                            <p className="font-bold text-sm text-foreground">{request.destination_entity}</p>
                            {cleanedPurpose && (
                                <p className="text-[11px] text-muted-foreground mt-1 pt-1 border-t border-border">
                                    الغرض المطلوب: <b className="text-foreground">لاغراض {cleanedPurpose}</b>
                                </p>
                            )}
                        </div>

                        <div
                            className={cn(
                                'p-3 rounded-xl border',
                                isDark ? 'bg-slate-800/40 border-slate-700' : 'bg-white border-slate-200'
                            )}
                        >
                            <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                                <DollarSign className="w-3.5 h-3.5 text-amber-500" />
                                <span className="font-bold text-[11px]">البيانات المالية المطلوبة:</span>
                            </div>
                            <div className="flex flex-col gap-1 text-[11px]">
                                <span>
                                    الراتب الاسمي:{' '}
                                    {request.include_nominal_salary ? (
                                        <b className="text-emerald-600 font-mono">
                                            {formatIQD(request.nominal_salary_snapshot)}
                                        </b>
                                    ) : (
                                        <span className="text-muted-foreground">غير مطلوب</span>
                                    )}
                                </span>
                                <span>
                                    الراتب الصافي الكلي:{' '}
                                    {request.include_total_salary ? (
                                        <b className="text-emerald-600 font-mono">
                                            {formatIQD(request.total_salary_snapshot)}
                                        </b>
                                    ) : (
                                        <span className="text-muted-foreground">غير مطلوب</span>
                                    )}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Official Letter Number & Date (Required for HR Issue) */}
                    <div
                        className={cn(
                            'p-3.5 rounded-xl border space-y-3',
                            isDark ? 'bg-slate-800/50 border-blue-500/30' : 'bg-blue-50/50 border-blue-200'
                        )}
                    >
                        <div className="flex items-center gap-2">
                            <span className="font-bold text-xs text-blue-600 dark:text-blue-400">
                                {isAlreadyIssued
                                    ? 'بيانات الكتاب الصادر المعتمد'
                                    : 'بيانات إصدار الكتاب الرسمي (صادر الموارد البشرية)'}
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
                                        'w-full p-2.5 rounded-xl border text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/30',
                                        isDark
                                            ? 'bg-slate-800 border-slate-700 text-white'
                                            : 'bg-white border-slate-300 text-slate-900'
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
                                        'w-full p-2.5 rounded-xl border text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/30',
                                        isDark
                                            ? 'bg-slate-800 border-slate-700 text-white'
                                            : 'bg-white border-slate-300 text-slate-900'
                                    )}
                                />
                            </div>
                        </div>
                    </div>

                    {/* CC Section: جهات «نسخة منه إلى» */}
                    <div
                        className={cn(
                            'p-3.5 rounded-xl border space-y-3',
                            isDark ? 'bg-slate-800/40 border-slate-750' : 'bg-slate-50/70 border-slate-200'
                        )}
                    >
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Share2 className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                                <div>
                                    <span className="font-bold text-xs text-foreground">
                                        جهات «نسخة منه إلى» {isAlreadyIssued ? '(المعتمدة في الكتاب الصادر)' : '(اختياري للطباعة)'}
                                    </span>
                                    <p className="text-[10.5px] text-muted-foreground mt-0.5">
                                        {isAlreadyIssued
                                            ? 'الجهات الموثقة رسمياً في أصل هذا الكتاب الصادر (للقراءة والطباعة فقط)'
                                            : 'تطبع تلقائياً أسفل الكتاب الرسمي متبوعة بالعبارة الإدارية الأصولية المناسبة'}
                                    </p>
                                </div>
                            </div>
                            <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-secondary text-foreground">
                                {cleanCcList.length} جهة
                            </span>
                        </div>

                        {/* Input & Add Button (ONLY active before issue) */}
                        {!isAlreadyIssued && (
                            <>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="text"
                                        value={customCcInput}
                                        onChange={(e) => setCustomCcInput(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                handleAddCc();
                                            }
                                        }}
                                        placeholder="اكتب اسم الدائرة أو الجهة (مثال: دائرة عقارات كربلاء)..."
                                        className={cn(
                                            'flex-1 p-2 rounded-xl border text-xs focus:outline-none focus:ring-2 focus:ring-cyan-500/30',
                                            isDark
                                                ? 'bg-slate-800 border-slate-700 text-white'
                                                : 'bg-white border-slate-300 text-slate-900'
                                        )}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => handleAddCc()}
                                        className="px-3 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-xs flex items-center gap-1 shadow-sm transition-all"
                                    >
                                        <Plus className="w-3.5 h-3.5" />
                                        <span>إضافة</span>
                                    </button>
                                </div>

                                {/* Quick Suggestion Chips */}
                                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                                    <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                        <Tag className="w-3 h-3" /> اقتراحات سريعة:
                                    </span>
                                    {COMMON_CC_SUGGESTIONS.map((item, idx) => (
                                        <button
                                            key={idx}
                                            type="button"
                                            onClick={() => handleAddCc(item)}
                                            className={cn(
                                                'text-[10.5px] px-2 py-0.5 rounded-lg border transition-colors',
                                                ccRecipients.includes(item)
                                                    ? 'opacity-40 cursor-not-allowed border-transparent'
                                                    : isDark
                                                      ? 'border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200'
                                                      : 'border-slate-200 bg-white hover:bg-cyan-50 hover:border-cyan-300 text-slate-700'
                                            )}
                                            disabled={ccRecipients.includes(item)}
                                        >
                                            + {item}
                                        </button>
                                    ))}
                                </div>
                            </>
                        )}

                        {/* Display Added CC Items */}
                        {cleanCcList.length > 0 ? (
                            <div className="space-y-1.5 pt-2 border-t border-border">
                                {cleanCcList.map((cc, index) => (
                                    <div
                                        key={index}
                                        className={cn(
                                            'p-2 rounded-lg border flex items-center justify-between gap-2 text-xs',
                                            isDark ? 'bg-slate-850 border-slate-700' : 'bg-white border-slate-200'
                                        )}
                                    >
                                        <div className="flex items-center gap-2 overflow-hidden">
                                            <span className="w-5 h-5 rounded-full bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 font-bold text-[11px] flex items-center justify-center shrink-0">
                                                {index + 1}
                                            </span>
                                            <span className="font-semibold text-foreground truncate">{cc}</span>
                                            <span className="text-[11px] text-muted-foreground font-medium shrink-0">
                                                {getCcActionPhrase(cc)}
                                            </span>
                                        </div>
                                        {!isAlreadyIssued && (
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveCc(index)}
                                                className="p-1 rounded-md text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors shrink-0"
                                                title="حذف هذه الجهة"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        ) : isAlreadyIssued ? (
                            <p className="text-[11.5px] text-muted-foreground italic py-1">
                                لا توجد جهات إضافية (نسخة منه إلى) مسجلة لهذا الكتاب الصادر.
                            </p>
                        ) : null}
                    </div>

                    {/* Official Letter Preview Component (Refined A4 Government Layout) */}
                    <div
                        id={`official-letter-print-${request.id}`}
                        className="p-6 sm:p-8 border rounded-xl bg-white text-slate-950 font-serif space-y-4 shadow-sm"
                    >
                        {/* Letter Header: Right (Hierarchy with internal center), Center (Emblem), Left (Number & Date) */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 items-center border-b-2 border-slate-900 pb-3 mb-2 gap-3">
                            <div className="text-center space-y-0.5">
                                <h4 className="font-extrabold text-sm text-slate-950">جمهورية العراق</h4>
                                <h5 className="font-bold text-xs text-slate-800">وزارة الاتصالات</h5>
                                <h5 className="font-bold text-xs text-slate-800">الشركة العامة للاتصالات والمعلوماتية</h5>
                                <h5 className="font-black text-sm text-slate-950">مديرية اتصالات ومعلوماتية كربلاء المقدسة</h5>
                                <p className="text-[11.5px] font-bold text-slate-700">شعبة الموارد البشرية</p>
                            </div>
                            <div className="flex justify-center items-center py-1">
                                <img
                                    src="/icon-192.png"
                                    alt="شعار مديرية اتصالات ومعلوماتية كربلاء"
                                    className="w-24 h-24 sm:w-28 sm:h-28 object-contain"
                                />
                            </div>
                            <div className="text-left space-y-0.5 text-xs font-mono">
                                <p>
                                    <b>العدد:</b> {letterNumber}
                                </p>
                                <p>
                                    <b>التاريخ:</b> {letterDate}
                                </p>
                            </div>
                        </div>

                        {/* Destination & Subject */}
                        <div className="text-center py-2">
                            <h3 className="font-extrabold text-base underline underline-offset-4 decoration-2 text-slate-950">
                                إلى / {request.destination_entity}
                            </h3>
                            <h4 className="font-bold text-sm mt-1 text-slate-900">م / تأييد استمرار بالخدمة</h4>
                        </div>

                        {/* Body - Streamlined according to official instructions */}
                        <div className="text-justify leading-relaxed text-xs space-y-3 font-tajawal">
                            <p className="font-bold text-xs text-slate-900 mb-1">تحية طيبة ...</p>

                            <p className="leading-loose text-[13px] text-justify text-slate-900">
                                نؤيد لكم بأن السيد/السيدة (<b>{employeeName}</b>) <b>هو أحد منتسبينا وعلى الملاك الدائم ومستمر بالخدمة الفعلية</b> لدى مديريتنا في الوقت الحاضر.
                            </p>

                            {/* Salary Section: ONLY if requested */}
                            {(request.include_nominal_salary || request.include_total_salary) && (
                                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-900 leading-normal text-xs">
                                    {request.include_nominal_salary && request.include_total_salary ? (
                                        <span>
                                             ويتقاضى راتباً اسمياً شهرياً قدره (<b>{formatIQD(request.nominal_salary_snapshot)}</b>)، وراتباً كلياً (صافياً) قدره (<b>{formatIQD(request.total_salary_snapshot)}</b>).
                                        </span>
                                    ) : request.include_nominal_salary ? (
                                        <span>
                                            ويتقاضى راتباً اسمياً شهرياً قدره (<b>{formatIQD(request.nominal_salary_snapshot)}</b>).
                                        </span>
                                    ) : request.include_total_salary ? (
                                        <span>
                                            ويتقاضى راتباً كلياً (صافياً) قدره (<b>{formatIQD(request.total_salary_snapshot)}</b>).
                                        </span>
                                    ) : null}
                                </div>
                            )}

                            {/* Purpose & Disclaimer Clause */}
                            <p className="leading-loose text-[12px] text-justify text-slate-800">
                                زُوّد بهذا التأييد بناءً على طلبه
                                {cleanedPurpose ? (
                                    <span>
                                        {' '}ولأغراض (<b>{cleanedPurpose}</b>)
                                    </span>
                                ) : null}
                                ، دون أن تتحمل مديريتنا أي تبعات أو التزامات مالية أو قانونية تجاه الغير.
                            </p>

                            {/* Request Conclusion Phrase (In Center) */}
                            <div className="text-center my-3 text-[13.5px] font-extrabold text-slate-900">
                                للتفضل بالاطلاع . . . مع التقدير
                            </div>
                        </div>

                        {/* Signatures & Footer Layout */}
                        <div className="space-y-4 pt-4">
                            {/* Director Signature on the Left (positioned higher) */}
                            <div className="flex justify-end">
                                <div className="text-center space-y-0.5 shrink-0 min-w-[200px]">
                                    <p className="text-[12px] text-slate-700 font-bold">الدكتور المهندس</p>
                                    <p className="font-extrabold text-sm text-slate-950">علي عباس جاسم الصباغ</p>
                                    <p className="text-[11px] text-slate-700 font-semibold">مدير مديرية اتصالات ومعلوماتية</p>
                                    <p className="text-[11px] text-slate-700 font-semibold">كربلاء المقدسة</p>
                                </div>
                            </div>

                            {/* CC Recipients Block (نسخة منه إلى) on Right (ONLY if cleanCcList.length > 0) */}
                            {cleanCcList.length > 0 && (
                                <div className="pt-2 text-right space-y-1 text-xs max-w-md">
                                    <p className="font-bold text-slate-900 underline underline-offset-4">نسخة منه إلى /</p>
                                    <ul className="space-y-0.5 text-slate-800 pr-1">
                                        {cleanCcList.map((cc, idx) => (
                                            <li
                                                key={idx}
                                                className="border-b border-dotted border-slate-200 pb-0.5 last:border-b-0"
                                            >
                                                <span className="font-semibold text-slate-900">• {cc}</span>
                                                <span className="text-slate-600 font-medium text-[11px] pr-1">
                                                    {getCcActionPhrase(cc)}
                                                </span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {/* Verification QR Code & Security Code at Bottom Right */}
                            <div className="flex justify-start items-center gap-2 pt-2">
                                {qrCodeDataUrl ? (
                                    <div className="p-1 rounded-lg border border-slate-300 bg-white shrink-0 shadow-2xs">
                                        <img
                                            src={qrCodeDataUrl}
                                            alt="QR Code للتحقق"
                                            className="w-14 h-14 object-contain block"
                                        />
                                    </div>
                                ) : (
                                    <div className="w-14 h-14 border border-dashed border-slate-300 rounded-lg flex items-center justify-center text-[10px] text-slate-400">
                                        QR
                                    </div>
                                )}
                                <div className="space-y-0.5 text-[10px] text-slate-600 font-sans text-right">
                                    <p className="font-bold text-slate-900 flex items-center gap-1">
                                        <ShieldCheck size={12} className="text-emerald-600 shrink-0" />
                                        <span>وثيقة رسمية معتمدة</span>
                                    </p>
                                    <p className="font-mono text-slate-500">
                                        كود: #{request.id.slice(0, 8)}
                                    </p>
                                    <p className="text-[9px] text-slate-400 leading-tight">
                                        امسح الرمز للتحقق الرقمي
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Reject Form toggle */}
                    {!isAlreadyIssued && showRejectBox && (
                        <div className="p-3 rounded-xl border border-rose-500/30 bg-rose-500/10 space-y-2">
                            <label className="block font-bold text-rose-600 dark:text-rose-400">
                                سبب رفض الطلب للموظف:
                            </label>
                            <textarea
                                rows={2}
                                value={rejectReason}
                                onChange={(e) => setRejectReason(e.target.value)}
                                placeholder="اكتب سبب الرفض أو النواقص في الطلب..."
                                className={cn(
                                    'w-full p-2 rounded-lg border text-xs focus:outline-none',
                                    isDark
                                        ? 'bg-slate-800 border-slate-700 text-white'
                                        : 'bg-white border-slate-300 text-slate-900'
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
                            onClick={handlePrintLetter}
                            className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-800 dark:text-slate-100 border border-slate-300 dark:border-slate-700 text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all"
                        >
                            <Printer className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
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
                                {isLoading ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <CheckCircle className="w-4 h-4" />
                                )}
                                <span>اعتماد وإصدار الكتاب أصولياً</span>
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
