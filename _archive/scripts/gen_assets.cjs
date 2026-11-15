const fs = require('fs');
const path = require('path');

const headerPath = path.join(__dirname, '../../public/itpc-official-header.png');
const watermarkPath = path.join(__dirname, '../../public/itpc-watermark-gray.png');

const h = fs.readFileSync(headerPath).toString('base64');
const w = fs.readFileSync(watermarkPath).toString('base64');

const content = `/**
 * أصول الصور المدمجة Base64 لكتاب الاستمرارية الرسمي
 * تضمن العرض والطباعة الفورية في جميع الهواتف والمتصفحات دون انتظار طلبات الشبكة
 */

export const ITPC_HEADER_BASE64 = 'data:image/png;base64,${h}';

export const ITPC_WATERMARK_BASE64 = 'data:image/png;base64,${w}';
`;

const targetPath = path.join(__dirname, '../../src/features/hr/utils/continuityPrintAssets.ts');
fs.writeFileSync(targetPath, content, 'utf8');
console.log('Successfully generated continuityPrintAssets.ts, file size:', content.length);
