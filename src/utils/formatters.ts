/**
 * Normalizes Arabic text for consistent searching and comparison by:
 * - Removing hidden characters (ZWSP, etc)
 * - Removing diacritics (Tashkeel)
 * - Normalizing Alef, Ta Marbuta, Ya
 * - Standardizing common prefixes like "Abd Al"
 * - Normalizing multiple spaces to a single space
 */
export const normalizeArabicText = (text: string | null | undefined): string => {
    if (!text) return '';
    return String(text)
        .replace(/[\u200B-\u200D\uFEFF]/g, '') // Remove hidden characters
        .replace(/[\u064B-\u065F\u0670]/g, '') // Remove Arabic diacritics (Tashkeel)
        .trim()
        .toLowerCase()
        .replace(/[أإآ]/g, 'ا') // Normalize Alef
        .replace(/ة/g, 'ه') // Normalize Ta Marbuta to Ha
        .replace(/ى/g, 'ي') // Normalize Ya
        .replace(/عبد\s+ال/g, 'عبدال') // Remove space after Abd
        .replace(/عبدال/g, 'عبد ال') // Standardize to "Abd Al" with space
        .replace(/\s+/g, ' '); // Normalize multiple spaces
};

/**
 * Cleans a numeric value from inputs (e.g., removing commas) and ensures it's a valid number.
 */
export const cleanNumericValue = (val: any): number => {
    if (typeof val === 'number') return isNaN(val) ? 0 : val;
    if (val === null || val === undefined || val === '') return 0;
    const strVal = String(val).trim().replace(/,/g, '');
    if (strVal === '') return 0;
    const num = parseFloat(strVal);
    return isNaN(num) ? 0 : num;
};

/**
 * Formats a number to a US locale string with commas (e.g., 1,000,000).
 * Returns '—' if the value is null or undefined.
 */
export const formatCurrency = (n: number | null | undefined): string => {
    return (n !== null && n !== undefined && !isNaN(n)) ? n.toLocaleString('en-US') : '—';
};
