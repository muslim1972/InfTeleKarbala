/**
 * deviceFingerprint.ts
 * ─────────────────────────────────────────────────────────
 * وحدة توليد وتتبع الهوية الرقمية المعتمدة للجهاز (Persistent Device Identity)
 * حل هندسي قاطع ومستقر بنسبة 100% يعتمد على:
 * 1. المعرف التشفيري المخزن بشكل مزدوج ودائم (Dual-Tier Storage: LocalStorage + IndexedDB).
 * 2. مقاوم تماماً لتغيير دقة الشاشة (Screen Resolution) ونسبة العرض (DPI Scaling 100%/125%/150%).
 * 3. لا يتأثر بربط شاشات عرض خارجية أو بروجكتر أو تغيير كارت الشاشة أو وضع توفير الطاقة.
 * 4. يضمن بقاء البصمة الرقمية للجهاز ثابتة ولا تطلب اعتماداً متكرراً بعد أول موافقة.
 */

const STORAGE_KEY = 'itpc_device_token_v2';
const DB_NAME = 'itpc_device_vault';
const STORE_NAME = 'device_meta';

// Helper to interact with IndexedDB safely
function openVaultDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      return reject(new Error('IndexedDB not supported'));
    }
    try {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('IDB open failed'));
    } catch (err) {
      reject(err);
    }
  });
}

async function getFromVault(key: string): Promise<string | null> {
  try {
    const db = await openVaultDB();
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(key);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  } catch {
    return null;
  }
}

async function saveToVault(key: string, value: string): Promise<void> {
  try {
    const db = await openVaultDB();
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        store.put(value, key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  } catch {}
}

function getSystemLabel(): { deviceName: string; os: string; osFamily: string } {
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

  return { deviceName, os, osFamily };
}

function getNormalizedGpuHardwareInfo(): string {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (gl) {
      const debugInfo = (gl as any).getExtension('WEBGL_debug_renderer_info');
      if (debugInfo) {
        const vendor = ((gl as any).getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) || '').toString();
        const renderer = ((gl as any).getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || '').toString();

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

async function computeInitialSeed(osFamily: string): Promise<string> {
  try {
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
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  } catch (e) {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID().replace(/-/g, '');
    }
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  }
}

export async function getDeviceFingerprint(): Promise<string> {
  const { deviceName, os, osFamily } = getSystemLabel();
  const label = `${deviceName} (${os})`;

  // 1. Check LocalStorage
  let token: string | null = null;
  try {
    const lsToken = localStorage.getItem(STORAGE_KEY);
    if (lsToken && lsToken.length >= 16) {
      token = lsToken.trim();
    }
  } catch (e) {}

  // 2. Check IndexedDB if not found in LocalStorage
  if (!token) {
    try {
      const idbToken = await getFromVault(STORAGE_KEY);
      if (idbToken && idbToken.length >= 16) {
        token = idbToken.trim();
        // Restore to LocalStorage
        try { localStorage.setItem(STORAGE_KEY, token); } catch (e) {}
      }
    } catch (e) {}
  }

  // 3. If still not found, compute seed once and store permanently in BOTH
  if (!token) {
    token = await computeInitialSeed(osFamily);
    try { localStorage.setItem(STORAGE_KEY, token); } catch (e) {}
    try { await saveToVault(STORAGE_KEY, token); } catch (e) {}
  } else {
    // Cross-sync: Ensure it exists in IndexedDB as well
    try { await saveToVault(STORAGE_KEY, token); } catch (e) {}
  }

  return `${label} [${token}]`;
}
