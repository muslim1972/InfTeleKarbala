const arabicReshaper = require('arabic-persian-reshaper');
const text = "علي عبد جاسم";
const reshaped = arabicReshaper.ArabicShaper.convertArabic(text);
console.log("Original:", text);
console.log("Reshaped:", reshaped);
console.log("Reshaped char codes:");
for (let i = 0; i < reshaped.length; i++) {
    console.log(reshaped[i], reshaped.charCodeAt(i).toString(16));
}
