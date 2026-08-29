/**
 * deviceFingerprint.ts
 * ─────────────────────────────────────────────────────────
 * وحدة توليد وتتبع البصمة الرقمية للجهاز (Web Crypto SHA-256 + GPU Hardware)
 * تم تصميمها لتكون مستقرة 100% وموحدة عبر جميع المتصفحات لنفس الجهاز الفيزيائي.
 */

function getNormalizedGpuHardwareInfo(): string {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (gl) {
      const debugInfo = (gl as any).getExtension('WEBGL_debug_renderer_info');
      if (debugInfo) {
        const vendor = ((gl as any).getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) || '').toString();
        const renderer = ((gl as any).getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || '').toString();

        // إزالة أية بادئات خاصة بنوع المتصفح أو طبقات المحاكاة (مثل ANGLE, Google Inc., Microsoft, Direct3D11)
        // للحصول على اسم معالج الرسومات الأساسي والشركة المصنعة بشكل موحد بين Chrome, Edge, Firefox, Brave, إلخ.
        const cleanRenderer = renderer
          .replace(/ANGLE\s*\(/gi, '')
          .replace(/Google Inc\./gi, '')
          .replace(/Microsoft/gi, '')
          .replace(/Direct3D\d+/gi, '')
          .replace(/vs_\d+_\d+/gi, '')
          .replace(/ps_\d+_\d+/gi, '')
          .replace(/D3D\d+/gi, '')
          .replace(/\(0x[0-9a-fA-F]+\)/gi, '')
          .replace(/OpenGL.*$/gi, '')
          .replace(/PCIe\/SSE\d*/gi, '')
          .replace(/[\(\),]/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
          .toLowerCase();

        const cleanVendor = vendor
          .replace(/Google Inc\./gi, '')
          .replace(/Microsoft/gi, '')
          .replace(/[\(\),]/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
          .toLowerCase();

        return `${cleanVendor}||${cleanRenderer}`;
      }
    }
  } catch (e) {}
  return 'standard-gpu';
}

export async function getDeviceFingerprint(): Promise<string> {
  const ua = navigator.userAgent;
  let os = 'جهاز غير معروف';
  let deviceName = 'جهاز محمول';
  let osFamily = 'Other';

  if (/android/i.test(ua)) {
    osFamily = 'Android';
    const match = ua.match(/Android\s+([0-9\.]+)/i);
    os = match ? `Android ${match[1]}` : 'Android';
    const modelMatch = ua.match(/\;\s*([^;]+)\s+Build\//i);
    if (modelMatch) {
      deviceName = modelMatch[1].trim();
    } else {
      deviceName = 'هاتف أندرويد';
    }
  } else if (/iPhone|iPad|iPod/i.test(ua)) {
    osFamily = 'iOS';
    const match = ua.match(/OS\s+([0-9_]+)/i);
    const version = match ? match[1].replace(/_/g, '.') : '';
    os = `iOS ${version}`.trim();
    deviceName = /iPad/i.test(ua) ? 'جهاز iPad' : 'جهاز iPhone';
  } else if (/Windows NT/i.test(ua)) {
    osFamily = 'Windows';
    if (/Windows NT 10.0/i.test(ua)) os = 'Windows 10/11';
    else if (/Windows NT 6.3/i.test(ua)) os = 'Windows 8.1';
    else os = 'Windows PC';
    deviceName = 'كمبيوتر شخصي';
  } else if (/Macintosh|Mac OS X/i.test(ua)) {
    osFamily = 'macOS';
    os = 'macOS';
    deviceName = 'كمبيوتر أبل (Mac)';
  } else if (/Linux/i.test(ua)) {
    osFamily = 'Linux';
    os = 'Linux';
    deviceName = 'جهاز لينوكس';
  }

  const label = `${deviceName} (${os})`;

  // استخدام خصائص العتاد الثابتة التي لا تتأثر بالمتصفح أو مستوى التكبير (Zoom) أو أبعاد النوافذ
  const screenDimensions = `${Math.max(screen.width, screen.height)}x${Math.min(screen.width, screen.height)}`;
  const colorDepth = screen.colorDepth || 24;
  const cpuCores = navigator.hardwareConcurrency ? String(navigator.hardwareConcurrency) : '4';
  const touchPoints = navigator.maxTouchPoints ? String(navigator.maxTouchPoints) : '0';
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Baghdad';
  const gpuInfo = getNormalizedGpuHardwareInfo();

  const rawHardware = [
    osFamily,
    screenDimensions,
    colorDepth,
    cpuCores,
    touchPoints,
    timeZone,
    gpuInfo
  ].join('||');

  const encoder = new TextEncoder();
  const data = encoder.encode(rawHardware);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hardwareHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

  return `${label} [${hardwareHash}]`;
}
