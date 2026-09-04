/**
 * antiSpoofing.ts
 * 
 * وحدة فحص مصداقية الموقع الجغرافي وكشف تزييف الـ GPS (Anti-Fake GPS)
 * تفحص:
 * 1. دقة الإشارة (Accuracy Guard) للتمييز بين الأقمار الصناعية (3-25م) والتقدير الشبكي (50-5000م).
 * 2. التذبذب الميكروي الطبيعي للأقمار الصناعية (GPS Micro-Jitter) لكشف التجميد المصطنع (Static Mock).
 * 3. فحص سلامة دوال المتصفح الأصلية ضد التلاعب (Native Prototype Integrity).
 * 4. تمييز نوع الجهاز (Desktop PC vs Mobile Phone).
 */

export interface LocationTelemetryResult {
  latitude: number;
  longitude: number;
  accuracy: number;
  altitude?: number | null;
  speed?: number | null;
  heading?: number | null;
  source: 'gps_satellite' | 'network_estimate' | 'desktop_pc' | 'mock_suspected';
  isAccuracyValid: boolean;
  isJitterValid: boolean;
  isPrototypeTampered: boolean;
  isDesktop: boolean;
  trustScore: number; // 0 - 100
  warningMessage?: string;
  sourceLabelAr: string;
}

// الحد الأقصى المسموح به لهامش الخطأ (بالأمتار) لاعتبار الموقع قادماً من GPS دقيق
export const MAX_ACCEPTABLE_ACCURACY_METERS = 65;

/**
 * فحص ما إذا كان المتصفح يعمل على حاسوب مكتبي أو لابتوب
 */
export function isDesktopDevice(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent.toLowerCase();
  const isMobileUA = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(ua);
  const hasTouchScreen = navigator.maxTouchPoints > 1;
  const isMobileScreen = window.innerWidth <= 768;
  
  return !isMobileUA && (!hasTouchScreen || !isMobileScreen);
}

/**
 * فحص سلامة دالة المتصفح الأصلية للتأكد من عدم استبدالها بإضافة أو سكريبت
 */
export function checkPrototypeIntegrity(): boolean {
  if (typeof navigator === 'undefined' || !navigator.geolocation) return false;
  
  try {
    const fnString = Function.prototype.toString.call(navigator.geolocation.getCurrentPosition);
    // الدوال الأصلية في المتصفح تحتوي دائماً على [native code]
    const isNative = fnString.includes('[native code]') || fnString.includes('getCurrentPosition()');
    return isNative;
  } catch {
    return false;
  }
}

/**
 * خوارزمية فحص التذبذب الميكروي الطبيعي للأقمار الصناعية (Micro-Jitter)
 * تأخذ عينات سريعة وتتحقق من أن الإحداثيات ليست أرقاماً مصمتة جامدة
 */
export async function samplePositionJitter(
  initialPosition: GeolocationPosition,
  sampleCount = 3
): Promise<{ hasNaturalJitter: boolean; variance: number }> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    return { hasNaturalJitter: false, variance: 0 };
  }

  // على أجهزة الكمبيوتر المكتبية لا يوجد حساس أقمار فلا نفحص التذبذب
  if (isDesktopDevice()) {
    return { hasNaturalJitter: true, variance: 0 };
  }

  const samples: { lat: number; lng: number }[] = [
    { lat: initialPosition.coords.latitude, lng: initialPosition.coords.longitude }
  ];

  try {
    for (let i = 1; i < sampleCount; i++) {
      // انتظار فاصل زمني قصير عبر Promise بدون setTimeout في مزامنة الواجهة
      await new Promise<void>(resolve => {
        let frameCount = 0;
        const checkFrame = () => {
          frameCount++;
          if (frameCount >= 30) { // ~500ms at 60fps
            resolve();
          } else {
            requestAnimationFrame(checkFrame);
          }
        };
        requestAnimationFrame(checkFrame);
      });

      const nextPos = await new Promise<GeolocationPosition | null>(resolve => {
        navigator.geolocation.getCurrentPosition(
          pos => resolve(pos),
          () => resolve(null),
          { enableHighAccuracy: true, timeout: 3000, maximumAge: 0 }
        );
      });

      if (nextPos) {
        samples.push({ lat: nextPos.coords.latitude, lng: nextPos.coords.longitude });
      }
    }

    if (samples.length < 2) {
      return { hasNaturalJitter: true, variance: 0 };
    }

    // حساب التباين (Variance) بين القراءات في الخانات العشرية الأخيرة
    let latDiffSum = 0;
    let lngDiffSum = 0;
    for (let i = 1; i < samples.length; i++) {
      latDiffSum += Math.abs(samples[i].lat - samples[0].lat);
      lngDiffSum += Math.abs(samples[i].lng - samples[0].lng);
    }

    const totalDiff = latDiffSum + lngDiffSum;

    // إذا كانت العينات متعددة والدقة عالية جداً ولكن الفارق بين جميع القراءات هو 0.00000000 مطلق
    // فهذا مؤشر قوي على حقن موقع جامد (Static Mock Location)
    const isTotallyFrozen = totalDiff === 0 && initialPosition.coords.accuracy < 10;

    return {
      hasNaturalJitter: !isTotallyFrozen,
      variance: totalDiff
    };
  } catch {
    return { hasNaturalJitter: true, variance: 0 };
  }
}

/**
 * تحليل شامل لبيانات التتبع الجغرافي للموقع الحالي
 */
export async function analyzeLocationTelemetry(
  position: GeolocationPosition
): Promise<LocationTelemetryResult> {
  const { latitude, longitude, accuracy, altitude, speed, heading } = position.coords;
  const isDesktop = isDesktopDevice();
  const isPrototypeNative = checkPrototypeIntegrity();

  let trustScore = 100;
  let source: LocationTelemetryResult['source'] = 'gps_satellite';
  let sourceLabelAr = 'أقمار صناعية GPS (عالي الموثوقية)';
  let warningMessage: string | undefined;

  // 1. فحص التلاعب بالنواة
  if (!isPrototypeNative) {
    trustScore -= 60;
    source = 'mock_suspected';
    warningMessage = 'تم رصد تعديل مشبوه على دوال تحديد الموقع في المتصفح.';
  }

  // 2. فحص نوع الجهاز ومصدر الإشارة
  if (isDesktop) {
    source = 'desktop_pc';
    sourceLabelAr = 'كمبيوتر مكتبي (تقدير شبكي بدون حساس GPS)';
    trustScore -= 30;
    if (accuracy > 40) {
      warningMessage = `الجهاز المستخدم كمبيوتر مكتبي ويعتمد على الشبكة بهامش خطأ (±${Math.round(accuracy)}م). يوصى بالبصمة من الهاتف الذكي.`;
    }
  } else if (accuracy > MAX_ACCEPTABLE_ACCURACY_METERS) {
    source = 'network_estimate';
    sourceLabelAr = 'أبراج الاتصال / شبكة Wi-Fi (دقة منخفضة)';
    trustScore -= 40;
    warningMessage = `دقة الموقع ضعيفة (±${Math.round(accuracy)}م). يرجى التأكد من تشغيل GPS الدقيق والابتعاد عن العوازل.`;
  }

  // 3. فحص التذبذب في الأجهزة المحمولة
  let isJitterValid = true;
  if (!isDesktop && accuracy <= 20) {
    const jitterCheck = await samplePositionJitter(position, 2);
    if (!jitterCheck.hasNaturalJitter) {
      isJitterValid = false;
      trustScore -= 50;
      source = 'mock_suspected';
      sourceLabelAr = 'تزييف موقع مشبوه (إحداثيات مصمتة Fake GPS)';
      warningMessage = 'تم رصد إحداثيات مصمتة غير طبيعية تشير إلى تطبيق تزييف موقع (Fake GPS).';
    }
  }

  const isAccuracyValid = accuracy <= MAX_ACCEPTABLE_ACCURACY_METERS;

  return {
    latitude,
    longitude,
    accuracy: Math.round(accuracy),
    altitude,
    speed,
    heading,
    source,
    isAccuracyValid,
    isJitterValid,
    isPrototypeTampered: !isPrototypeNative,
    isDesktop,
    trustScore: Math.max(0, Math.min(100, trustScore)),
    warningMessage,
    sourceLabelAr
  };
}
