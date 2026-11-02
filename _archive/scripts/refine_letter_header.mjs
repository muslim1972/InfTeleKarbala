import fs from 'fs';

// 1. Update ServiceContinuityProcessModal.tsx
const modalPath = 'D:/InfTeleKarbala/src/features/hr/components/ServiceContinuityProcessModal.tsx';
let modalContent = fs.readFileSync(modalPath, 'utf8');

// In handlePrintLetter styles: update .header-right and .header-left to text-align: center and emblem-img size
modalContent = modalContent.replace(
`                    .header-right {
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
                    }`,
`                    .header-right {
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
                    }`
);

modalContent = modalContent.replace(
`                    .emblem-img {
                        width: 115px;
                        height: auto;
                        max-height: 85px;
                        object-fit: contain;
                        display: block;
                        margin: 0 auto;
                    }`,
`                    .emblem-img {
                        width: 155px;
                        height: auto;
                        max-height: 100px;
                        object-fit: contain;
                        display: block;
                        margin: 0 auto;
                    }`
);

modalContent = modalContent.replace(
`                    .header-left {
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
                    }`,
`                    .header-left {
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
                    }`
);

// In handlePrintLetter HTML: remove جمهورية العراق and Republic of Iraq
modalContent = modalContent.replace(
`                        <!-- Top Header -->
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
                        </div>`,
`                        <!-- Top Header -->
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
                        </div>`
);

// In Modal Preview JSX: center text and resize logo
modalContent = modalContent.replace(
`                            {/* Letter Header: 3-column Grid */}
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
                            </div>`,
`                            {/* Letter Header: 3-column Grid */}
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
                            </div>`
);

fs.writeFileSync(modalPath, modalContent, 'utf8');
console.log('ServiceContinuityProcessModal.tsx header updated.');

// 2. Update PublicContinuityVerifyPage.tsx
const verifyPath = 'D:/InfTeleKarbala/src/features/hr/components/PublicContinuityVerifyPage.tsx';
let verifyContent = fs.readFileSync(verifyPath, 'utf8');

verifyContent = verifyContent.replace(
`                            {/* Letter Header: 3-column Grid */}
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
                            </div>`,
`                            {/* Letter Header: 3-column Grid */}
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
                            </div>`
);

fs.writeFileSync(verifyPath, verifyContent, 'utf8');
console.log('PublicContinuityVerifyPage.tsx header updated.');
