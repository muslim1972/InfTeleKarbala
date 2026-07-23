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
import { useAuth } from '../../../context/AuthContext';
import { FaceEnrollment } from './FaceEnrollment';
import { useCamera } from '../hooks/useCamera';
import { useFaceDetection } from '../hooks/useFaceDetection';

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
// Manual Capture Variables
// ============================================
const CAMERA_TIMEOUT_S = 30;

interface CameraState {
  capturing: boolean;
  message: string;
  countdown: number;
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
  const { registerPunch, timeLeaveOut, timeLeaveReturn } = useAttendance(employeeId);
  const { user } = useAuth();
  const [showEnrollment, setShowEnrollment] = useState(false);
  const isEnrolled = !!user?.face_descriptor;

  const debugStatsRef = useRef({
    frames: 0,
    faces: 0,
    minDistance: 999,
    minEar: 999,
    lastDistance: 999,
    lastEar: 999,
    matchFrames: 0
  });

  const showDebugAlert = useCallback(() => {
    if (!isEnrolled) return;
    const stats = debugStatsRef.current;
    const msg = `📊 تقرير الفحص (Debug):
- اللقطات المعالجة: ${stats.frames}
- مرات رصد الوجه: ${stats.faces}
- إطارات التطابق المستمرة: ${stats.matchFrames}
- أفضل مسافة (التطابق): ${stats.minDistance === 999 ? 'N/A' : stats.minDistance.toFixed(3)} (المطلوب < 0.55)
- آخر مسافة مقاسة: ${stats.lastDistance === 999 ? 'N/A' : stats.lastDistance.toFixed(3)}
- أفضل رمشة (EAR): ${stats.minEar === 999 ? 'N/A' : stats.minEar.toFixed(3)} (المطلوب < 0.30)
- آخر EAR: ${stats.lastEar === 999 ? 'N/A' : stats.lastEar.toFixed(3)}`;
    // setTimeout(() => alert(msg), 100);
    console.log(msg); // Log to console instead of showing alert to users
  }, [isEnrolled]);

  // Location & Geofencing
  const [loadingLocation, setLoadingLocation] = useState(false);
  const [locationText, setLocationText] = useState('');
  const [geofenceChecked, setGeofenceChecked] = useState(false);
  const [isAllowed, setIsAllowed] = useState(false);
  const [nearestLoc, setNearestLoc] = useState<WorkLocation | undefined>(undefined);
  const [nearestDistance, setNearestDistance] = useState<number | null>(null);

  // Camera & Face Detection
  const [capturingAction, setCapturingAction] = useState<'punch' | null>(null);
  const [processing, setProcessing] = useState(false);
  const [alertInfo, setAlertInfo] = useState<{ show: boolean; action: 'punch' | null }>({
    show: false,
    action: null
  });
  const [cameraState, setCameraState] = useState<CameraState>({
    capturing: false,
    message: 'يرجى وضع وجهك داخل الدائرة واضغط على زر التقاط الصورة',
    countdown: CAMERA_TIMEOUT_S
  });
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const countdownIntervalRef = useRef<number | null>(null);
  const capturedRef = useRef(false);

  const { videoRef, isCameraOpen: cameraOpen, startCamera, stopCamera, captureFrame } = useCamera();
  const { loadModels, detectFaceInFrame } = useFaceDetection();

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
  const handleStopCamera = useCallback(() => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    stopCamera();
  }, [stopCamera]);

  // Cleanup on unmount
  useEffect(() => {
    return () => handleStopCamera();
  }, [handleStopCamera]);

  // ---- Capture Frame & Upload ----
  const captureAndUpload = useCallback(async (): Promise<{ url?: string; notes?: string }> => {
    try {
      if (!canvasRef.current) return { notes: '(فشل تقني في التقاط الصورة)' };

      // Stop camera and close overlay immediately to avoid UI freezing
      setProcessing(true);

      const base64Data = await captureFrame(canvasRef.current);
      handleStopCamera();

      const url = await uploadSnapshotToR2(base64Data, 'snapshot');
      return url ? { url } : { notes: '(فشل رفع الصورة للسحابة)' };
    } catch (err: any) {
      console.error('Error inside captureAndUpload:', err);
      handleStopCamera();
      return { notes: `(خطأ تقني أثناء التقاط الصورة: ${err.message || err})` };
    }
  }, [captureFrame, handleStopCamera]);

  const completeAction = useCallback(async (currentAction: 'punch', snapshotResult: { url?: string; notes?: string }) => {
    try {
      const deviceId = await getDeviceFingerprint();
      
      await registerPunch(locationText, deviceId, false, snapshotResult.url, snapshotResult.notes);
      toast.success('تم تثبيت البصمة بنجاح');
      
      onAttendanceUpdate();
      verifyLocationAndGeofence(false);
    } catch (err: any) {
      toast.error(err.message || 'فشل تنفيذ العملية');
    } finally {
      setProcessing(false);
      setCapturingAction(null);
    }
  }, [locationText, registerPunch, onAttendanceUpdate, verifyLocationAndGeofence]);

  // ---- Manual Capture Action ----
  const handleManualCapture = useCallback(() => {
    if (capturedRef.current || !capturingAction) return;
    capturedRef.current = true;
    
    // Clear auto-close timeout
    if (countdownIntervalRef.current) {
      window.clearInterval(countdownIntervalRef.current);
    }
    
    setCameraState(prev => ({ ...prev, capturing: true, message: 'ابتسم! جاري التقاط الصورة...' }));
    
    // 1 second delay to allow user to look at lens
    window.setTimeout(async () => {
      try {
        const result = await captureAndUpload();
        await completeAction(capturingAction, result);
      } catch (err: any) {
        console.error('Error in manual capture:', err);
        toast.error('فشل التقاط الصورة بسبب خلل غير متوقع');
        setProcessing(false);
        setCapturingAction(null);
      }
    }, 1000);
  }, [capturingAction, captureAndUpload, completeAction]);

  // ---- Open Camera & Start Process ----
  const startFaceDetection = useCallback(async (action: 'punch') => {
    if (!videoRef.current || !isEnrolled || !user?.face_descriptor) return;
    
    try {
      setCameraState(prev => ({ ...prev, message: 'جاري تحميل نماذج الذكاء الاصطناعي...' }));
      await loadModels();
      setCameraState(prev => ({ ...prev, message: 'تم التحميل. يرجى النظر للكاميرا ورمش العينين' }));
      toast('يرجى النظر للكاميرا ورمش العينين للمطابقة', { icon: '👀', duration: 4000 });
    } catch (err) {
      toast.error('تعذر تحميل نماذج الذكاء الاصطناعي. يرجى التأكد من جودة الإنترنت.');
      return;
    }
    
    const referenceDescriptor = new Float32Array(user.face_descriptor);

    const detectLoop = async () => {
      if (capturedRef.current || !videoRef.current) return;

      try {
        debugStatsRef.current.frames++;
        
        const { detection, distance, ear } = await detectFaceInFrame(videoRef.current, referenceDescriptor);

        if (detection) {
          debugStatsRef.current.faces++;
          debugStatsRef.current.minDistance = Math.min(debugStatsRef.current.minDistance, distance);
          debugStatsRef.current.lastDistance = distance;
          
          if (distance < 0.55) {
            debugStatsRef.current.matchFrames++;
            setCameraState(prev => ({ ...prev, message: 'وجه متطابق! يرجى الثبات أو رمش العينين...' }));
            
            debugStatsRef.current.minEar = Math.min(debugStatsRef.current.minEar, ear);
            debugStatsRef.current.lastEar = ear;

            if (ear < 0.30 || debugStatsRef.current.matchFrames >= 10) { // Threshold for blink or steady match
              // Liveness verified!
              if (capturedRef.current) return;
              capturedRef.current = true;
              
              setCameraState(prev => ({ ...prev, message: 'تم التحقق بنجاح! جاري التسجيل...' }));
              showDebugAlert();
              
              const result = await captureAndUpload();
              await completeAction(action, result);
              return; // Stop loop
            }
          } else {
            setCameraState(prev => ({ ...prev, message: 'الوجه غير متطابق. يرجى تعديل وضعيتك.' }));
          }
        } else {
          setCameraState(prev => ({ ...prev, message: 'يرجى وضع وجهك داخل الدائرة' }));
        }
      } catch (err) {
        console.error("Face detection error:", err);
      }
      
      // Continue loop
      if (!capturedRef.current) {
        requestAnimationFrame(detectLoop);
      }
    };
    
    detectLoop();
  }, [user, isEnrolled, captureAndUpload, completeAction, showDebugAlert, loadModels, detectFaceInFrame, videoRef]);

  const openCamera = useCallback(async (action: 'punch') => {
    if (!isAllowed) {
      toast.error('لا يمكن التنفيذ: يجب أن تكون متواجداً في نطاق الدائرة');
      return;
    }

    // Reset debug stats for a new session
    debugStatsRef.current = {
      frames: 0,
      faces: 0,
      minDistance: 999,
      minEar: 999,
      lastDistance: 999,
      lastEar: 999,
      matchFrames: 0
    };

    capturedRef.current = false;
    setCapturingAction(action);
    setCameraState({
      capturing: false,
      message: isEnrolled ? 'يرجى وضع وجهك داخل الدائرة للمطابقة التلقائية' : 'يرجى وضع وجهك داخل الدائرة واضغط التقاط',
      countdown: CAMERA_TIMEOUT_S,
    });

    try {
      const stream = await startCamera();

      // Attach to video element after state update
      requestAnimationFrame(() => {
        if (videoRef.current && stream) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().then(() => {
            // Start Face Detection if enrolled
            if (isEnrolled) {
              startFaceDetection(action);
            }

            // Countdown timer for automatic cancel
            let remaining = CAMERA_TIMEOUT_S;
            countdownIntervalRef.current = window.setInterval(() => {
              remaining--;
              setCameraState(prev => ({ ...prev, countdown: remaining }));
              
              if (remaining <= 0 && !capturedRef.current) {
                capturedRef.current = true;
                handleStopCamera();
                toast.error('تم إلغاء العملية لعدم التفاعل');
                if (isEnrolled) {
                  showDebugAlert();
                }
                setProcessing(false);
                setCapturingAction(null);
              }
            }, 1000);
          }).catch(err => {
             console.error("Video play error", err);
          });
        }
      });
    } catch (err: any) {
      // Determine exact error and register with note
      let notes = cameraError || '(تعذر فتح الكاميرا لخلل تقني)';

      // Register attendance without photo
      setProcessing(true);
      try {
        const deviceId = await getDeviceFingerprint();
        await registerPunch(locationText, deviceId, false, undefined, notes);
        
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
  }, [isAllowed, locationText, registerPunch, onAttendanceUpdate, verifyLocationAndGeofence, stopCamera, isEnrolled, startFaceDetection, showDebugAlert]);

  // ---- Cancel Camera ----
  const cancelCamera = useCallback(() => {
    capturedRef.current = true; // prevent further captures
    handleStopCamera();
    setCapturingAction(null);
  }, [handleStopCamera]);

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

  const canPunch = true; // Always true, logic handles it in backend

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
                    stroke={cameraState.capturing ? '#22c55e' : '#ffffff'}
                    strokeWidth="3"
                    strokeDasharray={cameraState.capturing ? 'none' : '8 4'}
                    className="transition-all duration-300"
                  />
                </svg>
              </div>

              {/* Face Icon Hint */}
              {!cameraState.capturing && (
                <div className="absolute top-[22%] left-1/2 -translate-x-1/2 opacity-30 pointer-events-none">
                  <User className="w-16 h-16 text-white" />
                </div>
              )}
            </div>

            {/* Status Message */}
            <div className="mt-6 text-center">
              <p className={`text-lg font-bold transition-colors duration-300 ${cameraState.capturing ? 'text-emerald-400' : 'text-white'}`}>
                {cameraState.message}
              </p>
              <p className="text-sm text-white/60 mt-2">
                تثبيت البصمة — {cameraState.countdown > 0 && !cameraState.capturing ? `متبقي ${cameraState.countdown} ثانية` : 'جاري المعالجة...'}
              </p>
            </div>

            {/* Manual Capture Button */}
            {!isEnrolled && (
              <div className="mt-6 w-full max-w-sm">
                <button
                  onClick={handleManualCapture}
                  disabled={cameraState.capturing}
                  className="w-full py-4 rounded-2xl bg-emerald-500 hover:bg-emerald-600 active:scale-[0.98] transition-all text-white font-bold text-xl flex items-center justify-center gap-3 disabled:opacity-50 disabled:pointer-events-none shadow-[0_4px_20px_-4px_rgba(16,185,129,0.5)]"
                >
                  <Camera className="w-6 h-6" />
                  {cameraState.capturing ? 'جاري الالتقاط...' : 'التقاط الصورة'}
                </button>
              </div>
            )}
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
              جاري تثبيت البصمة...
            </p>
          </div>
        ) : !isEnrolled ? (
          <div className="flex flex-col items-center justify-center p-6 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl text-center">
            <ShieldCheck className="w-12 h-12 text-brand-green mb-4" />
            <h3 className="font-bold text-lg text-slate-800 dark:text-white mb-2">تسجيل الوجه مطلوب</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-6 max-w-sm">
              لتمكين ميزة تسجيل الحضور الذكية، يجب أولاً توثيق بصمة وجهك بإشراف المسؤول.
            </p>
            <button
              onClick={() => setShowEnrollment(true)}
              className="bg-brand-green hover:bg-emerald-600 text-white font-bold py-3 px-6 rounded-xl transition-all shadow-lg hover:shadow-emerald-500/30 flex items-center gap-2"
            >
              <User className="w-5 h-5" />
              توثيق بصمة الوجه (يتطلب مسؤول)
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            <button
              onClick={() => openCamera('punch')}
              disabled={loading || processing || cameraOpen || loadingLocation || !geofenceChecked || !isAllowed}
              className={`py-4 px-6 rounded-2xl font-bold text-white transition-all duration-300 flex flex-col items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] ${
                isAllowed && !loading && !processing && !cameraOpen && !loadingLocation && geofenceChecked
                  ? 'bg-blue-600 hover:bg-blue-700 shadow-md hover:shadow-lg shadow-blue-600/20'
                  : 'bg-slate-300 dark:bg-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed pointer-events-none'
              }`}
            >
              <div className="flex items-center gap-2">
                <Camera className="w-5 h-5" />
                <span>تثبيت البصمة (صورة مباشرة)</span>
              </div>
            </button>
          </div>
        )}
        
        {/* Debug Camera Button */}
        <button
          onClick={async () => {
            try {
              alert(`Secure Context: ${window.isSecureContext}\nMediaDevices: ${!!navigator.mediaDevices}\nUserAgent: ${navigator.userAgent}`);
              if (!navigator.mediaDevices) return alert("navigator.mediaDevices is undefined");
              await navigator.mediaDevices.getUserMedia({ video: true });
              alert("نجح فتح الكاميرا في الفحص المبدئي!");
            } catch (e: any) {
              alert(`فشل الفحص:\nName: ${e.name}\nMessage: ${e.message}`);
            }
          }}
          className="mt-4 w-full bg-slate-200 hover:bg-slate-300 text-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-slate-300 py-2 rounded-xl font-bold text-sm transition-all"
        >
          فحص الكاميرا (للمطور)
        </button>
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

      {showEnrollment && (
        <FaceEnrollment
          employeeId={employeeId}
          onClose={() => setShowEnrollment(false)}
          onSuccess={() => {
            // Need to reload window to fetch new profile with face_descriptor
            window.location.reload();
          }}
        />
      )}
    </div>
  );
}
