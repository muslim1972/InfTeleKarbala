const fs = require('fs');
const tsCode = fs.readFileSync('src/utils/arabicShaper.ts', 'utf8');
const jsCode = tsCode.replace(/export function shapeArabicText\(text: string\): string {/g, 'function shapeArabicText(text) {').replace(/const charsMap: Record<string, \[string, string, string, string\]>/g, 'const charsMap');

eval(jsCode);

const text = "علي عبد جاسم";
const reshaped = shapeArabicText(text);
const reversed = Array.from(reshaped).reverse().join('');

console.log("Original:", text);
console.log("Reshaped:", reshaped);
console.log("Reversed:", reversed);
