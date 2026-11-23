const fs = require('fs');

let raw = fs.readFileSync('D:/InfTeleKarbala/src/components/admin/CustomAudit.tsx', 'utf8');
const isCRLF = raw.includes('\r\n');
let content = raw.replace(/\r\n/g, '\n');

// Target the whole block inside else of SALARY_FIELDS:
const startMarker = `                    // --- تدقيق المخصصات والاستقطاعات التقليدي ---`;
const endMarker = `                if (mismatch) {
                    allRows.push({`;

const startIndex = content.indexOf(startMarker);
const endIndex = content.indexOf(endMarker);

if (startIndex === -1 || endIndex === -1) {
    console.error("Markers not found! startIndex:", startIndex, "endIndex:", endIndex);
    process.exit(1);
}

const replacement = `                    // --- تدقيق مخصصات الزوجية (مقطوعة 50,000 د.ع) ---
                    if (selectedField === 'marital_allowance') {
                        if (isContract || isFiveYear) {
                            if (fieldCurrentValue === 0) continue;
                            mismatch = true;
                            note = 'لا يستحق مخصصات زوجية';
                            approvedCalc = 0;
                        } else {
                            if (fieldCurrentValue > 0 && Math.abs(fieldCurrentValue - 50000) > 10) {
                                mismatch = true;
                                note = \`مخصصات الزوجية يجب أن تكون 50,000 د.ع (المستلم: \${fmt(fieldCurrentValue)})\`;
                                approvedCalc = 50000;
                            }
                        }
                        if (mismatch) {
                            allRows.push({
                                name: profile?.full_name || '—',
                                jobNumber: profile?.job_number || '—',
                                nominalSalary: nomSal,
                                userCalc: approvedCalc ?? 50000,
                                approvedCalc: approvedCalc ?? 50000,
                                currentValue: fieldCurrentValue,
                                notes: note,
                                isFiveYearLeave: isFiveYear,
                            });
                        }
                        continue;
                    }

                    // --- تدقيق المخصصات والاستقطاعات التقليدي ---
                    const approved = resolveApprovedPercentage(selectedField, fullRecord);
                    if (approved === null) continue;

                    approvedCalc = Math.round((nomSal * approved) / 100);
                    mismatch = Math.abs(approvedCalc - fieldCurrentValue) > 10;

                    // === 1. تدقيق المخصصات القانونية ===
                    if (selectedField === 'legal_allowance') {
                        const riskValue = parseFloat(rec.risk_allowance) || 0;
                        if (approvedCalc > 0) {
                            if (Math.abs(approvedCalc - fieldCurrentValue) > 10) {
                                mismatch = true;
                                if (fieldCurrentValue === 0) note = 'يستحق مخصصات قانونية ولا يستلمها';
                                else note = \`مبلغ المخصصات غير صحيح (يستحق \${fmt(approvedCalc)})\`;
                            } else if (riskValue > 0) {
                                mismatch = true;
                                note = 'يجمع بين مخصصات القانونية والخطورة (يجب حجب الخطورة)';
                            }
                        } else {
                            if (fieldCurrentValue > 0) {
                                mismatch = true;
                                note = 'يستلم مخصصات قانونية دون توفر العنوان أو الشهادة';
                            }
                        }
                    } 
                    // === 2. تدقيق مخصصات الخطورة ===
                    else if (selectedField === 'risk_allowance') {
                        const grade = parseInt(rec.salary_grade, 10);
                        const legalPct = getLegalAllowancePercentage(fullRecord);
                        const legalVal = parseFloat(rec.legal_allowance) || 0;

                        if ([8, 9, 10].includes(grade)) {
                            approvedCalc = 0;
                            if (fieldCurrentValue > 0) {
                                mismatch = true;
                                note = \`الدرجة (\${grade}): الخطورة يجب أن تكون 0% وتستحق مخصصات إضافية 50%\`;
                            }
                        } else if (legalPct === 30 || legalVal > 0) {
                            approvedCalc = 0;
                            if (fieldCurrentValue > 0) {
                                mismatch = true;
                                note = 'يجمع بين مخصصات القانونية والخطورة (يجب حجب الخطورة)';
                            }
                        } else {
                            approvedCalc = Math.round(nomSal * 0.30);
                            if (Math.abs(approvedCalc - fieldCurrentValue) > 10) {
                                mismatch = true;
                                if (fieldCurrentValue === 0) {
                                    note = 'يستحق مخصصات الخطورة (30%) ولا يستلمها';
                                } else if (fieldCurrentValue > approvedCalc) {
                                    note = \`يستلم مخصصات خطورة أعلى من المستحق (المستحق: \${fmt(approvedCalc)})\`;
                                } else {
                                    note = \`يستلم مخصصات خطورة أقل من المستحق (المستحق: \${fmt(approvedCalc)})\`;
                                }
                            }
                        }
                    }
                    // === 3. تدقيق مخصصات المنصب ===
                    else if (selectedField === 'position_allowance') {
                        const approvedPct = resolveApprovedPercentage('position_allowance', fullRecord);
                        approvedCalc = Math.round((nomSal * (approvedPct || 0)) / 100);
                        if (Math.abs(approvedCalc - fieldCurrentValue) > 10) {
                            mismatch = true;
                            if (approvedCalc > 0 && fieldCurrentValue === 0) {
                                note = \`يستحق مخصصات منصب (\${approvedPct}%) ولا يستلمها\`;
                            } else if (approvedCalc === 0 && fieldCurrentValue > 0) {
                                note = 'يستلم مخصصات منصب دون عنوان إداري في النظام';
                            } else if (fieldCurrentValue > approvedCalc) {
                                note = \`القيمة الحالية أعلى من المستحق (\${approvedPct}%)\`;
                            } else {
                                note = \`القيمة الحالية أقل من المستحق (\${approvedPct}%)\`;
                            }
                        }
                    }
                    // === 4. تدقيق المخصصات الإضافية 50% ===
                    else if (selectedField === 'additional_50_percent_allowance') {
                        const grade = parseInt(rec.salary_grade, 10);
                        if ([8, 9, 10].includes(grade)) {
                            approvedCalc = Math.round(nomSal * 0.50);
                            if (Math.abs(approvedCalc - fieldCurrentValue) > 10) {
                                mismatch = true;
                                note = \`يستحق مخصصات إضافية 50% للدرجة (\${grade})\`;
                            }
                        } else {
                            approvedCalc = 0;
                            if (fieldCurrentValue > 0) {
                                mismatch = true;
                                note = \`المخصصات الإضافية 50% خاصة بالدرجات (8، 9، 10) فقط\`;
                            }
                        }
                    }
                    // === 5. تدقيق المخصصات الهندسية (المستويان الذكيان) ===
                    else if (selectedField === 'engineering_allowance') {
                        if (Math.abs(approvedCalc - fieldCurrentValue) > 10) {
                            mismatch = true;
                            if (fieldCurrentValue === 0 && approvedCalc > 0) {
                                note = 'العنوان مهندس لكن لا توجد مخصصات';
                            } else if (approvedCalc === 0 && fieldCurrentValue > 0) {
                                note = 'يستلم مخصصات هندسية دون استحقاق';
                            } else {
                                note = \`المبلغ لا يطابق نسبة الهندسية (المستحق: \${fmt(approvedCalc)})\`;
                            }
                        } else if (fieldCurrentValue > 0) {
                            const isEngTitle = /مهندس|هندس/.test(jt);
                            if (!isEngTitle) {
                                mismatch = true;
                                note = 'لديه مخصصات هندسية وعنوانه ليس هندسياً';
                                approvedCalc = fieldCurrentValue;
                            }
                        }
                    }
                    else {
                        // المنطق العام لبقية الحقول (الشهادة، التقاعد، إلخ)
                        if (mismatch) {
                            if (selectedField === 'certificate_allowance') {
                                if (approvedCalc > 0 && fieldCurrentValue === 0) {
                                    note = 'لديه شهادة ولا يستلم مخصصات';
                                } else if (approvedCalc === 0 && fieldCurrentValue > 0) {
                                    note = 'يستلم مخصصات شهادة دون وجه حق';
                                } else {
                                    if (fieldCurrentValue > approvedCalc) note = \`نسبة الشهادة الممنوحة أعلى من المستحق\`;
                                    else note = \`نسبة الشهادة الممنوحة أقل من المستحق\`;
                                }
                            } else if (selectedField === 'retirement_deduction' && isFiveYear) {
                                note = \`إجازة 5 سنوات: استقطاع التقاعد 25% (\${fmt(approvedCalc)})\`;
                            } else {
                                if (fieldCurrentValue === 0) note = 'لا يستلم المخصصات المستحقة';
                                else if (approvedCalc === 0) note = 'يستلم مخصصات غير مستحقة';
                                else if (fieldCurrentValue > approvedCalc) note = \`القيمة الحالية أعلى من المستحق\`;
                                else note = \`القيمة الحالية أقل من المستحق\`;
                            }
                        }
                    }
                }

`;

content = content.substring(0, startIndex) + replacement + content.substring(endIndex);

if (isCRLF) {
    content = content.replace(/\n/g, '\r\n');
}

fs.writeFileSync('D:/InfTeleKarbala/src/components/admin/CustomAudit.tsx', content, 'utf8');
console.log('CustomAudit.tsx step 2 successfully updated.');
