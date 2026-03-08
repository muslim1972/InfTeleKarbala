/**
 * A lightweight, reliable Arabic text reshaper.
 * Maps standard Arabic characters to their presentation forms (isolated, initial, medial, final)
 * for proper rendering in environments that don't support contextual shaping natively (like PDF-lib).
 */

const charsMap: Record<string, [string, string, string, string]> = {
    // [isolated, final, initial, medial]
    'ا': ['\uFE8D', '\uFE8E', '\uFE8D', '\uFE8E'],
    'أ': ['\uFE83', '\uFE84', '\uFE83', '\uFE84'],
    'إ': ['\uFE87', '\uFE88', '\uFE87', '\uFE88'],
    'آ': ['\uFE81', '\uFE82', '\uFE81', '\uFE82'],
    'ب': ['\uFE8F', '\uFE90', '\uFE91', '\uFE92'],
    'پ': ['\uFB56', '\uFB57', '\uFB58', '\uFB59'],
    'ت': ['\uFE95', '\uFE96', '\uFE97', '\uFE98'],
    'ث': ['\uFE99', '\uFE9A', '\uFE9B', '\uFE9C'],
    'ج': ['\uFE9D', '\uFE9E', '\uFE9F', '\uFEA0'],
    'چ': ['\uFB7A', '\uFB7B', '\uFB7C', '\uFB7D'],
    'ح': ['\uFEA1', '\uFEA2', '\uFEA3', '\uFEA4'],
    'خ': ['\uFEA5', '\uFEA6', '\uFEA7', '\uFEA8'],
    'د': ['\uFEA9', '\uFEAA', '\uFEA9', '\uFEAA'],
    'ذ': ['\uFEAB', '\uFEAC', '\uFEAB', '\uFEAC'],
    'ر': ['\uFEAD', '\uFEAE', '\uFEAD', '\uFEAE'],
    'ز': ['\uFEAF', '\uFEB0', '\uFEAF', '\uFEB0'],
    'ژ': ['\uFB8A', '\uFB8B', '\uFB8A', '\uFB8B'],
    'س': ['\uFEB1', '\uFEB2', '\uFEB3', '\uFEB4'],
    'ش': ['\uFEB5', '\uFEB6', '\uFEB7', '\uFEB8'],
    'ص': ['\uFEB9', '\uFEBA', '\uFEBB', '\uFEBC'],
    'ض': ['\uFEBD', '\uFEBE', '\uFEBF', '\uFEC0'],
    'ط': ['\uFEC1', '\uFEC2', '\uFEC3', '\uFEC4'],
    'ظ': ['\uFEC5', '\uFEC6', '\uFEC7', '\uFEC8'],
    'ع': ['\uFEC9', '\uFECA', '\uFECB', '\uFECC'],
    'غ': ['\uFECD', '\uFECE', '\uFECF', '\uFED0'],
    'ف': ['\uFED1', '\uFED2', '\uFED3', '\uFED4'],
    'ق': ['\uFED5', '\uFED6', '\uFED7', '\uFED8'],
    'ك': ['\uFED9', '\uFEDA', '\uFEDB', '\uFEDC'],
    'ک': ['\uFB8E', '\uFB8F', '\uFB90', '\uFB91'],
    'گ': ['\uFB92', '\uFB93', '\uFB94', '\uFB95'],
    'ل': ['\uFEDD', '\uFEDE', '\uFEDF', '\uFEE0'],
    'م': ['\uFEE1', '\uFEE2', '\uFEE3', '\uFEE4'],
    'ن': ['\uFEE5', '\uFEE6', '\uFEE7', '\uFEE8'],
    'ه': ['\uFEE9', '\uFEEA', '\uFEEB', '\uFEEC'],
    'ة': ['\uFE93', '\uFE94', '\uFE93', '\uFE94'],
    'و': ['\uFEED', '\uFEEE', '\uFEED', '\uFEEE'],
    'ؤ': ['\uFE85', '\uFE86', '\uFE85', '\uFE86'],
    'ی': ['\uFBFC', '\uFBFD', '\uFBFE', '\uFBFF'],
    'ي': ['\uFEF1', '\uFEF2', '\uFEF3', '\uFEF4'],
    'ئ': ['\uFE89', '\uFE8A', '\uFE8B', '\uFE8C'],
    'ى': ['\uFEEF', '\uFEF0', '\uFEEF', '\uFEF0'],
    'ء': ['\uFE80', '\uFE80', '\uFE80', '\uFE80'],
};

// Characters that only connect to the right (cannot connect to the left)
const rightConnectors = 'اأإآدذرزءؤةوى';

export function shapeArabicText(text: string): string {
    if (!text) return '';
    let result = '';

    for (let i = 0; i < text.length; i++) {
        const char = text[i];

        if (!charsMap[char]) {
            result += char; // Not an Arabic character
            continue;
        }

        const prevChar = i > 0 ? text[i - 1] : null;
        const nextChar = i < text.length - 1 ? text[i + 1] : null;

        const isPrevConnecting = prevChar && charsMap[prevChar] && !rightConnectors.includes(prevChar);
        const isNextConnecting = nextChar && charsMap[nextChar] && char !== 'ء'; // space or non-arabic next

        let shapeIndex = 0; // Isolated by default

        if (isPrevConnecting && isNextConnecting) {
            shapeIndex = 3; // Medial
        } else if (isPrevConnecting && !isNextConnecting) {
            shapeIndex = 1; // Final
        } else if (!isPrevConnecting && isNextConnecting) {
            shapeIndex = 2; // Initial
        }

        // Handle Lam-Alef ligatures (ال)
        let shapedChar = charsMap[char][shapeIndex];

        if (char === 'ل' && nextChar && ['ا', 'أ', 'إ', 'آ'].includes(nextChar)) {
            // Lam-Alef ligature processing

            if (nextChar === 'ا') shapedChar = isPrevConnecting ? '\uFEFC' : '\uFEFB';
            if (nextChar === 'أ') shapedChar = isPrevConnecting ? '\uFEF8' : '\uFEF7';
            if (nextChar === 'إ') shapedChar = isPrevConnecting ? '\uFEFA' : '\uFEF9';
            if (nextChar === 'آ') shapedChar = isPrevConnecting ? '\uFEF6' : '\uFEF5';

            i++; // Skip the Alef
        }

        result += shapedChar;
    }

    return result;
}
