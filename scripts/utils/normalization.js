
// Advanced Arabic Normalization Function
// Unifies:
// - Alef forms (أ إ آ -> ا)
// - Ya forms (ى ي -> ي)
// - Ta Marbuta (ة -> ه)
// - Remove Tatweel (_)
// - Remove Diacritics (Tashkeel)

export const normalizeArabic = (text) => {
    if (!text) return '';
    return String(text)
        .replace(/[إأآا]/g, 'ا')
        .replace(/ى/g, 'ي')
        .replace(/ة/g, 'ه')
        .replace(/ـ/g, '') // Tatweel
        .replace(/[\u064B-\u065F]/g, '') // Tashkeel
        .replace(/\s+/g, ' ') // Collapse spaces
        .trim();
};
