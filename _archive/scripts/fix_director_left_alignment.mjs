import fs from 'fs';

// 1. Update ServiceContinuityProcessModal.tsx
const modalPath = 'D:/InfTeleKarbala/src/features/hr/components/ServiceContinuityProcessModal.tsx';
let modalContent = fs.readFileSync(modalPath, 'utf8');

// Fix ccHtml fallback in handlePrintLetter
modalContent = modalContent.replace(
`        const ccHtml = cleanCcList.length > 0 ? \`
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
        \` : '';`,
`        const ccHtml = cleanCcList.length > 0 ? \`
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
        \` : '<div class="cc-box" style="visibility: hidden; flex: 1; max-width: 50%;"></div>';`
);

// Fix .director-box CSS to have margin-right: auto (anchors to left in RTL)
modalContent = modalContent.replace(
`                    .director-box {
                        text-align: center;
                        min-width: 215px;
                        line-height: 1.45;
                    }`,
`                    .director-box {
                        text-align: center;
                        min-width: 215px;
                        line-height: 1.45;
                        margin-right: auto;
                    }`
);

// Fix Modal preview JSX
modalContent = modalContent.replace(
`                                {/* Dynamic Balanced Row: CC on the Right, Director Signature on the Left */}
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
                                    <div className="text-center space-y-0.5 shrink-0 min-w-[200px]">`,
`                                {/* Dynamic Balanced Row: CC on the Right, Director Signature on the Left */}
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
                                    <div className="text-center space-y-0.5 shrink-0 min-w-[200px] mr-auto">`
);

fs.writeFileSync(modalPath, modalContent, 'utf8');
console.log('ServiceContinuityProcessModal.tsx director left alignment fixed.');

// 2. Update PublicContinuityVerifyPage.tsx
const verifyPath = 'D:/InfTeleKarbala/src/features/hr/components/PublicContinuityVerifyPage.tsx';
let verifyContent = fs.readFileSync(verifyPath, 'utf8');

verifyContent = verifyContent.replace(
`                                {/* Balanced Row: CC on the Right, Director on the Left */}
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
                                    <div className="text-center space-y-0.5 shrink-0 min-w-[200px]">`,
`                                {/* Balanced Row: CC on the Right, Director on the Left */}
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
                                    <div className="text-center space-y-0.5 shrink-0 min-w-[200px] mr-auto">`
);

fs.writeFileSync(verifyPath, verifyContent, 'utf8');
console.log('PublicContinuityVerifyPage.tsx director left alignment fixed.');
