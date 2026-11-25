/**
 * دالة الطباعة الفورية المباشرة للأمر الإداري (انفكاك / مباشرة) (A4)
 * مستمدة من قالب الطباعة الرسمي لتأييد الاستمرارية مع استبدال الترويسة بـ "أمر إداري" والعنوان بـ "م / انفكاك" أو "م / مباشرة".
 */
import { ITPC_HEADER_BASE64, ITPC_WATERMARK_BASE64 } from './continuityPrintAssets';
import { getTripartiteName, getHonorific, getLowestOrgUnit } from './printContinuityDirect';

export interface DirectPrintMovementData {
    id: string;
    movement_type: 'disengagement' | 'resumption';
    effective_date: string;
    leave_order_number: string;
    leave_order_date: string;
    with_pay?: boolean;
    employee?: {
        full_name?: string;
        gender?: number | string | null;
        dept_text?: string;
        section_text?: string;
        unit_text?: string;
        job_number?: string;
    } | null;
}

const formatDateDMY = (dateStr?: string | null): string => {
    if (!dateStr) return '—';
    const d = dateStr.split('T')[0];
    const parts = d.split('-');
    if (parts.length === 3 && parts[0].length === 4) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return d;
};

const waitForImagesAndPrint = (printIframe: HTMLIFrameElement, resolve: (val: boolean) => void) => {
    const iframeDoc = printIframe.contentWindow?.document;
    if (!iframeDoc) {
        if (document.body.contains(printIframe)) {
            document.body.removeChild(printIframe);
        }
        resolve(false);
        return;
    }

    const triggerPrint = () => {
        try {
            printIframe.contentWindow?.addEventListener('afterprint', () => {
                if (document.body.contains(printIframe)) {
                    document.body.removeChild(printIframe);
                }
                resolve(true);
            }, { once: true });
            printIframe.contentWindow?.focus();
            printIframe.contentWindow?.print();
        } catch {
            if (document.body.contains(printIframe)) {
                document.body.removeChild(printIframe);
            }
            resolve(false);
        }
    };

    const images = Array.from(iframeDoc.images);
    if (images.length === 0) {
        triggerPrint();
        return;
    }

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
};

const getSharedAdminOrderStyles = () => `
    @page {
        size: A4 portrait;
        margin: 8mm 12mm 8mm 12mm;
    }
    * {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
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
    .letter-content {
        position: relative;
        z-index: 1;
        display: flex;
        flex-direction: column;
        height: 100%;
        flex: 1;
    }
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
    .header-right h3 { font-size: 12px; font-weight: 800; margin: 0 0 1px 0; color: #0f172a; }
    .header-right h4 { font-size: 11px; font-weight: 800; margin: 0 0 1px 0; color: #0f172a; }
    .header-right h5 { font-size: 11px; font-weight: 800; margin: 0 0 1px 0; color: #0f172a; }
    .header-right p { font-size: 10px; font-weight: 700; margin: 0; color: #334155; }
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
    .header-left h3 { font-size: 11.5px; font-weight: 800; margin: 0 0 1px 0; color: #0f172a; }
    .header-left h4 { font-size: 9.8px; font-weight: 700; margin: 0 0 1px 0; color: #1e293b; white-space: nowrap; }
    .header-left h5 { font-size: 10.5px; font-weight: 800; margin: 0 0 1px 0; color: #0f172a; }
    .header-left p { font-size: 9.5px; font-weight: 700; margin: 0; color: #334155; }
    .double-divider {
        margin-top: 6px;
        margin-bottom: 0;
        border-top: 2.5px solid #0f172a;
        border-bottom: 0.8px solid #0f172a;
        height: 5px;
    }
    .dispatch-gap {
        height: 95px;
        width: 100%;
    }
    .order-heading-box {
        text-align: center;
        margin-bottom: 8px;
    }
    .order-heading-text {
        font-size: 18px;
        font-weight: 900;
        color: #0f172a;
        text-decoration: underline;
        text-underline-offset: 6px;
        text-decoration-thickness: 2px;
    }
    .subject-box {
        text-align: center;
        margin: 4px 0 18px 0;
    }
    .subject-text {
        font-size: 17px;
        font-weight: 900;
        color: #0f172a;
    }
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
        font-size: 13px;
        line-height: 1.65;
        color: #0f172a;
        font-weight: 700;
    }
    .cc-list li {
        padding: 1.5px 0;
        white-space: nowrap;
    }
    .director-box {
        text-align: center;
        min-width: 225px;
        line-height: 1.45;
        margin-right: auto;
    }
    .director-title-top { font-size: 15px; font-weight: 700; color: #1e293b; margin: 0 0 2px 0; }
    .director-name-main { font-size: 18.5px; font-weight: 900; color: #0f172a; margin: 0 0 2px 0; }
    .director-post-sub { font-size: 13.5px; font-weight: 700; color: #334155; margin: 0; }
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
    .approver-box { text-align: right; }
    .approver-name { font-size: 12.5px; font-weight: 800; color: #0f172a; }
    .org-unit-box { text-align: left; direction: rtl; }
    .org-unit-name { font-size: 11px; font-weight: 700; color: #334155; }
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
`;

export const printAdministrativeOrderDirect = (req: DirectPrintMovementData): Promise<boolean> => {
    return new Promise((resolve) => {
        const printIframe = document.createElement('iframe');
        printIframe.style.position = 'fixed';
        printIframe.style.right = '0';
        printIframe.style.bottom = '0';
        printIframe.style.width = '0';
        printIframe.style.height = '0';
        printIframe.style.border = '0';
        document.body.appendChild(printIframe);

        const isDisengagement = req.movement_type === 'disengagement';
        const subjectTitle = isDisengagement ? 'م / انفكاك' : 'م / مباشرة';
        const employeeName = getTripartiteName(req.employee?.full_name) || 'الموظف';
        const honorific = getHonorific(req.employee?.gender, employeeName);
        const isFemale = honorific === 'السيدة';

        const salaryModeText = req.with_pay === false ? 'بدون راتب' : 'براتب تام';
        const actionVerb = isDisengagement
            ? (isFemale ? 'انفكت' : 'انفك')
            : (isFemale ? 'باشرت' : 'باشر');
        const pronounRef = isFemale ? 'المومأ إليها' : 'المومأ إليه';
        const workPlaceRef = isDisengagement
            ? (isFemale ? 'من مقر عملها' : 'من مقر عمله')
            : (isFemale ? 'في مقر عملها' : 'في مقر عمله');

        const orderNum = req.leave_order_number || '—';
        const orderDate = formatDateDMY(req.leave_order_date);
        const effDate = formatDateDMY(req.effective_date);
        const lowestOrgUnit = getLowestOrgUnit(req.employee);

        const bodyParagraphText =
            `استناداً للأمر الإداري المرقم (<b>${orderNum}</b>) في (<b>${orderDate}</b>) والخاص بمنح ${honorific} ( <b>${employeeName}</b> ) إجازة طويلة (${salaryModeText})، ${actionVerb} ${pronounRef} ${workPlaceRef} بتاريخ (<b>${effDate}</b>).`;

        const htmlContent = `
        <!DOCTYPE html>
        <html lang="ar" dir="rtl">
        <head>
            <meta charset="UTF-8">
            <title>أمر إداري - ${subjectTitle}</title>
            <style>${getSharedAdminOrderStyles()}</style>
        </head>
        <body>
            <div class="page-container">
                <div class="watermark-overlay">
                    <img src="${ITPC_WATERMARK_BASE64}" alt="ITPC" />
                </div>

                <div class="letter-content">
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
                            <h4>Informatics &amp; Telecommunications Public Company</h4>
                            <h5>Karbala Telecom &amp; Informatics Directorate</h5>
                            <p>Financial &amp; Administrative Department</p>
                            <p>Human Resources Division</p>
                        </div>
                    </div>

                    <div class="double-divider"></div>
                    <div class="dispatch-gap"></div>

                    <!-- في الوسط: أمر إداري -->
                    <div class="order-heading-box">
                        <span class="order-heading-text">أمر إداري</span>
                    </div>

                    <!-- العنوان: م / انفكاك أو م / مباشرة -->
                    <div class="subject-box">
                        <span class="subject-text">${subjectTitle}</span>
                    </div>

                    <!-- المتن -->
                    <div class="body-paragraph">
                        ${bodyParagraphText}
                    </div>

                    <div class="salutation-appreciation">
                        ... مـع التقديــر ...
                    </div>

                    <div class="sig-cc-section">
                        <div style="flex: 1; max-width: calc(100% - 225px);">
                            <div class="cc-box">
                                <div class="cc-title">نسخة منه إلى /</div>
                                <ul class="cc-list">
                                    <li>• الإضبارة الشخصية / للحفظ .</li>
                                </ul>
                            </div>
                        </div>

                        <div class="director-box">
                            <p class="director-title-top">الدكتور المهندس</p>
                            <p class="director-name-main">علي عباس جاسم الصباغ</p>
                            <p class="director-post-sub">مدير اتصالات ومعلوماتية</p>
                            <p class="director-post-sub">كربلاء المقدسة</p>
                        </div>
                    </div>

                    <div class="footer-container">
                        <div class="footer-pre-divider-row">
                            <div class="approver-box">
                                <span class="approver-name">حيدر صالح عبدالهادي</span>
                            </div>
                            <div class="org-unit-box">
                                ${lowestOrgUnit ? `<span class="org-unit-name">${lowestOrgUnit}</span>` : ''}
                            </div>
                        </div>
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

        const doc = printIframe.contentWindow?.document;
        if (!doc) {
            document.body.removeChild(printIframe);
            resolve(false);
            return;
        }

        doc.open();
        doc.write(htmlContent);
        doc.close();

        waitForImagesAndPrint(printIframe, resolve);
    });
};

export interface DirectPrintLongLeaveData {
    id: string;
    days_count: number;
    with_pay?: boolean;
    cadre_type?: 'permanent' | 'contract' | string;
    cc_recipients?: string[];
    reason?: string;
    employee?: {
        full_name?: string;
        gender?: number | string | null;
        dept_text?: string;
        section_text?: string;
        unit_text?: string;
        job_number?: string;
    } | null;
}

export const printLongLeaveOrderDirect = (req: DirectPrintLongLeaveData): Promise<boolean> => {
    return new Promise((resolve) => {
        const printIframe = document.createElement('iframe');
        printIframe.style.position = 'fixed';
        printIframe.style.right = '0';
        printIframe.style.bottom = '0';
        printIframe.style.width = '0';
        printIframe.style.height = '0';
        printIframe.style.border = '0';
        document.body.appendChild(printIframe);

        const employeeName = getTripartiteName(req.employee?.full_name) || 'الموظف';
        const honorific = getHonorific(req.employee?.gender, employeeName);
        const cadrePhrase = req.cadre_type === 'contract' ? '(بصفة عقد)' : '(على الملاك الدائم)';
        const salaryModeText = req.with_pay === false ? 'بدون راتب' : 'براتب تام';
        const lowestOrgUnit = getLowestOrgUnit(req.employee);
        const ccList = Array.isArray(req.cc_recipients) && req.cc_recipients.length > 0
            ? req.cc_recipients
            : ['الإضبارة الشخصية'];
        const ccItemsHtml = ccList
            .map((c) => `<li>• ${c.includes('/') ? c : `${c} / للحفظ والتأشير .`}</li>`)
            .join('');

        const bodyParagraphText =
            `تقرر منح ${honorific} ( <b>${employeeName}</b> ) ${cadrePhrase} إجازة اعتيادية طويلة لمدة (<b>${req.days_count}</b>) يوماً (${salaryModeText})، اعتباراً من تاريخ الانفكاك الرسمي.`;

        const htmlContent = `
        <!DOCTYPE html>
        <html lang="ar" dir="rtl">
        <head>
            <meta charset="UTF-8">
            <title>أمر إداري - إجازة اعتيادية طويلة</title>
            <style>${getSharedAdminOrderStyles()}</style>
        </head>
        <body>
            <div class="page-container">
                <div class="watermark-overlay">
                    <img src="${ITPC_WATERMARK_BASE64}" alt="ITPC" />
                </div>
                <div class="letter-content">
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
                            <h4>Informatics &amp; Telecommunications Public Company</h4>
                            <h5>Karbala Telecom &amp; Informatics Directorate</h5>
                            <p>Financial &amp; Administrative Department</p>
                            <p>Human Resources Division</p>
                        </div>
                    </div>
                    <div class="double-divider"></div>
                    <div class="dispatch-gap"></div>
                    <div class="order-heading-box">
                        <span class="order-heading-text">أمر إداري</span>
                    </div>
                    <div class="subject-box">
                        <span class="subject-text">م / إجازة اعتيادية طويلة</span>
                    </div>
                    <div class="body-paragraph">
                        ${bodyParagraphText}
                    </div>
                    <div class="salutation-appreciation">... مـع التقديــر ...</div>
                    <div class="sig-cc-section">
                        <div style="flex: 1; max-width: calc(100% - 225px);">
                            <div class="cc-box">
                                <div class="cc-title">نسخة منه إلى /</div>
                                <ul class="cc-list">${ccItemsHtml}</ul>
                            </div>
                        </div>
                        <div class="director-box">
                            <p class="director-title-top">الدكتور المهندس</p>
                            <p class="director-name-main">علي عباس جاسم الصباغ</p>
                            <p class="director-post-sub">مدير اتصالات ومعلوماتية</p>
                            <p class="director-post-sub">كربلاء المقدسة</p>
                        </div>
                    </div>
                    <div class="footer-container">
                        <div class="footer-pre-divider-row">
                            <div class="approver-box">
                                <span class="approver-name">حيدر صالح عبدالهادي</span>
                            </div>
                            <div class="org-unit-box">
                                ${lowestOrgUnit ? `<span class="org-unit-name">${lowestOrgUnit}</span>` : ''}
                            </div>
                        </div>
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
        </html>`;

        const doc = printIframe.contentWindow?.document;
        if (!doc) {
            document.body.removeChild(printIframe);
            resolve(false);
            return;
        }
        doc.open();
        doc.write(htmlContent);
        doc.close();

        waitForImagesAndPrint(printIframe, resolve);
    });
};
