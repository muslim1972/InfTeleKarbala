'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAttendance } from '../hooks/useAttendance';
import { geofenceService } from '../services/geofenceService';
import { geolocationManager } from '../../../utils/GeolocationManager';
import { uploadSnapshotToR2 } from '../utils/r2Storage';
import type { AttendanceRecord, WorkLocation } from '../types';
import { 
  LogIn, LogOut, MapPin, CheckCircle, 
  AlertTriangle, RefreshCw, Camera,
  ShieldCheck, X, User
} from 'lucide-react';
import { toast } from 'react-hot-toast';

// ============================================
// Device Fingerprint — Cybersecurity Layer
// Uses Web Crypto API (SHA-256) to create a
// stable, non-reversible device identifier
// ============================================
const getDeviceFingerprint = async (): Promise<string> => {
  const raw = [
    navigator.userAgent,
    `${screen.width}x${screen.height}x${screen.colorDepth}`,
    Intl.DateTimeFormat().resolvedOptions().timeZone,
    navigator.hardwareConcurrency?.toString() ?? '0',
    navigator.language,
    new Date().getTimezoneOffset().toString(),
  ].join('|');

  const encoder = new TextEncoder();
  const data = encoder.encode(raw);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

// ============================================
// Face Detection via Skin-tone & Motion Analysis
// No external AI libraries required
// ============================================
const FACE_DETECT_INTERVAL_MS = 200;
const FACE_DETECT_TIMEOUT_S = 10;
const STABILIZE_FRAMES = 3; // need 3 consecutive detected frames

interface FaceDetectState {
  detected: boolean;
  consecutiveCount: number;
  message: string;
  countdown: number;
}

/**
 * Analyze a canvas region for face-like features:
 * - Skin tone pixel ratio in the oval zone
 * - Sufficient brightness variance (not a blank wall / black screen)
 */
function analyzeFaceRegion(
  ctx: CanvasRenderingContext2D, 
  cx: number, cy: number, 
  rx: number, ry: number
): boolean {
  const x0 = Math.max(0, Math.floor(cx - rx));
  const y0 = Math.max(0, Math.floor(cy - ry));
  const w = Math.min(Math.floor(rx * 2), ctx.canvas.width - x0);
  const h = Math.min(Math.floor(ry * 2), ctx.canvas.height - y0);
  
  if (w <= 0 || h <= 0) return false;
  
  const imageData = ctx.getImageData(x0, y0, w, h);
  const pixels = imageData.data;
  const totalPixels = w * h;
  
  let skinPixels = 0;
  let brightnessSum = 0;
  let brightnessSqSum = 0;
  
  for (let i = 0; i < pixels.length; i += 16) { // sample every 4th pixel for performance
    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];
    const brightness = (r + g + b) / 3;
    
    brightnessSum += brightness;
    brightnessSqSum += brightness * brightness;
    
    // Skin-tone detection (works across multiple skin colors)
    const isSkin = (
      r > 60 && g > 40 && b > 20 &&
      r > g && r > b &&
      Math.abs(r - g) > 10 &&
      r - b > 15 &&
      brightness > 50 && brightness < 230
    );
    if (isSkin) skinPixels++;
  }
  
  const sampledCount = Math.ceil(totalPixels / 4);
  const skinRatio = skinPixels / sampledCount;
  const avgBrightness = brightnessSum / sampledCount;
  const variance = (brightnessSqSum / sampledCount) - (avgBrightness * avgBrightness);
  
  // Face criteria: enough skin pixels AND enough brightness variance (not blank)
  return skinRatio > 0.15 && skinRatio < 0.85 && variance > 200;
}


// ============================================
// Main Component
// ============================================
interface AttendanceCheckInOutProps {
  employeeId: string;
  todayAttendance: AttendanceRecord | null;
  loading: boolean;
  onAttendanceUpdate: () => void;
}

export default function AttendanceCheckInOut({
  employeeId,
  todayAttendance,
  loading,
  onAttendanceUpdate
}: AttendanceCheckInOutProps) {
  const { checkIn, checkOut, timeLeaveOut, timeLeaveReturn } = useAttendance(employeeId);

  // Location & Geofencing
  const [loadingLocation, setLoadingLocation] = useState(false);
  const [locationText, setLocationText] = useState('');
  const [geofenceChecked, setGeofenceChecked] = useState(false);
  const [isAllowed, setIsAllowed] = useState(false);
  const [nearestLoc, setNearestLoc] = useState<WorkLocation | undefined>(undefined);
  const [nearestDistance, setNearestDistance] = useState<number | null>(null);

  // Camera & Face Detection
  const [cameraOpen, setCameraOpen] = useState(false);
  const [capturingAction, setCapturingAction] = useState<'checkIn' | 'checkOut' | null>(null);
  const [processing, setProcessing] = useState(false);
  const [cameraAttempt, setCameraAttempt] = useState(1);
  const [alertInfo, setAlertInfo] = useState<{ show: boolean; action: 'checkIn' | 'checkOut' | null }>({
    show: false,
    action: null
  });
  const [faceState, setFaceState] = useState<FaceDetectState>({
    detected: false, consecutiveCount: 0, message: 'يرجى وضع وجهك داخل الدائرة', countdown: FACE_DETECT_TIMEOUT_S,
  });
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectIntervalRef = useRef<number | null>(null);
  const countdownIntervalRef = useRef<number | null>(null);
  const capturedRef = useRef(false);
  const attemptRef = useRef(1);

  // ---- Geofence Logic ----
  const verifyLocationAndGeofence = useCallback(async (showToast = false) => {
    setLoadingLocation(true);
    setGeofenceChecked(false);
    try {
      if (showToast) toast.loading('جاري تحديد موقعك الجغرافي...', { id: 'geo-verify' });
      const position = await geolocationManager.getCurrentPosition();
      const { latitude, longitude } = position.coords;
      const geofenceResult = await geofenceService.checkEmployeeGeofence(employeeId, latitude, longitude);
      
      setIsAllowed(geofenceResult.allowed);
      setNearestLoc(geofenceResult.nearestLocation);
      setNearestDistance(geofenceResult.distance ?? null);
      
      const locName = geofenceResult.nearestLocation?.name || 'موقع غير محدد';
      
      if (geofenceResult.allowed) {
        setLocationText(`${latitude.toFixed(6)}, ${longitude.toFixed(6)} - ${locName}`);
        if (showToast) toast.success(`أنت الآن داخل النطاق المسموح لـ: ${locName}`, { id: 'geo-verify' });
      } else {
        setLocationText(`${latitude.toFixed(6)}, ${longitude.toFixed(6)} - خارج النطاق المسموح`);
        if (showToast) toast.error('أنت خارج النطاق الجغرافي المسموح لتسجيل الحضور!', { id: 'geo-verify' });
      }
      setGeofenceChecked(true);
    } catch (err) {
      console.error('Error fetching position:', err);
      setLocationText('تعذر تحديد الموقع الجغرافي');
      setIsAllowed(false);
      setGeofenceChecked(true);
      if (showToast) toast.error('تعذر تحديد موقعك. يرجى التأكد من تفعيل GPS وإذن الوصول للموقع.', { id: 'geo-verify' });
    } finally {
      setLoadingLocation(false);
    }
  }, [employeeId]);

  useEffect(() => {
    verifyLocationAndGeofence(false);
  }, [verifyLocationAndGeofence]);

  // ---- Camera Cleanup ----
  const stopCamera = useCallback(() => {
    if (detectIntervalRef.current) {
      clearInterval(detectIntervalRef.current);
      detectIntervalRef.current = null;
    }
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => stopCamera();
  }, [stopCamera]);

  // ---- Capture Frame & Upload ----
  const captureAndUpload = useCallback(async (): Promise<{ url?: string; notes?: string }> => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return { notes: '(فشل تقني في التقاط الصورة)' };

    const ctx = canvas.getContext('2d');
    if (!ctx) return { notes: '(فشل تقني في رسم الصورة)' };

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);

    const base64Data = canvas.toDataURL('image/webp', 0.8);
    const url = await uploadSnapshotToR2(base64Data, 'snapshot');
    return url ? { url } : { notes: '(فشل رفع الصورة للسحابة)' };
  }, []);

  // ---- Complete Action (after capture) ----
  const completeAction = useCallback(async (snapshotResult: { url?: string; notes?: string }) => {
    if (!capturingAction) return;
    setProcessing(true);
    
    try {
      const deviceId = await getDeviceFingerprint();
      
      if (capturingAction === 'checkIn') {
        await checkIn(locationText, deviceId, false, snapshotResult.url, snapshotResult.notes);
        toast.success('تم تسجيل الحضور بنجاح');
      } else {
        await checkOut(locationText, deviceId, false, snapshotResult.url, snapshotResult.notes);
        toast.success('تم تسجيل الانصراف بنجاح');
      }
      onAttendanceUpdate();
      verifyLocationAndGeofence(false);
    } catch (err: any) {
      toast.error(err.message || 'فشل تنفيذ العملية');
    } finally {
      setProcessing(false);
      setCameraOpen(false);
      setCapturingAction(null);
    }
  }, [capturingAction, locationText, checkIn, checkOut, onAttendanceUpdate, verifyLocationAndGeofence]);

  // ---- Start Face Detection Loop ----
  const startFaceDetection = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    // Create an offscreen canvas for analysis
    const analysisCanvas = document.createElement('canvas');
    let consecutiveDetected = 0;

    detectIntervalRef.current = window.setInterval(() => {
      if (capturedRef.current || !video.videoWidth) return;

      analysisCanvas.width = video.videoWidth;
      analysisCanvas.height = video.videoHeight;
      const ctx = analysisCanvas.getContext('2d');
      if (!ctx) return;

      ctx.drawImage(video, 0, 0);

      // Oval center and radii (proportional to video size)
      const cx = video.videoWidth / 2;
      const cy = video.videoHeight / 2;
      const rx = video.videoWidth * 0.28;
      const ry = video.videoHeight * 0.38;

      const detected = analyzeFaceRegion(ctx, cx, cy, rx, ry);

      if (detected) {
        consecutiveDetected++;
        if (consecutiveDetected >= STABILIZE_FRAMES && !capturedRef.current) {
          capturedRef.current = true;
          setFaceState(prev => ({ ...prev, detected: true, message: 'يرجى الثبات لثانية واحدة...' }));
          
          // Brief stabilization pause then capture
          window.setTimeout(async () => {
            const result = await captureAndUpload();
            stopCamera();
            await completeAction(result);
          }, 600);
        } else {
          setFaceState(prev => ({ ...prev, message: 'تم اكتشاف وجه... يرجى الثبات' }));
        }
      } else {
        consecutiveDetected = 0;
        setFaceState(prev => ({
          ...prev,
          detected: false,
          message: prev.countdown <= 3 ? `يرجى وضع وجهك داخل الدائرة (${prev.countdown}ث)` : 'يرجى وضع وجهك داخل الدائرة',
        }));
      }
    }, FACE_DETECT_INTERVAL_MS);
  }, [captureAndUpload, stopCamera, completeAction]);

  // ---- Open Camera & Start Process ----
  const openCamera = useCallback(async (action: 'checkIn' | 'checkOut') => {
    if (!isAllowed) {
      toast.error('لا يمكن التنفيذ: يجب أن تكون متواجداً في نطاق الدائرة');
      return;
    }

    capturedRef.current = false;
    attemptRef.current = 1;
    setCameraAttempt(1);
    setCapturingAction(action);
    setFaceState({
      detected: false, consecutiveCount: 0,
      message: 'يرجى وضع وجهك داخل الدائرة',
      countdown: FACE_DETECT_TIMEOUT_S,
    });

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 480 }, height: { ideal: 640 }, frameRate: { ideal: 15 } },
      });
      streamRef.current = stream;
      setCameraOpen(true);

      // Attach to video element after state update
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().then(() => {
            startFaceDetection();

            // Countdown timer
            let remaining = FACE_DETECT_TIMEOUT_S;
            countdownIntervalRef.current = window.setInterval(() => {
              remaining--;
              setFaceState(prev => ({ ...prev, countdown: remaining }));
              
              if (remaining <= 0 && !capturedRef.current) {
                if (attemptRef.current < 3) {
                  // Retry attempt
                  attemptRef.current += 1;
                  setCameraAttempt(attemptRef.current);
                  toast.error('انتهت المهلة يرجى اظهار وجهك داخل الدائرة');
                  setFaceState({
                    detected: false,
                    consecutiveCount: 0,
                    message: `انتهت المهلة يرجى اظهار وجهك داخل الدائرة (محاولة ${attemptRef.current} من 3)`,
                    countdown: FACE_DETECT_TIMEOUT_S,
                  });
                  remaining = FACE_DETECT_TIMEOUT_S;
                } else {
                  capturedRef.current = true;
                  // Timeout on 3rd attempt — close camera and register without photo
                  stopCamera();
                  setCameraOpen(false);
                  
                  const failNotes = '(فشل كشف الوجه بعد 3 محاولات)';
                  setProcessing(true);
                  getDeviceFingerprint().then(async (deviceId) => {
                    try {
                      if (action === 'checkIn') {
                        await checkIn(locationText, deviceId, false, undefined, failNotes);
                      } else {
                        await checkOut(locationText, deviceId, false, undefined, failNotes);
                      }
                      onAttendanceUpdate();
                      verifyLocationAndGeofence(false);
                      setAlertInfo({ show: true, action });
                    } catch (regErr: any) {
                      toast.error(regErr.message || 'فشل تنفيذ العملية');
                    } finally {
                      setProcessing(false);
                      setCapturingAction(null);
                    }
                  });
                }
              }
            }, 1000);
          });
        }
      });
    } catch (err: any) {
      console.error('Camera Error:', err);
      setCameraOpen(false);

      // Determine exact error and register with note
      let notes: string;
      if (err.name === 'NotAllowedError') {
        notes = '(صلاحية الكاميرا مرفوضة من المستخدم)';
      } else if (err.name === 'NotFoundError') {
        notes = '(لا توجد كاميرا في الجهاز)';
      } else if (err.name === 'NotReadableError') {
        notes = '(الكاميرا مستخدمة من تطبيق آخر)';
      } else {
        notes = '(تعذر فتح الكاميرا لخلل تقني)';
      }

      // Register attendance without photo
      setProcessing(true);
      try {
        const deviceId = await getDeviceFingerprint();
        if (action === 'checkIn') {
          await checkIn(locationText, deviceId, false, undefined, notes);
        } else {
          await checkOut(locationText, deviceId, false, undefined, notes);
        }
        onAttendanceUpdate();
        verifyLocationAndGeofence(false);
        setAlertInfo({ show: true, action });
      } catch (regErr: any) {
        toast.error(regErr.message || 'فشل تنفيذ العملية');
      } finally {
        setProcessing(false);
        setCapturingAction(null);
      }
    }
  }, [isAllowed, locationText, checkIn, checkOut, onAttendanceUpdate, verifyLocationAndGeofence, startFaceDetection, stopCamera]);

  // ---- Cancel Camera ----
  const cancelCamera = useCallback(() => {
    capturedRef.current = true; // prevent further captures
    stopCamera();
    setCameraOpen(false);
    setCapturingAction(null);
  }, [stopCamera]);

  // ---- Time Leave Handlers (with device fingerprint) ----
  const handleTimeLeaveOut = useCallback(async () => {
    if (!isAllowed) {
      toast.error('لا يمكن تسجيل الخروج الزمني: يجب أن تكون متواجداً في نطاق العمل');
      return;
    }
    try {
      const deviceId = await getDeviceFingerprint();
      await timeLeaveOut(locationText, deviceId, false);
      toast.success('تم تسجيل الخروج الزمني بنجاح');
      onAttendanceUpdate();
      verifyLocationAndGeofence(false);
    } catch (err: any) {
      toast.error(err.message || 'فشل تسجيل الخروج الزمني');
    }
  }, [isAllowed, locationText, timeLeaveOut, onAttendanceUpdate, verifyLocationAndGeofence]);

  const handleTimeLeaveReturn = useCallback(async () => {
    if (!isAllowed) {
      toast.error('لا يمكن تسجيل العودة: يجب أن تكون متواجداً في نطاق العمل');
      return;
    }
    try {
      const deviceId = await getDeviceFingerprint();
      await timeLeaveReturn(locationText, deviceId, false);
      toast.success('تم تسجيل العودة من الإجازة الزمنية بنجاح');
      onAttendanceUpdate();
      verifyLocationAndGeofence(false);
    } catch (err: any) {
      toast.error(err.message || 'فشل تسجيل العودة');
    }
  }, [isAllowed, locationText, timeLeaveReturn, onAttendanceUpdate, verifyLocationAndGeofence]);

  // ---- Helpers ----
  const formatTime = (timeString?: string) => {
    if (!timeString) return '--:--';
    return new Date(timeString).toLocaleTimeString('ar-SA', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const canCheckIn = !todayAttendance || (todayAttendance.check_in && todayAttendance.check_out);
  const canCheckOut = todayAttendance?.check_in && !todayAttendance?.check_out && 
                      (!todayAttendance?.time_leave_out || todayAttendance?.time_leave_return);
  const canTimeLeaveOut = todayAttendance?.check_in && !todayAttendance?.check_out && !todayAttendance?.time_leave_out;
  const canTimeLeaveReturn = todayAttendance?.time_leave_out && !todayAttendance?.time_leave_return && !todayAttendance?.check_out;

  return (
    <div className="space-y-6">
      {/* ========== Camera Overlay with Face Detection ========== */}
      <AnimatePresence>
        {cameraOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/80 flex flex-col items-center justify-center p-4"
          >
            {/* Close Button */}
            <button
              onClick={cancelCamera}
              className="absolute top-4 left-4 z-10 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-full p-2 text-white transition-colors"
            >
              <X className="w-6 h-6" />
            </button>

            {/* Camera Preview */}
            <div className="relative w-full max-w-sm aspect-[3/4] rounded-3xl overflow-hidden bg-black shadow-2xl">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover scale-x-[-1]"
              />
              
              {/* Oval Guide Overlay */}
              <div className="absolute inset-0 pointer-events-none">
                <svg width="100%" height="100%" viewBox="0 0 300 400" preserveAspectRatio="xMidYMid slice">
                  {/* Dark mask with transparent oval hole */}
                  <defs>
                    <mask id="faceMask">
                      <rect width="300" height="400" fill="white" />
                      <ellipse cx="150" cy="180" rx="85" ry="115" fill="black" />
                    </mask>
                  </defs>
                  <rect width="300" height="400" fill="rgba(0,0,0,0.5)" mask="url(#faceMask)" />
                  {/* Oval border */}
                  <ellipse
                    cx="150" cy="180" rx="85" ry="115"
                    fill="none"
                    stroke={faceState.detected ? '#22c55e' : '#ffffff'}
                    strokeWidth="3"
                    strokeDasharray={faceState.detected ? 'none' : '8 4'}
                    className="transition-all duration-300"
                  />
                </svg>
              </div>

              {/* Face Icon Hint */}
              {!faceState.detected && (
                <div className="absolute top-[22%] left-1/2 -translate-x-1/2 opacity-30 pointer-events-none">
                  <User className="w-16 h-16 text-white" />
                </div>
              )}
            </div>

            {/* Status Message */}
            <div className="mt-6 text-center">
              <p className={`text-lg font-bold transition-colors duration-300 ${faceState.detected ? 'text-emerald-400' : 'text-white'}`}>
                {faceState.message}
              </p>
              <p className="text-sm text-white/60 mt-2">
                {capturingAction === 'checkIn' ? 'تسجيل الحضور' : 'تسجيل الانصراف'} | المحاولة {cameraAttempt} من 3 — {faceState.countdown > 0 ? `متبقي ${faceState.countdown} ثانية` : 'جاري المعالجة...'}
              </p>
            </div>

            {/* Countdown Progress */}
            <div className="mt-4 w-full max-w-sm bg-white/10 rounded-full h-2 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-1000 ease-linear ${faceState.detected ? 'bg-emerald-500' : 'bg-white/40'}`}
                style={{ width: `${(faceState.countdown / FACE_DETECT_TIMEOUT_S) * 100}%` }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hidden canvas for frame capture */}
      <canvas ref={canvasRef} className="hidden" />

      {/* ========== Geofence Status Header Card ========== */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className={`rounded-2xl shadow-lg border p-6 flex flex-col md:flex-row items-center justify-between gap-4 transition-colors ${
          loadingLocation 
            ? 'bg-slate-50 border-slate-200 dark:bg-slate-800/40 dark:border-slate-700' 
            : isAllowed
              ? 'bg-emerald-50 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-900/30'
              : 'bg-rose-50 border-rose-200 dark:bg-rose-950/20 dark:border-rose-900/30'
        }`}
      >
        <div className="flex items-center gap-4 text-center md:text-right">
          <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
            loadingLocation
              ? 'bg-slate-200 text-slate-500 animate-pulse'
              : isAllowed
                ? 'bg-emerald-500 text-white'
                : 'bg-rose-500 text-white'
          }`}>
            {loadingLocation ? (
              <RefreshCw className="w-6 h-6 animate-spin" />
            ) : isAllowed ? (
              <CheckCircle className="w-6 h-6" />
            ) : (
              <AlertTriangle className="w-6 h-6" />
            )}
          </div>
          <div>
            <h3 className="font-bold text-lg leading-tight">
              {loadingLocation 
                ? 'جاري التحقق من موقعك الحالي...' 
                : isAllowed 
                  ? `أنت متواجد داخل: ${nearestLoc?.name || 'موقع العمل'}` 
                  : 'أنت خارج نطاق العمل المسموح'}
            </h3>
            <p className="text-sm mt-1 text-slate-500 dark:text-slate-400">
              {loadingLocation 
                ? 'يرجى الانتظار لحين تحديد الإحداثيات...' 
                : isAllowed
                  ? 'موقعك مطابق لشروط البصمة الجغرافية. يمكنك تسجيل الحضور والانصراف.'
                  : nearestLoc
                    ? `أقرب موقع عمل لك هو "${nearestLoc.name}" ويبعد عنك بمسافة ${nearestDistance && nearestDistance >= 1000 ? (nearestDistance / 1000).toFixed(2) + ' كيلومتر' : nearestDistance + ' متر'}. (النطاق المطلوب: 50 متر)`
                    : 'لم يتم ربطك بأي موقع عمل بعد. يرجى مراجعة المشرف العام.'}
            </p>
          </div>
        </div>

        <button
          onClick={() => verifyLocationAndGeofence(true)}
          disabled={loadingLocation}
          className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 font-bold py-2.5 px-4 rounded-xl shadow-sm transition-all flex items-center gap-2 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 text-slate-700 dark:text-slate-300"
        >
          <RefreshCw className={`w-4 h-4 ${loadingLocation ? 'animate-spin' : ''}`} />
          تحديث الموقع الجغرافي
        </button>
      </motion.div>

      {/* ========== Current Status Cards ========== */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.05 }}
        className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-100 dark:border-slate-700/50 p-6 md:p-8"
      >
        <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-6 border-b dark:border-slate-700 pb-3">حالة البصمة لليوم</h2>

        {todayAttendance?.is_device_pending ? (
          <div className="mb-6 bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-xl p-4 flex items-start gap-3 dark:bg-yellow-900/20 dark:border-yellow-900/50 dark:text-yellow-200">
            <AlertTriangle className="w-6 h-6 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold mb-1">تنبيه: جهاز غير معتمد</p>
              <p className="text-sm">
                تم تسجيل حضورك مبدئياً، لكن لاحظنا استخدامك لجهاز جديد. تم رفع طلب للإدارة لاعتماد هذا الجهاز، وستبقى حالة البصمة معلقة لحين الموافقة.
              </p>
            </div>
          </div>
        ) : null}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Check In Status */}
          <div className={`p-6 rounded-2xl border-2 transition-all ${
            todayAttendance?.check_in
              ? todayAttendance.is_device_pending
                  ? 'border-yellow-400 bg-yellow-50/50 dark:bg-yellow-900/10'
                  : 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/10'
              : 'border-gray-200 dark:border-slate-700 bg-gray-50/50 dark:bg-slate-800/40'
          }`}>
            <div className="flex items-center gap-3 mb-3">
              <LogIn className={`w-6 h-6 ${
                todayAttendance?.check_in 
                  ? todayAttendance.is_device_pending
                      ? 'text-yellow-600 dark:text-yellow-400'
                      : 'text-emerald-600 dark:text-emerald-400'
                  : 'text-gray-400 dark:text-slate-500'
              }`} />
              <span className="font-bold text-gray-800 dark:text-slate-200">وقت الحضور</span>
            </div>
            <div className="text-3xl font-extrabold text-gray-800 dark:text-white font-mono">
              {formatTime(todayAttendance?.check_in)}
            </div>
            {todayAttendance?.check_in_verified_by_biometric ? (
              <div className={`flex items-center gap-2 mt-3 text-sm font-bold ${todayAttendance.is_device_pending ? 'text-yellow-600 dark:text-yellow-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                <ShieldCheck className="w-5 h-5" />
                <span>تم التحقق بيوميترياً بنجاح</span>
              </div>
            ) : null}
          </div>

          {/* Check Out Status */}
          <div className={`p-6 rounded-2xl border-2 transition-all ${
            todayAttendance?.check_out
              ? todayAttendance.is_device_pending
                  ? 'border-yellow-400 bg-yellow-50/50 dark:bg-yellow-900/10'
                  : 'border-teal-500 bg-teal-50/50 dark:bg-teal-950/10'
              : 'border-gray-200 dark:border-slate-700 bg-gray-50/50 dark:bg-slate-800/40'
          }`}>
            <div className="flex items-center gap-3 mb-3">
              <LogOut className={`w-6 h-6 ${
                todayAttendance?.check_out 
                  ? todayAttendance.is_device_pending
                      ? 'text-yellow-600 dark:text-yellow-400'
                      : 'text-teal-600 dark:text-teal-400'
                  : 'text-gray-400 dark:text-slate-500'
              }`} />
              <span className="font-bold text-gray-800 dark:text-slate-200">وقت الانصراف</span>
            </div>
            <div className="text-3xl font-extrabold text-gray-800 dark:text-white font-mono">
              {formatTime(todayAttendance?.check_out)}
            </div>
            {todayAttendance?.check_out_verified_by_biometric ? (
              <div className={`flex items-center gap-2 mt-3 text-sm font-bold ${todayAttendance.is_device_pending ? 'text-yellow-600 dark:text-yellow-400' : 'text-teal-600 dark:text-teal-400'}`}>
                <ShieldCheck className="w-5 h-5" />
                <span>تم التحقق بيوميترياً بنجاح</span>
              </div>
            ) : null}
          </div>
        </div>

        {/* Location if available */}
        {todayAttendance?.check_in_location ? (
          <div className="mt-6 p-4 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl">
            <div className="flex items-start gap-2.5 text-slate-600 dark:text-slate-400">
              <MapPin className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-sm text-slate-800 dark:text-slate-300">موقع تسجيل الحضور المعين:</p>
                <p className="text-xs font-mono font-bold mt-1 text-slate-600 dark:text-slate-400">{todayAttendance.check_in_location}</p>
              </div>
            </div>
          </div>
        ) : null}
      </motion.div>

      {/* ========== Actions Card ========== */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-100 dark:border-slate-700/50 p-6 md:p-8"
      >
        {/* Processing Indicator */}
        {processing ? (
          <div className="mb-6 bg-slate-50 border border-slate-200 dark:bg-slate-900 dark:border-slate-700 rounded-2xl p-6 flex flex-col items-center justify-center gap-3">
            <RefreshCw className="w-8 h-8 animate-spin text-emerald-600" />
            <p className="font-bold text-slate-700 dark:text-slate-300">
              {capturingAction === 'checkIn' ? 'جاري تسجيل الحضور...' : 'جاري تسجيل الانصراف...'}
            </p>
          </div>
        ) : null}

        {/* Action Buttons */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            onClick={() => openCamera('checkIn')}
            disabled={!canCheckIn || loading || processing || cameraOpen || loadingLocation || !geofenceChecked || !isAllowed}
            className={`py-4 px-6 rounded-2xl font-bold text-white transition-all duration-300 flex flex-col items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] ${
              canCheckIn && isAllowed
                ? 'bg-emerald-600 hover:bg-emerald-700 shadow-md hover:shadow-lg shadow-emerald-600/20'
                : 'bg-slate-300 dark:bg-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed'
            }`}
          >
            <div className="flex items-center gap-2">
              <Camera className="w-5 h-5" />
              <span>تسجيل الحضور (صورة مباشرة)</span>
            </div>
          </button>

          <button
            onClick={() => openCamera('checkOut')}
            disabled={!canCheckOut || loading || processing || cameraOpen || loadingLocation || !geofenceChecked || !isAllowed}
            className={`py-4 px-6 rounded-2xl font-bold text-white transition-all duration-300 flex flex-col items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] ${
              canCheckOut && isAllowed
                ? 'bg-teal-600 hover:bg-teal-700 shadow-md hover:shadow-lg shadow-teal-600/20'
                : 'bg-slate-300 dark:bg-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed'
            }`}
          >
            <div className="flex items-center gap-2">
              <Camera className="w-5 h-5" />
              <span>تسجيل الانصراف (صورة مباشرة)</span>
            </div>
          </button>
        </div>

        {/* Time Leave Actions */}
        {(canTimeLeaveOut || canTimeLeaveReturn) ? (
          <div className="grid grid-cols-1 mt-4 gap-4 animate-in fade-in slide-in-from-top-4 duration-300">
            {canTimeLeaveOut ? (
              <button
                onClick={handleTimeLeaveOut}
                disabled={loading || processing || loadingLocation || !geofenceChecked || !isAllowed}
                className={`py-4 px-6 rounded-2xl font-bold text-white transition-all duration-300 flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] ${
                  isAllowed
                    ? 'bg-amber-500 hover:bg-amber-600 shadow-md hover:shadow-lg shadow-amber-500/20'
                    : 'bg-slate-300 dark:bg-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed'
                }`}
              >
                <LogOut className="w-5 h-5" />
                <span>خروج زمني (إجازة زمنية)</span>
              </button>
            ) : null}

            {canTimeLeaveReturn ? (
              <button
                onClick={handleTimeLeaveReturn}
                disabled={loading || processing || loadingLocation || !geofenceChecked || !isAllowed}
                className={`py-4 px-6 rounded-2xl font-bold text-white transition-all duration-300 flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] ${
                  isAllowed
                    ? 'bg-blue-600 hover:bg-blue-700 shadow-md hover:shadow-lg shadow-blue-600/20'
                    : 'bg-slate-300 dark:bg-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed'
                }`}
              >
                <LogIn className="w-5 h-5" />
                <span>عودة من الإجازة الزمنية</span>
              </button>
            ) : null}
          </div>
        ) : null}
      </motion.div>

      {/* ========== Custom Alert Modal (Unverified Registration) ========== */}
      <AnimatePresence>
        {alertInfo.show && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white dark:bg-slate-800 rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl border border-slate-100 dark:border-slate-700"
            >
              <div className="mx-auto w-16 h-16 bg-amber-50 dark:bg-amber-950/30 rounded-full flex items-center justify-center mb-6 text-amber-500">
                <AlertTriangle className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-3">
                تم تثبيت تسجيل {alertInfo.action === 'checkIn' ? 'الحضور' : 'الانصراف'} بدون تحقق
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">
                تم تثبيت الوقت في السجل باللون الأحمر وإعلام الإدارة للتحقق من الحالة والموافقة عليها.
              </p>
              <button
                onClick={() => setAlertInfo({ show: false, action: null })}
                className="w-full py-3.5 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-2xl shadow-lg shadow-amber-500/20 hover:shadow-amber-500/30 active:scale-[0.98] transition-all"
              >
                موافق
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
