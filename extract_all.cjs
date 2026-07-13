const fs = require('fs');
const { chromium } = require('playwright');

(async () => {
  console.log("Starting browser...");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  let allText = '# نصوص كراس: e-مديرية اتصالات ومعلوماتية كربلاء المقدسة\n\n';
  
  const totalPages = 66;
  for (let i = 1; i <= totalPages; i++) {
    console.log(`Extracting page ${i}/${totalPages}...`);
    const page = await context.newPage();
    try {
      await page.goto(`https://online.fliphtml5.com/Ker-ITPC/nlpz/files/basic-html/page${i}.html`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      
      const text = await page.evaluate(() => {
        // Try to get paragraphs or text blocks
        const paragraphs = Array.from(document.querySelectorAll('p, li, h1, h2, h3, h4, h5, h6, .text-container span'));
        if (paragraphs.length > 0) {
            // Filter out navigation boilerplate text
            return paragraphs.map(p => p.innerText.trim())
                             .filter(t => t && t !== 'Previous Page' && t !== 'Next Page' && t !== 'Table of Contents' && !t.includes('http'))
                             .join('\n');
        }
        return document.body.innerText;
      });
      
      allText += `\n## الصفحة ${i}\n${text}\n`;
    } catch (error) {
      console.error(`Failed to extract page ${i}:`, error.message);
      allText += `\n## الصفحة ${i}\n(تعذر استخراج النص أو الصفحة فارغة)\n`;
    } finally {
      await page.close();
    }
  }
  
  fs.writeFileSync('book_text.md', allText);
  await browser.close();
  console.log("Extraction complete!");
})();
