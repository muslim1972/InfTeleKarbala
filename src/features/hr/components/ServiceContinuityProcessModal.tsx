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
        gender?: number | string | null;
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

export const getHonorific = (gender: number | string | undefined | null, fullName: string = ''): string => {
    if (gender === 2 || gender === '2' || gender === 'أنثى') return 'السيدة';
    if (gender === 1 || gender === '1' || gender === 'ذكر') return 'السيد';
    const first = fullName.trim().split(/\s+/)[0] || '';
    if (/(ة|اء|ى)$/.test(first) && !/^(حمزة|أسامة|قتيبة|طلحة|حذيفة|عروة|عمارة|عكرمة|علاء|بهاء|ضياء|صفاء|رجاء|موسى|يحيى|عيسى)/.test(first)) {
        return 'السيدة';
    }
    return 'السيد';
};

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

    // Isolated A4 Single-Page Official Print Engine
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

        const purposeClause = cleanedPurpose
            ? ` وذلك لغرض (${cleanedPurpose})`
            : '';

        const salaryHtml = (request.include_nominal_salary || request.include_total_salary) ? `
            <div class="salary-container">
                <div class="salary-heading">علماً أن:</div>
                <div class="salary-items">
                    ${request.include_nominal_salary ? `
                        <div class="salary-row">
                            <span class="salary-label">الراتب الاسمي /</span>
                            <span class="salary-val">${Number(request.nominal_salary_snapshot || 0).toLocaleString('ar-IQ')} دينار</span>
                        </div>
                    ` : ''}
                    ${request.include_total_salary ? `
                        <div class="salary-row">
                            <span class="salary-label">الراتب الكلي /</span>
                            <span class="salary-val">${Number(request.total_salary_snapshot || 0).toLocaleString('ar-IQ')} دينار</span>
                        </div>
                        <div class="salary-row">
                            <span class="salary-label">الراتب الصافي /</span>
                            <span class="salary-val">${Number(request.total_salary_snapshot || 0).toLocaleString('ar-IQ')} دينار</span>
                        </div>
                    ` : ''}
                </div>
            </div>
        ` : '';

        const ccHtml = cleanCcList.length > 0 ? `
            <div class="cc-box">
                <div class="cc-title">نسخة منه إلى /</div>
                <ul class="cc-list">
                    ${cleanCcList.map(cc => `
                        <li>
                            <span class="cc-name">• ${cc}</span>
                            <span class="cc-action">${getCcActionPhrase(cc)}</span>
                        </li>
                    `).join('')}
                </ul>
            </div>
        ` : '<div class="cc-box" style="visibility: hidden; flex: 1; max-width: 50%;"></div>';

        const htmlContent = `
            <!DOCTYPE html>
            <html dir="rtl" lang="ar">
            <head>
                <meta charset="utf-8">
                <title>تأييد استمرارية بالخدمة - ${letterNumber}</title>
                <style>
                    @page {
                        size: A4 portrait;
                        margin: 8mm 12mm 8mm 12mm;
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
                        position: relative;
                        width: 100%;
                        max-width: 182mm;
                        margin: 0 auto;
                        min-height: 272mm;
                        max-height: 274mm;
                        display: flex;
                        flex-direction: column;
                        justify-content: space-between;
                        page-break-inside: avoid;
                        page-break-after: avoid;
                        overflow: hidden;
                    }
                    /* Watermark */
                    .watermark-overlay {
                        position: absolute;
                        top: 52%;
                        left: 50%;
                        transform: translate(-50%, -50%);
                        width: 320px;
                        opacity: 0.13;
                        pointer-events: none;
                        z-index: 0;
                    }
                    .watermark-overlay img {
                        width: 100%;
                        height: auto;
                        display: block;
                    }
                    /* Content wrapper */
                    .letter-content {
                        position: relative;
                        z-index: 1;
                        display: flex;
                        flex-direction: column;
                        height: 100%;
                        flex: 1;
                    }
                    /* Header 3-column Grid */
                    .header-grid {
                        display: grid;
                        grid-template-columns: 1fr auto 1fr;
                        align-items: center;
                        gap: 12px;
                        padding-bottom: 4px;
                    }
                    .header-right {
                        text-align: center;
                        line-height: 1.35;
                    }
                    .header-right h3 {
                        font-size: 12px;
                        font-weight: 800;
                        margin: 0 0 1px 0;
                        color: #0f172a;
                    }
                    .header-right h4 {
                        font-size: 11px;
                        font-weight: 800;
                        margin: 0 0 1px 0;
                        color: #0f172a;
                    }
                    .header-right h5 {
                        font-size: 11px;
                        font-weight: 800;
                        margin: 0 0 1px 0;
                        color: #0f172a;
                    }
                    .header-right p {
                        font-size: 10px;
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
                        width: 155px;
                        height: auto;
                        max-height: 100px;
                        object-fit: contain;
                        display: block;
                        margin: 0 auto;
                    }
                    .header-left {
                        text-align: center;
                        direction: ltr;
                        font-family: Arial, -apple-system, sans-serif;
                        line-height: 1.3;
                    }
                    .header-left h3 {
                        font-size: 11.5px;
                        font-weight: 800;
                        margin: 0 0 1px 0;
                        color: #0f172a;
                    }
                    .header-left h4 {
                        font-size: 10.5px;
                        font-weight: 700;
                        margin: 0 0 1px 0;
                        color: #1e293b;
                    }
                    .header-left h5 {
                        font-size: 10.5px;
                        font-weight: 800;
                        margin: 0 0 1px 0;
                        color: #0f172a;
                    }
                    .header-left p {
                        font-size: 9.5px;
                        font-weight: 700;
                        margin: 0;
                        color: #334155;
                    }
                    /* Header Double Lines */
                    .double-divider {
                        margin-top: 6px;
                        margin-bottom: 0;
                        border-top: 2.5px solid #0f172a;
                        border-bottom: 0.8px solid #0f172a;
                        height: 5px;
                    }
                    /* Dispatch Office 3-line Blank Space */
                    .dispatch-gap {
                        height: 65px;
                        width: 100%;
                    }
                    /* Destination & Subject */
                    .destination-box {
                        text-align: right;
                        margin-bottom: 8px;
                    }
                    .destination-text {
                        font-size: 16px;
                        font-weight: 900;
                        text-decoration: underline;
                        text-underline-offset: 5px;
                        color: #0f172a;
                    }
                    .subject-box {
                        text-align: center;
                        margin: 6px 0 16px 0;
                    }
                    .subject-text {
                        font-size: 15px;
                        font-weight: 900;
                        color: #0f172a;
                    }
                    /* Body Paragraph */
                    .body-paragraph {
                        font-size: 14.5px;
                        line-height: 2.2;
                        text-align: justify;
                        color: #0f172a;
                        margin-bottom: 12px;
                    }
                    .salutation-appreciation {
                        text-align: center;
                        font-size: 14.5px;
                        font-weight: 900;
                        color: #0f172a;
                        margin: 14px 0;
                    }
                    /* Salary details */
                    .salary-container {
                        margin: 12px 0 16px 0;
                        font-size: 13.5px;
                        line-height: 1.9;
                        color: #0f172a;
                    }
                    .salary-heading {
                        font-weight: 900;
                        margin-bottom: 2px;
                    }
                    .salary-items {
                        padding-right: 18px;
                    }
                    .salary-row {
                        display: flex;
                        align-items: center;
                        gap: 12px;
                    }
                    .salary-label {
                        font-weight: 800;
                        min-width: 110px;
                    }
                    .salary-val {
                        font-weight: 900;
                        font-family: monospace;
                        font-size: 14px;
                    }
                    /* Signatures and CC Section */
                    .sig-cc-section {
                        display: flex;
                        justify-content: space-between;
                        align-items: flex-end;
                        margin-top: auto;
                        padding-top: 16px;
                        padding-bottom: 8px;
                        page-break-inside: avoid;
                    }
                    .cc-box {
                        text-align: right;
                        max-width: 55%;
                        font-size: 11px;
                        line-height: 1.6;
                        color: #1e293b;
                    }
                    .cc-title {
                        font-weight: 900;
                        text-decoration: underline;
                        text-underline-offset: 4px;
                        margin-bottom: 4px;
                        font-size: 11.5px;
                        color: #0f172a;
                    }
                    .cc-list {
                        list-style: none;
                        padding: 0;
                        margin: 0;
                    }
                    .cc-list li {
                        border-bottom: 1px dotted #cbd5e1;
                        padding: 1.5px 0;
                    }
                    .cc-name {
                        font-weight: 700;
                        color: #0f172a;
                    }
                    .cc-action {
                        font-size: 10.5px;
                        color: #475569;
                        font-weight: 600;
                        padding-right: 4px;
                    }
                    .director-box {
                        text-align: center;
                        min-width: 215px;
                        line-height: 1.45;
                        margin-right: auto;
                    }
                    .director-title-top {
                        font-size: 13px;
                        font-weight: 700;
                        color: #1e293b;
                        margin: 0 0 2px 0;
                    }
                    .director-name-main {
                        font-size: 16.5px;
                        font-weight: 900;
                        color: #0f172a;
                        margin: 0 0 2px 0;
                    }
                    .director-post-sub {
                        font-size: 11.5px;
                        font-weight: 700;
                        color: #334155;
                        margin: 0;
                    }
                    /* Footer */
                    .footer-container {
                        margin-top: auto;
                        padding-top: 4px;
                    }
                    .footer-info-row {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        padding-top: 5px;
                    }
                    .footer-address {
                        font-size: 10px;
                        line-height: 1.5;
                        color: #334155;
                        text-align: right;
                        font-weight: 600;
                    }
                    .footer-qr-container {
                        display: flex;
                        align-items: center;
                        gap: 8px;
                        text-align: right;
                    }
                    .footer-qr-img {
                        width: 52px;
                        height: 52px;
                        border: 1px solid #cbd5e1;
                        padding: 1.5px;
                        border-radius: 4px;
                        background: #ffffff;
                    }
                    .footer-qr-text {
                        font-size: 9.5px;
                        line-height: 1.35;
                        color: #475569;
                    }
                    .footer-qr-text b {
                        color: #0f172a;
                        font-weight: 800;
                    }
                </style>
            </head>
            <body>
                <div class="page-container">
                    <!-- Subtle watermark -->
                    <div class="watermark-overlay">
                        <img src="/itpc-watermark-gray.png" alt="ITPC" />
                    </div>

                    <div class="letter-content">
                        <!-- Top Header -->
                        <div class="header-grid">
                            <div class="header-right">
                                <h3>وزارة الاتصالات</h3>
                                <h4>الشركة العامة للاتصالات والمعلوماتية</h4>
                                <h5>مديرية اتصالات ومعلوماتية كربلاء المقدسة</h5>
                                <p>القسم المالي والاداري</p>
                                <p>شعبة الموارد البشرية</p>
                            </div>
                            <div class="header-center">
                                <img src="/itpc-official-header.png" alt="شعار الشركة العامة للاتصالات والمعلوماتية" class="emblem-img" />
                            </div>
                            <div class="header-left">
                                <h3>Ministry of Communications</h3>
                                <h4>Informatics & Telecommunications Public Company</h4>
                                <h5>Karbala Telecom & Informatics Directorate</h5>
                                <p>Financial & Administrative Department</p>
                                <p>Human Resources Division</p>
                            </div>
                        </div>

                        <!-- Double line divider -->
                        <div class="double-divider"></div>

                        <!-- 3-line blank space for Dispatch Office printer -->
                        <div class="dispatch-gap"></div>

                        <!-- Recipient (Right) -->
                        <div class="destination-box">
                            <span class="destination-text">إلى / ${request.destination_entity}</span>
                        </div>

                        <!-- Subject (Center) -->
                        <div class="subject-box">
                            <span class="subject-text">م / تأييد استمرار بالخدمة</span>
                        </div>

                        <!-- Official Body Text -->
                        <div class="body-paragraph">
                            نؤيد لكم بأن ${honorific} ( <b>${employeeName}</b> ) أحد منتسبي هذه المديرية على الملاك الدائم وما زال مستمراً بالخدمة في الوقت الحاضر وبناءً على طلبه زُوّد بهذا التأييد${purposeClause}
                        </div>

                        <!-- Appreciation -->
                        <div class="salutation-appreciation">
                            ... مـع التقديــر ...
                        </div>

                        <!-- Salary Block (Conditional) -->
                        ${salaryHtml}

                        <!-- Signatures & CC Section -->
                        <div class="sig-cc-section">
                            ${ccHtml}

                            <div class="director-box">
                                <p class="director-title-top">الدكتور المهندس</p>
                                <p class="director-name-main">علي عباس جاسم الصباغ</p>
                                <p class="director-post-sub">مدير مديرية اتصالات ومعلوماتية</p>
                                <p class="director-post-sub">كربلاء المقدسة</p>
                            </div>
                        </div>

                        <!-- Footer -->
                        <div class="footer-container">
                            <div class="double-divider"></div>
                            <div class="footer-info-row">
                                <div class="footer-address">
                                    <div>العنوان : محافظة كربلاء المقدسة – شارع العباس -ع-</div>
                                    <div>رقم الهاتف : 032333316 &nbsp;|&nbsp; البريد الألكتروني : kerbalatelecoms@itpc.gov.iq</div>
                                    <div>الموقع الألكتروني : www.itpc.gov.iq</div>
                                </div>
                                <div class="footer-qr-container">
                                    ${qrCodeDataUrl ? `<img src="${qrCodeDataUrl}" class="footer-qr-img" alt="QR" />` : ''}
                                    <div class="footer-qr-text">
                                        <div><b>وثيقة رسمية معتمدة</b></div>
                                        <div style="font-family: monospace;">كود: #${request.id.slice(0, 8)}</div>
                                        <div style="font-size: 8.5px; color: #64748b;">امسح الرمز للتحقق الرقمي</div>
                                    </div>
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
    const employeeGender = request.employee?.gender;
    const honorific = getHonorific(employeeGender, employeeName);
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
                        className="relative p-6 sm:p-8 border rounded-xl bg-white text-slate-950 font-serif space-y-3 shadow-sm overflow-hidden"
                    >
                        {/* Subtle background watermark */}
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 pointer-events-none opacity-10 select-none z-0">
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
                                <div className="flex items-end justify-between gap-4 w-full">
                                    {/* CC Recipients Block (نسخة منه إلى) on Right */}
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
