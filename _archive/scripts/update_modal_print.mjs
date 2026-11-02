import fs from 'fs';

const modalPath = 'D:/InfTeleKarbala/src/features/hr/components/ServiceContinuityProcessModal.tsx';
let content = fs.readFileSync(modalPath, 'utf8');

// Replace handlePrintLetter
const printFuncStart = '    // Isolated A4 Single-Page Print Engine';
const printFuncEnd = '        printIframe.contentWindow?.print();\n    };';

const startIndex = content.indexOf(printFuncStart);
const endIndex = content.indexOf(printFuncEnd) + printFuncEnd.length;

if (startIndex === -1 || endIndex === -1) {
    console.error('Could not locate handlePrintLetter in file!');
    process.exit(1);
}

const newPrintFunc = `    // Isolated A4 Single-Page Official Print Engine
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
            ? \` وذلك لغرض (\${cleanedPurpose})\`
            : '';

        const salaryHtml = (request.include_nominal_salary || request.include_total_salary) ? \`
            <div class="salary-container">
                <div class="salary-heading">علماً أن:</div>
                <div class="salary-items">
                    \${request.include_nominal_salary ? \`
                        <div class="salary-row">
                            <span class="salary-label">الراتب الاسمي /</span>
                            <span class="salary-val">\${Number(request.nominal_salary_snapshot || 0).toLocaleString('ar-IQ')} دينار</span>
                        </div>
                    \` : ''}
                    \${request.include_total_salary ? \`
                        <div class="salary-row">
                            <span class="salary-label">الراتب الكلي /</span>
                            <span class="salary-val">\${Number(request.total_salary_snapshot || 0).toLocaleString('ar-IQ')} دينار</span>
                        </div>
                        <div class="salary-row">
                            <span class="salary-label">الراتب الصافي /</span>
                            <span class="salary-val">\${Number(request.total_salary_snapshot || 0).toLocaleString('ar-IQ')} دينار</span>
                        </div>
                    \` : ''}
                </div>
            </div>
        \` : '';

        const ccHtml = cleanCcList.length > 0 ? \`
            <div class="cc-box">
                <div class="cc-title">نسخة منه إلى /</div>
                <ul class="cc-list">
                    \${cleanCcList.map(cc => \`
                        <li>
                            <span class="cc-name">• \${cc}</span>
                            <span class="cc-action">\${getCcActionPhrase(cc)}</span>
                        </li>
                    \`).join('')}
                </ul>
            </div>
        \` : '';

        const htmlContent = \`
            <!DOCTYPE html>
            <html dir="rtl" lang="ar">
            <head>
                <meta charset="utf-8">
                <title>تأييد استمرارية بالخدمة - \${letterNumber}</title>
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
                        text-align: right;
                        line-height: 1.4;
                    }
                    .header-right h3 {
                        font-size: 13.5px;
                        font-weight: 800;
                        margin: 0 0 1px 0;
                        color: #0f172a;
                    }
                    .header-right h4 {
                        font-size: 12px;
                        font-weight: 700;
                        margin: 0 0 1px 0;
                        color: #1e293b;
                    }
                    .header-right h5 {
                        font-size: 12px;
                        font-weight: 800;
                        margin: 0 0 1px 0;
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
                        width: 115px;
                        height: auto;
                        max-height: 85px;
                        object-fit: contain;
                        display: block;
                        margin: 0 auto;
                    }
                    .header-left {
                        text-align: left;
                        direction: ltr;
                        font-family: Arial, -apple-system, sans-serif;
                        line-height: 1.35;
                    }
                    .header-left h3 {
                        font-size: 12px;
                        font-weight: 800;
                        margin: 0 0 1px 0;
                        color: #0f172a;
                    }
                    .header-left h4 {
                        font-size: 11px;
                        font-weight: 700;
                        margin: 0 0 1px 0;
                        color: #1e293b;
                    }
                    .header-left h5 {
                        font-size: 11px;
                        font-weight: 800;
                        margin: 0 0 1px 0;
                        color: #0f172a;
                    }
                    .header-left p {
                        font-size: 10px;
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
                                <h3>جمهورية العراق</h3>
                                <h4>وزارة الاتصالات</h4>
                                <h4>الشركة العامة للاتصالات والمعلوماتية</h4>
                                <h5>مديرية اتصالات ومعلوماتية كربلاء المقدسة</h5>
                                <p>القسم المالي والاداري</p>
                                <p>شعبة الموارد البشرية</p>
                            </div>
                            <div class="header-center">
                                <img src="/itpc-official-header.png" alt="شعار الشركة العامة للاتصالات والمعلوماتية" class="emblem-img" />
                            </div>
                            <div class="header-left">
                                <h3>Republic of Iraq</h3>
                                <h4>Ministry of Communications</h4>
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
                            <span class="destination-text">إلى / \${request.destination_entity}</span>
                        </div>

                        <!-- Subject (Center) -->
                        <div class="subject-box">
                            <span class="subject-text">م / تأييد استمرار بالخدمة</span>
                        </div>

                        <!-- Official Body Text -->
                        <div class="body-paragraph">
                            نؤيد لكم بأن \${honorific} ( <b>\${employeeName}</b> ) أحد منتسبي هذه المديرية على الملاك الدائم وما زال مستمراً بالخدمة في الوقت الحاضر وبناءً على طلبه زُوّد بهذا التأييد\${purposeClause}
                        </div>

                        <!-- Appreciation -->
                        <div class="salutation-appreciation">
                            ... مـع التقديــر ...
                        </div>

                        <!-- Salary Block (Conditional) -->
                        \${salaryHtml}

                        <!-- Signatures & CC Section -->
                        <div class="sig-cc-section">
                            \${ccHtml}

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
                                    \${qrCodeDataUrl ? \`<img src="\${qrCodeDataUrl}" class="footer-qr-img" alt="QR" />\` : ''}
                                    <div class="footer-qr-text">
                                        <div><b>وثيقة رسمية معتمدة</b></div>
                                        <div style="font-family: monospace;">كود: #\${request.id.slice(0, 8)}</div>
                                        <div style="font-size: 8.5px; color: #64748b;">امسح الرمز للتحقق الرقمي</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </body>
            </html>
        \`;

        iframeDoc.open();
        iframeDoc.write(htmlContent);
        iframeDoc.close();

        printIframe.contentWindow?.addEventListener('afterprint', () => {
            printIframe.remove();
        });

        printIframe.contentWindow?.focus();
        printIframe.contentWindow?.print();
    };`;

content = content.slice(0, startIndex) + newPrintFunc + content.slice(endIndex);

fs.writeFileSync(modalPath, content, 'utf8');
console.log('handlePrintLetter successfully updated!');
