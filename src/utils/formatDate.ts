/**
 * تنسيق التاريخ بصيغة dd/mm/yyyy
 * يقبل: string (yyyy-mm-dd أو ISO) أو Date أو null/undefined
 * يرجع: dd/mm/yyyy أو النص الأصلي إذا فشل التحويل
 */
export function formatDate(dateInput: string | Date | null | undefined): string {
    if (!dateInput) return '';

    try {
        // إذا كان بصيغة yyyy-mm-dd (من حقول date-fixed-year)
        if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
            const [y, m, d] = dateInput.split('-');
            return `${d}/${m}/${y}`;
        }

        // إذا كان Date أو ISO string
        const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
        if (isNaN(date.getTime())) return String(dateInput);

        const day = date.getDate().toString().padStart(2, '0');
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const year = date.getFullYear();
        return `${day}/${month}/${year}`;
    } catch {
        return String(dateInput);
    }
}

/**
 * تنسيق التاريخ والوقت بصيغة dd/mm/yyyy hh:mm AM/PM
 */
export function formatDateTime(dateInput: string | Date | null | undefined): string {
    if (!dateInput) return '';

    try {
        const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
        if (isNaN(date.getTime())) return String(dateInput);

        const datePart = formatDate(date);
        const timePart = date.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });
        return `${datePart} ${timePart}`;
    } catch {
        return String(dateInput);
    }
}
