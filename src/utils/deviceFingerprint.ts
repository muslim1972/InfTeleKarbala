/**
 * deviceFingerprint.ts
 * ─────────────────────────────────────────────────────────
 * وحدة توليد وتتبع البصمة الرقمية للجهاز (Web Crypto SHA-256 + GPU Hardware)
 */

function getCanvasGpuSignature(): string {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 200;
    canvas.height = 50;
    const ctx = canvas.getContext('2d');
    if (!ctx) return 'no-canvas';

    ctx.textBaseline = 'top';
    ctx.font = "14px 'Arial', sans-serif";
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#f60';
    ctx.fillRect(125, 1, 62, 20);
    ctx.fillStyle = '#069';
    ctx.fillText('InfTeleKarbala,123#$!~', 2, 15);
    ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
    ctx.fillText('InfTeleKarbala,123#$!~', 4, 17);

    let gpuRenderer = '';
    try {
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      if (gl) {
        const debugInfo = (gl as any).getExtension('WEBGL_debug_renderer_info');
        if (debugInfo) {
          gpuRenderer = (gl as any).getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || '';
        }
      }
    } catch (e) {}

    return canvas.toDataURL() + '|' + gpuRenderer;
  } catch (e) {
    return 'canvas-error';
  }
}

export async function getDeviceFingerprint(): Promise<string> {
  const ua = navigator.userAgent;
  let os = 'جهاز غير معروف';
  let deviceName = 'جهاز محمول';

  if (/android/i.test(ua)) {
    const match = ua.match(/Android\s+([0-9\.]+)/i);
    os = match ? `Android ${match[1]}` : 'Android';
    const modelMatch = ua.match(/\;\s*([^;]+)\s+Build\//i);
    if (modelMatch) {
      deviceName = modelMatch[1].trim();
    } else {
      deviceName = 'هاتف أندرويد';
    }
  } else if (/iPhone|iPad|iPod/i.test(ua)) {
    const match = ua.match(/OS\s+([0-9_]+)/i);
    const version = match ? match[1].replace(/_/g, '.') : '';
    os = `iOS ${version}`.trim();
    deviceName = /iPad/i.test(ua) ? 'جهاز iPad' : 'جهاز iPhone';
  } else if (/Windows NT/i.test(ua)) {
    if (/Windows NT 10.0/i.test(ua)) os = 'Windows 10/11';
    else if (/Windows NT 6.3/i.test(ua)) os = 'Windows 8.1';
    else os = 'Windows PC';
    deviceName = 'كمبيوتر شخصي';
  } else if (/Macintosh|Mac OS X/i.test(ua)) {
    os = 'macOS';
    deviceName = 'كمبيوتر أبل (Mac)';
  } else if (/Linux/i.test(ua)) {
    os = 'Linux';
    deviceName = 'جهاز لنيوكس';
  }

  let browser = '';
  if (/Edg\//i.test(ua)) browser = 'Edge';
  else if (/Chrome\//i.test(ua)) browser = 'Chrome';
  else if (/Safari\//i.test(ua) && !/Chrome\//i.test(ua)) browser = 'Safari';
  else if (/Firefox\//i.test(ua)) browser = 'Firefox';

  const label = `${deviceName} (${os}${browser ? ' - ' + browser : ''})`;

  const rawHardware = [
    navigator.platform || '',
    /Android/i.test(ua) ? 'Android' : /iPhone|iPad/i.test(ua) ? 'iOS' : /Windows/i.test(ua) ? 'Windows' : 'OtherOS',
    `${screen.width}x${screen.height}x${screen.colorDepth}`,
    window.devicePixelRatio || 1,
    navigator.hardwareConcurrency?.toString() ?? '0',
    navigator.maxTouchPoints?.toString() ?? '0',
    Intl.DateTimeFormat().resolvedOptions().timeZone,
    new Date().getTimezoneOffset().toString(),
    getCanvasGpuSignature()
  ].join('||');

  const encoder = new TextEncoder();
  const data = encoder.encode(rawHardware);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hardwareHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

  return `${label} [${hardwareHash}]`;
}
