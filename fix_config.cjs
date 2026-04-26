const fs = require('fs');

const content = [
  'import type { NextConfig } from "next";',
  '',
  'const nextConfig: NextConfig = {',
  '  turbopack: {',
  '    root: __dirname,',
  '  },',
  '};',
  '',
  'export default nextConfig;',
  ''
].join('\n');

fs.writeFileSync('D:/noortech/next.config.ts', content, 'utf8');
console.log('Done fixing next.config.ts');