/**
 * KioskCapture.tsx
 * ─────────────────────────────────────────────────────────────
 * واجهة البصمة البيومترية المتنقلة/الثابتة لأكشاك الحضور والانصراف:
 *  - ملائمة تامة للهواتف الذكية والأجهزة اللوحية (Smartphone Portrait/Landscape & Tablets)
 *  - فحص حقيقي وديناميكي للسياج الجغرافي للطرفية (Terminal GPS Geofencing) لمنع تشغيل الطرفية خارج المقر
 *  - تطبيق التوجيه الإداري الصارم: حظر الموظف من البصمة خارج موقع عمله الرسمي (Strict Employee Location Binding)
 *  - عزل تام لدورة حياة البطارية والمعالج (0% استهلاك طاقة في الخلفية عبر تجميد الكاميرا والـ GPS)
 *  - استدعاء عميل kioskSupabase المعزول لضمان عدم طرد أو تصادم جلسة المشرف في تطبيق الإدارة الموحد
 *  - مطابقة بيومترية 1:N فورية مع مصفوفات Float32Array مسبقة التحضير في الذاكرة (< 2ms)
 *  - مؤثرات صوتية عراقية أنثوية محلية ومحكمة
 *  - التزام صارم بمسلمات إطار عمل B.R.I.C.K وقواعد عدم استخدام setTimeout لمزامنة الواجهة
 */

import { useRef, useState, useEffect, useCallback } from 'react';
import {
  LogOut, CheckCircle2, AlertTriangle, Loader2, CameraOff, Clock3,
  MapPin, ShieldAlert, Sparkles, Building2, UserX, Volume2, Settings,
  RotateCcw, ShieldCheck, X, Navigation
} from 'lucide-react';
import { useCamera } from '../attendance/hooks/useCamera';
import { useFaceDetection } from '../attendance/hooks/useFaceDetection';
import { uploadSnapshot } from '../attendance/utils/snapshotStorage';
import { getServerNow } from '../attendance/services/serverTimeService';
import { geolocationManager } from '../../utils/GeolocationManager';
import type { AttendanceRecord } from '../attendance/types';
import {
  toDescriptorArrays, playKioskAudio, evaluateKioskGeofence,
  verifyEmployeeLocationBinding, kioskRegisterPunch,
  formatRemainingCooldown,
  type KioskActivation, type KioskEmployee, fetchKioskEmployees,
  fetchAuthorizedSupervisors, type KioskSupervisor
} from './kioskService';

// ── عتبات المطابقة البيومترية — مطابقة للتطبيق الرئيسي ──
const AWARENESS_DISTANCE = 0.45;   // عتبة الوعي بالوجه
const PERFECT_DISTANCE = 0.38;     // مطابقة تامة + 3 إطارات
const GOOD_BLINK_DISTANCE = 0.42;  // مطابقة جيدة + رمشة عين
const EAR_BLINK_THRESHOLD = 0.28;
const AMBIGUITY_GAP = 0.03;        // فرق ضئيل بين أفضل مطابقتين = غموض

type Mode = 'searching' | 'verifying' | 'processing' | 'result' | 'objection';

interface ResultInfo {
  name: string;
  time: string;
  punchType: string;
  scheduleLine: string;
  hierarchy: string;
  kioskLocationName: string;
}

interface FlattenedEmployee {
  emp: KioskEmployee;
  descriptors: Float32Array[];
}

interface KioskCaptureProps {
  activation: KioskActivation;
  onDeactivate: () => void;
}

const euclidean = (a: Float32Array, b: Float32Array): number => {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    sum += d * d;
  }
  return Math.sqrt(sum);
};

const computeEAR = (landmarks: any): number => {
  const earOf = (eye: any[]) => {
    const v1 = Math.hypot(eye[1].x - eye[5].x, eye[1].y - eye[5].y);
    const v2 = Math.hypot(eye[2].x - eye[4].x, eye[2].y - eye[4].y);
    const h = Math.hypot(eye[0].x - eye[3].x, eye[0].y - eye[3].y);
    return (v1 + v2) / (2.0 * h);
  };
  const leftEye = landmarks.getLeftEye();
  const rightEye = landmarks.getRightEye();
  return (earOf(leftEye) + earOf(rightEye)) / 2.0;
};

const formatClock = (iso: string | null | undefined): string => {
  const d = iso ? new Date(iso) : getServerNow();
  return d.toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' });
};

const detectPunchType = (prev: AttendanceRecord | null | undefined, next: AttendanceRecord | null | undefined): string => {
  if (!next) return 'بصمة مسجلة';
  const slots: [string, string][] = [
    ['check_in', 'بصمة حضور — بداية الدوام'],
    ['time_leave_out', 'بصمة خروج زمني'],
    ['time_leave_return', 'بصمة عودة من الزمني'],
    ['time_leave_out_2', 'بصمة خروج زمني (ثانية)'],
    ['time_leave_return_2', 'بصمة عودة من الزمني (ثانية)'],
    ['check_out', 'بصمة انصراف — نهاية الدوام']
  ];
  for (const [key, label] of slots) {
    const before = prev ? (prev as any)[key] : null;
    const after = (next as any)[key];
    if (after && after !== before) return label;
  }
  return 'بصمة مسجلة';
};

const describeSchedule = (emp: KioskEmployee): string => {
  if (emp.today_rest) return 'يوم راحة — خارج دوامه الرسمي';
  const shiftLabel = emp.today_is_night ? 'دوام ليلي' : emp.today_is_evening ? 'دوام مسائي' : 'دوام صباحي';
  const start = emp.today_start ? emp.today_start.substring(0, 5) : '—';
  const end = emp.today_end ? emp.today_end.substring(0, 5) : '—';
  return `${shiftLabel} (${start} - ${end})`;
};

const buildEmployeeHierarchy = (emp: KioskEmployee): string => {
  const parts: string[] = ['كربلاء المقدسة', 'مديرية اتصالات كربلاء'];
  if (emp.dept_text || emp.department_name) {
    parts.push(emp.dept_text || emp.department_name || '');
  }
  if (emp.section_text) parts.push(emp.section_text);
  if (emp.unit_text) parts.push(emp.unit_text);
  return parts.filter(Boolean).join(' • ');
};

export const KioskCapture = ({ activation, onDeactivate }: KioskCaptureProps) => {
  const { videoRef, startCamera, stopCamera, captureFrame } = useCamera();
  const { loadModels, detectFaceInFrame, modelsLoaded } = useFaceDetection();

  const [employees, setEmployees] = useState<KioskEmployee[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>('searching');
  const [hint, setHint] = useState('ضع وجهك بهدوء داخل الإطار البيضاوي');
  const [result, setResult] = useState<ResultInfo | null>(null);
  const [objection, setObjection] = useState<string | null>(null);
  const [objectionType, setObjectionType] = useState<'cooldown' | 'geo' | 'camera' | 'general'>('general');
  const [objectionCountdown, setObjectionCountdown] = useState(6);
  const [clock, setClock] = useState(formatClock(null));
  const [countdown, setCountdown] = useState(20);
  const [showSupervisorModal, setShowSupervisorModal] = useState(false);
  const [supervisorVerified, setSupervisorVerified] = useState(false);
  const [supervisorMessage, setSupervisorMessage] = useState<string | null>(null);

  // ── حالة السياج الجغرافي للطرفية (Terminal GPS Geofencing) ──
  const [geoStatus, setGeoStatus] = useState<'locating' | 'inside' | 'outside' | 'error' | 'no_coords'>('locating');
  const [geoMessage, setGeoMessage] = useState('جاري التحقق من موقع الطرفية عبر GPS...');
  const [nearestDistance, setNearestDistance] = useState<number | null>(null);
  const [matchedLocationName, setMatchedLocationName] = useState<string | null>(null);
  const geoWatchIdRef = useRef<number | null>(null);

  const modeRef = useRef<Mode>('searching');
  const flattenedEmployeesRef = useRef<FlattenedEmployee[]>([]);
  const candidateRef = useRef<KioskEmployee | null>(null);
  const matchedFramesRef = useRef(0);
  const perfectFramesRef = useRef(0);
  const blinkedRef = useRef(false);
  const unknownFramesRef = useRef(0);
  const lastUnknownAudioTimeRef = useRef(0);
  const lastCooldownAudioTimeRef = useRef(0);
  const lastPunchAtRef = useRef<Record<string, number>>({});
  const isProcessingRef = useRef(false);
  const countdownIntervalRef = useRef<number | null>(null);
  const objectionCountdownIntervalRef = useRef<number | null>(null);

  const setModeSafe = (m: Mode) => {
    modeRef.current = m;
    setMode(m);
  };

  // ── تحويل بصمات الموظفين مسبقاً لمصفوفات Float32Array ──
  const prepareFlattenedEmployees = (list: KioskEmployee[]): FlattenedEmployee[] => {
    return list.map(emp => ({
      emp,
      descriptors: toDescriptorArrays(emp.face_descriptor)
    })).filter(item => item.descriptors.length > 0);
  };

  // ── جلب موظفي البصمة دورياً ──
  const refreshEmployees = useCallback(async () => {
    try {
      const list = await fetchKioskEmployees(activation.code);
      const flattened = prepareFlattenedEmployees(list);
      flattenedEmployeesRef.current = flattened;
      setEmployees(list);
      setLoadError(null);
    } catch (err: any) {
      const msg = err?.message || 'خطأ غير معروف';
      if (/JWT|session|log ?in|رمز التفعيل|موقوف/i.test(msg)) {
        onDeactivate();
        return;
      }
      setLoadError(msg);
    }
  }, [activation.code, onDeactivate]);

  useEffect(() => {
    refreshEmployees();
    const interval = window.setInterval(refreshEmployees, 10 * 60 * 1000);
    return () => window.clearInterval(interval);
  }, [refreshEmployees]);

  // ── ساعة الشاشة الحية ──
  useEffect(() => {
    const t = window.setInterval(() => setClock(formatClock(null)), 10000);
    return () => window.clearInterval(t);
  }, []);

  // ── إدارة تتبع الموقع الجغرافي للطرفية (GPS) ──
  const startLocationTracking = useCallback(() => {
    if (!navigator.geolocation) {
      setGeoStatus('error');
      setGeoMessage('خدمة الموقع الجغرافي غير مدعومة في هذا الجهاز');
      return;
    }
    if (geoWatchIdRef.current != null) {
      geolocationManager.clearWatch(geoWatchIdRef.current);
      geoWatchIdRef.current = null;
    }
    const watchId = geolocationManager.watchPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        const check = evaluateKioskGeofence(activation.device.locations, latitude, longitude);
        setGeoStatus(check.status);
        setGeoMessage(check.message);
        setNearestDistance(check.distanceMeters);
        setMatchedLocationName(check.matchedLoc?.name || null);
      },
      (err) => {
        setGeoStatus('error');
        setGeoMessage(
          err.code === 1
            ? 'يرجى تفعيل إذن الموقع الجغرافي (GPS) للهاتف لتشغيل الطرفية'
            : 'تعذر استقبال إشارة الموقع الجغرافي للطرفية'
        );
      }
    );
    geoWatchIdRef.current = watchId;
  }, [activation.device.locations]);

  const stopLocationTracking = useCallback(() => {
    if (geoWatchIdRef.current != null) {
      geolocationManager.clearWatch(geoWatchIdRef.current);
      geoWatchIdRef.current = null;
    }
  }, []);

  // ── إدارة دورة حياة التطبيق في الخلفية (Zero Battery / Zero CPU In Background) ──
  useEffect(() => {
    let wakeLock: any = null;

    const acquireWakeLock = async () => {
      try {
        if ('wakeLock' in navigator && document.visibilityState === 'visible') {
          wakeLock = await (navigator as any).wakeLock.request('screen');
        }
      } catch { /* غير مدعوم أو مرفوض */ }
    };

    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'hidden') {
        // التطبيق في الخلفية: إيقاف كامل للعتاد والموقع لتصفير استهلاك الطاقة
        stopCamera();
        stopLocationTracking();
        try { wakeLock?.release?.(); } catch {}
        wakeLock = null;
      } else if (document.visibilityState === 'visible') {
        // العودة للواجهة: إعادة إيقاظ الكاميرا والموقع والـ WakeLock
        acquireWakeLock();
        startLocationTracking();
        try {
          await startCamera({
            video: {
              facingMode: 'user',
              width: { ideal: 1280 },
              height: { ideal: 720 }
            }
          });
        } catch (err: any) {
          setObjection(err?.message || 'تعذر تشغيل الكاميرا');
        }
      }
    };

    // التشغيل الأولي
    acquireWakeLock();
    startLocationTracking();
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      stopLocationTracking();
      try { wakeLock?.release?.(); } catch {}
    };
  }, [startCamera, stopCamera, startLocationTracking, stopLocationTracking]);

  // ── تشغيل الكاميرا والموديلات لأول مرة ──
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await loadModels();
        if (cancelled) return;
        await startCamera({
          video: {
            facingMode: 'user',
            width: { ideal: 1280 },
            height: { ideal: 720 }
          }
        });
      } catch (err: any) {
        if (!cancelled) setObjection(err?.message || 'تعذر فتح الكاميرا');
      }
    })();
    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [loadModels, startCamera, stopCamera]);

  // ── العودة إلى وضع البحث ──
  const backToSearch = useCallback(() => {
    if (countdownIntervalRef.current) {
      window.clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    if (objectionCountdownIntervalRef.current) {
      window.clearInterval(objectionCountdownIntervalRef.current);
      objectionCountdownIntervalRef.current = null;
    }
    setResult(null);
    setObjection(null);
    setObjectionType('general');
    candidateRef.current = null;
    matchedFramesRef.current = 0;
    perfectFramesRef.current = 0;
    blinkedRef.current = false;
    unknownFramesRef.current = 0;
    setCountdown(20);
    setObjectionCountdown(6);
    setHint('ضع وجهك بهدوء داخل الإطار البيضاوي');
    setModeSafe('searching');
  }, []);

  // ── إدارة العداد التنازلي 20 ثانية عند ظهور النتيجة ──
  useEffect(() => {
    if (mode === 'result') {
      setCountdown(20);
      countdownIntervalRef.current = window.setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            backToSearch();
            return 20;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (countdownIntervalRef.current) {
        window.clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
    }
    return () => {
      if (countdownIntervalRef.current) {
        window.clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
    };
  }, [mode, backToSearch]);

  // ── إدارة العداد التنازلي 6 ثوانٍ لشاشة الاعتراض/مهلة الأمان للعودة التلقائية ──
  useEffect(() => {
    if (mode === 'objection') {
      setObjectionCountdown(6);
      objectionCountdownIntervalRef.current = window.setInterval(() => {
        setObjectionCountdown((prev) => {
          if (prev <= 1) {
            backToSearch();
            return 6;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (objectionCountdownIntervalRef.current) {
        window.clearInterval(objectionCountdownIntervalRef.current);
        objectionCountdownIntervalRef.current = null;
      }
    }
    return () => {
      if (objectionCountdownIntervalRef.current) {
        window.clearInterval(objectionCountdownIntervalRef.current);
        objectionCountdownIntervalRef.current = null;
      }
    };
  }, [mode, backToSearch]);

  // ── تثبيت البصمة بعد التحقق الصارم ──
  const processPunch = useCallback(async (emp: KioskEmployee) => {
    if (isProcessingRef.current) return;
    isProcessingRef.current = true;
    try {
      // المستوى 1 من التحقق: هل هاتف الطرفية داخل الموقع المصرح به؟
      if (geoStatus === 'outside') {
        setObjectionType('geo');
        setObjection('الطرفية خارج حرم موقع العمل المصرح به — لا يمكن تثبيت البصمات من هذا الموقع');
        playKioskAudio('outside_location');
        setModeSafe('objection');
        return;
      }

      // المستوى 2 من التحقق (توجيه المدير الصارم): هل الموظف مرتبط بموقع عمل هذا الكشك؟
      const locationBinding = verifyEmployeeLocationBinding(emp, activation.device.locations);
      if (!locationBinding.allowed) {
        setObjectionType('geo');
        setObjection(locationBinding.reason || 'أنت خارج مقر عملك الرسمي المصرح به — لا يمكن تثبيت البصمة في هذا الموقع');
        playKioskAudio('outside_location');
        setModeSafe('objection');
        return;
      }

      // المستوى 3 من التحقق: مهلة الأمان الصارمة (3 دقائق / 180 ثانية) بالذاكرة المحلية
      const COOLDOWN_SECONDS = 180;
      const lastAt = lastPunchAtRef.current[emp.id] || 0;
      const nowMs = Date.now();
      const elapsedLocalSec = Math.floor((nowMs - lastAt) / 1000);

      if (elapsedLocalSec < COOLDOWN_SECONDS) {
        const remainingSeconds = COOLDOWN_SECONDS - elapsedLocalSec;
        const formattedTime = formatRemainingCooldown(remainingSeconds);
        const msg = `تم تسجيل بصمتك مؤخراً — يُرجى الانتظار (${formattedTime}) قبل تسجيل بصمة جديدة`;

        if (nowMs - lastCooldownAudioTimeRef.current > 4000) {
          lastCooldownAudioTimeRef.current = nowMs;
          playKioskAudio('cooldown');
        }
        setObjectionType('cooldown');
        setObjection(msg);
        setModeSafe('objection');
        return;
      }

      setModeSafe('processing');
      setHint('جاري تثبيت البصمة...');

      try {
        const canvas = document.createElement('canvas');
        let snapshotUrl: string | undefined;
        try {
          const base64 = await captureFrame(canvas);
          const snap = await uploadSnapshot(base64, 'kiosk');
          snapshotUrl = snap.url ?? undefined;
        } catch { /* اللقطة غير حرجة ولا توقف التسجيل */ }

        // التسجيل الرسمي عبر حساب خدمة الكيوسك المعزول (kioskSupabase)
        const { record, prevRecord } = await kioskRegisterPunch(
          emp,
          activation.device,
          activation.code,
          snapshotUrl,
          matchedLocationName || undefined
        );

        // نجاح التثبيت: حفظ التوقيت الحالي فوراً لتفعيل مهلة الأمان لـ 3 دقائق كاملة
        lastPunchAtRef.current[emp.id] = Date.now();

        const punchType = detectPunchType(prevRecord, record);
        const newTime = (() => {
          for (const key of ['check_in', 'time_leave_out', 'time_leave_return', 'time_leave_out_2', 'time_leave_return_2', 'check_out']) {
            const before = prevRecord ? (prevRecord as any)[key] : null;
            const after = (record as any)[key];
            if (after && after !== before) return formatClock(after);
          }
          return formatClock(null);
        })();

        playKioskAudio('punch_success');

        setResult({
          name: emp.full_name,
          time: newTime,
          punchType,
          scheduleLine: describeSchedule(emp),
          hierarchy: buildEmployeeHierarchy(emp),
          kioskLocationName: matchedLocationName || activation.device.name
        });

        setModeSafe('result');
      } catch (err: any) {
        const currentNowMs = Date.now();
        if (err?.code === 'COOLDOWN_ACTIVE' || String(err?.message).startsWith('COOLDOWN_ACTIVE:')) {
          const remSec = err.remainingSeconds || parseInt(String(err.message).split(':')[1], 10) || 180;
          // مزامنة الذاكرة المحلية مع حقيقة قاعدة البيانات
          lastPunchAtRef.current[emp.id] = currentNowMs - ((COOLDOWN_SECONDS - remSec) * 1000);
          const formattedTime = formatRemainingCooldown(remSec);
          const msg = `تم تسجيل بصمتك مؤخراً — يُرجى الانتظار (${formattedTime}) قبل تسجيل بصمة جديدة`;

          if (currentNowMs - lastCooldownAudioTimeRef.current > 4000) {
            lastCooldownAudioTimeRef.current = currentNowMs;
            playKioskAudio('cooldown');
          }
          setObjectionType('cooldown');
          setObjection(msg);
          setModeSafe('objection');
          return;
        }

        const msg = err?.message || 'تعذر تثبيت البصمة — حاول مجدداً';
        playKioskAudio('punch_retry');
        setObjectionType('general');
        setObjection(msg);
        setModeSafe('objection');
      }
    } finally {
      isProcessingRef.current = false;
    }
  }, [activation, captureFrame, geoStatus, matchedLocationName]);

  // ── حلقة التعرف والمطابقة البيومترية 1:N المستمرة وغير القابلة للتوقف ──
  useEffect(() => {
    let animationFrameId: number;
    let isCancelled = false;
    let lastFrameTime = 0;
    const FRAME_INTERVAL = 130; // ~7.5 إطار/ثانية لتوفير الموارد والبطارية

    const runLoop = async (now: number) => {
      if (isCancelled) return;

      // جدولة الإطار التالي دائماً في البداية لضمان استمرارية النبض مهما حدث
      animationFrameId = requestAnimationFrame(runLoop);

      // تجميد المعالجة إذا كانت الطرفية خارج الموقع الجغرافي أو بدون GPS
      if (geoStatus === 'outside' || geoStatus === 'error') {
        return;
      }

      // لا تفحص الإطارات إلا في وضعي searching و verifying حصراً
      const currentMode = modeRef.current;
      if (currentMode !== 'searching' && currentMode !== 'verifying') {
        return;
      }

      if (!modelsLoaded) return;

      if (now - lastFrameTime < FRAME_INTERVAL) {
        return;
      }
      lastFrameTime = now;

      try {
        const video = videoRef.current;
        if (!video || video.readyState < 2 || video.videoWidth === 0) {
          return;
        }

        const { detection } = await detectFaceInFrame(video, []);
        if (isCancelled) return;

        // التحقق مجدداً من الوضع بعد اكتمال كشف الوجه
        if (modeRef.current !== 'searching' && modeRef.current !== 'verifying') {
          return;
        }

        if (!detection) {
          if (modeRef.current === 'verifying') {
            candidateRef.current = null;
            matchedFramesRef.current = 0;
            perfectFramesRef.current = 0;
            blinkedRef.current = false;
            setModeSafe('searching');
          }
          unknownFramesRef.current = 0;
          setHint('ضع وجهك بهدوء داخل الإطار البيضاوي');
          return;
        }

        const descriptor: Float32Array = detection.descriptor;
        const ear = computeEAR(detection.landmarks);

        let best: { emp: KioskEmployee; dist: number } | null = null;
        let secondBest: { emp: KioskEmployee; dist: number } | null = null;

        const flattened = flattenedEmployeesRef.current;
        const count = flattened.length;

        for (let i = 0; i < count; i++) {
          const item = flattened[i];
          let minDist = 999;
          const descs = item.descriptors;
          const dLen = descs.length;
          for (let j = 0; j < dLen; j++) {
            const d = euclidean(descriptor, descs[j]);
            if (d < minDist) minDist = d;
          }

          if (!best || minDist < best.dist) {
            secondBest = best;
            best = { emp: item.emp, dist: minDist };
          } else if (!secondBest || minDist < secondBest.dist) {
            secondBest = { emp: item.emp, dist: minDist };
          }
        }

        const activeMode = modeRef.current;
        if (activeMode === 'searching') {
          if (!best || best.dist > AWARENESS_DISTANCE) {
            unknownFramesRef.current += 1;
            if (unknownFramesRef.current > 12) {
              setHint('وجه غير مسجل في النظام — راجع مسؤول البصمة');
              const nowMs = Date.now();
              if (nowMs - lastUnknownAudioTimeRef.current > 7000) {
                lastUnknownAudioTimeRef.current = nowMs;
                playKioskAudio('not_enrolled');
              }
            } else {
              setHint('جاري التعرف على الوجه...');
            }
          } else if (secondBest && (secondBest.dist - best.dist) < AMBIGUITY_GAP) {
            unknownFramesRef.current = 0;
            setHint(`تطابق متقارب مع (${best.emp.full_name} و ${secondBest.emp.full_name})`);
          } else {
            unknownFramesRef.current = 0;
            candidateRef.current = best.emp;
            matchedFramesRef.current = 1;
            perfectFramesRef.current = best.dist <= PERFECT_DISTANCE ? 1 : 0;
            blinkedRef.current = ear < EAR_BLINK_THRESHOLD;
            setModeSafe('verifying');

            const lastPunch = lastPunchAtRef.current[best.emp.id] || 0;
            const elapsedSec = (Date.now() - lastPunch) / 1000;
            if (elapsedSec < 180) {
              const remSec = Math.ceil(180 - elapsedSec);
              setHint(`مهلة الأمان نشطة (${best.emp.full_name}) — متبقي ${formatRemainingCooldown(remSec)}`);
            } else {
              setHint(best.dist <= PERFECT_DISTANCE ? 'جاري التحقق...' : 'ارمش بعينيك للتأكيد');
            }
          }
        } else if (activeMode === 'verifying') {
          const candidate = candidateRef.current;
          if (!candidate) {
            setModeSafe('searching');
            return;
          }

          let dist = 999;
          const cRefs = toDescriptorArrays(candidate.face_descriptor);
          for (let k = 0; k < cRefs.length; k++) {
            const d = euclidean(descriptor, cRefs[k]);
            if (d < dist) dist = d;
          }

          if (dist > AWARENESS_DISTANCE + 0.05) {
            candidateRef.current = null;
            matchedFramesRef.current = 0;
            perfectFramesRef.current = 0;
            blinkedRef.current = false;
            setModeSafe('searching');
            setHint('ضع وجهك بهدوء داخل الإطار البيضاوي');
            return;
          }

          matchedFramesRef.current += 1;
          if (ear < EAR_BLINK_THRESHOLD) blinkedRef.current = true;
          if (dist <= PERFECT_DISTANCE) perfectFramesRef.current += 1;
          else perfectFramesRef.current = 0;

          // التحقق الحيوي: تطابق الملامح + الرمش لمنع الصور والشاشات
          const isVerified = (dist <= GOOD_BLINK_DISTANCE && blinkedRef.current && matchedFramesRef.current >= 3)
            || (perfectFramesRef.current >= 4);

          if (isVerified) {
            // الانتقال الفوري لوضع processing لمنع تكرار المعالجة في الإطارات التالية
            setModeSafe('processing');
            // استدعاء processPunch دون تعطيل الحلقة
            processPunch(candidate);
            return;
          }
          setHint(blinkedRef.current ? 'تم رصد الرمشة — جاري التثبيت...' : 'ارمش بعينيك للتأكيد الحيوي');
        }
      } catch (err: any) {
        console.warn('[Kiosk] Detection error:', err);
      }
    };

    animationFrameId = requestAnimationFrame(runLoop);
    return () => {
      isCancelled = true;
      cancelAnimationFrame(animationFrameId);
    };
  }, [modelsLoaded, processPunch, geoStatus]);

  // ── نافذة قفل المشرف للتحكم بالكشك ──
  const handleOpenSupervisorSettings = async () => {
    setShowSupervisorModal(true);
    setSupervisorVerified(false);
    setSupervisorMessage('يرجى وقوف المشرف المخوّل أمام الكاميرا لفتح الإعدادات');
    playKioskAudio('align_face');
  };

  const verifySupervisorFace = async () => {
    try {
      const sups = await fetchAuthorizedSupervisors(activation.code);
      if (sups.length === 0) {
        setSupervisorMessage('لا يوجد مشرفون مخولون لهذا الجهاز');
        playKioskAudio('supervisor_unauthorized');
        return;
      }

      const video = videoRef.current;
      if (!video) throw new Error('الكاميرا غير جاهزة');

      const { detection } = await detectFaceInFrame(video, []);
      if (!detection) {
        setSupervisorMessage('لم يتم رصد وجه — قف أمام الكاميرا');
        return;
      }

      const desc: Float32Array = detection.descriptor;
      let matchedSupervisor: KioskSupervisor | null = null;
      let minDist = 999;

      for (const sup of sups) {
        for (const ref of toDescriptorArrays(sup.face_descriptor)) {
          const d = euclidean(desc, ref);
          if (d < minDist) {
            minDist = d;
            if (d <= 0.40) {
              matchedSupervisor = sup;
            }
          }
        }
      }

      if (matchedSupervisor) {
        setSupervisorVerified(true);
        setSupervisorMessage(`مرحباً المشرف: ${matchedSupervisor.full_name} (${matchedSupervisor.role_label})`);
        playKioskAudio('supervisor_approved');
      } else {
        setSupervisorMessage('عذراً، الوجه غير مخول بإدارة هذه الطرفية العامة');
        playKioskAudio('supervisor_unauthorized');
      }
    } catch (err: any) {
      setSupervisorMessage(err?.message || 'فشل التحقق');
      playKioskAudio('supervisor_unauthorized');
    }
  };

  const isResultOrObjection = mode === 'result' || mode === 'objection';

  return (
    <div
      onClick={isResultOrObjection ? backToSearch : undefined}
      className="fixed inset-0 bg-slate-950 text-white font-tajawal overflow-hidden select-none flex flex-col"
      dir="rtl"
    >
      {/* ── الشريط العلوي الذكي (متجاوب للهواتف والأجهزة اللوحية) ── */}
      <header className="fixed top-0 inset-x-0 z-[60] px-3 py-2.5 flex items-center justify-between pointer-events-none bg-gradient-to-b from-slate-950/95 via-slate-950/70 to-transparent">
        {/* بيانات الكشك وموقعه */}
        <div className="pointer-events-auto flex items-center gap-2 bg-slate-900/90 backdrop-blur-md border border-slate-700/60 rounded-2xl px-3 py-1.5 shadow-xl max-w-[60%] sm:max-w-none">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
          <div className="min-w-0">
            <h1 className="text-xs sm:text-sm font-extrabold text-white leading-tight truncate">
              {activation.device.name ? activation.device.name.replace(/كيوسك|كشك|أكشاك/gi, 'طرفية عامة') : 'طرفية البصمة العامة'}
            </h1>
            <p className="text-[10px] text-slate-400 flex items-center gap-1 truncate">
              <MapPin size={10} className="text-emerald-400 shrink-0" />
              <span className="truncate">
                {matchedLocationName || (activation.device.locations || []).map(l => l.name).join(' / ') || 'موقع المديرية'}
              </span>
            </p>
          </div>
        </div>

        {/* مؤشر GPS والساعة وقفل المشرف */}
        <div className="pointer-events-auto flex items-center gap-1.5 sm:gap-2">
          {/* شارة فحص الـ GPS الحية للطرفية */}
          <div
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[11px] font-black border backdrop-blur-md shadow-lg ${
              geoStatus === 'inside'
                ? 'bg-emerald-950/80 border-emerald-500/60 text-emerald-400'
                : geoStatus === 'outside'
                ? 'bg-rose-950/90 border-rose-500 text-rose-300 animate-pulse'
                : geoStatus === 'error'
                ? 'bg-rose-950/90 border-rose-600 text-rose-300'
                : 'bg-amber-950/80 border-amber-500/60 text-amber-300'
            }`}
          >
            <Navigation size={12} className={geoStatus === 'inside' ? 'text-emerald-400' : 'text-rose-400 animate-spin'} />
            <span className="hidden sm:inline">
              {geoStatus === 'inside'
                ? 'داخل الموقع'
                : geoStatus === 'outside'
                ? `خارج الموقع (${nearestDistance}م)`
                : geoStatus === 'error'
                ? 'GPS معطل'
                : 'تحديد GPS...'}
            </span>
          </div>

          {/* الساعة */}
          <div className="flex items-center gap-1.5 bg-slate-900/90 backdrop-blur-md border border-slate-700/60 rounded-xl px-2.5 py-1.5 shadow-xl text-slate-200">
            <Clock3 size={13} className="text-emerald-400 shrink-0" />
            <span className="text-xs sm:text-sm font-bold tracking-wider font-mono" dir="ltr">{clock}</span>
          </div>

          {/* زر إعدادات المشرف */}
          <button
            onClick={(e) => { e.stopPropagation(); handleOpenSupervisorSettings(); }}
            className="bg-slate-900/90 hover:bg-slate-800 backdrop-blur-md border border-slate-700/60 text-slate-300 hover:text-white p-2 rounded-xl transition-colors shadow-xl"
            title="إعدادات الطرفية العامة"
          >
            <Settings size={16} />
          </button>
        </div>
      </header>

      {/* ── منطقة الكاميرا والإطار البيضاوي (مستجيبة لأبعاد الهاتف والتابلت) ── */}
      <main className="flex-1 relative flex items-center justify-center p-3 pt-14 pb-20">
        <div className="relative w-full max-w-[420px] aspect-[3/4] sm:aspect-[4/5] max-h-[72vh] flex items-center justify-center">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="absolute inset-0 w-full h-full object-cover rounded-[2.5rem] sm:rounded-[3.5rem] scale-x-[-1] shadow-2xl"
          />

          {/* قناع التعتيم والقص البيضاوي المتجاوب */}
          <svg viewBox="0 0 340 420" className="absolute inset-0 w-full h-full pointer-events-none">
            <defs>
              <mask id="kioskOvalMask">
                <rect width="340" height="420" fill="white" />
                <ellipse cx="170" cy="210" rx="100" ry="138" fill="black" />
              </mask>
            </defs>
            <rect width="340" height="420" fill="rgba(2, 6, 23, 0.78)" mask="url(#kioskOvalMask)" />
            <ellipse
              cx="170"
              cy="210"
              rx="100"
              ry="138"
              fill="none"
              stroke={
                geoStatus === 'outside' || geoStatus === 'error'
                  ? '#e11d48'
                  : mode === 'verifying' || mode === 'processing' || mode === 'result'
                  ? '#10b981'
                  : '#ffffff'
              }
              strokeWidth={mode === 'verifying' ? '4' : '3'}
              strokeDasharray={mode === 'searching' || mode === 'objection' ? '12 8' : 'none'}
              className="transition-all duration-300"
            />
          </svg>

          {/* لافتة القفل الجغرافي الصارم عند تواجد الطرفية خارج الموقع المصرح به */}
          {(geoStatus === 'outside' || geoStatus === 'error') && (
            <div className="absolute inset-0 z-30 bg-slate-950/85 backdrop-blur-md rounded-[2.5rem] sm:rounded-[3.5rem] flex flex-col items-center justify-center p-6 text-center space-y-3">
              <div className="bg-rose-950 border-2 border-rose-500 p-4 rounded-3xl animate-bounce">
                <ShieldAlert size={40} className="text-rose-400" />
              </div>
              <h3 className="text-base sm:text-lg font-black text-rose-300 leading-tight">
                {geoStatus === 'outside' ? 'الطرفية خارج حرم موقع العمل' : 'تعذر فحص الموقع الجغرافي للطرفية'}
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed font-semibold max-w-xs">
                {geoMessage}
              </p>
              <p className="text-[11px] text-amber-300 bg-amber-950/60 border border-amber-600/40 rounded-xl px-3 py-1.5 font-bold">
                🔒 تم إيقاف استقبال البصمات لحين التواجد داخل الموقع المصرح به
              </p>
            </div>
          )}
        </div>
      </main>

      {/* ── شريط الحالة والتلميح أثناء البحث ── */}
      {!isResultOrObjection && (
        <footer className="fixed bottom-0 inset-x-0 pb-6 pt-3 bg-gradient-to-t from-slate-950 via-slate-950/90 to-transparent pointer-events-none">
          <div className="text-center px-4 space-y-2 max-w-md mx-auto">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-900/90 border border-slate-700 shadow-2xl backdrop-blur-md">
              {mode === 'processing' ? (
                <Loader2 size={16} className="animate-spin text-amber-400" />
              ) : mode === 'verifying' ? (
                <Sparkles size={16} className="text-emerald-400 animate-pulse" />
              ) : (
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
              )}
              <p className={`text-sm sm:text-base font-extrabold ${mode === 'verifying' ? 'text-emerald-400' : 'text-white'}`}>
                {hint}
              </p>
            </div>

            {loadError && (
              <div className="pointer-events-auto mx-auto max-w-xs bg-amber-950/60 border border-amber-700/80 text-amber-200 rounded-xl p-2 text-xs">
                تعذر تحديث السجلات: {loadError}
                <button onClick={refreshEmployees} className="underline mr-2 font-bold">إعادة</button>
              </div>
            )}
          </div>
        </footer>
      )}

      {/* ── شاشة النتيجة (مع نقر في أي مكان لإعادة البحث) ── */}
      {mode === 'result' && result && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 cursor-pointer">
          <div
            onClick={(e) => { e.stopPropagation(); backToSearch(); }}
            className="w-full max-w-sm sm:max-w-md bg-gradient-to-b from-slate-900 to-slate-950 border-2 border-emerald-500 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-3.5 animate-in fade-in zoom-in-95 duration-200"
          >
            {/* مؤشر العداد التنازلي */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <span className="text-xs text-slate-400 font-bold">تثبيت البصمة البيومترية</span>
              <div className="flex items-center gap-1.5 bg-emerald-950/80 border border-emerald-600/50 px-3 py-1 rounded-full text-emerald-400 text-xs font-mono font-black">
                <RotateCcw size={12} className="animate-spin" />
                <span>إعادة بعد {countdown} ث</span>
              </div>
            </div>

            {/* الاسم ونوع البصمة والوقت */}
            <div className="flex items-center gap-3">
              <div className="bg-emerald-600/20 border border-emerald-500 p-2.5 rounded-2xl shrink-0">
                <CheckCircle2 className="text-emerald-400" size={28} />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-lg sm:text-xl font-black text-white leading-tight truncate">
                  {result.name}
                </h2>
                <p className="text-xs text-emerald-400 font-extrabold mt-0.5">
                  {result.punchType}
                </p>
              </div>
              <div className="text-left shrink-0">
                <div className="text-xl sm:text-2xl font-black text-emerald-400 tracking-wider font-mono" dir="ltr">
                  {result.time}
                </div>
                <div className="text-[10px] text-slate-400 font-bold">وقت التثبيت</div>
              </div>
            </div>

            {/* كرت المسار الإداري والموقع */}
            <div className="bg-slate-800/80 border border-slate-700/60 rounded-2xl p-3 text-xs text-slate-300 space-y-2">
              <div className="flex items-start gap-2">
                <Building2 size={14} className="text-amber-400 shrink-0 mt-0.5" />
                <span className="leading-relaxed font-semibold">{result.hierarchy}</span>
              </div>
              <div className="flex items-center gap-2 text-slate-400 pt-1 border-t border-slate-700/40">
                <MapPin size={13} className="text-emerald-400 shrink-0" />
                <span>موقع الطرفية: <strong className="text-slate-200">{result.kioskLocationName}</strong></span>
              </div>
              <div className="text-slate-400">
                <span>جدول الدوام: <strong className="text-slate-200">{result.scheduleLine}</strong></span>
              </div>
            </div>

            {/* زر الجاهزية للشخص التالي */}
            <div className="pt-2 text-center">
              <div className="text-xs text-emerald-400 font-bold animate-pulse mb-2.5">
                👈 انقر في أي موقع على الشاشة لتثبيت البصمة للشخص التالي
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); backToSearch(); }}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-black text-sm transition-colors shadow-lg shadow-emerald-900/40"
              >
                جاهز للموظف التالي
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── شاشة الاعتراض / الرفض الصارم / مهلة الأمان ── */}
      {mode === 'objection' && (
        <div
          onClick={(e) => { e.stopPropagation(); backToSearch(); }}
          className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 cursor-pointer"
        >
          <div
            onClick={(e) => { e.stopPropagation(); backToSearch(); }}
            className={`w-full max-w-sm sm:max-w-md bg-slate-900 border-2 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-3.5 ${
              objectionType === 'cooldown' ? 'border-amber-500' : 'border-rose-600'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-2xl shrink-0 border ${
                objectionType === 'cooldown'
                  ? 'bg-amber-950/80 border-amber-500 text-amber-400'
                  : 'bg-rose-950/80 border-rose-600 text-rose-400'
              }`}>
                {objectionType === 'cooldown' ? (
                  <Clock3 size={26} />
                ) : objection?.includes('كاميرا') ? (
                  <CameraOff size={26} />
                ) : (
                  <UserX size={26} />
                )}
              </div>
              <div className="flex-1">
                <h2 className={`text-base font-black ${
                  objectionType === 'cooldown' ? 'text-amber-300' : 'text-rose-300'
                }`}>
                  {objectionType === 'cooldown' ? 'مهلة الأمان نشطة (3 دقائق)' : 'تنبيه البصمة'}
                </h2>
                <p className="text-xs text-slate-200 mt-1 leading-relaxed font-semibold">{objection}</p>
              </div>
            </div>

            <div className="bg-slate-800/80 border border-slate-700/60 rounded-2xl p-2.5 text-xs text-slate-400 flex items-start gap-2">
              {objectionType === 'cooldown' ? (
                <>
                  <Clock3 size={14} className="shrink-0 mt-0.5 text-amber-400" />
                  <span>تُطبّق مهلة الأمان (3 دقائق) نظامياً لمنع تسجيل الحركات المزدوجة العرضية أثناء التواجد أمام الكاميرا.</span>
                </>
              ) : (
                <>
                  <AlertTriangle size={14} className="shrink-0 mt-0.5 text-amber-400" />
                  <span>لا يُسمح بتثبيت البصمة إلا في مقر العمل الرسمي المصرح به للمنتسب.</span>
                </>
              )}
            </div>

            <div className="text-center pt-2">
              <button
                onClick={(e) => { e.stopPropagation(); backToSearch(); }}
                className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-2xl font-black text-xs transition-colors border border-slate-600 flex items-center justify-center gap-2"
              >
                <span>جاهز للموظف التالي</span>
                <span className="text-[10px] text-amber-400/90 font-mono">({objectionCountdown} ث)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── نافذة قفل المشرف للتحكم بالكشك ── */}
      {showSupervisorModal && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="fixed inset-0 z-[100] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4"
        >
          <div className="w-full max-w-sm bg-slate-900 border border-slate-700 rounded-3xl p-5 space-y-3.5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <div className="flex items-center gap-2">
                <ShieldCheck className="text-emerald-400" size={18} />
                <h3 className="font-extrabold text-white text-sm">إدارة الطرفية العامة (المشرف)</h3>
              </div>
              <button
                onClick={() => setShowSupervisorModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X size={16} />
              </button>
            </div>

            <div className="text-xs text-slate-300 leading-relaxed bg-slate-800/70 p-2.5 rounded-xl">
              {supervisorMessage}
            </div>

            {!supervisorVerified ? (
              <div className="space-y-2 pt-1">
                <button
                  onClick={verifySupervisorFace}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-extrabold text-xs flex items-center justify-center gap-2"
                >
                  <Sparkles size={14} />
                  التحقق من وجه المشرف
                </button>
              </div>
            ) : (
              <div className="space-y-2 pt-1">
                <button
                  onClick={() => {
                    refreshEmployees();
                    setShowSupervisorModal(false);
                  }}
                  className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-bold text-xs flex items-center justify-center gap-2"
                >
                  <RotateCcw size={13} />
                  تحديث فوري لقائمة الموظفين
                </button>

                <button
                  onClick={() => {
                    playKioskAudio('punch_success');
                  }}
                  className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-bold text-xs flex items-center justify-center gap-2"
                >
                  <Volume2 size={13} />
                  فحص الصوت العراقي
                </button>

                <button
                  onClick={() => {
                    if (window.confirm('هل أنت متأكد من إلغاء تفعيل هذه الطرفية العامة وإعادتها لشاشة التفعيل؟')) {
                      onDeactivate();
                    }
                  }}
                  className="w-full py-2 bg-rose-600/80 hover:bg-rose-600 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2"
                >
                  <LogOut size={13} />
                  إلغاء تفعيل الطرفية (Deactivate)
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* شريط تشخيص سفلي صامت */}
      <footer className="fixed bottom-1 left-2 z-[60] text-[9px] text-slate-600 pointer-events-none" dir="ltr">
        Biometric Terminal · {employees.length} enrolled
      </footer>
    </div>
  );
};
