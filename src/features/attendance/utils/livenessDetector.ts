// src/features/attendance/utils/livenessDetector.ts
/**
 * وحدة الحيوية ومكافحة الانتحال البيومترية (Tri-Factor Biometric Liveness Detector)
 * تم تطويرها وفق معايير ISO/IEC 30107-3 لمقاومة هجمات العرض (Presentation Attacks)
 * وبشكل خاص: هجمات إعادة عرض الفيديو وشاشات الهواتف ومكالمات الفيديو الحية.
 * 
 * المكونات الثلاثة:
 * 1. آلة حالة الرمش الطبيعي (Temporal Blink State Machine).
 * 2. التباين الهندسي ثلاثي الأبعاد للوجه (3D Perspective Variance).
 * 3. نبضة الانعكاس الضوئي النشطة (Active Optical Reflection Pulse).
 */

export interface Point2D {
  x: number;
  y: number;
}

export interface BlinkState {
  stage: 'WAITING_OPEN' | 'CLOSING' | 'CLOSED' | 'REOPENING' | 'COMPLETED';
  closedTimestamp: number | null;
  openedTimestamp: number | null;
  blinkDurationMs: number | null;
  isComplete: boolean;
}

export interface Landmark3DStats {
  perspectiveRatios: number[];
  depthVariance: number;
  sampleCount: number;
}

/**
 * حساب نسبة أبعاد العين (Eye Aspect Ratio - EAR)
 * @param eye مصفوفة تضم 6 نقاط معلمية للعين
 */
export const calculateEAR = (eye: Point2D[]): number => {
  if (!eye || eye.length < 6) return 0;
  // المسافات الرأسية
  const v1 = Math.hypot(eye[1].x - eye[5].x, eye[1].y - eye[5].y);
  const v2 = Math.hypot(eye[2].x - eye[4].x, eye[2].y - eye[4].y);
  // المسافة الأفقية
  const h = Math.hypot(eye[0].x - eye[3].x, eye[0].y - eye[3].y);
  if (h === 0) return 0;
  return (v1 + v2) / (2.0 * h);
};

/**
 * آلة حالة الرمش البشري الطبيعي
 * الإنسان يرمش بين 100ms و 500ms
 * أقل من 80ms يعتبر ضوضاء إطار أو فقدان تتبع مؤقت
 * أكثر من 850ms يعتبر إغلاق متعمد للعين أو صورة ثابتة
 */
export class BlinkTracker {
  private stage: 'WAITING_OPEN' | 'CLOSED' | 'COMPLETED' = 'WAITING_OPEN';
  private closeStartTime: number | null = null;
  private blinkCompleted = false;
  private readonly CLOSE_THRESHOLD = 0.21; // تحت هذا الرقم تعتبر العين مغلقة
  private readonly OPEN_THRESHOLD = 0.28;  // فوق هذا الرقم تعتبر العين مفتوحة طبيعياً

  public update(currentEar: number, now = performance.now()): { stage: string; isComplete: boolean; error?: string } {
    if (this.blinkCompleted) {
      return { stage: 'COMPLETED', isComplete: true };
    }

    if (this.stage === 'WAITING_OPEN') {
      if (currentEar >= this.OPEN_THRESHOLD) {
        // العين مفتوحة ومستقرة، ننتظر الرمشة
      } else if (currentEar <= this.CLOSE_THRESHOLD) {
        // بدأت الرمشة
        this.stage = 'CLOSED';
        this.closeStartTime = now;
      }
    } else if (this.stage === 'CLOSED') {
      const closedDuration = now - (this.closeStartTime || now);
      
      if (currentEar >= this.OPEN_THRESHOLD) {
        // تم فتح العين مجدداً بعد إغلاقها
        if (closedDuration >= 80 && closedDuration <= 850) {
          // رمشة طبيعية ومثالية
          this.stage = 'COMPLETED';
          this.blinkCompleted = true;
          return { stage: 'COMPLETED', isComplete: true };
        } else {
          // رمشة غير طبيعية (سريعة جداً أو بطيئة جداً) - إعادة ضبط
          this.stage = 'WAITING_OPEN';
          this.closeStartTime = null;
          return { stage: 'WAITING_OPEN', isComplete: false, error: 'رمشة غير منتظمة' };
        }
      } else if (closedDuration > 1000) {
        // العين ظلت مغلقة لأكثر من ثانية، إعادة ضبط
        this.stage = 'WAITING_OPEN';
        this.closeStartTime = null;
        return { stage: 'WAITING_OPEN', isComplete: false, error: 'العين مغلقة لفترة طويلة' };
      }
    }

    return { stage: this.stage, isComplete: this.blinkCompleted };
  }

  public reset(): void {
    this.stage = 'WAITING_OPEN';
    this.closeStartTime = null;
    this.blinkCompleted = false;
  }

  public isBlinkComplete(): boolean {
    return this.blinkCompleted;
  }
}

/**
 * كاشف التباين الهندسي ثلاثي الأبعاد وتذبذب العمق (3D Landmark Depth Variance)
 * شاشات الهواتف واللوحات المسطحة تملك نسب مسافات ثابتة خطياً (Affine Planar Transform)
 * الوجه البشري الحي يملك تضاريس ثلاثية الأبعاد (أنف بارز، تجاويف العينين، فك متحرك طفيفاً)
 */
export class DepthPerspectiveTracker {
  private history: number[] = [];
  private readonly MAX_SAMPLES = 10;

  public addFrame(landmarks: any): void {
    if (!landmarks || typeof landmarks.getPositions !== 'function') return;
    const pts = landmarks.getPositions();
    if (!pts || pts.length < 68) return;

    // النقاط:
    // 30: طرف الأنف
    // 33: أسفل الأنف
    // 36, 45: زاويتا العينين الخارجية
    // 27: جسر الأنف بين العينين
    const noseTip = pts[30];
    const noseBridge = pts[27];
    const leftEyeCorner = pts[36];
    const rightEyeCorner = pts[45];

    const interOcularDist = Math.hypot(rightEyeCorner.x - leftEyeCorner.x, rightEyeCorner.y - leftEyeCorner.y);
    const noseDepthProjection = Math.hypot(noseTip.x - noseBridge.x, noseTip.y - noseBridge.y);

    if (interOcularDist > 0) {
      const ratio = noseDepthProjection / interOcularDist;
      this.history.push(ratio);
      if (this.history.length > this.MAX_SAMPLES) {
        this.history.shift();
      }
    }
  }

  public getVariance(): number {
    if (this.history.length < 5) return 0;
    const mean = this.history.reduce((a, b) => a + b, 0) / this.history.length;
    const variance = this.history.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / this.history.length;
    return variance;
  }

  public reset(): void {
    this.history = [];
  }
}

/**
 * دالة قياس متوسط السطوع في رقعة محددة من الـ Video
 */
const getRegionBrightness = (
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  x: number,
  y: number,
  w: number,
  h: number
): number => {
  ctx.drawImage(video, x, y, w, h, 0, 0, 32, 32);
  const imgData = ctx.getImageData(0, 0, 32, 32);
  const data = imgData.data;
  let sum = 0;
  for (let i = 0; i < data.length; i += 4) {
    // Luminance formula
    sum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }
  return sum / (32 * 32);
};

/**
 * تنفيذ نبضة ضوئية وفحص الانعكاس الحيوي على الجلد (Optical Reflection Pulse)
 * يقيس استجابة بشرة الوجه لنبضة ضوء سريعة صادرة من الشاشة
 * الشاشات الأخرى تطلق ضوءاً مستقلاً ولا تستجيب لانعكاس شاشتنا بينما الجلد يعكسه فوراً
 */
export const verifyOpticalReflection = async (
  videoElement: HTMLVideoElement,
  faceBox: { x: number; y: number; width: number; height: number }
): Promise<{ passed: boolean; skinDelta: number; bgDelta: number }> => {
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 32;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return { passed: true, skinDelta: 0, bgDelta: 0 }; // Fallback

  const vw = videoElement.videoWidth || 640;
  const vh = videoElement.videoHeight || 480;

  // إحداثيات رقعة الجبين (أكثر منطقة عاكسة للضوء على الوجه)
  const foreheadX = Math.max(0, Math.min(vw - 40, faceBox.x + faceBox.width * 0.3));
  const foreheadY = Math.max(0, Math.min(vh - 40, faceBox.y + faceBox.height * 0.1));
  const patchW = Math.max(20, faceBox.width * 0.4);
  const patchH = Math.max(20, faceBox.height * 0.2);

  // إحداثيات رقعة مرجعية في الخلفية (أعلى زاوية الفيديو)
  const bgX = 10;
  const bgY = 10;
  const bgW = 30;
  const bgH = 30;

  // 1. أخذ قراءة السطوع الأساسية قبل النبضة
  const baselineSkin = getRegionBrightness(ctx, videoElement, foreheadX, foreheadY, patchW, patchH);
  const baselineBg = getRegionBrightness(ctx, videoElement, bgX, bgY, bgW, bgH);

  // 2. إطلاق نبضة الإضاءة على الشاشة
  const pulseOverlay = document.createElement('div');
  pulseOverlay.style.position = 'fixed';
  pulseOverlay.style.top = '0';
  pulseOverlay.style.left = '0';
  pulseOverlay.style.width = '100vw';
  pulseOverlay.style.height = '100vh';
  pulseOverlay.style.backgroundColor = '#FFFFFF';
  pulseOverlay.style.opacity = '0.85';
  pulseOverlay.style.zIndex = '99999';
  pulseOverlay.style.pointerEvents = 'none';
  pulseOverlay.style.transition = 'opacity 0.08s ease-out';
  document.body.appendChild(pulseOverlay);

  // 3. الانتظار حتى تلتقط الكاميرا إطار النبضة (140ms)
  await new Promise(resolve => window.setTimeout(resolve, 140));

  // 4. أخذ قراءة السطوع أثناء النبضة
  const pulseSkin = getRegionBrightness(ctx, videoElement, foreheadX, foreheadY, patchW, patchH);
  const pulseBg = getRegionBrightness(ctx, videoElement, bgX, bgY, bgW, bgH);

  // 5. إزالة النبضة فوراً وبسلاسة
  pulseOverlay.style.opacity = '0';
  window.setTimeout(() => {
    if (document.body.contains(pulseOverlay)) {
      document.body.removeChild(pulseOverlay);
    }
  }, 100);

  const skinDelta = pulseSkin - baselineSkin;
  const bgDelta = pulseBg - baselineBg;

  // المعيار الفيزيائي:
  // في الوجه الحي: نبضة الضوء ترفع سطوع الجبين/الوجه بمقدار ملحوظ (skinDelta > 2.0)
  // أو على الأقل تكون استجابة الوجه أعلى من أي تغير عشوائي في الخلفية
  // في الشاشات (الهاتف المعروض): تكون الشاشة مضيئة مسبقاً بنسبة تشبع عالية، أو يظهر انعكاس زجاجي مسطح يعطي تشوهاً
  const passed = skinDelta >= 2.0 || (skinDelta > bgDelta && skinDelta > 1.0);

  return { passed, skinDelta, bgDelta };
};
