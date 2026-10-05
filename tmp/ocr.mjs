import { createWorker } from 'tesseract.js';
import { readFileSync } from 'fs';
import { join } from 'path';

const files = [
  'D:\\jumla\\tmp\\WhatsApp Image 2026-09-25 at 10.51.22 PM.jpeg',
  'D:\\jumla\\tmp\\WhatsApp Image 2026-09-25 at 10.52.50 PM.jpeg',
];

const worker = await createWorker(['ara', 'eng'], 1, { logger: m => { if (m.status === 'recognizing text') console.log(m.status, Math.round(m.progress * 100) + '%'); } });
for (const f of files) {
  console.log('\n========== ' + f.split('\\').pop() + ' ==========');
  const { data: { text } } = await worker.recognize(readFileSync(f));
  console.log(text);
}
await worker.terminate();