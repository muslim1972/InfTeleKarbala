import re

with open('src/components/admin/CustomAudit.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update imports
target_import = """import { 
    ALLOWANCE_FIELDS, 
    DEDUCTION_FIELDS, 
    SALARY_FIELDS, 
    resolveApprovedPercentage 
} from '../../utils/salaryRules';"""

repl_import = """import { 
    ALLOWANCE_FIELDS, 
    DEDUCTION_FIELDS, 
    SALARY_FIELDS, 
    resolveApprovedPercentage,
    getLegalAllowancePercentage,
    getExpectedGrossSalary,
    getExpectedNetSalary
} from '../../utils/salaryRules';"""

content = content.replace(target_import, repl_import)

# 2. Update handleVerify for salary fields
target_hv = """        // -- تدقيق قيم الراتب --
        if (SALARY_FIELDS.some(f => f.key === field)) {
            setApprovedPercentage(null);
            let expectedValue: number | null = null;

            if (field === 'nominal_salary') {
                const grade = finData.salary_grade;
                const stage = finData.salary_stage;
                expectedValue = getExpectedNominalSalary(grade, stage);
            } else if (field === 'gross_salary') {
                if (isFiveYear) {
                    expectedValue = nom;
                } else {
                    const allAllowances = ALLOWANCE_FIELDS.reduce((sum, f) => sum + (parseFloat(finData[f.key]) || 0), 0);
                    expectedValue = nom + allAllowances;
                }
            } else if (field === 'net_salary') {
                if (isFiveYear) {
                    const ret = Math.round(nom * 0.25);
                    const soc = Math.round(nom * 0.0025);
                    expectedValue = nom - ret - soc;
                } else {
                    const allAllowances = ALLOWANCE_FIELDS.reduce((sum, f) => sum + (parseFloat(finData[f.key]) || 0), 0);
                    const allDeductions = DEDUCTION_FIELDS.reduce((sum, f) => sum + (parseFloat(finData[f.key]) || 0), 0);
                    expectedValue = (nom + allAllowances) - allDeductions;
                }
            }"""

repl_hv = """        // -- تدقيق قيم الراتب --
        if (SALARY_FIELDS.some(f => f.key === field)) {
            setApprovedPercentage(null);
            let expectedValue: number | null = null;

            if (field === 'nominal_salary') {
                const grade = finData.salary_grade;
                const stage = finData.salary_stage;
                expectedValue = getExpectedNominalSalary(grade, stage, fieldCurrentValue);
            } else if (field === 'gross_salary') {
                expectedValue = getExpectedGrossSalary({ ...finData, is_five_year_leave: isFiveYear });
            } else if (field === 'net_salary') {
                expectedValue = getExpectedNetSalary({ ...finData, is_five_year_leave: isFiveYear });
            }"""

content = content.replace(target_hv, repl_hv)

# 3. Update generateMismatchReport exclusions and checks
target_loop_start = """            // استبعاد الحسابات الاختبارية والتجريبية
            if (uname.startsWith('c12') || uname.includes('test') || fname.includes('تجريبي')) {
                continue;
            }

            // كشف إجازة الخمس سنوات الفعلية
            const grossVal = parseFloat(rec.gross_salary) || 0;
            const certAllVal = parseFloat(rec.certificate_allowance) || 0;
            const isFiveYear = (rec.is_five_year_leave && Math.abs(grossVal - nomSal) < 10 && certAllVal === 0) || (
                grossVal > 0 && 
                Math.abs(grossVal - nomSal) < 10 && 
                certAllVal === 0 && 
                (parseFloat(rec.risk_allowance) || 0) === 0
            );

            // كشف العقود
            const isContract = (jn.startsWith('143264') || jt.includes('عقد')) && (parseFloat(rec.certificate_allowance) || 0) === 0;

            const fieldCurrentValue = parseFloat(rec[selectedField]) || 0;

            // إذا كان الموظف مجاز 5 سنوات والتدقيق في أحد بنود المخصصات وقيمتها 0، فهذا مطابق قانوناً
            if (isFiveYear && ALLOWANCE_FIELDS.some(f => f.key === selectedField)) {
                if (fieldCurrentValue === 0) {
                    continue;
                }
            }

            // إذا كان الموظف عقد والتدقيق في مخصصات الشهادة وقيمتها 0، فهذا مطابق لسلم رواتبهم
            if (isContract && selectedField === 'certificate_allowance') {
                if (fieldCurrentValue === 0) {
                    continue;
                }
            }"""

repl_loop_start = """            // استبعاد الحسابات الاختبارية والتجريبية
            if (uname.startsWith('c12') || uname.includes('test') || fname.includes('تجريبي')) {
                continue;
            }

            // كشف واستبعاد موظفي العقود والأجور اليومية تماماً من كافة التدقيقات الوزارية
            const isContractOrDaily = jn.startsWith('143264') || /عقد|اجير|أجير/.test(jt);
            if (isContractOrDaily) {
                continue;
            }

            // كشف إجازة الخمس سنوات الفعلية
            const grossVal = parseFloat(rec.gross_salary) || 0;
            const certAllVal = parseFloat(rec.certificate_allowance) || 0;
            const isFiveYear = (rec.is_five_year_leave && Math.abs(grossVal - nomSal) < 10 && certAllVal === 0) || (
                grossVal > 0 && 
                Math.abs(grossVal - nomSal) < 10 && 
                certAllVal === 0 && 
                (parseFloat(rec.risk_allowance) || 0) === 0
            );

            const fieldCurrentValue = parseFloat(rec[selectedField]) || 0;

            // إذا كان الموظف مجاز 5 سنوات والتدقيق في أحد بنود المخصصات وقيمتها 0، فهذا مطابق قانوناً
            if (isFiveYear && ALLOWANCE_FIELDS.some(f => f.key === selectedField)) {
                if (fieldCurrentValue === 0) {
                    continue;
                }
            }"""

content = content.replace(target_loop_start, repl_loop_start)

# 4. Update salary fields audit in generateMismatchReport
target_sal_audit = """                    if (selectedField === 'nominal_salary') {
                        const grade = rec.salary_grade;
                        const stage = rec.salary_stage;
                        approvedCalc = getExpectedNominalSalary(grade, stage);
                        if (approvedCalc === null) {
                            mismatch = true;
                            note = 'الدرجة والمرحلة غير صالحة أو مفقودة';
                        } else if (Math.abs(approvedCalc - fieldCurrentValue) > 1) {
                            mismatch = true;
                            note = `الراتب الاسمي لا يطابق السلم (المستحق: ${fmt(approvedCalc)})`;
                        }
                    } else if (selectedField === 'gross_salary') {
                        if (isFiveYear) {
                            approvedCalc = nomSal;
                            if (Math.abs(approvedCalc - fieldCurrentValue) > 1) {
                                mismatch = true;
                                note = `إجازة 5 سنوات: الراتب الكلي يجب أن يساوي الاسمي (${fmt(approvedCalc)})`;
                            }
                        } else {
                            const allAllowances = ALLOWANCE_FIELDS.reduce((sum, f) => sum + (parseFloat(rec[f.key]) || 0), 0);
                            approvedCalc = nomSal + allAllowances;
                            if (Math.abs(approvedCalc - fieldCurrentValue) > 1) {
                                mismatch = true;
                                note = `خطأ في جمع الراتب الكلي (مجموع الاسمي والمخصصات = ${fmt(approvedCalc)})`;
                            }
                        }
                    } else if (selectedField === 'net_salary') {
                        if (isFiveYear) {
                            const ret = Math.round(nomSal * 0.25);
                            const soc = Math.round(nomSal * 0.0025);
                            approvedCalc = nomSal - ret - soc;
                            if (Math.abs(approvedCalc - fieldCurrentValue) > 1) {
                                mismatch = true;
                                note = `إجازة 5 سنوات: الصافي = الاسمي - تقاعد 25% (${fmt(ret)}) - حماية 0.25% (${fmt(soc)}) = ${fmt(approvedCalc)}`;
                            }
                        } else {
                            const allAllowances = ALLOWANCE_FIELDS.reduce((sum, f) => sum + (parseFloat(rec[f.key]) || 0), 0);
                            const allDeductions = DEDUCTION_FIELDS.reduce((sum, f) => sum + (parseFloat(rec[f.key]) || 0), 0);
                            approvedCalc = (nomSal + allAllowances) - allDeductions;
                            if (Math.abs(approvedCalc - fieldCurrentValue) > 1) {
                                mismatch = true;
                                note = `خطأ في حساب الراتب الصافي (الاستحقاق = ${fmt(approvedCalc)})`;
                            }
                        }
                    }"""

repl_sal_audit = """                    if (selectedField === 'nominal_salary') {
                        const grade = rec.salary_grade;
                        const stage = rec.salary_stage;
                        approvedCalc = getExpectedNominalSalary(grade, stage, fieldCurrentValue);
                        if (approvedCalc === null) {
                            mismatch = true;
                            note = 'الدرجة والمرحلة غير صالحة أو مفقودة';
                        } else if (Math.abs(approvedCalc - fieldCurrentValue) > 1) {
                            mismatch = true;
                            note = `الراتب الاسمي لا يطابق السلم (المستحق: ${fmt(approvedCalc)})`;
                        }
                    } else if (selectedField === 'gross_salary') {
                        approvedCalc = getExpectedGrossSalary(fullRecord);
                        if (Math.abs(approvedCalc - fieldCurrentValue) > 1) {
                            mismatch = true;
                            note = `خطأ في جمع الراتب الكلي (المستحق: ${fmt(approvedCalc)})`;
                        }
                    } else if (selectedField === 'net_salary') {
                        approvedCalc = getExpectedNetSalary(fullRecord);
                        if (Math.abs(approvedCalc - fieldCurrentValue) > 1) {
                            mismatch = true;
                            note = `خطأ في حساب الراتب الصافي (الاستحقاق: ${fmt(approvedCalc)})`;
                        }
                    }"""

content = content.replace(target_sal_audit, repl_sal_audit)

# 5. Update engineering & risk special audit logic
target_sp_logic = """                    // === منطق خاص للمخصصات القانونية (الشرط الرباعي) ===
                    if (selectedField === 'legal_allowance') {
                        const riskValue = parseFloat(rec.risk_allowance) || 0;

                        // إذا كان مستحقاً (30%)
                        if (approvedCalc > 0) {
                            // 1. يجب أن يستلم المبلغ الصحيح
                            if (Math.abs(approvedCalc - fieldCurrentValue) > 1) {
                                mismatch = true;
                                if (fieldCurrentValue === 0) note = 'يستحق مخصصات قانونية ولا يستلمها';
                                else note = `مبلغ المخصصات غير صحيح (يستحق ${fmt(approvedCalc)})`;
                            }
                            // 2. يجب أن تكون مخصصات الخطورة 0
                            else if (riskValue > 0) {
                                mismatch = true;
                                note = 'يجمع بين مخصصات القانونية والخطورة (يجب حجب الخطورة)';
                            }
                        }
                        // إذا لم يكن مستحقاً (0%)
                        else {
                            if (fieldCurrentValue > 0) {
                                mismatch = true;
                                const title = fullRecord.job_title || '';
                                const cert = fullRecord.certificate_text || '';
                                const normalizedCert = cert.replace(/[0-9%.\s\-\(\)]/g, '');

                                const legalTitles = [
                                    'مستشار قانوني',
                                    'مستشار قانوني اقدم',
                                    'مستشار قانوني اقدم اول',
                                    'مشاور قانوني',
                                    'مشاور قانوني اقدم',
                                    'مشاور قانوني اقدم اول',
                                    'ر مستشارين',
                                    'ر مستشارين اقدم',
                                    'ر مستشارين اقدم اول',
                                    'ر مشاورين',
                                    'ر مشاورين اقدم',
                                    'ر مشاورين اقدم اول'
                                ];
                                const isLegalTitle = legalTitles.some(t => title === t || title.includes(t));
                                const isBachelor = normalizedCert.includes('بكلوريوس') || normalizedCert.includes('بكالوريوس');

                                if (!isLegalTitle && !isBachelor) note = 'العنوان والشهادة لا يطابقان شروط القانونية';
                                else if (!isLegalTitle) note = 'العنوان ليس ضمن العناوين القانونية المعتمدة';
                                else if (!isBachelor) note = 'الشهادة ليست بكلوريوس';
                                else note = 'يستلم مخصصات غير مستحقة';
                            }
                        }
                    } else {
                        // المنطق العام لبقية الحقول
                        if (mismatch) {
                            if (selectedField === 'engineering_allowance') {
                                if (approvedCalc > 0 && fieldCurrentValue === 0) {
                                    note = 'العنوان مهندس لكن لا توجد مخصصات';
                                } else if (approvedCalc === 0 && fieldCurrentValue > 0) {
                                    note = 'عدم تطابق المخصصات مع العنوان أو الشهادة';
                                } else {
                                    if (fieldCurrentValue > approvedCalc) note = `يستلم زيادة عن الاستحقاق (${fmt(fieldCurrentValue - approvedCalc)})`;
                                    else note = `يستلم أقل من الاستحقاق (${fmt(approvedCalc - fieldCurrentValue)})`;
                                }
                            } else if (selectedField === 'certificate_allowance') {
                                if (approvedCalc > 0 && fieldCurrentValue === 0) {
                                    note = 'لديه شهادة ولا يستلم مخصصات';
                                } else if (approvedCalc === 0 && fieldCurrentValue > 0) {
                                    note = 'يستلم مخصصات شهادة دون وجه حق';
                                } else {
                                    if (fieldCurrentValue > approvedCalc) note = `نسبة الشهادة الممنوحة أعلى من المستحق`;
                                    else note = `نسبة الشهادة الممنوحة أقل من المستحق`;
                                }
                            } else if (selectedField === 'retirement_deduction' && isFiveYear) {
                                note = `إجازة 5 سنوات: استقطاع التقاعد 25% (${fmt(approvedCalc)})`;
                            } else {
                                if (fieldCurrentValue === 0) note = 'لا يستلم المخصصات المستحقة';
                                else if (approvedCalc === 0) note = 'يستلم مخصصات غير مستحقة';
                                else if (fieldCurrentValue > approvedCalc) note = `القيمة الحالية أعلى من المستحق`;
                                else note = `القيمة الحالية أقل من المستحق`;
                            }
                        }
                    }"""

repl_sp_logic = """                    // === 1. تدقيق المخصصات القانونية ===
                    if (selectedField === 'legal_allowance') {
                        const riskValue = parseFloat(rec.risk_allowance) || 0;
                        if (approvedCalc > 0) {
                            if (Math.abs(approvedCalc - fieldCurrentValue) > 1) {
                                mismatch = true;
                                if (fieldCurrentValue === 0) note = 'يستحق مخصصات قانونية ولا يستلمها';
                                else note = `مبلغ المخصصات غير صحيح (يستحق ${fmt(approvedCalc)})`;
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
                        const legalPct = getLegalAllowancePercentage(fullRecord);
                        if (legalPct === 30) {
                            if (fieldCurrentValue > 0) {
                                mismatch = true;
                                note = 'يستلم مخصصات خطورة وهو يستحق مخصصات قانونية';
                                approvedCalc = 0;
                            }
                        } else {
                            approvedCalc = Math.round(nomSal * 0.30);
                            if (Math.abs(approvedCalc - fieldCurrentValue) > 1) {
                                mismatch = true;
                                if (fieldCurrentValue === 0) {
                                    note = 'يستحق مخصصات الخطورة (30%) ولا يستلمها';
                                } else if (fieldCurrentValue > approvedCalc) {
                                    note = `يستلم مخصصات خطورة أعلى من المستحق (المستحق: ${fmt(approvedCalc)})`;
                                } else {
                                    note = `يستلم مخصصات خطورة أقل من المستحق (المستحق: ${fmt(approvedCalc)})`;
                                }
                            }
                        }
                    }
                    // === 3. تدقيق المخصصات الهندسية (المستويان الذكيان) ===
                    else if (selectedField === 'engineering_allowance') {
                        // المستوى الأول: التدقيق الحسابي
                        if (Math.abs(approvedCalc - fieldCurrentValue) > 1) {
                            mismatch = true;
                            if (fieldCurrentValue === 0 && approvedCalc > 0) {
                                note = 'العنوان مهندس لكن لا توجد مخصصات';
                            } else if (approvedCalc === 0 && fieldCurrentValue > 0) {
                                note = 'يستلم مخصصات هندسية دون استحقاق';
                            } else {
                                note = `المبلغ لا يطابق نسبة الهندسية (المستحق: ${fmt(approvedCalc)})`;
                            }
                        } else if (fieldCurrentValue > 0) {
                            // المستوى الثاني: تدقيق العنوان الوظيفي
                            const isEngTitle = /مهندس|هندس/.test(jt);
                            if (!isEngTitle) {
                                mismatch = true;
                                note = 'لديه مخصصات هندسية وعنوانه ليس هندسياً';
                                approvedCalc = fieldCurrentValue;
                            }
                        }
                    }
                    else {
                        // المنطق العام لبقية الحقول
                        if (mismatch) {
                            if (selectedField === 'certificate_allowance') {
                                if (approvedCalc > 0 && fieldCurrentValue === 0) {
                                    note = 'لديه شهادة ولا يستلم مخصصات';
                                } else if (approvedCalc === 0 && fieldCurrentValue > 0) {
                                    note = 'يستلم مخصصات شهادة دون وجه حق';
                                } else {
                                    if (fieldCurrentValue > approvedCalc) note = `نسبة الشهادة الممنوحة أعلى من المستحق`;
                                    else note = `نسبة الشهادة الممنوحة أقل من المستحق`;
                                }
                            } else if (selectedField === 'retirement_deduction' && isFiveYear) {
                                note = `إجازة 5 سنوات: استقطاع التقاعد 25% (${fmt(approvedCalc)})`;
                            } else {
                                if (fieldCurrentValue === 0) note = 'لا يستلم المخصصات المستحقة';
                                else if (approvedCalc === 0) note = 'يستلم مخصصات غير مستحقة';
                                else if (fieldCurrentValue > approvedCalc) note = `القيمة الحالية أعلى من المستحق`;
                                else note = `القيمة الحالية أقل من المستحق`;
                            }
                        }
                    }"""

content = content.replace(target_sp_logic, repl_sp_logic)

# 6. Fix the "ما هذا؟" box under start button (lines 718-725)
target_box = """                                <div className="flex items-center justify-between border-t border-dashed pt-3" style={{ borderColor: theme === 'light' ? '#ddd' : 'rgba(255,255,255,0.1)' }}>
                                    <span className={cn("text-xs font-bold", labelClr)}>المستلم</span>
                                    <div className="flex items-center gap-2">
                                        <span className={cn("text-lg font-bold font-mono", theme === 'light' ? 'text-blue-600' : 'text-blue-400')}>{fmt(currentValue)}</span>
                                        <span className={cn("text-[10px] font-mono px-1.5 py-0.5 rounded", theme === 'light' ? 'bg-blue-100 text-blue-600' : 'bg-blue-500/10 text-blue-400')}>المستلم</span>
                                    </div>
                                </div>"""

repl_box = """                                {scope === 'specific' && currentValue !== null && (
                                    <div className="flex items-center justify-between border-t border-dashed pt-3" style={{ borderColor: theme === 'light' ? '#ddd' : 'rgba(255,255,255,0.1)' }}>
                                        <span className={cn("text-xs font-bold", labelClr)}>المستلم</span>
                                        <div className="flex items-center gap-2">
                                            <span className={cn("text-lg font-bold font-mono", theme === 'light' ? 'text-blue-600' : 'text-blue-400')}>{fmt(currentValue)}</span>
                                            <span className={cn("text-[10px] font-mono px-1.5 py-0.5 rounded", theme === 'light' ? 'bg-blue-100 text-blue-600' : 'bg-blue-500/10 text-blue-400')}>المستلم</span>
                                        </div>
                                    </div>
                                )}"""

content = content.replace(target_box, repl_box)

with open('src/components/admin/CustomAudit.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Updated CustomAudit.tsx successfully!")
