'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAttendance } from '../hooks/useAttendance';
import { getLocalDateStr } from '../services/attendanceService';
import { geofenceService } from '../services/geofenceService';
import { geolocationManager } from '../../../utils/GeolocationManager';
import { uploadSnapshot } from '../utils/snapshotStorage';
import {
  getLeaveContext,
  hasLeaveOvertimeNote,
  type DayLeaveInfo,
  type TimeLeaveInfo
} from '../services/leaveIntegrationService';
import type { AttendanceRecord, WorkLocation } from '../types';
import {
  LogIn, LogOut, MapPin, CheckCircle,
  AlertTriangle, RefreshCw, Camera,
  ShieldCheck, X, User, Clock, XCircle,
  ChevronDown, ChevronUp, Radio, Laptop, Smartphone
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { type LocationTelemetryResult } from '../../../utils/antiSpoofing';
import { useAuth } from '../../../context/AuthContext';
import { FaceEnrollment } from './FaceEnrollment';
import { useCamera } from '../hooks/useCamera';
import { useFaceDetection } from '../hooks/useFaceDetection';
import { getAverageBrightness, triggerScreenFlash } from '../utils/imageEnhancement';
import { formatArabicErrorMessage } from '../../../utils/errorMessageFormatter';
import { getDeviceFingerprint } from '../../../utils/deviceFingerprint';
import { determineShiftType, validateEarlyCheckIn } from '../utils/shiftRules';

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

  // ─── تكامل الإجازات: حالة إجازات اليوم ───
  const [leaveCtx, setLeaveCtx] = useState<{ dayLeave: DayLeaveInfo | null; timeLeaves: TimeLeaveInfo[] }>({
    dayLeave: null,
    timeLeaves: []
  });
  // بصمة معلّقة بانتظار تأكيد الموظف (اليوم يوم إجازته)
  const [pendingLeavePunch, setPendingLeavePunch] = useState<{ snapshotResult: { url?: string; notes?: string } } | null>(null);
  const [confirmingPunch, setConfirmingPunch] = useState(false);

  // تاريخ محلي — toISOString() يرجع UTC فيظل «أمس» حتى 03:00 صباحاً بغداد
  // فتُعرض بانرات إجازات اليوم السابق خطأً بعد منتصف الليل
  const todayStr = getLocalDateStr();

  const loadLeaveContext = useCallback(async () => {
    const ctx = await getLeaveContext(employeeId, todayStr);
    setLeaveCtx(ctx);
  }, [employeeId, todayStr]);

  useEffect(() => {
    loadLeaveContext().catch(err => console.warn('[LeaveIntegration] تعذر جلب إجازات اليوم:', err));
  }, [loadLeaveContext]);

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
  const [telemetry, setTelemetry] = useState<LocationTelemetryResult | null>(null);
  const [showDiagnostics, setShowDiagnostics] = useState(false);

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
  const { modelsLoaded, loadModels, detectFaceInFrame } = useFaceDetection();
  const screenFlashCleanupRef = useRef<(() => void) | null>(null);

  // ---- Preload Face Models Silently on Mount ----
  useEffect(() => {
    loadModels(false).catch(err => {
      console.warn('Silent background face models preload:', err);
    });
  }, [loadModels]);

  // ---- Geofence Logic with Anti-Spoofing & Telemetry ----
  const verifyLocationAndGeofence = useCallback(async (showToast = false) => {
    setLoadingLocation(true);
    setGeofenceChecked(false);
    try {
      if (showToast) toast.loading('جاري فحص وتدقيق إحداثيات الموقع الجغرافي...', { id: 'geo-verify' });
      const { position, telemetry: telResult } = await geolocationManager.getCurrentPositionWithTelemetry();
      setTelemetry(telResult);

      const { latitude, longitude } = position.coords;
      const geofenceResult = await geofenceService.checkEmployeeGeofence(
        employeeId,
        latitude,
        longitude,
        telResult.accuracy
      );
      
      setNearestLoc(geofenceResult.nearestLocation);
      setNearestDistance(geofenceResult.distance ?? null);
      
      const locName = geofenceResult.nearestLocation?.name || 'موقع غير محدد';
      
      // كشف التزييف البرمجي الصريح (Fake GPS / Tamper)
      if (telResult.source === 'mock_suspected') {
        setIsAllowed(false);
        setLocationText(`${latitude.toFixed(6)}, ${longitude.toFixed(6)} - اشتباه تزييف موقع (Fake GPS)`);
        if (showToast) toast.error('تم رصد تزييف للموقع الجغرافي (Fake GPS)! البصمة مرفوضة.', { id: 'geo-verify' });
      } else if (geofenceResult.allowed) {
        setIsAllowed(true);
        const deviceNote = telResult.isDesktop ? 'كمبيوتر' : 'هاتف';
        setLocationText(`${latitude.toFixed(6)}, ${longitude.toFixed(6)} - ${locName} (دقة: ±${telResult.accuracy}م, ${deviceNote})`);
        
        if (showToast) {
          if (telResult.isDesktop) {
            toast('أنت داخل النطاق، ولكن الإشارة تقديرية من كمبيوتر مكتبي — يرجى الانتباه', { icon: '⚠️', id: 'geo-verify' });
          } else if (!telResult.isAccuracyValid) {
            toast('أنت داخل النطاق، ولكن دقة الـ GPS ضعيفة — يرجى تفعيل الموقع الدقيق', { icon: '⚠️', id: 'geo-verify' });
          } else {
            toast.success(`أنت الآن داخل النطاق المسموح لـ: ${locName}`, { id: 'geo-verify' });
          }
        }
      } else {
        setIsAllowed(false);
        setLocationText(`${latitude.toFixed(6)}, ${longitude.toFixed(6)} - خارج النطاق المسموح`);
        if (showToast) toast.error('أنت خارج النطاق الجغرافي المسموح لتسجيل الحضور!', { id: 'geo-verify' });
      }
      setGeofenceChecked(true);
    } catch (err: any) {
      console.error('Error fetching position:', err);
      setLocationText('تعذر تحديد الموقع الجغرافي');
      setIsAllowed(false);
      setGeofenceChecked(true);
      
      const isUnsecureHTTP = window.location.protocol === 'http:' && window.location.hostname !== 'localhost';
      const msg = isUnsecureHTTP
        ? 'يتطلب GPS رابطاً آمناً (HTTPS). يرجى الوصول عبر HTTPS أو تفعيل استثناء الرابط في المتصفح.'
        : 'تعذر تحديد موقعك. يرجى التأكد من تفعيل GPS وإذن الوصول للموقع.';

      if (showToast) toast.error(msg, { id: 'geo-verify' });
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
    if (screenFlashCleanupRef.current) {
      screenFlashCleanupRef.current();
      screenFlashCleanupRef.current = null;
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
      if (!canvasRef.current) return { notes: '(فشل تقني في التقاط الصورة: لا توجد لوحة رسم)' };

      // Stop camera and close overlay immediately to avoid UI freezing
      setProcessing(true);

      let base64Data: string;
      try {
        base64Data = await captureFrame(canvasRef.current);
      } catch (capErr: any) {
        console.error('captureFrame failed:', capErr);
        handleStopCamera();
        return { notes: `(فشل التقاط الصورة من الكاميرا: ${capErr?.message || capErr})` };
      }
      handleStopCamera();

      const upload = await uploadSnapshot(base64Data, 'snapshot');
      return upload.url
        ? { url: upload.url }
        : { notes: `(فشل رفع الصورة للسحابة: ${upload.error || 'سبب غير معروف'})` };
    } catch (err: any) {
      console.error('Error inside captureAndUpload:', err);
      handleStopCamera();
      return { notes: `(خطأ تقني أثناء التقاط الصورة: ${err.message || err})` };
    }
  }, [captureFrame, handleStopCamera]);

  const cancelPunchProcess = useCallback(() => {
    setProcessing(false);
    setCapturingAction(null);
    capturedRef.current = false;
    handleStopCamera();
    toast('تم إلغاء عملية تثبيت البصمة', { icon: '🛑' });
  }, [handleStopCamera]);

  const completeAction = useCallback(async (currentAction: 'punch', snapshotResult: { url?: string; notes?: string }) => {
    setProcessing(true);
    try {
      const deviceId = await getDeviceFingerprint();

      try {
        await registerPunch(locationText, deviceId, false, snapshotResult.url, snapshotResult.notes);
      } catch (err: any) {
        // تحذير يوم الإجازة: يوقف التثبيت ويعرض مودال التأكيد بدل الخطأ
        if (err?.isLeaveDayWarning) {
          setPendingLeavePunch({ snapshotResult });
          return;
        }
        throw err;
      }
      // تنبيه إن لم تُرفع الصورة — لا نجاح صامت يخفي الخلل عن الموظف
      // (لا نطلب إعادة المحاولة لأنها ستحسب بصمة جديدة)
      if (snapshotResult.url) {
        toast.success('تم تثبيت البصمة بنجاح');
      } else {
        toast('تم تسجيل البصمة، لكن تعذر حفظ الصورة — يرجى إبلاغ المسؤول', { icon: '⚠️', duration: 6000 });
      }

      onAttendanceUpdate();
      verifyLocationAndGeofence(false);
      loadLeaveContext();
    } catch (err: any) {
      toast.error(formatArabicErrorMessage(err, 'فشل تنفيذ عملية البصمة'));
    } finally {
      setProcessing(false);
      setCapturingAction(null);
      capturedRef.current = false;
    }
  }, [locationText, registerPunch, onAttendanceUpdate, verifyLocationAndGeofence, loadLeaveContext]);

  // ---- تأكيد البصمة في يوم الإجازة ("تثبيت البصمة رغم ذلك") ----
  const confirmLeaveDayPunch = useCallback(async () => {
    if (!pendingLeavePunch) return;
    setConfirmingPunch(true);
    try {
      const deviceId = await getDeviceFingerprint();
      await registerPunch(
        locationText,
        deviceId,
        false,
        pendingLeavePunch.snapshotResult.url,
        pendingLeavePunch.snapshotResult.notes,
        true // bypassLeaveWarning — الموظف أكّد الاستمرار رغم التنبيه
      );
      if (pendingLeavePunch.snapshotResult.url) {
        toast.success('تم تثبيت البصمة — سيُحتسب الدوام إضافياً في يوم إجازتك');
      } else {
        toast('تم تسجيل البصمة، لكن تعذر حفظ الصورة — يرجى إبلاغ المسؤول', { icon: '⚠️', duration: 6000 });
      }
      onAttendanceUpdate();
      verifyLocationAndGeofence(false);
      loadLeaveContext();
    } catch (err: any) {
      toast.error(formatArabicErrorMessage(err, 'فشل تنفيذ عملية البصمة'));
    } finally {
      setConfirmingPunch(false);
      setPendingLeavePunch(null);
    }
  }, [pendingLeavePunch, locationText, registerPunch, onAttendanceUpdate, verifyLocationAndGeofence, loadLeaveContext]);

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
      setCameraState(prev => ({ ...prev, message: 'جاري مطابقة بصمة الوجه...' }));
      await loadModels();
      setCameraState(prev => ({ ...prev, message: 'يرجى وضع وجهك داخل الدائرة ورمش العينين' }));
    } catch (err) {
      toast.error('تعذر تحميل نماذج الذكاء الاصطناعي. يرجى التأكد من جودة الإنترنت.');
      return;
    }
    
    // Determine if we have a single descriptor or an array of descriptors
    let referenceDescriptors: Float32Array[] = [];
    if (Array.isArray(user.face_descriptor)) {
      if (Array.isArray(user.face_descriptor[0])) {
        // Multiple descriptors
        referenceDescriptors = user.face_descriptor.map(d => new Float32Array(d));
      } else {
        // Single descriptor
        referenceDescriptors = [new Float32Array(user.face_descriptor)];
      }
    } else {
      toast.error('بيانات بصمة الوجه غير صالحة');
      return;
    }

    // Check for low light and activate flash if needed
    if (videoRef.current) {
      const brightness = getAverageBrightness(videoRef.current);
      if (brightness < 60) {
        toast('تم تفعيل إضاءة الشاشة نظراً لضعف الإضاءة', { icon: '💡' });
        screenFlashCleanupRef.current = triggerScreenFlash();
      }
    }

    let isDetecting = true;
    const detectLoop = async () => {
      if (capturedRef.current || !videoRef.current || !isDetecting) return;

      try {
        debugStatsRef.current.frames++;
        
        const { detection, distance, ear } = await detectFaceInFrame(videoRef.current, referenceDescriptors);

        if (detection) {
          debugStatsRef.current.faces++;
          debugStatsRef.current.minDistance = Math.min(debugStatsRef.current.minDistance, distance);
          debugStatsRef.current.lastDistance = distance;
          
          if (distance < 0.64) {
            debugStatsRef.current.matchFrames++;
            setCameraState(prev => ({ ...prev, message: 'تم رصد الوجه! يرجى الثبات أو رمش العينين...' }));
            
            debugStatsRef.current.minEar = Math.min(debugStatsRef.current.minEar, ear);
            debugStatsRef.current.lastEar = ear;

            if (ear < 0.32 || debugStatsRef.current.matchFrames >= 2) { // Instant match threshold (~ 0.25s)
              // Liveness verified!
              if (capturedRef.current) return;
              capturedRef.current = true;
              
              setCameraState(prev => ({ ...prev, message: 'تم التحقق بنجاح! جاري تثبيت البصمة...' }));
              showDebugAlert();
              
              try {
                const result = await captureAndUpload();
                await completeAction(action, result);
              } catch (actErr: any) {
                console.error('Face verification action failed:', actErr);
                toast.error(formatArabicErrorMessage(actErr, 'تعذر تثبيت البصمة'));
                setProcessing(false);
                setCapturingAction(null);
                capturedRef.current = false;
              }
              return; // Stop loop
            }
          } else {
            // Reset match frames if face distance exceeds threshold
            debugStatsRef.current.matchFrames = 0;
            setCameraState(prev => ({ ...prev, message: 'يرجى التوجيه المباشر نحو الكاميرا داخل الإطار' }));
          }
        } else {
          // Reset match frames if no face detected
          debugStatsRef.current.matchFrames = 0;
          setCameraState(prev => ({ ...prev, message: 'يرجى وضع وجهك داخل الإطار البيضاوي' }));
        }
      } catch (err: any) {
        if (!err?.message?.includes('Models not loaded')) {
          console.warn("Face detection warning:", err);
        }
      }
      
      // Continue loop with a small delay instead of requestAnimationFrame to give processing time
      if (!capturedRef.current && isDetecting) {
        setTimeout(detectLoop, 150);
      }
    };
    
    // Add small delay for camera to stabilize its auto-exposure and auto-focus
    setTimeout(detectLoop, 300);

    return () => { isDetecting = false; };
  }, [user?.id, user?.face_descriptor, isEnrolled, captureAndUpload, completeAction, showDebugAlert, loadModels, detectFaceInFrame, videoRef]);

  const openCamera = useCallback(async (action: 'punch') => {
    if (!isAllowed) {
      toast.error('لا يمكن التنفيذ: يجب أن تكون متواجداً في نطاق الدائرة');
      return;
    }

    const shiftType = determineShiftType(user, null);
    const hasExistingPunch = Boolean(todayAttendance?.check_in);
    if (!hasExistingPunch) {
      const earlyCheck = validateEarlyCheckIn(shiftType, new Date());
      if (!earlyCheck.allowed) {
        toast.error(earlyCheck.message || 'لا يسمح بتثبيت الحضور قبل 6:30ص');
        return;
      }
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
              // Wait a bit for the camera to adjust lighting before starting detection
              setTimeout(() => {
                 startFaceDetection(action);
              }, 500);
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
      let notes = err?.message || '(تعذر فتح الكاميرا لخلل تقني)';

      // Register attendance without photo
      setProcessing(true);
      try {
        const deviceId = await getDeviceFingerprint();
        try {
          await registerPunch(locationText, deviceId, false, undefined, notes);
        } catch (regErr: any) {
          // تحذير يوم الإجازة: مودال تأكيد بدل تسجيل مباشر
          if (regErr?.isLeaveDayWarning) {
            setPendingLeavePunch({ snapshotResult: { notes } });
            return;
          }
          throw regErr;
        }

        onAttendanceUpdate();
        verifyLocationAndGeofence(false);
        loadLeaveContext();
        setAlertInfo({ show: true, action });
      } catch (regErr: any) {
        toast.error(formatArabicErrorMessage(regErr, 'فشل تنفيذ العملية'));
      } finally {
        setProcessing(false);
        setCapturingAction(null);
      }
    }
  }, [isAllowed, locationText, registerPunch, onAttendanceUpdate, verifyLocationAndGeofence, loadLeaveContext, stopCamera, isEnrolled, startFaceDetection, showDebugAlert]);

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
      toast.error(formatArabicErrorMessage(err, 'فشل تسجيل الخروج الزمني'));
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
      toast.error(formatArabicErrorMessage(err, 'فشل تسجيل العودة'));
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
                : telemetry?.source === 'mock_suspected'
                  ? '⛔ تم رصد تزييف للموقع الجغرافي (Fake GPS)'
                  : isAllowed 
                    ? `أنت متواجد داخل: ${nearestLoc?.name || 'موقع العمل'}` 
                    : 'أنت خارج نطاق العمل المسموح'}
            </h3>
            <p className="text-sm mt-1 text-slate-500 dark:text-slate-400">
              {loadingLocation 
                ? 'يرجى الانتظار لحين تحديد الإحداثيات...' 
                : telemetry?.source === 'mock_suspected'
                  ? 'تم رصد إحداثيات مصمتة غير طبيعية تشير إلى استخدام تطبيق Fake GPS. تم حظر تثبيت البصمة تلقائياً.'
                  : isAllowed
                    ? 'موقعك مطابق لشروط البصمة الجغرافية. يمكنك تسجيل الحضور والانصراف.'
                    : nearestLoc
                      ? `أقرب موقع عمل لك هو "${nearestLoc.name}" ويبعد عنك بمسافة ${nearestDistance && nearestDistance >= 1000 ? (nearestDistance / 1000).toFixed(2) + ' كيلومتر' : Math.round(nearestDistance || 0) + ' متر'}. (النطاق المطلوب: ${nearestLoc.radius_meters} متر)`
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

      {/* ========== Telemetry & Anti-Spoofing Diagnostic Panel ========== */}
      {telemetry && (
        <motion.div
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/60 backdrop-blur-sm p-4 text-xs text-slate-600 dark:text-slate-300 shadow-sm"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="flex items-center gap-1 font-bold text-slate-800 dark:text-slate-200">
                <Radio className="w-4 h-4 text-indigo-500 animate-pulse" />
                بيانات التتبع الجغرافي والأمان:
              </span>
              <span className="font-mono dir-ltr bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-slate-700 dark:text-slate-300 font-semibold">
                {telemetry.latitude.toFixed(6)}, {telemetry.longitude.toFixed(6)}
              </span>
              <a
                href={`https://www.google.com/maps?q=${telemetry.latitude},${telemetry.longitude}`}
                target="_blank"
                rel="noreferrer"
                className="text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-0.5"
              >
                (عرض في الخريطة)
              </a>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Badge: Accuracy */}
              <span className={`px-2.5 py-1 rounded-full font-bold flex items-center gap-1 ${
                telemetry.accuracy <= 30
                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                  : telemetry.accuracy <= 65
                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300'
                    : 'bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300'
              }`}>
                <span>دقة الإشارة: ±{telemetry.accuracy} متر</span>
                {telemetry.accuracy <= 30 ? ' (GPS عالي الدقة)' : ' (تقدير تقريبي)'}
              </span>

              {/* Badge: Device */}
              <span className={`px-2.5 py-1 rounded-full font-bold flex items-center gap-1 ${
                telemetry.isDesktop
                  ? 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                  : 'bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300'
              }`}>
                {telemetry.isDesktop ? <Laptop className="w-3.5 h-3.5" /> : <Smartphone className="w-3.5 h-3.5" />}
                <span>{telemetry.isDesktop ? 'كمبيوتر مكتبي (شبكي)' : 'هاتف ذكي'}</span>
              </span>

              {/* Toggle details */}
              <button
                type="button"
                onClick={() => setShowDiagnostics(prev => !prev)}
                className="text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 p-1"
                title="تفاصيل تقرير الأمان"
              >
                {showDiagnostics ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Warning banner if desktop or weak accuracy */}
          {(telemetry.isDesktop || !telemetry.isAccuracyValid) && (
            <div className="mt-3 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 flex items-start gap-2.5">
              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
              <div className="leading-relaxed">
                <p className="font-bold">تنبيه فني بشأن دقة ومصدر الموقع الجغرافي:</p>
                <p className="text-xs mt-0.5 opacity-90">
                  {telemetry.warningMessage || (
                    telemetry.isDesktop
                      ? 'أجهزة الحاسوب المكتبية لا تحتوي على شريحة أقمار صناعية حقيقية (GPS)، ويتم استنتاج الإحداثيات عبر راوتر الـ Wi-Fi أو مزود الإنترنت بهامش خطأ. لضمان التواجد الفعلي داخل الدائرة بدون أي التباس، يوصى بالبصمة من الهاتف الذكي.'
                      : `هامش الخطأ في موقعك الحالي (±${telemetry.accuracy}م) أعلى من المعتاد. يرجى تفعيل الموقع الدقيق في هاتفك.`
                  )}
                </p>
              </div>
            </div>
          )}

          {/* Collapsible details */}
          {showDiagnostics && (
            <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
              <div>
                <span className="text-slate-400 block">مصدر الإشارة:</span>
                <span className="font-semibold">{telemetry.sourceLabelAr}</span>
              </div>
              <div>
                <span className="text-slate-400 block">مؤشر التذبذب الطبيعي:</span>
                <span className={`font-semibold ${telemetry.isJitterValid ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {telemetry.isJitterValid ? 'طبيعي وموثوق' : 'غير طبيعي (اشتباه Fake GPS)'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block">سلامة بروتوكول المتصفح:</span>
                <span className={`font-semibold ${!telemetry.isPrototypeTampered ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {!telemetry.isPrototypeTampered ? 'أصلي (Native)' : 'معدل (Tampered)'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block">المسافة لأقرب موقع:</span>
                <span className="font-semibold font-mono">
                  {nearestDistance !== null ? `${nearestDistance} متر` : 'غير محدد'}
                </span>
              </div>
            </div>
          )}
        </motion.div>
      )}

      {/* ========== تكامل الإجازات: بانرات حالة اليوم ========== */}
      {/* إجازة يوم كامل (اعتيادية/مرضية/واجب/إيفاد) قبل أول بصمة */}
      {leaveCtx.dayLeave && !todayAttendance?.check_in && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl shadow-lg border border-orange-300 bg-orange-50 dark:bg-orange-950/20 dark:border-orange-900/40 p-5 flex items-start gap-3"
        >
          <div className="w-10 h-10 rounded-full bg-orange-500 text-white flex items-center justify-center shrink-0">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <p className="font-bold text-orange-800 dark:text-orange-300">{leaveCtx.dayLeave.warningMessage}</p>
            <p className="text-sm mt-1 text-orange-700/90 dark:text-orange-400/90 leading-relaxed">
              إن ثبتت بصمة الحضور اليوم سيُحتسب الدوام «دواماً إضافياً في يوم إجازة».
            </p>
          </div>
        </motion.div>
      )}

      {/* تأكيد: بصمة اليوم مسجّلة كدوام إضافي في يوم إجازة */}
      {todayAttendance?.check_in && hasLeaveOvertimeNote(todayAttendance.notes) && (
        <div className="rounded-2xl border border-orange-300 bg-orange-50 dark:bg-orange-950/20 dark:border-orange-900/40 p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-orange-500 shrink-0 mt-0.5" />
          <p className="text-sm font-bold text-orange-800 dark:text-orange-300">
            دوام اليوم مسجَّل كدوام إضافي في يوم إجازتك.
          </p>
        </div>
      )}

      {/* إجازات زمنية معتمدة اليوم: تعليمات بصمات الخروج/العودة */}
      {leaveCtx.timeLeaves.length > 0 && !todayAttendance?.check_out && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl shadow-lg border border-indigo-200 bg-indigo-50 dark:bg-indigo-950/20 dark:border-indigo-900/40 p-5 flex items-start gap-3"
        >
          <div className="w-10 h-10 rounded-full bg-indigo-500 text-white flex items-center justify-center shrink-0">
            <Clock className="w-5 h-5" />
          </div>
          <div className="space-y-1.5">
            {leaveCtx.timeLeaves.map(l => (
              <div key={l.id}>
                <p className="font-bold text-indigo-800 dark:text-indigo-300">
                  إجازة زمنية معتمدة ({l.minutes} دقيقة){l.subtype === 'mid_shift' ? ' — وسط الدوام' : l.subtype === 'shift_start' ? ' — بداية الدوام' : l.subtype === 'shift_end' ? ' — نهاية الدوام' : ''}
                </p>
                <p className="text-sm text-indigo-700/90 dark:text-indigo-400/90 leading-relaxed">
                  {l.subtype === 'shift_start'
                    ? 'الدخول المتأخر مرخّص لك اليوم؛ سجّل بصمة الحضور عند وصولك للدوام.'
                    : l.subtype === 'shift_end'
                      ? 'الخروج المبكر مرخّص لك اليوم؛ سجّل بصمة الانصراف عند مغادرتك.'
                      : 'عند مغادرتك سجّل بصمة خروج زمني وعند عودتك بصمة عودة، وإلا يظهر تنبيه «لم يثبت بصمة خروج/عودة» في السجلات والتقارير.'}
                </p>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* تذكير حي: خارج الدوام حالياً (خروج زمني) ولم يرجع */}
      {todayAttendance?.time_leave_out && !todayAttendance?.time_leave_return && !todayAttendance?.time_leave_return_2 && !todayAttendance?.check_out && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-900/40 p-4 flex items-start gap-3">
          <LogIn className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <p className="text-sm font-bold text-amber-800 dark:text-amber-300">
            أنت خارج الدوام حالياً (خروج زمني) — لا تنسَ تسجيل بصمة العودة عند رجوعك، وإلا يظهر تنبيه في السجلات والتقارير.
          </p>
        </div>
      )}

      {/* ========== Current Status Cards ========== */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.05 }}
        className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-100 dark:border-slate-700/50 p-6 md:p-8"
      >
        <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-6 border-b dark:border-slate-700 pb-3">حالة البصمة لليوم</h2>

        {todayAttendance?.is_device_pending ? (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-800 rounded-xl p-4 flex items-start gap-3 dark:bg-red-900/20 dark:border-red-900/50 dark:text-red-200">
            <AlertTriangle className="w-6 h-6 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold mb-1">تنبيه: جهاز غير معتمد</p>
              <p className="text-sm">
                تم تسجيل بصمتك باللون الأحمر نظراً لاستخدامك جهاز جديد غير معتمد. تم توجيه إشعار لمشرف البصمة للموافقة، وستبقى الحالة معلقة لحين الاعتماد.
              </p>
            </div>
          </div>
        ) : null}

        {(() => {
          const isVirtualIn = todayAttendance?.notes?.includes('دخول اولي افتراضي');
          const isVirtualOut = todayAttendance?.notes?.includes('خروج نهائي افتراضي');

          return (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {/* 1. Main Check-In */}
              <div className={`p-4 rounded-xl border transition-all ${
                todayAttendance?.check_in
                  ? (todayAttendance.is_device_pending || isVirtualIn)
                      ? 'border-red-400 bg-red-50/70 dark:bg-red-950/30'
                      : 'border-emerald-300 bg-emerald-50/60 dark:bg-emerald-950/20'
                  : 'border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40'
              }`}>
                <div className="flex items-center justify-between mb-1.5 text-xs">
                  <div className="flex items-center gap-1.5">
                    <LogIn className={`w-4 h-4 ${
                      todayAttendance?.check_in 
                        ? (todayAttendance.is_device_pending || isVirtualIn) ? 'text-red-500' : 'text-emerald-500'
                        : 'text-slate-400'
                    }`} />
                    <span className="font-bold text-slate-700 dark:text-slate-300">دخول رئيسي</span>
                  </div>
                  {isVirtualIn && (
                    <span className="text-[10px] bg-red-100 text-red-700 font-bold px-1.5 py-0.5 rounded">
                      افتراضي
                    </span>
                  )}
                </div>
                <div className={`text-xl font-extrabold font-mono ${
                  todayAttendance?.check_in
                    ? (todayAttendance.is_device_pending || isVirtualIn) ? 'text-red-600 dark:text-red-400' : 'text-emerald-700 dark:text-emerald-300'
                    : 'text-slate-400 dark:text-slate-500'
                }`}>
                  {formatTime(todayAttendance?.check_in)}
                </div>
              </div>

              {/* 2. Break 1 Out */}
              <div className={`p-4 rounded-xl border transition-all ${
                todayAttendance?.time_leave_out
                  ? 'border-amber-300 bg-amber-50/60 dark:bg-amber-950/20'
                  : 'border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40'
              }`}>
                <div className="flex items-center gap-1.5 mb-1.5 text-xs">
                  <LogOut className={`w-4 h-4 ${todayAttendance?.time_leave_out ? 'text-amber-500' : 'text-slate-400'}`} />
                  <span className="font-bold text-slate-700 dark:text-slate-300">ب. استراحة 1</span>
                </div>
                <div className={`text-xl font-extrabold font-mono ${
                  todayAttendance?.time_leave_out ? 'text-amber-700 dark:text-amber-300' : 'text-slate-400 dark:text-slate-500'
                }`}>
                  {formatTime(todayAttendance?.time_leave_out)}
                </div>
              </div>

              {/* 3. Break 1 Return */}
              <div className={`p-4 rounded-xl border transition-all ${
                todayAttendance?.time_leave_return
                  ? 'border-indigo-300 bg-indigo-50/60 dark:bg-indigo-950/20'
                  : 'border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40'
              }`}>
                <div className="flex items-center gap-1.5 mb-1.5 text-xs">
                  <LogIn className={`w-4 h-4 ${todayAttendance?.time_leave_return ? 'text-indigo-500' : 'text-slate-400'}`} />
                  <span className="font-bold text-slate-700 dark:text-slate-300">ع. استراحة 1</span>
                </div>
                <div className={`text-xl font-extrabold font-mono ${
                  todayAttendance?.time_leave_return ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-400 dark:text-slate-500'
                }`}>
                  {formatTime(todayAttendance?.time_leave_return)}
                </div>
              </div>

              {/* 4. Break 2 Out */}
              <div className={`p-4 rounded-xl border transition-all ${
                todayAttendance?.time_leave_out_2
                  ? 'border-amber-300 bg-amber-50/60 dark:bg-amber-950/20'
                  : 'border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40'
              }`}>
                <div className="flex items-center gap-1.5 mb-1.5 text-xs">
                  <LogOut className={`w-4 h-4 ${todayAttendance?.time_leave_out_2 ? 'text-amber-500' : 'text-slate-400'}`} />
                  <span className="font-bold text-slate-700 dark:text-slate-300">ب. استراحة 2</span>
                </div>
                <div className={`text-xl font-extrabold font-mono ${
                  todayAttendance?.time_leave_out_2 ? 'text-amber-700 dark:text-amber-300' : 'text-slate-400 dark:text-slate-500'
                }`}>
                  {formatTime(todayAttendance?.time_leave_out_2)}
                </div>
              </div>

              {/* 5. Break 2 Return */}
              <div className={`p-4 rounded-xl border transition-all ${
                todayAttendance?.time_leave_return_2
                  ? 'border-indigo-300 bg-indigo-50/60 dark:bg-indigo-950/20'
                  : 'border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40'
              }`}>
                <div className="flex items-center gap-1.5 mb-1.5 text-xs">
                  <LogIn className={`w-4 h-4 ${todayAttendance?.time_leave_return_2 ? 'text-indigo-500' : 'text-slate-400'}`} />
                  <span className="font-bold text-slate-700 dark:text-slate-300">ع. استراحة 2</span>
                </div>
                <div className={`text-xl font-extrabold font-mono ${
                  todayAttendance?.time_leave_return_2 ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-400 dark:text-slate-500'
                }`}>
                  {formatTime(todayAttendance?.time_leave_return_2)}
                </div>
              </div>

              {/* 6. Main Check-Out */}
              <div className={`p-4 rounded-xl border transition-all ${
                todayAttendance?.check_out
                  ? (todayAttendance.is_device_pending || isVirtualOut)
                      ? 'border-red-400 bg-red-50/70 dark:bg-red-950/30'
                      : 'border-teal-300 bg-teal-50/60 dark:bg-teal-950/20'
                  : 'border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40'
              }`}>
                <div className="flex items-center justify-between mb-1.5 text-xs">
                  <div className="flex items-center gap-1.5">
                    <LogOut className={`w-4 h-4 ${
                      todayAttendance?.check_out 
                        ? (todayAttendance.is_device_pending || isVirtualOut) ? 'text-red-500' : 'text-teal-500'
                        : 'text-slate-400'
                    }`} />
                    <span className="font-bold text-slate-700 dark:text-slate-300">انصراف نهائي</span>
                  </div>
                  {isVirtualOut && (
                    <span className="text-[10px] bg-red-100 text-red-700 font-bold px-1.5 py-0.5 rounded">
                      افتراضي
                    </span>
                  )}
                </div>
                <div className={`text-xl font-extrabold font-mono ${
                  todayAttendance?.check_out
                    ? (todayAttendance.is_device_pending || isVirtualOut) ? 'text-red-600 dark:text-red-400' : 'text-teal-700 dark:text-teal-300'
                    : 'text-slate-400 dark:text-slate-500'
                }`}>
                  {formatTime(todayAttendance?.check_out)}
                </div>
              </div>
            </div>
          );
        })()}

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
          <div className="mb-6 bg-slate-50 border border-slate-200 dark:bg-slate-900 dark:border-slate-700 rounded-2xl p-6 flex flex-col items-center justify-center gap-4">
            <div className="flex items-center gap-3">
              <RefreshCw className="w-8 h-8 animate-spin text-emerald-600" />
              <p className="font-bold text-base text-slate-800 dark:text-slate-200">
                جاري تثبيت البصمة...
              </p>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 text-center">
              يرجى الانتظار ثوانٍ معدودة لحفظ وتوثيق الحركة
            </p>
            <button
              type="button"
              onClick={cancelPunchProcess}
              className="mt-1 px-5 py-2.5 bg-red-50 hover:bg-red-100 dark:bg-red-950/40 dark:hover:bg-red-900/60 text-red-600 dark:text-red-400 text-sm font-bold rounded-xl border border-red-200 dark:border-red-800/50 transition-all flex items-center gap-2 shadow-sm active:scale-95 cursor-pointer"
            >
              <XCircle className="w-4 h-4" />
              <span>إلغاء ومقاطعة العملية</span>
            </button>
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

            {isEnrolled && (
              <button
                onClick={() => setShowEnrollment(true)}
                disabled={loading || processing || cameraOpen}
                className="py-3 px-6 rounded-2xl border-2 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-all flex items-center justify-center gap-2 mt-2"
              >
                <RefreshCw className="w-4 h-4" />
                إعادة تسجيل الوجه (بحضور المسؤول)
              </button>
            )}
          </div>
        )}
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

      {/* ========== مودال تأكيد البصمة في يوم الإجازة (تكامل الإجازات) ========== */}
      <AnimatePresence>
        {pendingLeavePunch && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white dark:bg-slate-800 rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl border border-orange-200 dark:border-orange-900/40"
            >
              <div className="mx-auto w-16 h-16 bg-orange-50 dark:bg-orange-950/30 rounded-full flex items-center justify-center mb-6 text-orange-500">
                <Clock className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-3">
                {leaveCtx.dayLeave?.warningMessage || 'اليوم من أيام إجازتك المعتمدة'}
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">
                إذا ثبّت البصمة الآن سيُسجَّل دوامك كـ«دوام إضافي في يوم إجازة
                {leaveCtx.dayLeave ? ` (${leaveCtx.dayLeave.label})` : ''}» وتظهر أوقاتك باللون البرتقالي في التقارير.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setPendingLeavePunch(null)}
                  disabled={confirmingPunch}
                  className="py-3.5 rounded-2xl border-2 border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-50 dark:hover:bg-slate-700 transition-all disabled:opacity-50"
                >
                  إلغاء
                </button>
                <button
                  onClick={confirmLeaveDayPunch}
                  disabled={confirmingPunch}
                  className="py-3.5 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-2xl shadow-lg shadow-orange-500/20 hover:shadow-orange-500/30 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {confirmingPunch ? <RefreshCw className="w-4 h-4 animate-spin" /> : null}
                  تثبيت البصمة رغم ذلك
                </button>
              </div>
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
