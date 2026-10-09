

/**
 * تحليل خلية الشهادة واستخراج الاسم والنسبة معاً، وتدقيق النسبة حسب المعايير
 */
export function extractCertificateData(val: any): { certName: string, certPerc: number } | null {
    if (!val) return null;
    let strVal = String(val).trim();
    
    // 1. تحويل الأرقام العربية إلى إنجليزية
    const arabicDigits: Record<string, string> = {
        '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4',
        '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9'
    };
    strVal = strVal.replace(/[٠-٩]/g, d => arabicDigits[d]);
    
    // 2. استخراج النسبة
    let extractedPerc = 0;
    const percMatch = strVal.match(/(\d+)\s*%/);
    if (percMatch) {
        extractedPerc = parseInt(percMatch[1], 10);
    } else {
        const numMatch = strVal.match(/(\d+)/);
        if (numMatch) {
            extractedPerc = parseInt(numMatch[1], 10);
        }
    }
    
    // 3. استخراج اسم الشهادة
    const certName = cleanCertificate(strVal);
    
    // 4. تدقيق الشهادة والنسبة
    const certDef = CERTIFICATES.find(c => 
        certName === c.label || 
        (c.aliases && c.aliases.includes(certName)) ||
        (certName === 'بكالوريوس' && c.label === 'بكلوريوس') ||
        (certName === 'بكلوريوس' && c.label === 'بكالوريوس')
    );
    
    if (certDef && certDef.percentage === extractedPerc) {
        // إذا طابقت النسبة المستخرجة الجدول الموجود في الكود
        return { certName: certDef.label, certPerc: extractedPerc };
    }
    
    if (certDef) {
        // إذا كان هناك شهادة معروفة لكن النسبة مختلفة أو غير موجودة في النص،
        // نعتمد على النسبة الصحيحة من الجدول حفاظاً على سلامة البيانات
        return { certName: certDef.label, certPerc: certDef.percentage };
    }
    
    return null;
}

