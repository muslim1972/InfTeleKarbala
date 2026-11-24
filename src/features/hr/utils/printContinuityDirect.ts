/**
 * دالة الطباعة الفورية المباشرة لكتاب تأييد الاستمرارية بالخدمة (A4)
 * تقوم بحقن المستند مباشرة في iframe مخفي وإطلاق نافذة حفظ/طباعة الـ PDF فورياً
 * دون فتح أي نوافذ وسيطة أو شاشات إعداد لموظف الطابعة.
 */

import { ITPC_HEADER_BASE64, ITPC_WATERMARK_BASE64 } from './continuityPrintAssets';

export interface DirectPrintContinuityData {
    id: string;
    destination_entity: string;
    notes?: string | null;
    nominal_salary_snapshot?: number;
    total_salary_snapshot?: number;
    gross_salary_snapshot?: number;
    include_nominal_salary?: boolean;
    include_total_salary?: boolean;
    include_salary_details?: boolean;
    cadre_type?: 'permanent' | 'contract' | string | null;
    cc_recipients?: string[] | null;
    approved_by_name?: string | null;
    official_letter_number?: string | null;
    official_letter_date?: string | null;
    employee?: {
        full_name?: string;
        job_number?: string;
        dept_text?: string;
        section_text?: string;
        unit_text?: string;
        department?: string;
        gender?: number | string | null;
    } | null;
}

/**
 * يستخرج الاسم الثلاثي للموظف مع مراعاة الأسماء المركبة العربية (مثل: عبد علي، عبد الحسين، عبد الله، أمة الله)
 * بحيث يعتبر "عبد [ما بعدها]" مقطعاً اسمياً واحداً حتى مع وجود فراغ بينهما.
 */
export const getTripartiteName = (fullName: string | undefined | null): string => {
    if (!fullName) return '';
    const words = fullName.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) return '';

    const nameTokens: string[] = [];
    for (let i = 0; i < words.length; i++) {
        const current = words[i];
        // إذا كانت الكلمة هي "عبد" أو "أمة" وهناك كلمة تليها، تُدمجان كمقطع اسمي واحد مع الحفاظ على الفراغ الأصلي
        if (/^(عبد|أمة|امه)$/i.test(current) && i + 1 < words.length) {
            nameTokens.push(`${current} ${words[i + 1]}`);
            i++; // تخطي الكلمة التالية لأنها مضافة لمقطع عبد
        } else {
            nameTokens.push(current);
        }

        // التوقف عند اكتمال ثلاثة مقاطع اسمية (الاسم + اسم الأب + اسم الجد)
        if (nameTokens.length === 3) {
            break;
        }
    }

    return nameTokens.join(' ');
};

/**
 * يستخرج أدنى معلومة في هيكلية المديرية التي ينتمي إليها الموظف:
 * الوحدة أولاً، فإن لم تكن فالشعبة، فإن لم تكن فالقسم/المجمع.
 */
export const getLowestOrgUnit = (emp?: {
    unit_text?: string | null;
    section_text?: string | null;
    dept_text?: string | null;
    department?: string | null;
} | null): string => {
    if (!emp) return '';
    const unit = emp.unit_text?.trim();
    if (unit) return unit;
    const section = emp.section_text?.trim();
    if (section) return section;
    const dept = (emp.dept_text || emp.department)?.trim();
    if (dept && dept !== 'كربلاء') return dept;
    return dept || '';
};

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
    if (/إضبارة|اضبارة|أضبارة|اضباره|إضباره|ملف شخصي|الملف الشخصي|أرشيف|ارشيف/.test(text)) {
        return ' / للحفظ .';
    }
    if (/موما|مومأ|صاحب الطلب|المعني/.test(text)) {
        return ' / للاطلاع .';
    }
    return ' / للتفضل بالاطلاع مع التقدير .';
};

export const printContinuityLetterDirect = (req: DirectPrintContinuityData): Promise<boolean> => {
    return new Promise((resolve) => {
        const printIframe = document.createElement('iframe');
        printIframe.style.position = 'fixed';
        printIframe.style.right = '0';
        printIframe.style.bottom = '0';
        printIframe.style.width = '0';
        printIframe.style.height = '0';
        printIframe.style.border = '0';
        document.body.appendChild(printIframe);

        const iframeDoc = printIframe.contentWindow?.document;
        if (!iframeDoc) {
            printIframe.remove();
            resolve(false);
            return;
        }

        const employeeName = getTripartiteName(req.employee?.full_name) || 'الموظف';
        const honorific = getHonorific(req.employee?.gender, employeeName);
        const letterNumber = req.official_letter_number || `ت/${new Date().getFullYear()}/${Math.floor(Math.random() * 800 + 100)}`;

        // تنقية الغرض من الزوائد
        const cleanedPurpose = req.notes?.trim()
            ? req.notes.trim().replace(/^(لأغراض|لاغراض|لغرض|بغرض|غرض)\s+/i, '').trim()
            : '';
        const purposeClause = cleanedPurpose ? ` وذلك لغرض (${cleanedPurpose})` : '';

        // صفة التعيين: الملاك الدائم / بصفة عقد
        const isContract = String(req.cadre_type || '').toLowerCase() === 'contract';
        const cadrePhrase = isContract ? 'بصفة عقد' : 'على الملاك الدائم';

        // تفاصيل الراتب
        const hasSalary = req.include_nominal_salary || req.include_total_salary || req.include_salary_details;
        const salaryHtml = hasSalary ? `
            <div class="salary-container">
                <div class="salary-heading">علماً أن:</div>
                <div class="salary-items">
                    <div class="salary-row">
                        <span class="salary-label">الراتب الكلي /</span>
                        <span class="salary-val">${Number(req.gross_salary_snapshot || req.total_salary_snapshot || 0).toLocaleString('ar-IQ')} دينار</span>
                    </div>
                    <div class="salary-row">
                        <span class="salary-label">الراتب الصافي /</span>
                        <span class="salary-val">${Number((req as any).net_salary_snapshot || req.total_salary_snapshot || 0).toLocaleString('ar-IQ')} دينار</span>
                    </div>
                    <div class="salary-row">
                        <span class="salary-label">الراتب الاسمي /</span>
                        <span class="salary-val">${Number(req.nominal_salary_snapshot || 0).toLocaleString('ar-IQ')} دينار</span>
                    </div>
                </div>
            </div>
        ` : '';

        // اسم المعتمد ثلاثياً مجرداً فقط بدون مقدمة موافقة أو تدقيق
        const approverTripartite = getTripartiteName(req.approved_by_name);
        const lowestOrg = getLowestOrgUnit(req.employee);
        const approverAndOrgHtml = (approverTripartite || lowestOrg) ? `
            <div class="footer-pre-divider-row">
                <div class="approver-box">
                    ${approverTripartite ? `<span class="approver-name">${approverTripartite}</span>` : ''}
                </div>
                <div class="org-unit-box">
                    ${lowestOrg ? `<span class="org-unit-name">${lowestOrg}</span>` : ''}
                </div>
            </div>
        ` : '';

        // جهات نسخة منه إلى
        const cleanCcList = Array.isArray(req.cc_recipients)
            ? req.cc_recipients.map((s) => s.trim()).filter(Boolean)
            : [];
        const ccHtml = cleanCcList.length > 0 ? `
            <div class="cc-box">
                <div class="cc-title">نسخة منه إلى /</div>
                <ul class="cc-list">
                    ${cleanCcList.map((cc) => `
                        <li>
                            <span class="cc-name">• ${cc}</span>
                            <span class="cc-action">${getCcActionPhrase(cc)}</span>
                        </li>
                    `).join('')}
                </ul>
            </div>
        ` : '';

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
                        font-size: 9.8px;
                        font-weight: 700;
                        margin: 0 0 1px 0;
                        color: #1e293b;
                        white-space: nowrap;
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
                        height: 110px;
                        width: 100%;
                    }
                    /* Destination & Subject */
                    .destination-box {
                        text-align: right;
                        margin-bottom: 8px;
                    }
                    .destination-text {
                        font-size: 18px;
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
                        font-size: 17px;
                        font-weight: 900;
                        color: #0f172a;
                    }
                    /* Body Paragraph */
                    .body-paragraph {
                        font-size: 16.5px;
                        line-height: 2.2;
                        text-align: justify;
                        color: #0f172a;
                        margin-bottom: 12px;
                    }
                    .salutation-appreciation {
                        text-align: center;
                        font-size: 16.5px;
                        font-weight: 900;
                        color: #0f172a;
                        margin: 14px 0;
                    }
                    /* Salary details */
                    .salary-container {
                        margin: 12px 0 16px 0;
                        font-size: 15.5px;
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
                        min-width: 120px;
                    }
                    .salary-val {
                        font-weight: 900;
                        font-family: monospace;
                        font-size: 16px;
                    }
                    /* Signatures and CC Section */
                    .sig-cc-section {
                        display: flex;
                        justify-content: space-between;
                        align-items: flex-start;
                        margin-top: auto;
                        margin-bottom: auto;
                        padding-top: 6px;
                        padding-bottom: 6px;
                        page-break-inside: avoid;
                    }
                    .cc-box {
                        text-align: right;
                        width: 100%;
                        max-width: calc(100% - 235px);
                        font-size: 13px;
                        line-height: 1.6;
                        color: #1e293b;
                        padding-top: 56px;
                    }
                    .cc-title {
                        font-weight: 900;
                        text-decoration: underline;
                        text-underline-offset: 4px;
                        margin-bottom: 4px;
                        font-size: 13.5px;
                        color: #0f172a;
                    }
                    .cc-list {
                        list-style: none;
                        padding: 0;
                        margin: 0;
                    }
                    .cc-list li {
                        padding: 1.5px 0;
                        white-space: nowrap;
                    }
                    .cc-name {
                        font-weight: 700;
                        color: #0f172a;
                    }
                    .cc-action {
                        font-size: 12.5px;
                        color: #475569;
                        font-weight: 600;
                        padding-right: 4px;
                    }
                    .director-box {
                        text-align: center;
                        min-width: 225px;
                        line-height: 1.45;
                        margin-right: auto;
                    }
                    .director-title-top {
                        font-size: 15px;
                        font-weight: 700;
                        color: #1e293b;
                        margin: 0 0 2px 0;
                    }
                    .director-name-main {
                        font-size: 18.5px;
                        font-weight: 900;
                        color: #0f172a;
                        margin: 0 0 2px 0;
                    }
                    .director-post-sub {
                        font-size: 13.5px;
                        font-weight: 700;
                        color: #334155;
                        margin: 0;
                    }
                    /* Footer & Fixed Approver Accreditation */
                    .footer-container {
                        margin-top: 0;
                        padding-top: 6px;
                    }
                    .footer-pre-divider-row {
                        display: flex;
                        justify-content: space-between;
                        align-items: flex-end;
                        margin-bottom: 3px;
                        line-height: 1.25;
                    }
                    .approver-box {
                        text-align: right;
                    }
                    .approver-name {
                        font-size: 12.5px;
                        font-weight: 800;
                        color: #0f172a;
                    }
                    .org-unit-box {
                        text-align: left;
                        direction: rtl;
                    }
                    .org-unit-name {
                        font-size: 11px;
                        font-weight: 700;
                        color: #334155;
                    }
                    .footer-info-row {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        padding-top: 5px;
                    }
                    .footer-address {
                        font-size: 9.5px;
                        line-height: 1.5;
                        color: #334155;
                        text-align: right;
                        font-weight: 600;
                        width: 100%;
                    }
                </style>
            </head>
            <body>
                <div class="page-container">
                    <!-- Subtle watermark -->
                    <div class="watermark-overlay">
                        <img src="${ITPC_WATERMARK_BASE64}" alt="ITPC" />
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
                                <img src="${ITPC_HEADER_BASE64}" alt="شعار الشركة العامة للاتصالات والمعلوماتية" class="emblem-img" />
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
                            <span class="destination-text">إلى / ${req.destination_entity}</span>
                        </div>

                        <!-- Subject (Center) -->
                        <div class="subject-box">
                            <span class="subject-text">م / تأييد استمرار بالخدمة</span>
                        </div>

                        <!-- Official Body Text -->
                        <div class="body-paragraph">
                            نؤيد لكم بأن ${honorific} ( <b>${employeeName}</b> ) أحد منتسبي هذه المديرية ${cadrePhrase} وما زال مستمراً بالخدمة في الوقت الحاضر وبناءً على طلبه زُوّد بهذا التأييد${purposeClause}
                        </div>

                        <!-- Appreciation -->
                        <div class="salutation-appreciation">
                            ... مـع التقديــر ...
                        </div>

                        <!-- Salary Block (Conditional) -->
                        ${salaryHtml}

                        <!-- Signatures & CC Section -->
                        <div class="sig-cc-section">
                            <div style="flex: 1; max-width: calc(100% - 225px);">
                                ${ccHtml}
                            </div>

                            <div class="director-box">
                                <p class="director-title-top">الدكتور المهندس</p>
                                <p class="director-name-main">علي عباس جاسم الصباغ</p>
                                <p class="director-post-sub">مدير اتصالات ومعلوماتية</p>
                                <p class="director-post-sub">كربلاء المقدسة</p>
                            </div>
                        </div>

                        <!-- Footer & Approver Accreditation / Org Unit -->
                        <div class="footer-container">
                            ${approverAndOrgHtml}
                            <div class="double-divider"></div>
                            <div class="footer-info-row">
                                <div class="footer-address">
                                    <div>العنوان : محافظة كربلاء المقدسة – شارع العباس -ع-</div>
                                    <div>رقم الهاتف : 032333316 &nbsp;|&nbsp; البريد الألكتروني : kerbalatelecoms@itpc.gov.iq &nbsp;|&nbsp; الموقع الألكتروني : www.itpc.gov.iq</div>
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

        const triggerPrint = () => {
            printIframe.contentWindow?.addEventListener('afterprint', () => {
                printIframe.remove();
                resolve(true);
            });
            printIframe.contentWindow?.focus();
            printIframe.contentWindow?.print();
        };

        // انتظار اكتمال تحميل جميع صور المستند في الـ iframe لضمان ظهور الشعار والعلامة المائية
        const images = Array.from(iframeDoc.images);
        if (images.length === 0) {
            triggerPrint();
        } else {
            let loadedCount = 0;
            const onImgFinish = () => {
                loadedCount++;
                if (loadedCount >= images.length) {
                    triggerPrint();
                }
            };
            images.forEach((img) => {
                if (img.complete) {
                    onImgFinish();
                } else {
                    img.addEventListener('load', onImgFinish, { once: true });
                    img.addEventListener('error', onImgFinish, { once: true });
                }
            });
        }
    });
};
