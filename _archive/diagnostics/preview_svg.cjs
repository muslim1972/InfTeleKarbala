const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const svg = fs.readFileSync('d:/InfTeleKarbala/_archive/diagnostics/moc_clean.svg', 'utf8');
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 900, height: 700 }, deviceScaleFactor: 1 });
  await page.setContent(`
    <body style="margin:0;display:flex;align-items:center;justify-content:center;height:100vh;background:#ffffff;">
      ${svg.replace('<svg ', '<svg style="width:700px;height:auto;" ')}
    </body>
  `);
  await page.screenshot({ path: 'd:/InfTeleKarbala/_archive/diagnostics/moc_svg_preview.png' });
  await browser.close();
  console.log('Preview saved');
})();
