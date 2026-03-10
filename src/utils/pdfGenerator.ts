import { PDFDocument, TextAlignment } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { shapeArabicText } from './arabicShaper';

export interface LeaveFormData {
    full_name: string;
    id: string | number;
    balance: number | string;
    reason: string;
    start_date: string;
    days: number;
    approval_date: string;
    manager_name: string;
    supervisor_name?: string;
    unpaid_days?: number;
}

export const generateLeavePDF = async (formData: LeaveFormData, preOpenedWindow?: Window | null) => {
    try {
        // 1. Fetch template and font
        // Choose template based on unpaid days
        const templatePath = (formData.unpaid_days && formData.unpaid_days > 0)
            ? '/new_leave_template.pdf'
            : '/leave_template.pdf';
        console.log("Fetching template:", templatePath);
        const templateRes = await fetch(templatePath);
        if (!templateRes.ok) throw new Error(`Template fetch failed with status: ${templateRes.status}`);
        const existingPdfBytes = await templateRes.arrayBuffer();

        console.log("Loading PDF document...");
        const pdfDoc = await PDFDocument.load(existingPdfBytes);
        pdfDoc.registerFontkit(fontkit);

        console.log("Fetching font...");
        const fontRes = await fetch('/fonts/Amiri-Regular.ttf');
        if (!fontRes.ok) throw new Error(`Font fetch failed with status: ${fontRes.status}`);
        const fontBytes = await fontRes.arrayBuffer();

        console.log("Embedding font...");
        const arabicFont = await pdfDoc.embedFont(fontBytes);

        // 2. Magic function to fix Arabic text shaping and RTL natively
        const fixArabic = (text: string | null | undefined) => {
            if (!text) return "";
            const reshaped = shapeArabicText(text.toString());
            // AcroFields in pdf-lib handle the Right-to-Left layout internally when the font is set
            // so we ONLY need to do the contextual shaping (joining) and NOT the reversal
            return reshaped;
        };

        const form = pdfDoc.getForm();

        // 3. Fill the fields
        const safeSetText = (fieldName: string, text: string) => {
            try {
                const field = form.getTextField(fieldName);
                if (field) {
                    field.setText(text);
                    field.setAlignment(TextAlignment.Center);
                }
            } catch (e) {
                // Field not in template — safe to ignore
            }
        };

        safeSetText('full_name', fixArabic(formData.full_name));
        safeSetText('leave_requests_id', formData.id.toString());
        safeSetText('remaining_leaves_balance', formData.balance.toString());
        safeSetText('leave_requests_reason', fixArabic(formData.reason));
        safeSetText('leave_requests_start_date', formData.start_date);
        safeSetText('days_count', formData.days.toString());
        safeSetText('approval_date', formData.approval_date);
        safeSetText('manager_name', fixArabic(formData.manager_name));

        // Let's populate supervisor signature if a field exists, just in case
        if (formData.supervisor_name) {
            safeSetText('supervisor_name', fixArabic(formData.supervisor_name));
        }

        // Auto print date
        const today = new Date().toLocaleDateString('en-GB');
        safeSetText('print_date', today);

        // Fill 'without salary' field if unpaid days exist (new template only)
        if (formData.unpaid_days && formData.unpaid_days > 0) {
            safeSetText('without salary', formData.unpaid_days.toString());
        }

        // 4. Update appearances to apply the Arabic font
        const fields = form.getFields();
        fields.forEach(field => {
            try {
                if (field.constructor.name.includes('TextField')) {
                    // @ts-ignore: updateAppearances is missing in type definition for TextField sometimes
                    field.updateAppearances(arabicFont);
                }
            } catch (e) { }
        });

        // 5. Generate and open PDF
        const pdfBytes = await pdfDoc.save();
        const blob = new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' });
        const pdfUrl = URL.createObjectURL(blob);

        if (preOpenedWindow && !preOpenedWindow.closed) {
            // Use the pre-opened window (bypasses popup blocker)
            preOpenedWindow.location.href = pdfUrl;
        } else {
            // Fallback: try opening directly
            window.open(pdfUrl, '_blank');
        }

    } catch (error: any) {
        console.error("خطأ مفصل في توليد الملف:", error);
        // Close the pre-opened window on error
        if (preOpenedWindow && !preOpenedWindow.closed) preOpenedWindow.close();
        alert(`تأكد من وجود ملف leave_template.pdf والخط في مجلد public.\nالخطأ: ${error.message}`);
    }
};
